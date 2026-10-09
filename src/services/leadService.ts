import { db } from '../db/index.ts';
import { leads, fieldEvidence } from '../db/schema.ts';
import { eq, and, sql } from 'drizzle-orm';

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

  static normalizeEmail(email?: string | null): string {
    if (!email) return '';
    return email.trim().toLowerCase();
  }
}

export class ValidationService {
  static validateEmail(email: string): boolean {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    // Exclude common junk patterns
    if (!re.test(email)) return false;
    const lower = email.toLowerCase();
    if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.webp') || lower.endsWith('.svg')) return false;
    if (lower.includes('sentry') || lower.includes('wixpress') || lower.includes('example.com')) return false;
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
    // Must contain actual alphabetical characters
    if (!/[a-zA-Z\u00C0-\u024F]/.test(trimmed)) return true;

    const lower = trimmed.toLowerCase();
    // Exclude generic urban features, public utilities, and placeholder names
    const genericBlocked = [
      'unnamed', 'unknown', 'n/a', 'sans nom', 'point of interest', 'parking', 'abri bus', 'bus stop',
      'toilettes', 'toilet', 'wc', 'poste', 'boite aux lettres', 'post box', 'distributeur',
      'atm', 'substation', 'borne de recharge', 'recycling', 'poubelle', 'banc', 'bench',
      'calvaire', 'statue', 'monument', 'fontaine', 'cimetiere', 'cemetery', 'test',
      'chantier', 'batiment', 'building', 'residential', 'maison', 'residence', 'immeuble',
      'arret', 'gare', 'station service', 'station essence', 'lavoir', 'eglise'
    ];
    if (genericBlocked.some(b => lower === b || lower === `le ${b}` || lower === `la ${b}` || lower.startsWith(b + ' ') || lower.endsWith(' ' + b))) {
      return true;
    }
    // Block pure numbers or pure street addresses with no trade/company name (e.g. "42 Rue de la Paix")
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
      // Must have at least one direct communication channel
      return hasPhone || hasWebsite || hasEmail;
    }

    // Must either have direct communication channel or verifiable location with valid name
    return hasPhone || hasWebsite || hasEmail || hasAddress;
  }
}

export class LeadService {
  static async createLead(data: any, campaignId?: number, options?: { requireVerifiedContact?: boolean }) {
    // 0. Strict Lead Verification Check
    if (ValidationService.isInvalidBusinessName(data.companyName)) {
      return { lead: null, status: 'rejected_unverified' as const };
    }

    if (options?.requireVerifiedContact && !ValidationService.isVerifiedBusiness(data, true)) {
      return { lead: null, status: 'rejected_unverified' as const };
    }

    const normalizedName = NormalizationService.normalizeCompanyName(data.companyName || '');
    const normalizedDomain = NormalizationService.normalizeDomain(data.website);
    const normalizedPhone = NormalizationService.normalizePhone(data.phone);

    // 1. Multi-factor Deduplication (scoped to campaign if provided)
    let existingLead: any = null;

    // Check by Domain
    if (normalizedDomain) {
      existingLead = await db.query.leads.findFirst({
        where: campaignId 
          ? and(eq(leads.campaignId, campaignId), eq(leads.normalizedDomain, normalizedDomain))
          : eq(leads.normalizedDomain, normalizedDomain),
      });
    }

    // Check by Phone
    if (!existingLead && normalizedPhone && normalizedPhone.length >= 7) {
      existingLead = await db.query.leads.findFirst({
        where: campaignId
          ? and(eq(leads.campaignId, campaignId), eq(leads.normalizedPhone, normalizedPhone))
          : eq(leads.normalizedPhone, normalizedPhone),
      });
    }

    // Check by Company Name + City (prevents duplicate cells from duplicating contact-less businesses)
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
    const hasPhone = Boolean(data.phone);

    // 2. Lead Storage
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
      phone: data.phone,
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
      dataConfidence: (hasWebsite && hasPhone) ? 'HIGH' : (hasWebsite || hasPhone) ? 'MEDIUM' : 'LOW',
      leadStatus: 'NEW'
    }).returning();

    // 3. Store Initial Field Evidence
    const evidenceItems: any[] = [];
    const sourceName = data.source === 'CSV' ? 'CSV_IMPORT' : 'OPENSTREETMAP';

    if (data.phone) {
      evidenceItems.push({
        leadId: newLead.id,
        fieldName: 'phone',
        value: data.phone,
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

    return { lead: newLead, status: 'created' as const };
  }
}
