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
}

export class LeadService {
  static async createLead(data: any, campaignId?: number) {
    const normalizedName = NormalizationService.normalizeCompanyName(data.companyName || '');
    const normalizedDomain = NormalizationService.normalizeDomain(data.website);
    const normalizedPhone = NormalizationService.normalizePhone(data.phone);

    // 1. Multi-factor Deduplication
    let existingLead: any = null;

    // Check by Domain
    if (normalizedDomain) {
      existingLead = await db.query.leads.findFirst({
        where: eq(leads.normalizedDomain, normalizedDomain),
      });
    }

    // Check by Phone
    if (!existingLead && normalizedPhone && normalizedPhone.length >= 7) {
      existingLead = await db.query.leads.findFirst({
        where: eq(leads.normalizedPhone, normalizedPhone),
      });
    }

    // Check by Company Name + City (prevents duplicate cells from duplicating contact-less businesses)
    if (!existingLead && normalizedName && (data.city || data.address)) {
      existingLead = await db.query.leads.findFirst({
        where: and(
          eq(leads.normalizedCompanyName, normalizedName),
          data.city ? eq(leads.city, data.city) : undefined
        ),
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
      websiteStatus: hasWebsite ? 'verified' : 'unknown',
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

    if (evidenceItems.length > 0) {
      await db.insert(fieldEvidence).values(evidenceItems);
    }

    return { lead: newLead, status: 'created' as const };
  }
}
