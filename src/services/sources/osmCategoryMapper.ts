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
        { key: 'craft', value: 'car_repair' },
        { key: 'shop', value: 'tyres' },
        { key: 'shop', value: 'car' },
        { key: 'shop', value: 'car_parts' },
        { key: 'shop', value: 'motorcycle_repair' },
        { key: 'craft', value: 'mechanic' }
      ]
    },
    'auto repair': {
      tags: [
        { key: 'shop', value: 'car_repair' },
        { key: 'amenity', value: 'car_repair' },
        { key: 'craft', value: 'car_repair' },
        { key: 'shop', value: 'tyres' },
        { key: 'shop', value: 'car' },
        { key: 'shop', value: 'car_parts' },
        { key: 'shop', value: 'motorcycle_repair' },
        { key: 'craft', value: 'mechanic' }
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
        { key: 'office', value: 'legal' },
        { key: 'amenity', value: 'lawyer' }
      ]
    },
    'carpenter': {
      tags: [
        { key: 'craft', value: 'carpenter' },
        { key: 'craft', value: 'joiner' }
      ]
    },
    'florist': {
      tags: [
        { key: 'shop', value: 'florist' }
      ]
    },
    'optician': {
      tags: [
        { key: 'shop', value: 'optician' },
        { key: 'healthcare', value: 'optometrist' }
      ]
    },
    'accountant': {
      tags: [
        { key: 'office', value: 'accountant' },
        { key: 'office', value: 'tax_advisor' }
      ]
    },
    'locksmith': {
      tags: [
        { key: 'craft', value: 'locksmith' },
        { key: 'shop', value: 'locksmith' }
      ]
    },
    'dry cleaning': {
      tags: [
        { key: 'shop', value: 'dry_cleaning' },
        { key: 'shop', value: 'laundry' }
      ]
    },
    'butcher': {
      tags: [
        { key: 'shop', value: 'butcher' }
      ]
    },
    'grocery': {
      tags: [
        { key: 'shop', value: 'supermarket' },
        { key: 'shop', value: 'convenience' },
        { key: 'shop', value: 'greengrocer' }
      ]
    },
    'doctor': {
      tags: [
        { key: 'amenity', value: 'doctors' },
        { key: 'healthcare', value: 'doctor' },
        { key: 'amenity', value: 'clinic' }
      ]
    }
  };

  static normalize(str: string): string {
    return str
      .toLowerCase()
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  static getMapping(category: string): OSMCategoryMapping {
    const raw = category.toLowerCase().trim();
    const normalized = this.normalize(category);
    
    // Direct match (raw or normalized)
    if (this.mapping[raw]) return this.mapping[raw];
    if (this.mapping[normalized]) return this.mapping[normalized];

    // French & English Synonyms / Stem matching
    if (normalized.includes('mecanic') || normalized.includes('garag') || normalized.includes('auto') || normalized.includes('carrosser') || normalized.includes('pneu') || normalized.includes('vidange') || normalized.includes('controle tech') || normalized.includes('depannage auto')) {
      return this.mapping['car mechanic'];
    }
    if (normalized.includes('plomb') || normalized.includes('chauffag') || normalized.includes('sanitair')) {
      return this.mapping['plumber'];
    }
    if (normalized.includes('avocat') || normalized.includes('notair') || normalized.includes('juridiq') || normalized.includes('lawyer') || normalized.includes('legal')) {
      return this.mapping['lawyer'];
    }
    if (normalized.includes('dentist') || normalized.includes('dentair') || normalized.includes('orthodont')) {
      return this.mapping['dentist'];
    }
    if (normalized.includes('medecin') || normalized.includes('docteur') || normalized.includes('medical') || normalized.includes('cliniq') || normalized.includes('doctor')) {
      return this.mapping['doctor'];
    }
    if (normalized.includes('coiff') || normalized.includes('barbi') || normalized.includes('barber') || normalized.includes('hair')) {
      return this.mapping['hairdresser'];
    }
    if (normalized.includes('boulang') || normalized.includes('patiss') || normalized.includes('baker') || normalized.includes('pastry')) {
      return this.mapping['bakery'];
    }
    if (normalized.includes('restau') || normalized.includes('brasser') || normalized.includes('pizz') || normalized.includes('bistro') || normalized.includes('creper') || normalized.includes('traiteur')) {
      return this.mapping['restaurant'];
    }
    if (normalized.includes('pharmac') || normalized.includes('parapharmac') || normalized.includes('chemist')) {
      return this.mapping['pharmacy'];
    }
    if (normalized.includes('electri')) {
      return this.mapping['electrician'];
    }
    if (normalized.includes('immobili') || normalized.includes('real estate') || normalized.includes('agence immo')) {
      return this.mapping['real estate agency'];
    }
    if (normalized.includes('architect')) {
      return this.mapping['architect'];
    }
    if (normalized.includes('menuis') || normalized.includes('charpent') || normalized.includes('carpent')) {
      return this.mapping['carpenter'];
    }
    if (normalized.includes('peint') || normalized.includes('paint')) {
      return this.mapping['painter'];
    }
    if (normalized.includes('informatiq') || normalized.includes('ordinateur') || normalized.includes('logiciel') || normalized.includes('software') || normalized.includes('web')) {
      return this.mapping['it services'];
    }
    if (normalized.includes('telephon') || normalized.includes('phone') || normalized.includes('smartphone') || normalized.includes('mobile') || normalized.includes('reparation')) {
      return this.mapping['phone repair'];
    }
    if (normalized.includes('veterin')) {
      return this.mapping['veterinarian'];
    }
    if (normalized.includes('fleur') || normalized.includes('florist')) {
      return this.mapping['florist'];
    }
    if (normalized.includes('optic') || normalized.includes('lunett')) {
      return this.mapping['optician'];
    }
    if (normalized.includes('comptab') || normalized.includes('account')) {
      return this.mapping['accountant'];
    }
    if (normalized.includes('serrur') || normalized.includes('locksmith')) {
      return this.mapping['locksmith'];
    }
    if (normalized.includes('press') || normalized.includes('blanchiss') || normalized.includes('laver') || normalized.includes('laundry')) {
      return this.mapping['dry cleaning'];
    }
    if (normalized.includes('hotel') || normalized.includes('heberg') || normalized.includes('gite') || normalized.includes('auberge')) {
      return this.mapping['hotel'];
    }
    if (normalized.includes('sport') || normalized.includes('fitness') || normalized.includes('muscu') || normalized.includes('gym')) {
      return this.mapping['gym'];
    }
    if (normalized.includes('beaut') || normalized.includes('esthetiq') || normalized.includes('ongl') || normalized.includes('spa')) {
      return this.mapping['beauty salon'];
    }
    if (normalized.includes('bouch') || normalized.includes('charcut') || normalized.includes('butcher')) {
      return this.mapping['butcher'];
    }
    if (normalized.includes('epic') || normalized.includes('superm') || normalized.includes('aliment') || normalized.includes('grocer')) {
      return this.mapping['grocery'];
    }
    if (normalized.includes('nettoy') || normalized.includes('clean')) {
      return this.mapping['cleaning service'];
    }

    // Partial key matching against registered keys
    for (const [key, value] of Object.entries(this.mapping)) {
      if (normalized.includes(key) || key.includes(normalized)) {
        return value;
      }
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
        // Matches any value for this tag, but must have a name
        parts.push(`node["${tag.key}"][name];`);
        parts.push(`way["${tag.key}"][name];`);
      } else {
        parts.push(`node["${tag.key}"="${tag.value}"][name];`);
        parts.push(`way["${tag.key}"="${tag.value}"][name];`);
      }
    }
    
    return parts;
  }

  static getNWRQueryParts(category: string): string[] {
    const mapping = this.getMapping(category);
    const parts: string[] = [];
    
    for (const tag of mapping.tags) {
      if (tag.value === '*') {
        parts.push(`nwr["${tag.key}"][name];`);
      } else {
        parts.push(`nwr["${tag.key}"="${tag.value}"][name];`);
      }
    }
    
    return parts;
  }
}
