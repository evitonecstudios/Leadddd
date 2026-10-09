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

  /**
   * Attempts to get a bounding box for a city/country name using Nominatim.
   */
  static async getBoundingBox(location: string): Promise<BoundingBox | null> {
    try {
      const cleanLocation = location?.trim();
      if (!cleanLocation) return null;

      const response = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: {
          q: cleanLocation,
          format: 'json',
          limit: 1
        },
        headers: {
          'User-Agent': 'LeadForge-Discovery-Engine/1.0'
        },
        timeout: 10000
      });

      if (response.data && response.data.length > 0) {
        const item = response.data[0];
        const boundingbox = item.boundingbox; // [minlat, maxlat, minlon, maxlon]
        return {
          minLat: parseFloat(boundingbox[0]),
          maxLat: parseFloat(boundingbox[1]),
          minLon: parseFloat(boundingbox[2]),
          maxLon: parseFloat(boundingbox[3])
        };
      }
      return null;
    } catch (error) {
      console.error('Failed to fetch bounding box for location:', location, error);
      return null;
    }
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
