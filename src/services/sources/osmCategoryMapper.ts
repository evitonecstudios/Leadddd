export interface OSMCategoryTag {
  key: string;
  value: string; // specific value or '*' for any non-empty value
}

export interface OSMCategoryMapping {
  tags: OSMCategoryTag[];
}

export class OSMCategoryMapper {
  private static mapping: Record<string, OSMCategoryMapping> = {
    'phone repair': {
      tags: [
        { key: 'shop', value: 'mobile_phone' },
        { key: 'shop', value: 'electronics' },
        { key: 'shop', value: 'telecommunication' },
        { key: 'craft', value: 'electronics_repair' },
        { key: 'repair', value: 'mobile_phone' },
        { key: 'repair', value: 'phone' },
        { key: 'repair', value: 'electronics' },
        { key: 'amenity', value: 'mobile_phone_repair' }
      ]
    },
    'electronics repair': {
      tags: [
        { key: 'craft', value: 'electronics_repair' },
        { key: 'shop', value: 'electronics' },
        { key: 'repair', value: 'electronics' },
        { key: 'repair', value: 'computer' }
      ]
    },
    'restaurant': {
      tags: [
        { key: 'amenity', value: 'restaurant' },
        { key: 'amenity', value: 'bistro' },
        { key: 'amenity', value: 'fast_food' }
      ]
    },
    'car rental': {
      tags: [
        { key: 'amenity', value: 'car_rental' }
      ]
    },
    'plumber': {
      tags: [
        { key: 'craft', value: 'plumber' },
        { key: 'craft', value: 'sanitary' },
        { key: 'office', value: 'plumbing' }
      ]
    },
    'heating company': {
      tags: [
        { key: 'craft', value: 'hvac' },
        { key: 'craft', value: 'heating' }
      ]
    },
    'architect': {
      tags: [
        { key: 'office', value: 'architect' },
        { key: 'office', value: 'architectural_design' }
      ]
    },
    'dentist': {
      tags: [
        { key: 'amenity', value: 'dentist' },
        { key: 'healthcare', value: 'dentist' },
        { key: 'amenity', value: 'dental_clinic' }
      ]
    },
    'barber': {
      tags: [
        { key: 'shop', value: 'hairdresser' },
        { key: 'shop', value: 'barber' }
      ]
    },
    'hairdresser': {
      tags: [
        { key: 'shop', value: 'hairdresser' },
        { key: 'shop', value: 'barber' },
        { key: 'shop', value: 'beauty' }
      ]
    },
    'law firm': {
      tags: [
        { key: 'office', value: 'lawyer' },
        { key: 'office', value: 'legal' }
      ]
    },
    'real estate agency': {
      tags: [
        { key: 'office', value: 'estate_agent' },
        { key: 'office', value: 'property_management' }
      ]
    },
    'car mechanic': {
      tags: [
        { key: 'shop', value: 'car_repair' },
        { key: 'amenity', value: 'car_repair' },
        { key: 'craft', value: 'car_repair' }
      ]
    },
    'auto repair': {
      tags: [
        { key: 'shop', value: 'car_repair' },
        { key: 'amenity', value: 'car_repair' },
        { key: 'craft', value: 'car_repair' }
      ]
    },
    'bakery': {
      tags: [
        { key: 'shop', value: 'bakery' },
        { key: 'shop', value: 'pastry' }
      ]
    },
    'cafe': {
      tags: [
        { key: 'amenity', value: 'cafe' },
        { key: 'amenity', value: 'coffee_shop' }
      ]
    },
    'pharmacy': {
      tags: [
        { key: 'amenity', value: 'pharmacy' },
        { key: 'healthcare', value: 'pharmacy' },
        { key: 'shop', value: 'chemist' }
      ]
    },
    'hotel': {
      tags: [
        { key: 'tourism', value: 'hotel' },
        { key: 'tourism', value: 'guest_house' },
        { key: 'tourism', value: 'motel' }
      ]
    },
    'gym': {
      tags: [
        { key: 'leisure', value: 'fitness_centre' },
        { key: 'leisure', value: 'sports_centre' }
      ]
    },
    'spa': {
      tags: [
        { key: 'leisure', value: 'spa' },
        { key: 'shop', value: 'beauty' }
      ]
    },
    'cleaning service': {
      tags: [
        { key: 'office', value: 'cleaning' },
        { key: 'craft', value: 'cleaning' }
      ]
    },
    'electrician': {
      tags: [
        { key: 'craft', value: 'electrician' },
        { key: 'office', value: 'electrical' }
      ]
    },
    'painter': {
      tags: [
        { key: 'craft', value: 'painter' }
      ]
    },
    'veterinarian': {
      tags: [
        { key: 'amenity', value: 'veterinary' },
        { key: 'healthcare', value: 'veterinary' }
      ]
    },
    'it services': {
      tags: [
        { key: 'office', value: 'it' },
        { key: 'office', value: 'software' },
        { key: 'shop', value: 'computer' }
      ]
    },
    'roofing': {
      tags: [
        { key: 'craft', value: 'roofer' }
      ]
    },
    'landscaping': {
      tags: [
        { key: 'craft', value: 'gardener' }
      ]
    },
    'boutique': {
      tags: [
        { key: 'shop', value: 'boutique' },
        { key: 'shop', value: 'clothes' },
        { key: 'shop', value: 'fashion' }
      ]
    },
    'beauty salon': {
      tags: [
        { key: 'shop', value: 'beauty' },
        { key: 'shop', value: 'cosmetics' }
      ]
    },
    'lawyer': {
      tags: [
        { key: 'office', value: 'lawyer' },
        { key: 'office', value: 'legal' }
      ]
    }
  };

  static getMapping(category: string): OSMCategoryMapping {
    const normalized = category.toLowerCase().trim();
    
    // Direct match
    if (this.mapping[normalized]) {
      return this.mapping[normalized];
    }

    // Partial key matching (e.g. "smartphone repair" matches "phone repair")
    for (const [key, value] of Object.entries(this.mapping)) {
      if (normalized.includes(key) || key.includes(normalized)) {
        return value;
      }
    }

    // Keyword synonyms check
    if (normalized.includes('phone') || normalized.includes('smartphone') || normalized.includes('mobile') || normalized.includes('reparation')) {
      return this.mapping['phone repair'];
    }
    if (normalized.includes('repair') || normalized.includes('fix')) {
      return this.mapping['electronics repair'];
    }
    if (normalized.includes('food') || normalized.includes('dining') || normalized.includes('eat')) {
      return this.mapping['restaurant'];
    }
    if (normalized.includes('car') || normalized.includes('auto') || normalized.includes('garage') || normalized.includes('mechanic')) {
      return this.mapping['car mechanic'];
    }

    // Dynamic fallback: build relevant tags based on user input string
    const cleanWord = normalized.replace(/[^a-z0-9]/g, '_');
    return { 
      tags: [
        { key: 'shop', value: cleanWord },
        { key: 'amenity', value: cleanWord },
        { key: 'office', value: cleanWord },
        { key: 'craft', value: cleanWord }
      ] 
    };
  }

  static getQueryParts(category: string): string[] {
    const mapping = this.getMapping(category);
    const parts: string[] = [];
    
    for (const tag of mapping.tags) {
      if (tag.value === '*') {
        // Matches any value for this tag
        parts.push(`node["${tag.key}"];`);
        parts.push(`way["${tag.key}"];`);
      } else {
        parts.push(`node["${tag.key}"="${tag.value}"];`);
        parts.push(`way["${tag.key}"="${tag.value}"];`);
      }
    }
    
    return parts;
  }
}
