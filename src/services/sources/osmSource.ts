import axios from 'axios';
import { LeadSource, RawLead } from './types.ts';
import { logger, metrics } from '../../lib/monitoring.ts';
import { OSMCategoryMapper } from './osmCategoryMapper.ts';
import { ChainFilter } from './chainFilter.ts';

export class OSMSource implements LeadSource {
  private overpassUrl = 'https://overpass-api.de/api/interpreter';

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
    const { country, city, category, limit = 50, bbox } = criteria;
    
    // Construct Overpass QL query
    let areaPart = '';
    if (!bbox) {
      if (city && country) {
        areaPart = `area["name"="${city}"]->.searchArea;`;
      } else if (city) {
        areaPart = `area["name"="${city}"]->.searchArea;`;
      } else if (country) {
        areaPart = `area["name"="${country}"]->.searchArea;`;
      }
    }

    const bboxString = bbox ? `${bbox.minLat},${bbox.minLon},${bbox.maxLat},${bbox.maxLon}` : '';
    const locationSelector = bbox ? `(${bboxString})` : (areaPart ? '(area.searchArea)' : '');

    const queryParts = category ? OSMCategoryMapper.getQueryParts(category) : [
      'node["amenity"];',
      'way["amenity"];',
      'node["shop"];',
      'way["shop"];',
      'node["office"];',
      'way["office"];'
    ];

    const finalQueryParts = queryParts.map(part => {
      if (!locationSelector) return part;
      return part.replace(';', `${locationSelector};`);
    });

    const query = `
      [out:json][timeout:90];
      ${bbox ? '' : areaPart}
      (
        ${finalQueryParts.join('\n        ')}
      );
      out center body ${limit};
    `;

    try {
      let response: any;
      let retries = 4;
      let attemptCount = 0;
      
      while (retries > 0) {
        attemptCount++;
        try {
          response = await axios.get(`${this.overpassUrl}?data=${encodeURIComponent(query)}`, {
            headers: { 
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 LeadForge/2.0',
              'Accept': 'application/json',
              'Referer': 'https://leadforge.app/'
            },
            timeout: 120000
          });
          
          if (attemptCount > 1) {
            await metrics.record('SOURCE', 'OSM', 'RETRY_SUCCESS', Date.now() - startTime, { criteria, attemptCount });
          } else {
            await metrics.record('SOURCE', 'OSM', 'SUCCESS', Date.now() - startTime, { criteria });
          }
          break;
        } catch (err: any) {
          retries--;
          const status = err.response?.status;
          const isTimeout = err.code === 'ECONNABORTED' || status === 504 || status === 502;
          const isRateLimit = status === 429;
          const isForbidden = status === 403;
          
          const metricStatus = isTimeout ? 'TIMEOUT' : 'FAILURE';
          
          await logger.warn('OSM', `OSM Search attempt ${attemptCount} failed: ${err.message}`, { 
            status, 
            code: err.code,
            criteria,
            isTimeout,
            retriesLeft: retries
          }, 'OSM_API');

          if (isForbidden) {
            throw new Error('Overpass API access forbidden (403). The service may be blocking requests from this environment. Please try again later.');
          }

          if (retries === 0 || (!isTimeout && !isRateLimit)) {
            await metrics.record('SOURCE', 'OSM', metricStatus, Date.now() - startTime, { criteria, attemptCount, error: err.message });
            throw err;
          }
          
          const backoff = (isRateLimit || isTimeout) ? 4000 * (5 - retries) : 2000;
          await new Promise(resolve => setTimeout(resolve, backoff));
        }
      }

      if (!response?.data) return [];

      const elements = response.data.elements || [];
      const results: RawLead[] = [];

      let chainsExcludedCount = 0;

      for (const el of elements) {
        if (!el.tags || !el.tags.name) continue;
        const tags = el.tags;

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

        // If user specifically requested leads with verified contact details only
        if (criteria.requireContactInfo && !phone && !website && !email) {
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

      await logger.info('OSM', `OSM Search returned ${results.length} leads`, { criteria, count: results.length }, 'OSM_API');
      return results;
    } catch (error: any) {
      await logger.error('OSM', 'OSM Search failed completely', error, { criteria }, 'OSM_API');
      throw new Error(`OSM Search failed: ${error.message}`);
    }
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
