import axios from 'axios';
import type { LeadSource, RawLead } from './types.ts';
import { logger, metrics } from '../../lib/monitoring.ts';
import { OSMCategoryMapper } from './osmCategoryMapper.ts';
import { ChainFilter } from './chainFilter.ts';
import { ValidationService } from '../leadService.ts';

export class OSMSource implements LeadSource {
  private overpassUrls = [
    'https://lz4.overpass-api.de/api/interpreter',
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter'
  ];

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
      [out:json][timeout:25]${bboxDecl};
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

      for (const endpoint of this.overpassUrls) {
        attemptCount++;
        try {
          response = await axios.post(endpoint, 'data=' + encodeURIComponent(query), {
            headers: { 
              'Content-Type': 'application/x-www-form-urlencoded',
              'User-Agent': 'LeadForge-Discovery/2.0',
              'Referer': 'https://leadforge.app/'
            },
            timeout: 18000
          });
          
          if (response?.data?.elements) {
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

          await new Promise(resolve => setTimeout(resolve, 800));
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

        // Filter out mega-chains, famous franchises, and multinational brands (e.g. Fnac, Zara, McDonald's)
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
        const phone = tags.phone || tags['contact:phone'] || tags['phone:mobile'] || tags.mobile || 
                      tags['contact:mobile'] || tags['telephone'] || tags['contact:telephone'] || tags.tel;

        const officialWebsite = tags.website || tags['contact:website'] || tags.url || tags['contact:url'] || 
                                tags['contact:web'] || tags['website:official'] || tags['website:menu'];

        const socialFb = tags['contact:facebook'] || tags.facebook;
        const socialInsta = tags['contact:instagram'] || tags.instagram;
        const socialLinkedin = tags['contact:linkedin'] || tags.linkedin;
        const socialTwitter = tags['contact:twitter'] || tags.twitter;

        const website = officialWebsite || socialFb || socialInsta || socialLinkedin;
        const email = tags.email || tags['contact:email'] || tags['email:contact'];
        const openingHours = tags.opening_hours || tags['contact:opening_hours'];

        // Enforce verified contact details: if requireContactInfo is set, or if unverified (no phone, no website, no email, no valid address)
        const hasDirectContact = Boolean(phone || website || email);
        if (criteria.requireContactInfo !== false && !hasDirectContact) {
          continue;
        }

        // If even standard discovery, require at least direct contact or a precise street address
        if (!hasDirectContact && (!address || address.length < 5)) {
          continue;
        }

        results.push({
          source: 'osm',
          sourceId: `${el.type}/${el.id}`,
          sourceUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
          companyName: tags.name,
          category: tags.shop || tags.amenity || tags.office || tags.craft || category,
          city: tags['addr:city'] || city,
          address: address || undefined,
          phone: phone ? String(phone).trim() : undefined,
          website: website ? String(website).trim() : undefined,
          email: email ? String(email).trim() : undefined,
          latitude: lat,
          longitude: lon,
          rawData: { 
            ...el, 
            chainsExcludedCount,
            openingHours,
            socialLinks: {
              facebook: socialFb,
              instagram: socialInsta,
              linkedin: socialLinkedin,
              twitter: socialTwitter
            }
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

      await logger.info('OSM', `OSM Search returned ${results.length} leads`, { criteria, count: results.length }, 'OSM_API');
      return results;
    } catch (error: any) {
      await logger.error('OSM', 'OSM Search failed completely', error, { criteria }, 'OSM_API');
      
      // Attempt emergency Nominatim fallback even if Overpass threw error
      if ((criteria.city || criteria.country) && criteria.category) {
        try {
          return await this.searchNominatim(criteria.category, criteria.city, criteria.country, criteria.limit || 50);
        } catch {}
      }

      throw new Error(`OSM Search failed: ${error.message}`);
    }
  }

  public async searchNominatim(category: string, city?: string, country?: string, limit: number = 50): Promise<RawLead[]> {
    const loc = [city, country].filter(Boolean).join(' ').trim();
    const cleanCat = category.trim();
    const queries = [
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cleanCat + ' ' + loc)}&format=json&addressdetails=1&limit=${limit}`,
      `https://nominatim.openstreetmap.org/search?city=${encodeURIComponent(city || loc)}&amenity=${encodeURIComponent(cleanCat)}&format=json&addressdetails=1&limit=${limit}`,
      `https://nominatim.openstreetmap.org/search?city=${encodeURIComponent(city || loc)}&shop=${encodeURIComponent(cleanCat)}&format=json&addressdetails=1&limit=${limit}`,
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cleanCat + ' in ' + (city || loc))}&format=json&addressdetails=1&limit=${limit}`
    ];

    const leads: RawLead[] = [];
    const seenNames = new Set<string>();

    for (const q of queries) {
      if (leads.length >= limit) break;
      try {
        const res = await axios.get(q, {
          headers: { 'User-Agent': 'LeadForge-Discovery/2.0' },
          timeout: 8000
        });

        if (Array.isArray(res.data)) {
          for (const item of res.data) {
            const name = item.name || (item.display_name ? item.display_name.split(',')[0].trim() : null);
            if (!name || ValidationService.isInvalidBusinessName(name) || seenNames.has(name.toLowerCase())) continue;
            seenNames.add(name.toLowerCase());

            const addr = item.address || {};
            const street = [addr.house_number, addr.road].filter(Boolean).join(' ');
            const address = [street, addr.postcode, addr.city || addr.town || addr.village].filter(Boolean).join(', ');

            leads.push({
              source: 'osm',
              sourceId: `nominatim/${item.osm_type || 'node'}/${item.osm_id}`,
              sourceUrl: `https://www.openstreetmap.org/${item.osm_type || 'node'}/${item.osm_id}`,
              companyName: name,
              category: addr.shop || addr.amenity || addr.office || addr.craft || category,
              city: addr.city || addr.town || addr.village || city,
              address: address || item.display_name || undefined,
              latitude: parseFloat(item.lat),
              longitude: parseFloat(item.lon),
              rawData: item
            });

            if (leads.length >= limit) break;
          }
        }
      } catch (e: any) {
        console.warn('Single Nominatim query failed:', e.message);
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
