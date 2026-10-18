/**
 * Phone Number & WhatsApp Classification Utilities
 * Ensures only confirmed mobile numbers or explicitly verified WhatsApp numbers
 * are linked to WhatsApp (wa.me), avoiding "number is not on WhatsApp" errors on landlines.
 */

export type PhoneType = 'mobile' | 'fixed' | 'toll_free' | 'unknown';

export interface PhoneAnalysis {
  cleanedDigits: string;
  internationalNumber: string;
  type: PhoneType;
  isWhatsAppReady: boolean;
  typeLabel: string;
  directCallUrl: string;
  whatsappUrl: string | null;
}

/**
 * Normalizes phone number into international E.164 digits without leading '+'
 */
export function formatInternationalNumber(phone?: string | null, country?: string | null): string {
  if (!phone) return '';
  let cleaned = phone.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  } else if (cleaned.startsWith('00')) {
    cleaned = cleaned.substring(2);
  } else if (cleaned.startsWith('0')) {
    const c = (country || '').toLowerCase();
    if (c.includes('switz') || c.includes('suisse') || c.includes('ch')) {
      cleaned = '41' + cleaned.substring(1);
    } else if (c.includes('belg') || c.includes('be')) {
      cleaned = '32' + cleaned.substring(1);
    } else if (c.includes('tunis') || c.includes('tn')) {
      cleaned = '216' + cleaned.substring(1);
    } else if (c.includes('maroc') || c.includes('morocco') || c.includes('ma')) {
      cleaned = '212' + cleaned.substring(1);
    } else if (c.includes('alger') || c.includes('dz')) {
      cleaned = '213' + cleaned.substring(1);
    } else if (c.includes('ger') || c.includes('de')) {
      cleaned = '49' + cleaned.substring(1);
    } else if (c.includes('uk') || c.includes('gb') || c.includes('united kingdom')) {
      cleaned = '44' + cleaned.substring(1);
    } else if (c.includes('can') || c.includes('quebec') || c.includes('us') || c.includes('usa')) {
      cleaned = '1' + cleaned.substring(1);
    } else {
      // Default to France (+33)
      cleaned = '33' + cleaned.substring(1);
    }
  }
  return cleaned;
}

/**
 * Detects whether a phone number is a mobile number or landline based on international prefix rules.
 */
export function analyzePhoneNumber(
  phone?: string | null, 
  country?: string | null, 
  hasExplicitWhatsAppEvidence = false
): PhoneAnalysis {
  if (!phone) {
    return {
      cleanedDigits: '',
      internationalNumber: '',
      type: 'unknown',
      isWhatsAppReady: false,
      typeLabel: 'Non renseigné',
      directCallUrl: '',
      whatsappUrl: null
    };
  }

  const intl = formatInternationalNumber(phone, country);
  const directCallUrl = `tel:${phone.replace(/\s+/g, '')}`;

  // If explicit evidence from OSM or website confirms WhatsApp (e.g. wa.me link extracted)
  if (hasExplicitWhatsAppEvidence) {
    return {
      cleanedDigits: intl,
      internationalNumber: intl,
      type: 'mobile',
      isWhatsAppReady: true,
      typeLabel: 'WhatsApp Vérifié',
      directCallUrl,
      whatsappUrl: `https://wa.me/${intl}`
    };
  }

  let type: PhoneType = 'unknown';

  // 1. France (+33)
  if (intl.startsWith('33')) {
    const national = intl.substring(2);
    if (/^[67]\d{8}$/.test(national)) {
      type = 'mobile';
    } else if (/^[1-59]\d{8}$/.test(national)) {
      type = 'fixed';
    } else if (/^8\d{8}$/.test(national)) {
      type = 'toll_free';
    }
  }
  // 2. Switzerland (+41)
  else if (intl.startsWith('41')) {
    const national = intl.substring(2);
    if (/^7[5-9]\d{7}$/.test(national)) {
      type = 'mobile';
    } else if (/^(800|848|844|840|900)\d{6}$/.test(national)) {
      type = 'toll_free';
    } else {
      type = 'fixed';
    }
  }
  // 3. Belgium (+32)
  else if (intl.startsWith('32')) {
    const national = intl.substring(2);
    if (/^4[5-9]\d{7}$/.test(national)) {
      type = 'mobile';
    } else {
      type = 'fixed';
    }
  }
  // 4. Germany (+49)
  else if (intl.startsWith('49')) {
    const national = intl.substring(2);
    if (/^1[567]\d+$/.test(national)) {
      type = 'mobile';
    } else {
      type = 'fixed';
    }
  }
  // 5. United Kingdom (+44)
  else if (intl.startsWith('44')) {
    const national = intl.substring(2);
    if (/^7\d{9}$/.test(national)) {
      type = 'mobile';
    } else {
      type = 'fixed';
    }
  }
  // 6. Tunisia (+216)
  else if (intl.startsWith('216')) {
    const national = intl.substring(3);
    if (/^[2459]\d{7}$/.test(national)) {
      type = 'mobile';
    } else {
      type = 'fixed';
    }
  }
  // 7. Morocco (+212)
  else if (intl.startsWith('212')) {
    const national = intl.substring(3);
    if (/^[67]\d{8}$/.test(national)) {
      type = 'mobile';
    } else {
      type = 'fixed';
    }
  }
  // 8. Spain (+34)
  else if (intl.startsWith('34')) {
    const national = intl.substring(2);
    if (/^[67]\d{8}$/.test(national)) {
      type = 'mobile';
    } else {
      type = 'fixed';
    }
  }
  // 9. North America (+1) - mobile/fixed share area codes
  else if (intl.startsWith('1') && intl.length === 11) {
    type = 'unknown';
  } else {
    // Check raw string if starting with 06 or 07
    const trimmed = phone.trim().replace(/\s+/g, '');
    if (/^0[67]\d{8}$/.test(trimmed)) {
      type = 'mobile';
    } else if (/^0[1-5]\d{8}$/.test(trimmed)) {
      type = 'fixed';
    }
  }

  const isWhatsAppReady = type === 'mobile';
  const whatsappUrl = isWhatsAppReady ? `https://wa.me/${intl}` : null;

  let typeLabel = 'Téléphone';
  if (type === 'mobile') typeLabel = 'Mobile (WhatsApp)';
  else if (type === 'fixed') typeLabel = 'Ligne Fixe';
  else if (type === 'toll_free') typeLabel = 'Numéro Gratuit / Spécial';

  return {
    cleanedDigits: intl,
    internationalNumber: intl,
    type,
    isWhatsAppReady,
    typeLabel,
    directCallUrl,
    whatsappUrl
  };
}

/**
 * Backward compatible helper
 */
export function formatWhatsAppNumber(phone?: string | null, country?: string | null): string {
  return formatInternationalNumber(phone, country);
}
