import axios from 'axios';
import type { LeadSource, RawLead } from './types.ts';
import { logger, metrics } from '../../lib/monitoring.ts';
import { OSMCategoryMapper } from './osmCategoryMapper.ts';
import { ChainFilter } from './chainFilter.ts';
import { ValidationService } from '../leadService.ts';
import { SocialEnrichmentService } from '../socialEnrichmentService.ts';

// Fast in-memory query cache with 1-hour TTL
const queryCache = new Map<string, { leads: RawLead[]; timestamp: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000;

export class OSMSource implements LeadSource {
  private globalOverpassUrls = [
    'https://overpass.openstreetmap.fr/api/interpreter',
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
    'https://lz4.overpass-api.de/api/interpreter'
  ];
  private swissOverpassUrl = 'https://overpass.osm.ch/api/interpreter';

  async search(criteria: { 
    country?: string; 
    city?: string; 
    category?: string; 
    keyword?: string; 
    limit?: number;
    bbox?: { minLat: number; maxLat: number; minLon: number; maxLon: number };
    localOnly?: boolean;
    requireContactInfo?: boolean;
  }): Promise<RawLead[]> {
    const startTime = Date.now();
    const country = criteria.country ? criteria.country.trim() : undefined;
    const city = criteria.city ? criteria.city.trim() : undefined;
    const category = criteria.category ? criteria.category.trim() : undefined;
    const { limit = 50, bbox } = criteria;
    
    // Check Cache
    const cacheKey = `${(category || '').toLowerCase()}:${(city || '').toLowerCase()}:${(country || '').toLowerCase()}:${bbox ? `${bbox.minLat.toFixed(3)},${bbox.minLon.toFixed(3)}` : ''}:${criteria.localOnly}:${criteria.requireContactInfo}`;
    const cached = queryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.leads.slice(0, limit);
    }

    let activeBbox = bbox;
    if (!activeBbox && (city || country)) {
      try {
        const { GridPartitionService } = await import('../gridPartitionService.ts');
        const loc = [city, country].filter(Boolean).join(', ');
        const resolved = await GridPartitionService.getBoundingBox(loc);
        if (resolved) {
          activeBbox = resolved;
        }
      } catch {
        // Fallback to area part
      }
    }

    let areaPart = '';
    if (!activeBbox) {
      if (city && country) {
        areaPart = `area["name"="${city}"]->.searchArea;`;
      } else if (city) {
        areaPart = `area["name"="${city}"]->.searchArea;`;
      } else if (country) {
        areaPart = `area["name"="${country}"]->.searchArea;`;
      }
    }

    const bboxDecl = activeBbox ? `[bbox:${activeBbox.minLat},${activeBbox.minLon},${activeBbox.maxLat},${activeBbox.maxLon}]` : '';
    const queryParts = category ? OSMCategoryMapper.getNWRQueryParts(category) : [
      'nwr["amenity"];',
      'nwr["shop"];',
      'nwr["office"];',
      'nwr["craft"];'
    ];

    const finalQueryParts = queryParts.map(part => {
      if (activeBbox || !areaPart) return part;
      return part.replace(';', '(area.searchArea);');
    });

    const query = `
      [out:json][timeout:15]${bboxDecl};
      ${activeBbox ? '' : areaPart}
      (
        ${finalQueryParts.join('\n        ')}
      );
      out center ${limit};
    `;

    try {
      let response: any;
      let attemptCount = 0;
      let lastError: any = null;

      const locLower = `${country || ''} ${city || ''}`.toLowerCase();
      const isSwitzerland = locLower.includes('switz') || locLower.includes('suisse') ||
        ['geneve', 'genève', 'geneva', 'lausanne', 'zurich', 'zürich', 'bale', 'bâle', 'basel', 'berne', 'bern', 'neuchatel', 'neuchâtel', 'fribourg', 'lugano'].some(c => locLower.includes(c));
      const endpointsToTry = isSwitzerland
        ? [this.swissOverpassUrl, ...this.globalOverpassUrls]
        : this.globalOverpassUrls;

      for (const endpoint of endpointsToTry) {
        attemptCount++;
        try {
          response = await axios.post(endpoint, 'data=' + encodeURIComponent(query), {
            headers: { 
              'Content-Type': 'application/x-www-form-urlencoded',
              'User-Agent': 'LeadForge-Discovery/2.5',
              'Referer': 'https://leadforge.app/'
            },
            timeout: 8500
          });
          
          if (Array.isArray(response?.data?.elements)) {
            // Never stop early on an empty response from the regional Swiss mirror
            if (endpoint === this.swissOverpassUrl && response.data.elements.length === 0) {
              continue;
            }
            if (attemptCount > 1) {
              await metrics.record('SOURCE', 'OSM', 'RETRY_SUCCESS', Date.now() - startTime, { criteria, endpoint, attemptCount });
            } else {
              await metrics.record('SOURCE', 'OSM', 'SUCCESS', Date.now() - startTime, { criteria, endpoint });
            }
            break;
          }
        } catch (err: any) {
          lastError = err;
          const status = err.response?.status;
          const isTimeout = err.code === 'ECONNABORTED' || status === 504 || status === 502;
          
          await logger.warn('OSM', `Mirror ${endpoint} attempt ${attemptCount} failed (${status || err.code}): ${err.message}`, { 
            status, 
            code: err.code,
            endpoint,
            criteria,
            isTimeout
          }, 'OSM_API');

          // Rapid failover
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      if (!response?.data && lastError) {
        await metrics.record('SOURCE', 'OSM', 'FAILURE', Date.now() - startTime, { criteria, attemptCount, error: lastError.message });
      }

      const elements = response?.data?.elements || [];
      const results: RawLead[] = [];

      let chainsExcludedCount = 0;

      for (const el of elements) {
        if (!el.tags || !el.tags.name) continue;
        const tags = el.tags;

        // Discard unverified / non-business / generic entities
        if (ValidationService.isInvalidBusinessName(tags.name)) {
          continue;
        }

        // Filter out mega-chains, famous franchises, and multinational brands
        if (criteria.localOnly !== false && ChainFilter.isChainOrMajorBrand(tags, tags.name)) {
          chainsExcludedCount++;
          continue;
        }

        const street = tags['addr:street'] || '';
        const houseNr = tags['addr:housenumber'] || '';
        const postcode = tags['addr:postcode'] || '';
        const address = [street, houseNr, postcode].filter(Boolean).join(' ').trim();

        const lat = el.lat ?? el.center?.lat;
        const lon = el.lon ?? el.center?.lon;

        // Comprehensive Contact & Social Tag Extraction
        const rawPhone = tags.phone || tags['contact:phone'] || tags['phone:mobile'] || tags.mobile || 
                         tags['contact:mobile'] || tags['telephone'] || tags['contact:telephone'] || tags.tel;
        const phone = rawPhone && ValidationService.validatePhone(String(rawPhone)) ? String(rawPhone).trim() : undefined;

        const rawWa = tags['contact:whatsapp'] || tags.whatsapp;
        const whatsapp = rawWa && (ValidationService.validatePhone(String(rawWa)) || String(rawWa).toLowerCase().includes('wa.me'))
          ? String(rawWa).trim()
          : undefined;

        const rawWebCandidate = tags.website || tags['contact:website'] || tags.url || tags['contact:url'] || 
                                tags['contact:web'] || tags['website:official'] || tags['website:menu'];

        const normalizedFb = SocialEnrichmentService.normalizeFacebookUrl(tags['contact:facebook'] || tags.facebook || (rawWebCandidate?.includes('facebook.com') ? rawWebCandidate : undefined));
        const normalizedInsta = SocialEnrichmentService.normalizeInstagramUrl(tags['contact:instagram'] || tags.instagram || (rawWebCandidate?.includes('instagram.com') ? rawWebCandidate : undefined));
        const normalizedLi = SocialEnrichmentService.normalizeLinkedInUrl(tags['contact:linkedin'] || tags.linkedin || (rawWebCandidate?.includes('linkedin.com') ? rawWebCandidate : undefined));
        const normalizedTw = SocialEnrichmentService.normalizeTwitterUrl(tags['contact:twitter'] || tags.twitter || (rawWebCandidate?.includes('twitter.com') || rawWebCandidate?.includes('x.com') ? rawWebCandidate : undefined));
        const rawYt = tags['contact:youtube'] || tags.youtube;
        const normalizedYt = rawYt && (String(rawYt).includes('youtube.com') || String(rawYt).includes('youtu.be')) ? String(rawYt).trim() : undefined;
        const rawTt = tags['contact:tiktok'] || tags.tiktok;
        const normalizedTt = rawTt && String(rawTt).includes('tiktok.com') ? String(rawTt).trim() : undefined;

        // Official website: ONLY genuine website, never social profile or directory
        let cleanOfficialWebsite: string | undefined = undefined;
        if (rawWebCandidate && !ValidationService.isSocialOrDirectoryUrl(rawWebCandidate)) {
          cleanOfficialWebsite = rawWebCandidate.trim();
        }

        const rawEmail = tags.email || tags['contact:email'] || tags['email:contact'];
        const email = rawEmail && ValidationService.validateEmail(String(rawEmail)) ? String(rawEmail).trim().toLowerCase() : undefined;
        const openingHours = tags.opening_hours || tags['contact:opening_hours'];

        if (ValidationService.isInvalidBusinessName(tags.name)) {
          continue;
        }

        const hasDirectContact = Boolean(phone || whatsapp || cleanOfficialWebsite || email || normalizedFb || normalizedInsta);
        const hasPhysicalPresence = Boolean((address && address.length >= 3) || (lat && lon));
        // Actionable businesses: must have either direct contact channels or verified physical establishment
        if (!hasDirectContact && !hasPhysicalPresence) {
          continue;
        }

        const validSocialLinks: Record<string, string> = {};
        if (normalizedFb) validSocialLinks.facebook = normalizedFb;
        if (normalizedInsta) validSocialLinks.instagram = normalizedInsta;
        if (normalizedLi) validSocialLinks.linkedin = normalizedLi;
        if (normalizedTw) validSocialLinks.twitter = normalizedTw;
        if (normalizedYt) validSocialLinks.youtube = normalizedYt;
        if (normalizedTt) validSocialLinks.tiktok = normalizedTt;

        const resolvedCity = tags['addr:city'] || tags['addr:town'] || tags['addr:village'] || city;
        results.push({
          source: 'osm',
          sourceId: `${el.type}/${el.id}`,
          sourceUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
          companyName: tags.name,
          category: tags.shop || tags.amenity || tags.office || tags.craft || category,
          country: tags['addr:country'] || country,
          city: resolvedCity,
          address: address || (resolvedCity ? `${resolvedCity}${country ? `, ${country}` : ''}` : undefined),
          phone: phone,
          whatsapp: whatsapp,
          website: cleanOfficialWebsite,
          email: email,
          latitude: lat,
          longitude: lon,
          rawData: { 
            ...el, 
            chainsExcludedCount,
            openingHours,
            operator: tags.operator,
            description: tags.description,
            socialLinks: validSocialLinks
          }
        });
      }

      // Fallback: If Overpass returned 0 results, query Nominatim directly
      if (results.length === 0 && (city || country) && category) {
        try {
          const nominatimLeads = await this.searchNominatim(category, city, country, limit);
          results.push(...nominatimLeads);
        } catch (e: any) {
          console.warn('Nominatim fallback query failed:', e.message);
        }
      }

      // Save to Cache
      queryCache.set(cacheKey, { leads: results, timestamp: Date.now() });

      await logger.info('OSM', `OSM Search returned ${results.length} leads`, { criteria, count: results.length }, 'OSM_API');
      return results;
    } catch (error: any) {
      await logger.error('OSM', 'OSM Search failed completely', error, { criteria }, 'OSM_API');
      
      // Attempt emergency Nominatim fallback
      if ((criteria.city || criteria.country) && criteria.category) {
        try {
          const fallbackResults = await this.searchNominatim(criteria.category, criteria.city, criteria.country, criteria.limit || 50);
          queryCache.set(cacheKey, { leads: fallbackResults, timestamp: Date.now() });
          return fallbackResults;
        } catch {}
      }

      throw new Error(`OSM Search failed: ${error.message}`);
    }
  }

  public async searchNominatim(category: string, city?: string, country?: string, limit: number = 50): Promise<RawLead[]> {
    const loc = [city, country].filter(Boolean).join(' ').trim();
    const cleanCat = category.trim();
    const leads: RawLead[] = [];
    const seenNames = new Set<string>();

    // 1. Primary Nominatim query with extratags=1 to get phone, website, email, facebook
    try {
      const primaryQuery = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cleanCat + ' in ' + loc)}&format=json&addressdetails=1&extratags=1&limit=${Math.min(limit, 50)}`;
      const res = await axios.get(primaryQuery, {
        headers: { 
          'User-Agent': 'LeadForge-Prospecting-Engine/3.0 (https://leadforge.app; contact@leadforge.app)',
          'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7'
        },
        timeout: 4500
      });

      if (Array.isArray(res.data) && res.data.length > 0) {
        for (const item of res.data) {
          const name = item.name || (item.display_name ? item.display_name.split(',')[0].trim() : null);
          if (!name || ValidationService.isInvalidBusinessName(name) || seenNames.has(name.toLowerCase())) continue;
          const tags = item.extratags || {};
          if (ChainFilter.isChainOrMajorBrand(tags, name)) continue;
          seenNames.add(name.toLowerCase());

          const addr = item.address || {};
          const street = [addr.house_number, addr.road].filter(Boolean).join(' ');
          const resolvedCity = addr.city || addr.town || addr.village || city;
          const address = [street, addr.postcode, resolvedCity].filter(Boolean).join(', ');

          const rawPhone = tags.phone || tags['contact:phone'] || tags['phone:mobile'] || tags.mobile || tags['contact:mobile'];
          const phone = rawPhone && ValidationService.validatePhone(String(rawPhone)) ? String(rawPhone).trim() : undefined;
          const rawWa = tags['contact:whatsapp'] || tags.whatsapp;
          const whatsapp = rawWa && (ValidationService.validatePhone(String(rawWa)) || String(rawWa).toLowerCase().includes('wa.me'))
            ? String(rawWa).trim()
            : undefined;
          const rawWeb = tags.website || tags['contact:website'] || tags.url || tags['contact:url'];
          const cleanWeb = rawWeb && !ValidationService.isSocialOrDirectoryUrl(rawWeb) ? rawWeb.trim() : undefined;
          const rawEmail = tags.email || tags['contact:email'];
          const email = rawEmail && ValidationService.validateEmail(String(rawEmail)) ? String(rawEmail).trim().toLowerCase() : undefined;

          const socialLinks: Record<string, string> = {};
          const fb = SocialEnrichmentService.normalizeFacebookUrl(tags['contact:facebook'] || tags.facebook || (rawWeb?.includes('facebook.com') ? rawWeb : undefined));
          const insta = SocialEnrichmentService.normalizeInstagramUrl(tags['contact:instagram'] || tags.instagram || (rawWeb?.includes('instagram.com') ? rawWeb : undefined));
          const li = SocialEnrichmentService.normalizeLinkedInUrl(tags['contact:linkedin'] || tags.linkedin || (rawWeb?.includes('linkedin.com') ? rawWeb : undefined));
          const tw = SocialEnrichmentService.normalizeTwitterUrl(tags['contact:twitter'] || tags.twitter || (rawWeb?.includes('twitter.com') || rawWeb?.includes('x.com') ? rawWeb : undefined));
          if (fb) socialLinks.facebook = fb;
          if (insta) socialLinks.instagram = insta;
          if (li) socialLinks.linkedin = li;
          if (tw) socialLinks.twitter = tw;

          leads.push({
            source: 'osm',
            sourceId: `nominatim/${item.osm_type || 'node'}/${item.osm_id}`,
            sourceUrl: `https://www.openstreetmap.org/${item.osm_type || 'node'}/${item.osm_id}`,
            companyName: name,
            category: addr.shop || addr.amenity || addr.office || addr.craft || category,
            country: addr.country || country,
            city: resolvedCity,
            address: address || item.display_name || undefined,
            phone,
            whatsapp,
            website: cleanWeb,
            email,
            latitude: parseFloat(item.lat),
            longitude: parseFloat(item.lon),
            rawData: {
              ...item,
              tags,
              socialLinks,
              openingHours: tags.opening_hours || tags['contact:opening_hours'],
              operator: tags.operator,
              description: tags.description
            }
          });

          if (leads.length >= limit) break;
        }
      }
    } catch (err: any) {
      if (err.response?.status !== 429) {
        console.info(`Nominatim query notice: ${err.message}. Switching to Photon OSM mirror.`);
      }
    }

    // 2. If under limit, query Photon OSM API + batch-enrich tags via Overpass ID lookup
    if (leads.length < limit) {
      try {
        const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(cleanCat + ' ' + loc)}&limit=${Math.min(limit, 50)}`;
        const pRes = await axios.get(photonUrl, {
          headers: { 'Accept': 'application/json' },
          timeout: 3500
        });

        const features = pRes.data?.features || [];
        // Batch fetch full OSM tags for Photon features via Overpass.fr
        const nodeIds = features.filter((f: any) => f.properties?.osm_type === 'N' && f.properties?.osm_id).map((f: any) => f.properties.osm_id);
        const wayIds = features.filter((f: any) => f.properties?.osm_type === 'W' && f.properties?.osm_id).map((f: any) => f.properties.osm_id);
        const tagMap = new Map<string, Record<string, any>>();

        if (nodeIds.length > 0 || wayIds.length > 0) {
          try {
            const idParts: string[] = [];
            if (nodeIds.length > 0) idParts.push(`node(id:${nodeIds.join(',')});`);
            if (wayIds.length > 0) idParts.push(`way(id:${wayIds.join(',')});`);
            const idQuery = `[out:json][timeout:8];(${idParts.join('')});out tags;`;
            const ovRes = await axios.post(this.globalOverpassUrls[0], 'data=' + encodeURIComponent(idQuery), {
              headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'LeadForge-Discovery/2.5' },
              timeout: 4500
            });
            for (const el of ovRes.data?.elements || []) {
              const prefix = el.type === 'node' ? 'N' : el.type === 'way' ? 'W' : 'R';
              if (el.tags) tagMap.set(`${prefix}/${el.id}`, el.tags);
            }
          } catch {}
        }

        for (const f of features) {
          const p = f.properties || {};
          const name = p.name;
          if (!name || ValidationService.isInvalidBusinessName(name) || seenNames.has(name.toLowerCase())) continue;
          if (p.osm_key === 'place' || p.osm_key === 'boundary' || p.osm_key === 'highway' || p.type === 'city' || p.type === 'administrative') continue;
          if (city && name.toLowerCase() === city.toLowerCase()) continue;

          const tags = tagMap.get(`${p.osm_type}/${p.osm_id}`) || {};
          if (ChainFilter.isChainOrMajorBrand(tags, name)) continue;
          seenNames.add(name.toLowerCase());

          const street = [p.housenumber, p.street].filter(Boolean).join(' ');
          const resolvedCity = p.city || p.district || city;
          const address = [street, p.postcode, resolvedCity].filter(Boolean).join(', ');
          const coords = f.geometry?.coordinates || [];

          const rawPhone = tags.phone || tags['contact:phone'] || tags['phone:mobile'] || tags.mobile || tags['contact:mobile'];
          const phone = rawPhone && ValidationService.validatePhone(String(rawPhone)) ? String(rawPhone).trim() : undefined;
          const rawWa = tags['contact:whatsapp'] || tags.whatsapp;
          const whatsapp = rawWa && (ValidationService.validatePhone(String(rawWa)) || String(rawWa).toLowerCase().includes('wa.me'))
            ? String(rawWa).trim()
            : undefined;
          const rawWeb = tags.website || tags['contact:website'] || tags.url || tags['contact:url'];
          const cleanWeb = rawWeb && !ValidationService.isSocialOrDirectoryUrl(rawWeb) ? rawWeb.trim() : undefined;
          const rawEmail = tags.email || tags['contact:email'];
          const email = rawEmail && ValidationService.validateEmail(String(rawEmail)) ? String(rawEmail).trim().toLowerCase() : undefined;

          const socialLinks: Record<string, string> = {};
          const fb = SocialEnrichmentService.normalizeFacebookUrl(tags['contact:facebook'] || tags.facebook || (rawWeb?.includes('facebook.com') ? rawWeb : undefined));
          const insta = SocialEnrichmentService.normalizeInstagramUrl(tags['contact:instagram'] || tags.instagram || (rawWeb?.includes('instagram.com') ? rawWeb : undefined));
          const li = SocialEnrichmentService.normalizeLinkedInUrl(tags['contact:linkedin'] || tags.linkedin || (rawWeb?.includes('linkedin.com') ? rawWeb : undefined));
          const tw = SocialEnrichmentService.normalizeTwitterUrl(tags['contact:twitter'] || tags.twitter || (rawWeb?.includes('twitter.com') || rawWeb?.includes('x.com') ? rawWeb : undefined));
          if (fb) socialLinks.facebook = fb;
          if (insta) socialLinks.instagram = insta;
          if (li) socialLinks.linkedin = li;
          if (tw) socialLinks.twitter = tw;

          leads.push({
            source: 'osm',
            sourceId: `photon/${p.osm_type || 'N'}/${p.osm_id || Math.floor(Math.random() * 1000000)}`,
            sourceUrl: p.osm_id ? `https://www.openstreetmap.org/${p.osm_type === 'W' ? 'way' : 'node'}/${p.osm_id}` : `https://www.openstreetmap.org/`,
            companyName: name,
            category: p.osm_value || category,
            country: p.country || country,
            city: resolvedCity,
            address: address || (p.city ? `${p.city}, ${p.country || ''}` : undefined),
            phone,
            whatsapp,
            website: cleanWeb,
            email,
            latitude: coords[1] ? parseFloat(coords[1]) : undefined,
            longitude: coords[0] ? parseFloat(coords[0]) : undefined,
            rawData: {
              ...f,
              tags,
              socialLinks,
              openingHours: tags.opening_hours || tags['contact:opening_hours'],
              operator: tags.operator,
              description: tags.description
            }
          });

          if (leads.length >= limit) break;
        }
      } catch (photonErr: any) {
        // Non-critical fallback
      }
    }

    return leads;
  }

  async validateConfiguration(): Promise<{ valid: boolean }> {
    return { valid: true };
  }

  getSourceName(): string {
    return 'OpenStreetMap';
  }

  getCapabilities(): string[] {
    return ['company_name', 'address', 'category', 'coordinates', 'phone', 'website'];
  }
}
