import { db } from '../db/index.ts';
import { leads, fieldEvidence } from '../db/schema.ts';
import { eq, and } from 'drizzle-orm';

export interface DataQualityReport {
  score: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  tier: 'A+' | 'A' | 'B' | 'C' | 'D';
  breakdown: {
    hasPhone: boolean;
    hasWebsite: boolean;
    hasEmail: boolean;
    hasAddress: boolean;
    hasLegalOrSocial: boolean;
  };
}

export class NormalizationService {
  static normalizeCompanyName(name: string): string {
    return name
      .trim()
      .replace(/\s+/g, ' ')
      .toUpperCase();
  }

  static normalizeDomain(url?: string | null): string | null {
    try {
      if (!url) return null;
      let clean = url.trim().toLowerCase();
      if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
        clean = 'http://' + clean;
      }
      const urlObj = new URL(clean);
      let hostname = urlObj.hostname;
      if (hostname.startsWith('www.')) {
        hostname = hostname.substring(4);
      }
      return hostname;
    } catch {
      return null;
    }
  }

  static normalizePhone(phone?: string | null): string {
    if (!phone) return '';
    // Keep only digits and initial plus sign
    const cleaned = phone.replace(/[^\d+]/g, '');
    return cleaned;
  }

  static formatDisplayPhone(phone?: string | null, country?: string | null): string {
    if (!phone) return '';
    const raw = phone.trim();
    const digits = raw.replace(/[^\d]/g, '');
    
    // France: 10 digits starting with 0, or 9 digits after 33
    if (digits.startsWith('33') && digits.length === 11) {
      const rest = digits.slice(2);
      return `+33 ${rest[0]} ${rest.slice(1, 3)} ${rest.slice(3, 5)} ${rest.slice(5, 7)} ${rest.slice(7, 9)}`;
    }
    if (digits.startsWith('0') && digits.length === 10) {
      return `${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 6)} ${digits.slice(6, 8)} ${digits.slice(8, 10)}`;
    }

    // Switzerland: +41
    if (digits.startsWith('41') && digits.length >= 10) {
      const rest = digits.slice(2);
      return `+41 ${rest.slice(0, 2)} ${rest.slice(2, 5)} ${rest.slice(5, 7)} ${rest.slice(7)}`;
    }

    // Belgium: +32
    if (digits.startsWith('32') && digits.length >= 9) {
      const rest = digits.slice(2);
      return `+32 ${rest.slice(0, 1)} ${rest.slice(1, 4)} ${rest.slice(4, 6)} ${rest.slice(6)}`;
    }

    return raw;
  }

  static normalizeEmail(email?: string | null): string {
    if (!email) return '';
    return email.trim().toLowerCase();
  }

  static computeDataQuality(data: any): DataQualityReport {
    let score = 0;
    const hasPhone = Boolean(data.phone && data.phone.trim().length >= 6);
    const hasWebsite = Boolean(data.website && data.website.trim().length >= 4);
    const hasEmail = Boolean(data.email && ValidationService.validateEmail(data.email));
    const hasAddress = Boolean(data.address && data.address.trim().length >= 6);
    const hasLegalOrSocial = Boolean(
      (data.notes && (data.notes.includes('SIRET') || data.notes.includes('Dirigeant') || data.notes.includes('WhatsApp'))) ||
      (data.rawData?.socialLinks && Object.values(data.rawData.socialLinks).some(Boolean))
    );

    if (hasPhone) score += 30;
    if (hasWebsite) score += 25;
    if (hasEmail) score += 20;
    if (hasAddress) score += 15;
    if (hasLegalOrSocial) score += 10;

    let tier: 'A+' | 'A' | 'B' | 'C' | 'D' = 'D';
    if (score >= 90) tier = 'A+';
    else if (score >= 75) tier = 'A';
    else if (score >= 50) tier = 'B';
    else if (score >= 30) tier = 'C';

    const confidence: 'HIGH' | 'MEDIUM' | 'LOW' = score >= 70 ? 'HIGH' : score >= 40 ? 'MEDIUM' : 'LOW';

    return {
      score,
      confidence,
      tier,
      breakdown: {
        hasPhone,
        hasWebsite,
        hasEmail,
        hasAddress,
        hasLegalOrSocial
      }
    };
  }
}

export class ValidationService {
  static validateEmail(email: string): boolean {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!re.test(email)) return false;
    const lower = email.toLowerCase();
    if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.webp') || lower.endsWith('.svg') || lower.endsWith('.gif')) return false;
    if (lower.includes('sentry') || lower.includes('wixpress') || lower.includes('example.com') || lower.includes('noreply') || lower.includes('no-reply') || lower.includes('privacy')) return false;
    return true;
  }

  static validatePhone(phone: string): boolean {
    const clean = phone.replace(/[^\d]/g, '');
    return clean.length >= 7 && clean.length <= 15;
  }

  static isInvalidBusinessName(name?: string | null): boolean {
    if (!name) return true;
    const trimmed = name.trim();
    if (trimmed.length < 2) return true;
    if (!/[a-zA-Z\u00C0-\u024F]/.test(trimmed)) return true;

    const lower = trimmed.toLowerCase();
    const genericBlocked = [
      'unnamed', 'unknown', 'n/a', 'sans nom', 'point of interest', 'parking', 'abri bus', 'abribus', 'bus stop',
      'toilettes', 'toilet', 'wc', 'poste', 'boite aux lettres', 'post box', 'distributeur',
      'atm', 'substation', 'borne de recharge', 'recycling', 'poubelle', 'banc', 'bench',
      'calvaire', 'statue', 'monument', 'fontaine', 'cimetiere', 'cemetery', 'test',
      'chantier', 'batiment', 'building', 'residential', 'maison', 'residence', 'immeuble',
      'arret', 'gare', 'station service', 'station essence', 'lavoir', 'eglise', 'mairie',
      'salle des fetes', 'decheterie', 'poste de transformation'
    ];
    if (genericBlocked.some(b => lower === b || lower === `le ${b}` || lower === `la ${b}` || lower.startsWith(b + ' ') || lower.endsWith(' ' + b))) {
      return true;
    }
    if (/^\d+\s+(rue|avenue|boulevard|chemin|allee|route|place|str\.|strasse|gasse|street|road|ave)/i.test(lower)) {
      return true;
    }
    return false;
  }

  static isVerifiedBusiness(data: any, strictContact: boolean = false): boolean {
    if (this.isInvalidBusinessName(data.companyName)) return false;

    const hasPhone = Boolean(data.phone && data.phone.trim().length >= 6);
    const hasWebsite = Boolean(data.website && data.website.trim().length >= 4);
    const hasEmail = Boolean(data.email && this.validateEmail(data.email));
    const hasAddress = Boolean(data.address && data.address.trim().length >= 6);

    if (strictContact) {
      return hasPhone || hasWebsite || hasEmail;
    }

    return hasPhone || hasWebsite || hasEmail || hasAddress;
  }
}

export class LeadService {
  static async createLead(data: any, campaignId?: number, options?: { requireVerifiedContact?: boolean }) {
    if (ValidationService.isInvalidBusinessName(data.companyName)) {
      return { lead: null, status: 'rejected_unverified' as const };
    }

    if (options?.requireVerifiedContact && !ValidationService.isVerifiedBusiness(data, true)) {
      return { lead: null, status: 'rejected_unverified' as const };
    }

    const normalizedName = NormalizationService.normalizeCompanyName(data.companyName || '');
    const normalizedDomain = NormalizationService.normalizeDomain(data.website);
    const normalizedPhone = NormalizationService.normalizePhone(data.phone);
    const displayPhone = NormalizationService.formatDisplayPhone(data.phone, data.country);

    // Multi-factor Deduplication
    let existingLead: any = null;

    if (normalizedDomain) {
      existingLead = await db.query.leads.findFirst({
        where: campaignId 
          ? and(eq(leads.campaignId, campaignId), eq(leads.normalizedDomain, normalizedDomain))
          : eq(leads.normalizedDomain, normalizedDomain),
      });
    }

    if (!existingLead && normalizedPhone && normalizedPhone.length >= 7) {
      existingLead = await db.query.leads.findFirst({
        where: campaignId
          ? and(eq(leads.campaignId, campaignId), eq(leads.normalizedPhone, normalizedPhone))
          : eq(leads.normalizedPhone, normalizedPhone),
      });
    }

    if (!existingLead && normalizedName && (data.city || data.address)) {
      const conds = [
        eq(leads.normalizedCompanyName, normalizedName),
        data.city ? eq(leads.city, data.city) : undefined,
        campaignId ? eq(leads.campaignId, campaignId) : undefined
      ].filter(Boolean);

      existingLead = await db.query.leads.findFirst({
        where: and(...(conds as any[])),
      });
    }

    if (existingLead) {
      return { lead: existingLead, status: 'duplicate' as const };
    }

    const hasWebsite = Boolean(data.website);
    const qualityReport = NormalizationService.computeDataQuality({
      phone: displayPhone || data.phone,
      website: data.website,
      email: data.email,
      address: data.address,
      notes: data.notes,
      rawData: data.rawData
    });

    // Lead Storage
    const [newLead] = await db.insert(leads).values({
      campaignId,
      companyName: data.companyName,
      normalizedCompanyName: normalizedName,
      category: data.category,
      country: data.country,
      region: data.region,
      city: data.city,
      address: data.address,
      latitude: data.latitude,
      longitude: data.longitude,
      phone: displayPhone || data.phone,
      normalizedPhone: normalizedPhone || null,
      email: data.email,
      website: data.website,
      normalizedDomain,
      googleRating: data.googleRating,
      googleReviews: data.googleReviews,
      source: data.source || 'OpenStreetMap',
      sourceUrl: data.sourceUrl,
      discoverySource: data.source || 'OpenStreetMap',
      websiteStatus: hasWebsite ? (data.website?.includes('facebook.com') || data.website?.includes('instagram.com') || data.website?.includes('linkedin.com') ? 'social_profile' : 'verified') : 'unknown',
      websiteConfidence: hasWebsite ? 'HIGH' : 'UNKNOWN',
      dataConfidence: qualityReport.confidence,
      opportunityScore: qualityReport.score,
      leadStatus: 'NEW'
    }).returning();

    // Store Initial Field Evidence
    const evidenceItems: any[] = [];
    const sourceName = data.source === 'CSV' ? 'CSV_IMPORT' : 'OPENSTREETMAP';

    if (data.phone) {
      evidenceItems.push({
        leadId: newLead.id,
        fieldName: 'phone',
        value: displayPhone || data.phone,
        source: sourceName,
        sourceUrl: data.sourceUrl || null,
        verified: true,
        confidence: 'HIGH' as const,
      });
    }

    if (data.email) {
      evidenceItems.push({
        leadId: newLead.id,
        fieldName: 'email',
        value: data.email,
        source: sourceName,
        sourceUrl: data.sourceUrl || null,
        verified: true,
        confidence: 'HIGH' as const,
      });
    }

    if (data.address) {
      evidenceItems.push({
        leadId: newLead.id,
        fieldName: 'address',
        value: data.address,
        source: sourceName,
        sourceUrl: data.sourceUrl || null,
        verified: true,
        confidence: 'HIGH' as const,
      });
    }

    if (data.website) {
      evidenceItems.push({
        leadId: newLead.id,
        fieldName: 'website',
        value: data.website,
        source: sourceName,
        sourceUrl: data.sourceUrl || null,
        verified: true,
        confidence: 'HIGH' as const,
      });
    }

    if (data.rawData?.openingHours) {
      evidenceItems.push({
        leadId: newLead.id,
        fieldName: 'opening_hours',
        value: data.rawData.openingHours,
        source: sourceName,
        sourceUrl: data.sourceUrl || null,
        verified: true,
        confidence: 'HIGH' as const,
      });
    }

    if (data.rawData?.socialLinks) {
      Object.entries(data.rawData.socialLinks).forEach(([platform, url]) => {
        if (url && typeof url === 'string') {
          evidenceItems.push({
            leadId: newLead.id,
            fieldName: platform,
            value: url,
            source: sourceName,
            sourceUrl: url,
            verified: true,
            confidence: 'HIGH' as const,
          });
        }
      });
    }

    if (evidenceItems.length > 0) {
      await db.insert(fieldEvidence).values(evidenceItems);
    }

    return { lead: newLead, status: 'created' as const, qualityReport };
  }
}
