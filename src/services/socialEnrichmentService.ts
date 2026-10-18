import axios from 'axios';
import * as cheerio from 'cheerio';
import https from 'https';
import { logger } from '../lib/monitoring.ts';

export interface SocialEnrichmentResult {
  socialUrl?: string;
  platform?: 'facebook' | 'instagram' | 'linkedin' | 'twitter' | 'youtube' | 'tiktok';
  phone?: string;
  email?: string;
  address?: string;
  discoveredWebsite?: string;
  bio?: string;
  socialLinks: Record<string, string>;
  evidence: Array<{
    field: string;
    value: string;
    url: string;
    method: string;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  }>;
}

export class SocialEnrichmentService {
  private static CRAWLER_USER_AGENT = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)';
  private static GOOGLEBOT_USER_AGENT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

  /**
   * Normalizes and validates real social media profile URLs from verified data sources.
   * STRICT POLICY: NEVER guesses or invents synthetic profile URLs or slugs.
   */
  static async enrichFromSocialMedia(
    companyName: string, 
    city?: string, 
    country?: string,
    existingRawTags?: Record<string, any>
  ): Promise<SocialEnrichmentResult> {
    const result: SocialEnrichmentResult = {
      socialLinks: {},
      evidence: []
    };

    if (!existingRawTags) return result;

    // 1. Extract ONLY authentic social links present in real tags
    this.extractSocialFromTags(existingRawTags, result);

    // If no real social links found in tags, return immediately — ZERO synthetic guesses
    const verifiedCandidates: Array<{ url: string; platform: SocialEnrichmentResult['platform'] }> = [];
    if (result.socialLinks.facebook) verifiedCandidates.push({ url: result.socialLinks.facebook, platform: 'facebook' });
    if (result.socialLinks.instagram) verifiedCandidates.push({ url: result.socialLinks.instagram, platform: 'instagram' });
    if (result.socialLinks.linkedin) verifiedCandidates.push({ url: result.socialLinks.linkedin, platform: 'linkedin' });
    if (result.socialLinks.twitter) verifiedCandidates.push({ url: result.socialLinks.twitter, platform: 'twitter' });

    if (verifiedCandidates.length === 0) {
      return result;
    }

    // 2. Safely inspect verified public profiles for contact details (phone, email, real site)
    const permissiveAgent = new https.Agent({ rejectUnauthorized: false });

    for (const candidate of verifiedCandidates) {
      try {
        const userAgent = candidate.platform === 'facebook' ? this.CRAWLER_USER_AGENT : this.GOOGLEBOT_USER_AGENT;
        const res = await axios.get(candidate.url, {
          headers: {
            'User-Agent': userAgent,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8',
            'Cache-Control': 'no-cache'
          },
          httpsAgent: permissiveAgent,
          timeout: 4000,
          maxRedirects: 2,
          validateStatus: (status) => status >= 200 && status < 400
        });

        if (typeof res.data !== 'string') continue;
        const $ = cheerio.load(res.data);

        const ogTitle = $('meta[property="og:title"]').attr('content') || $('title').text() || '';
        const ogDesc = $('meta[property="og:description"]').attr('content') || 
                       $('meta[name="description"]').attr('content') || '';
        const fullSnippet = `${ogTitle} ${ogDesc}`.trim();

        // Discard generic login/splash boilerplate
        if (this.isGenericSocialBoilerplate(fullSnippet)) {
          continue;
        }

        // Extract real phone numbers from public social description
        if (!result.phone) {
          const phone = this.extractPhoneFromText(fullSnippet);
          if (phone) {
            result.phone = phone;
            result.evidence.push({
              field: 'phone',
              value: phone,
              url: candidate.url,
              method: `${candidate.platform?.toUpperCase()} Public Profile Bio`,
              confidence: 'HIGH'
            });
          }
        }

        // Extract real email from public social description
        if (!result.email) {
          const email = this.extractEmailFromText(fullSnippet);
          if (email) {
            result.email = email;
            result.evidence.push({
              field: 'email',
              value: email,
              url: candidate.url,
              method: `${candidate.platform?.toUpperCase()} Public Profile Bio`,
              confidence: 'HIGH'
            });
          }
        }

        // Extract external official website link if listed in bio
        if (!result.discoveredWebsite) {
          const websiteCandidate = this.extractWebsiteFromBio(fullSnippet);
          if (websiteCandidate) {
            result.discoveredWebsite = websiteCandidate;
            result.evidence.push({
              field: 'website',
              value: websiteCandidate,
              url: candidate.url,
              method: `${candidate.platform?.toUpperCase()} Bio External Link`,
              confidence: 'HIGH'
            });
          }
        }

      } catch (err: any) {
        // Safe skip
        await logger.warn('SOCIAL_SCRAPER', `Notice inspecting verified social URL ${candidate.url}: ${err.message}`, { companyName }, 'SOCIAL_SCRAPER');
      }
    }

    return result;
  }

  public static normalizeFacebookUrl(raw?: string): string | null {
    if (!raw || typeof raw !== 'string') return null;
    let clean = raw.trim();
    if (clean.length < 2) return null;

    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = clean.replace(/^@/, '').replace(/^facebook\.com\/?/i, '').replace(/^www\.facebook\.com\/?/i, '');
      if (!clean) return null;
      clean = `https://www.facebook.com/${clean}`;
    }

    try {
      const u = new URL(clean);
      if (!u.hostname.includes('facebook.com')) return null;
      const path = u.pathname.replace(/\/+$/, '').toLowerCase();
      const blockedPaths = ['', '/', '/home', '/login', '/policies', '/help', '/sharer', '/share', '/dialog', '/tr', '/plugins', '/pages'];
      if (blockedPaths.includes(path) || path.length < 2) return null;
      return `${u.origin}${u.pathname}`;
    } catch {
      return null;
    }
  }

  public static normalizeInstagramUrl(raw?: string): string | null {
    if (!raw || typeof raw !== 'string') return null;
    let clean = raw.trim();
    if (clean.length < 2) return null;

    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = clean.replace(/^@/, '').replace(/^instagram\.com\/?/i, '').replace(/^www\.instagram\.com\/?/i, '').replace(/\/$/, '');
      if (!clean) return null;
      clean = `https://www.instagram.com/${clean}/`;
    }

    try {
      const u = new URL(clean);
      if (!u.hostname.includes('instagram.com')) return null;
      const path = u.pathname.replace(/\/+$/, '').toLowerCase();
      const blockedPaths = ['', '/', '/p', '/explore', '/stories', '/reels', '/accounts', '/about', '/legal', '/direct'];
      if (blockedPaths.includes(path) || path.length < 2) return null;
      return `${u.origin}${u.pathname.endsWith('/') ? u.pathname : `${u.pathname}/`}`;
    } catch {
      return null;
    }
  }

  public static normalizeLinkedInUrl(raw?: string): string | null {
    if (!raw || typeof raw !== 'string') return null;
    let clean = raw.trim();
    if (clean.length < 3) return null;

    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = clean.replace(/^@/, '').replace(/^linkedin\.com\/?/i, '').replace(/^www\.linkedin\.com\/?/i, '');
      if (!clean) return null;
      clean = clean.startsWith('company/') || clean.startsWith('in/')
        ? `https://www.linkedin.com/${clean}`
        : `https://www.linkedin.com/company/${clean}`;
    }

    try {
      const u = new URL(clean);
      if (!u.hostname.includes('linkedin.com')) return null;
      const path = u.pathname.replace(/\/+$/, '').toLowerCase();
      if (!path || path === '/' || path === '/company' || path === '/in') return null;
      return `${u.origin}${u.pathname}`;
    } catch {
      return null;
    }
  }

  public static normalizeTwitterUrl(raw?: string): string | null {
    if (!raw || typeof raw !== 'string') return null;
    let clean = raw.trim();
    if (clean.length < 2) return null;

    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = clean.replace(/^@/, '').replace(/^(?:twitter|x)\.com\/?/i, '');
      if (!clean) return null;
      clean = `https://x.com/${clean}`;
    }

    try {
      const u = new URL(clean);
      if (!u.hostname.includes('twitter.com') && !u.hostname.includes('x.com')) return null;
      const path = u.pathname.replace(/\/+$/, '').toLowerCase();
      const blockedPaths = ['', '/', '/home', '/login', '/intent', '/share', '/search'];
      if (blockedPaths.includes(path) || path.length < 2) return null;
      return `${u.origin}${u.pathname}`;
    } catch {
      return null;
    }
  }

  private static extractSocialFromTags(tags: Record<string, any>, result: SocialEnrichmentResult) {
    const rawFb = tags['contact:facebook'] || tags.facebook;
    const cleanFb = this.normalizeFacebookUrl(rawFb);
    if (cleanFb) {
      result.socialLinks.facebook = cleanFb;
      result.evidence.push({ field: 'facebook', value: cleanFb, url: cleanFb, method: 'OpenStreetMap contact tag', confidence: 'HIGH' });
    }

    const rawInsta = tags['contact:instagram'] || tags.instagram;
    const cleanInsta = this.normalizeInstagramUrl(rawInsta);
    if (cleanInsta) {
      result.socialLinks.instagram = cleanInsta;
      result.evidence.push({ field: 'instagram', value: cleanInsta, url: cleanInsta, method: 'OpenStreetMap contact tag', confidence: 'HIGH' });
    }

    const rawLi = tags['contact:linkedin'] || tags.linkedin;
    const cleanLi = this.normalizeLinkedInUrl(rawLi);
    if (cleanLi) {
      result.socialLinks.linkedin = cleanLi;
      result.evidence.push({ field: 'linkedin', value: cleanLi, url: cleanLi, method: 'OpenStreetMap contact tag', confidence: 'HIGH' });
    }

    const rawTw = tags['contact:twitter'] || tags.twitter;
    const cleanTw = this.normalizeTwitterUrl(rawTw);
    if (cleanTw) {
      result.socialLinks.twitter = cleanTw;
      result.evidence.push({ field: 'twitter', value: cleanTw, url: cleanTw, method: 'OpenStreetMap contact tag', confidence: 'HIGH' });
    }

    const phone = tags.phone || tags['contact:phone'] || tags['phone:mobile'] || tags.mobile;
    if (phone && !result.phone) {
      result.phone = String(phone).trim();
      result.evidence.push({ field: 'phone', value: result.phone, url: 'https://www.openstreetmap.org/', method: 'OpenStreetMap contact:phone tag', confidence: 'HIGH' });
    }

    const email = tags.email || tags['contact:email'];
    if (email && !result.email) {
      result.email = String(email).trim().toLowerCase();
      result.evidence.push({ field: 'email', value: result.email, url: 'https://www.openstreetmap.org/', method: 'OpenStreetMap contact:email tag', confidence: 'HIGH' });
    }
  }

  private static isGenericSocialBoilerplate(text: string): boolean {
    const lower = text.toLowerCase();
    const boilerplateKeywords = [
      'welcome back to instagram',
      'log in to check out what your friends',
      'log into facebook',
      'see posts, photos and more on facebook',
      'create an account or log in',
      'join facebook to connect',
      'login • instagram',
      'sign up for facebook'
    ];
    return boilerplateKeywords.some(b => lower.includes(b));
  }

  private static extractPhoneFromText(text: string): string | undefined {
    const phoneRegex = /(?:(?:\+|00)(?:[1-9]\d{0,2})[\s.-]*)?(?:\(?\d{1,4}\)?[\s.-]*)?\d{2,4}[\s.-]*\d{2,4}[\s.-]*\d{2,4}/g;
    const matches = text.match(phoneRegex);
    if (!matches) return undefined;

    for (const match of matches) {
      const digits = match.replace(/\D/g, '');
      if (digits.length >= 8 && digits.length <= 13 && !digits.startsWith('0000') && !digits.startsWith('123456')) {
        return match.trim().replace(/\s+/g, ' ');
      }
    }
    return undefined;
  }

  private static extractEmailFromText(text: string): string | undefined {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const matches = text.match(emailRegex);
    if (!matches) return undefined;

    for (const match of matches) {
      const email = match.toLowerCase().trim();
      if (!email.includes('facebook') && !email.includes('instagram') && !email.includes('example.com') && !email.endsWith('.png')) {
        return email;
      }
    }
    return undefined;
  }

  private static extractWebsiteFromBio(text: string): string | undefined {
    const urlRegex = /(?:https?:\/\/|www\.)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[^\s,)]*)?/g;
    const matches = text.match(urlRegex);
    if (!matches) return undefined;

    for (const match of matches) {
      const lower = match.toLowerCase();
      if (!lower.includes('facebook.com') && !lower.includes('instagram.com') && 
          !lower.includes('fb.me') && !lower.includes('twitter.com') && !lower.includes('x.com') &&
          !lower.includes('bit.ly') && !lower.includes('linktr.ee')) {
        return match.startsWith('http') ? match : `https://${match}`;
      }
    }
    return undefined;
  }
}
