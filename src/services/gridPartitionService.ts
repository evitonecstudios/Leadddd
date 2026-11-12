import axios from 'axios';

export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

export class GridPartitionService {
  /**
   * Subdivides a bounding box into a grid of cells.
   * @param bbox The master bounding box to subdivide.
   * @param divisions The number of divisions per axis (e.g., 2 means 4 cells).
   */
  static partition(bbox: BoundingBox, divisions: number = 2): BoundingBox[] {
    const cells: BoundingBox[] = [];
    const latStep = (bbox.maxLat - bbox.minLat) / divisions;
    const lonStep = (bbox.maxLon - bbox.minLon) / divisions;

    for (let i = 0; i < divisions; i++) {
      for (let j = 0; j < divisions; j++) {
        cells.push({
          minLat: bbox.minLat + i * latStep,
          maxLat: bbox.minLat + (i + 1) * latStep,
          minLon: bbox.minLon + j * lonStep,
          maxLon: bbox.minLon + (j + 1) * lonStep,
        });
      }
    }
    return cells;
  }

  // In-memory cache to prevent redundant geocoding requests
  private static bboxCache = new Map<string, BoundingBox>();

  // Pre-cached accurate bounding boxes for major European metros (0 network calls, 0 latency, 0 rate limits)
  private static KNOWN_METROS: Record<string, BoundingBox> = {
    'paris': { minLat: 48.8155, maxLat: 48.9021, minLon: 2.2241, maxLon: 2.4699 },
    'lyon': { minLat: 45.7073, maxLat: 45.8082, minLon: 4.7718, maxLon: 4.8984 },
    'marseille': { minLat: 43.1696, maxLat: 43.3912, minLon: 5.2892, maxLon: 5.5324 },
    'geneve': { minLat: 46.1779, maxLat: 46.2366, minLon: 6.1082, maxLon: 6.1784 },
    'geneva': { minLat: 46.1779, maxLat: 46.2366, minLon: 6.1082, maxLon: 6.1784 },
    'toulouse': { minLat: 43.5326, maxLat: 43.6687, minLon: 1.3503, maxLon: 1.5153 },
    'nice': { minLat: 43.6453, maxLat: 43.7594, minLon: 7.1818, maxLon: 7.3223 },
    'nantes': { minLat: 47.1805, maxLat: 47.2842, minLon: -1.6425, maxLon: -1.4789 },
    'strasbourg': { minLat: 48.5204, maxLat: 48.6471, minLon: 7.6841, maxLon: 7.8375 },
    'bordeaux': { minLat: 44.8105, maxLat: 44.9152, minLon: -0.6387, maxLon: -0.5336 },
    'lille': { minLat: 50.6000, maxLat: 50.6600, minLon: 3.0000, maxLon: 3.1200 },
    'bruxelles': { minLat: 50.7962, maxLat: 50.9138, minLon: 4.3137, maxLon: 4.4370 },
    'brussels': { minLat: 50.7962, maxLat: 50.9138, minLon: 4.3137, maxLon: 4.4370 }
  };

  /**
   * Attempts to get a bounding box for a city/country name using cache, Nominatim or Photon.
   */
  static async getBoundingBox(location: string): Promise<BoundingBox | null> {
    const cleanLocation = location?.trim();
    if (!cleanLocation) return null;

    const normalizedKey = cleanLocation.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .split(',')[0].trim();

    // 1. Check known metros instant cache
    if (this.KNOWN_METROS[normalizedKey]) {
      return this.KNOWN_METROS[normalizedKey];
    }

    // 2. Check dynamic runtime cache
    if (this.bboxCache.has(normalizedKey)) {
      return this.bboxCache.get(normalizedKey)!;
    }

    // 3. Query Nominatim with polite headers and backoff
    try {
      const response = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: {
          q: cleanLocation,
          format: 'json',
          limit: 1
        },
        headers: {
          'User-Agent': 'LeadForge-Prospecting-Engine/3.0 (https://leadforge.app; contact@leadforge.app)'
        },
        timeout: 4000
      });

      if (response.data && response.data.length > 0) {
        const item = response.data[0];
        const boundingbox = item.boundingbox; // [minlat, maxlat, minlon, maxlon]
        const bbox: BoundingBox = {
          minLat: parseFloat(boundingbox[0]),
          maxLat: parseFloat(boundingbox[1]),
          minLon: parseFloat(boundingbox[2]),
          maxLon: parseFloat(boundingbox[3])
        };
        this.bboxCache.set(normalizedKey, bbox);
        return bbox;
      }
    } catch (err: any) {
      // If 429 or error, fall back to Photon OSM Geocoder without throwing
      if (err.response?.status !== 429) {
        console.info(`Nominatim notice for "${cleanLocation}": ${err.message}. Trying Photon fallback.`);
      }
    }

    // 4. Photon OSM Geocoder Fallback (no 429 rate limit, 100% OSM data)
    try {
      const photonRes = await axios.get(`https://photon.komoot.io/api/?q=${encodeURIComponent(cleanLocation)}&limit=1`, {
        timeout: 3000
      });
      const feature = photonRes.data?.features?.[0];
      if (feature && feature.geometry?.coordinates) {
        const [lon, lat] = feature.geometry.coordinates;
        // Construct reasonable city bounding box (+/- 0.06 deg ~ 7km radius)
        const bbox: BoundingBox = {
          minLat: lat - 0.05,
          maxLat: lat + 0.05,
          minLon: lon - 0.06,
          maxLon: lon + 0.06
        };
        this.bboxCache.set(normalizedKey, bbox);
        return bbox;
      }
    } catch {}

    return null;
  }

  /**
   * Decides on the number of divisions based on the area size or target count.
   */
  static calculateDivisions(bbox: BoundingBox, targetCount: number): number {
    const latDiff = bbox.maxLat - bbox.minLat;
    const lonDiff = bbox.maxLon - bbox.minLon;
    const area = latDiff * lonDiff;

    // Small city area is roughly 0.01 - 0.05
    // Big city area is 0.1 - 0.5
    // Country area is > 1.0

    if (area > 5.0) return 8; // Country scale (64 cells)
    if (area > 1.0) return 6; // Region scale (36 cells)
    if (area > 0.3) return 4; // Large Metro scale (16 cells)
    
    if (targetCount <= 30) return 1; 
    if (targetCount <= 80) return 2; 
    if (targetCount <= 200) return 3; 
    if (targetCount <= 500) return 4;
    return 5;
  }

  /**
   * Expands a bounding box by a multiplier while keeping it centered.
   * multiplier 1.5 = 50% larger on each axis.
   */
  static expandBoundingBox(bbox: BoundingBox, multiplier: number): BoundingBox {
    const latDiff = bbox.maxLat - bbox.minLat;
    const lonDiff = bbox.maxLon - bbox.minLon;
    const centerLat = (bbox.minLat + bbox.maxLat) / 2;
    const centerLon = (bbox.minLon + bbox.maxLon) / 2;
    
    const halfLat = (latDiff * multiplier) / 2;
    const halfLon = (lonDiff * multiplier) / 2;
    
    return {
      minLat: centerLat - halfLat,
      maxLat: centerLat + halfLat,
      minLon: centerLon - halfLon,
      maxLon: centerLon + halfLon
    };
  }
}
