import axios from 'axios';
import * as cheerio from 'cheerio';
import https from 'https';
import { logger } from '../lib/monitoring.ts';

export interface EnrichedData {
  phone?: string;
  allPhones?: string[];
  email?: string;
  allEmails?: string[];
  whatsapp?: string;
  address?: string;
  openingHours?: string;
  legalName?: string;
  siretOrVat?: string;
  managerName?: string;
  tagline?: string;
  socialLinks: Record<string, string>;
  evidence: Array<{
    field: string;
    value: string;
    url: string;
    method: string;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  }>;
}

export class EnrichmentBot {
  private static USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 (compatible; LeadForge-Bot/2.5; +https://leadforge.app/)';

  static async enrich(url: string): Promise<EnrichedData> {
    const data: EnrichedData = { 
      socialLinks: {}, 
      evidence: [],
      allPhones: [],
      allEmails: []
    };

    let baseUrl: URL;
    try {
      baseUrl = new URL(url);
    } catch {
      return data;
    }

    const permissiveAgent = new https.Agent({ rejectUnauthorized: false });
    const visited = new Set<string>();

    const fetchPage = async (pageUrl: string) => {
      try {
        const response = await axios.get(pageUrl, {
          headers: { 
            'User-Agent': this.USER_AGENT,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
            'Cache-Control': 'no-cache'
          },
          httpsAgent: permissiveAgent,
          timeout: 3500, // Fast failover to keep speed blazing
          maxRedirects: 3,
          validateStatus: (status) => status >= 200 && status < 400
        });
        if (typeof response.data === 'string') {
          return { url: pageUrl, html: response.data };
        }
      } catch {
        // Page crawl non-critical failure
      }
      return null;
    };

    try {
      // 1. Fetch Main Homepage first
      visited.add(url);
      const homeResult = await fetchPage(url);
      if (!homeResult) return data;

      const $home = cheerio.load(homeResult.html);
      this.extractInfo($home, url, data);

      // 2. Discover high-priority subpages (Contact & Legal / Mentions Légales)
      let contactCandidate: string | null = null;
      let legalCandidate: string | null = null;

      $home('a').each((_, el) => {
        const href = $home(el).attr('href');
        const linkText = $home(el).text();
        if (href && (contactCandidate === null || legalCandidate === null)) {
          try {
            const absoluteUrl = new URL(href, url).href;
            const parsed = new URL(absoluteUrl);
            if (
              (parsed.hostname === baseUrl.hostname || parsed.hostname.endsWith('.' + baseUrl.hostname.replace(/^www\./, ''))) &&
              !parsed.hash &&
              !/\.(pdf|jpg|jpeg|png|gif|zip|doc)$/i.test(parsed.pathname)
            ) {
              const cleanPath = (parsed.origin + parsed.pathname).toLowerCase();
              const lower = (href + ' ' + linkText).toLowerCase();

              if (!contactCandidate && (lower.includes('contact') || lower.includes('nous-contacter') || lower.includes('coordonnees'))) {
                contactCandidate = cleanPath;
              }
              if (!legalCandidate && (lower.includes('mention') || lower.includes('legal') || lower.includes('impressum') || lower.includes('cgv') || lower.includes('propos'))) {
                legalCandidate = cleanPath;
              }
            }
          } catch {}
        }
      });

      // 3. Fast Parallel Subpage Crawl
      const candidates: (string | null)[] = [contactCandidate, legalCandidate];
      const subpagesToFetch = candidates.filter((u): u is string => typeof u === 'string' && !visited.has(u));
      subpagesToFetch.forEach(u => visited.add(u));

      if (subpagesToFetch.length > 0) {
        const results = await Promise.allSettled(subpagesToFetch.map(u => fetchPage(u)));
        for (const res of results) {
          if (res.status === 'fulfilled' && res.value) {
            const $sub = cheerio.load(res.value.html);
            this.extractInfo($sub, res.value.url, data);
          }
        }
      }
    } catch (err: any) {
      await logger.warn('CRAWLER', `Notice while enriching ${url}: ${err.message}`, { url }, 'WEBSITE_SCRAPER');
    }

    return data;
  }

  private static extractInfo($: cheerio.CheerioAPI, url: string, data: EnrichedData) {
    const bodyText = $('body').text();

    // 0. Extract Meta Tagline / Description
    if (!data.tagline) {
      const metaDesc = $('meta[name="description"]').attr('content') || 
                       $('meta[property="og:description"]').attr('content');
      if (metaDesc && metaDesc.trim().length > 15) {
        const clean = metaDesc.trim().replace(/\s+/g, ' ');
        data.tagline = clean;
        data.evidence.push({ field: 'tagline', value: clean.slice(0, 200), url, method: 'meta description', confidence: 'HIGH' });
      }
    }

    // 1. JSON-LD / Schema.org Structured Data Extraction
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const jsonContent = $(el).html();
        if (!jsonContent) return;
        const parsed = JSON.parse(jsonContent);
        this.extractFromJsonLd(parsed, url, data);
      } catch {}
    });

    // 2. Extract Phones from tel: links
    $('a[href^="tel:"]').each((_, el) => {
      const rawTel = $(el).attr('href')?.replace('tel:', '').trim();
      if (rawTel) {
        const clean = this.cleanPhoneNumber(rawTel);
        if (clean && this.isValidPhoneNumber(clean)) {
          if (!data.phone) data.phone = clean;
          if (!data.allPhones?.includes(clean)) {
            data.allPhones?.push(clean);
            data.evidence.push({ field: 'phone', value: clean, url, method: 'tel link', confidence: 'HIGH' });
          }
        }
      }
    });

    // 3. Fallback phone regex extraction (supports French 0X XX XX XX XX or +33 format)
    const frenchPhoneRegex = /(?:(?:\+|00)33[\s.-]?|0)[1-9](?:[\s.-]?\d{2}){4}/g;
    const phoneCandidates = bodyText.match(frenchPhoneRegex);
    if (phoneCandidates) {
      for (const raw of phoneCandidates) {
        const clean = this.cleanPhoneNumber(raw);
        if (clean && this.isValidPhoneNumber(clean)) {
          if (!data.phone) data.phone = clean;
          if (!data.allPhones?.includes(clean) && (data.allPhones?.length || 0) < 3) {
            data.allPhones?.push(clean);
            data.evidence.push({ field: 'phone', value: clean, url, method: 'regex text', confidence: 'MEDIUM' });
          }
        }
      }
    }

    // 4. Extract Emails from mailto: links
    $('a[href^="mailto:"]').each((_, el) => {
      const email = $(el).attr('href')?.replace('mailto:', '').split('?')[0].trim().toLowerCase();
      if (email && this.isValidEmail(email)) {
        if (!data.email) data.email = email;
        if (!data.allEmails?.includes(email)) {
          data.allEmails?.push(email);
          data.evidence.push({ field: 'email', value: email, url, method: 'mailto link', confidence: 'HIGH' });
        }
      }
    });

    // 5. Fallback email extraction
    const normalizedBodyText = bodyText
      .replace(/\s*\[at\]\s*/gi, '@')
      .replace(/\s*\(at\)\s*/gi, '@')
      .replace(/\s*\[dot\]\s*/gi, '.')
      .replace(/\s*\(dot\)\s*/gi, '.');

    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const foundEmails = normalizedBodyText.match(emailRegex);
    if (foundEmails) {
      for (const candidate of foundEmails) {
        const clean = candidate.toLowerCase().trim();
        if (this.isValidEmail(clean)) {
          if (!data.email) data.email = clean;
          if (!data.allEmails?.includes(clean) && (data.allEmails?.length || 0) < 3) {
            data.allEmails?.push(clean);
            data.evidence.push({ field: 'email', value: clean, url, method: 'regex body text', confidence: 'MEDIUM' });
          }
        }
      }
    }

    // 6. WhatsApp links
    const waRegex = /(?:wa\.me\/|api\.whatsapp\.com\/send\?phone=)(\+?\d+)/;
    $('a[href*="wa.me"], a[href*="whatsapp.com"]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const match = href.match(waRegex);
      if (match && !data.whatsapp) {
        data.whatsapp = match[1];
        data.evidence.push({ field: 'whatsapp', value: match[1], url, method: 'whatsapp CTA link', confidence: 'HIGH' });
      }
    });

    // 7. Extract Physical Address from HTML microdata / footer
    if (!data.address) {
      const street = $('[itemprop="streetAddress"]').text().trim();
      const postal = $('[itemprop="postalCode"]').text().trim();
      const locality = $('[itemprop="addressLocality"]').text().trim();
      if (street || locality) {
        const fullAddr = [street, postal, locality].filter(Boolean).join(', ');
        data.address = fullAddr;
        data.evidence.push({ field: 'address', value: fullAddr, url, method: 'schema microdata', confidence: 'HIGH' });
      }
    }

    // 8. Social Media Profile Links
    $('a').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;

      try {
        const lowerHref = href.toLowerCase();
        
        if (lowerHref.includes('facebook.com/') && !lowerHref.includes('/sharer') && !lowerHref.includes('/dialog')) {
          const cleanUrl = this.cleanSocialUrl(href);
          if (cleanUrl && !data.socialLinks.facebook) {
            data.socialLinks.facebook = cleanUrl;
            data.evidence.push({ field: 'facebook', value: cleanUrl, url, method: 'page link', confidence: 'HIGH' });
          }
        }

        if (lowerHref.includes('instagram.com/') && !lowerHref.includes('/p/') && !lowerHref.includes('/explore/')) {
          const cleanUrl = this.cleanSocialUrl(href);
          if (cleanUrl && !data.socialLinks.instagram) {
            data.socialLinks.instagram = cleanUrl;
            data.evidence.push({ field: 'instagram', value: cleanUrl, url, method: 'page link', confidence: 'HIGH' });
          }
        }

        if (lowerHref.includes('linkedin.com/company/') || lowerHref.includes('linkedin.com/in/')) {
          const cleanUrl = this.cleanSocialUrl(href);
          if (cleanUrl && !data.socialLinks.linkedin) {
            data.socialLinks.linkedin = cleanUrl;
            data.evidence.push({ field: 'linkedin', value: cleanUrl, url, method: 'page link', confidence: 'HIGH' });
          }
        }

        if ((lowerHref.includes('twitter.com/') || lowerHref.includes('x.com/')) && !lowerHref.includes('/intent')) {
          const cleanUrl = this.cleanSocialUrl(href);
          if (cleanUrl && !data.socialLinks.twitter) {
            data.socialLinks.twitter = cleanUrl;
            data.evidence.push({ field: 'twitter', value: cleanUrl, url, method: 'page link', confidence: 'HIGH' });
          }
        }
      } catch {}
    });

    // 9. Legal & Registry Data Extraction (SIRET, SIREN, TVA, Manager)
    if (!data.siretOrVat) {
      // SIRET (14 digits) or SIREN (9 digits)
      const siretMatch = bodyText.match(/(?:siret|siren|rcs|n°\s*siret)[\s:.-]*([0-9]{3}[\s\.]?[0-9]{3}[\s\.]?[0-9]{3}(?:[\s\.]?[0-9]{5})?)/i);
      if (siretMatch && siretMatch[1]) {
        const cleanSiret = siretMatch[1].replace(/\s+/g, ' ').trim();
        data.siretOrVat = cleanSiret;
        data.evidence.push({ field: 'legal_id', value: cleanSiret, url, method: 'legal notice text', confidence: 'HIGH' });
      }
    }

    if (!data.managerName) {
      const managerMatch = bodyText.match(/(?:dirigeant|gérant|directeur|responsable\s+de\s+la\s+publication|président)[\s:.-]*([A-ZÀ-ÖØ-ß][a-zà-öø-ÿ]+(?:\s+[A-ZÀ-ÖØ-ß][a-zà-öø-ÿ]+){1,3})/i);
      if (managerMatch && managerMatch[1]) {
        const manager = managerMatch[1].trim();
        if (manager.length > 3 && manager.length < 40) {
          data.managerName = manager;
          data.evidence.push({ field: 'manager', value: manager, url, method: 'legal notice text', confidence: 'HIGH' });
        }
      }
    }
  }

  private static extractFromJsonLd(dataObj: any, url: string, data: EnrichedData) {
    if (!dataObj || typeof dataObj !== 'object') return;

    if (Array.isArray(dataObj)) {
      for (const item of dataObj) this.extractFromJsonLd(item, url, data);
      return;
    }

    if (dataObj['@graph'] && Array.isArray(dataObj['@graph'])) {
      for (const item of dataObj['@graph']) this.extractFromJsonLd(item, url, data);
      return;
    }

    if (dataObj.telephone) {
      const tel = Array.isArray(dataObj.telephone) ? dataObj.telephone[0] : String(dataObj.telephone);
      const clean = this.cleanPhoneNumber(tel);
      if (clean && this.isValidPhoneNumber(clean)) {
        if (!data.phone) data.phone = clean;
        if (!data.allPhones?.includes(clean)) {
          data.allPhones?.push(clean);
          data.evidence.push({ field: 'phone', value: clean, url, method: 'JSON-LD Schema.org', confidence: 'HIGH' });
        }
      }
    }

    if (dataObj.email) {
      const email = Array.isArray(dataObj.email) ? dataObj.email[0] : String(dataObj.email).trim().toLowerCase();
      if (this.isValidEmail(email)) {
        if (!data.email) data.email = email;
        if (!data.allEmails?.includes(email)) {
          data.allEmails?.push(email);
          data.evidence.push({ field: 'email', value: email, url, method: 'JSON-LD Schema.org', confidence: 'HIGH' });
        }
      }
    }

    if (dataObj.address && !data.address) {
      const addr = dataObj.address;
      if (typeof addr === 'string') {
        data.address = addr;
        data.evidence.push({ field: 'address', value: addr, url, method: 'JSON-LD Schema.org', confidence: 'HIGH' });
      } else if (typeof addr === 'object') {
        const street = addr.streetAddress || '';
        const postal = addr.postalCode || '';
        const locality = addr.addressLocality || '';
        const country = addr.addressCountry || '';
        const fullAddr = [street, postal, locality, country].filter(Boolean).join(', ');
        if (fullAddr.length > 5) {
          data.address = fullAddr;
          data.evidence.push({ field: 'address', value: fullAddr, url, method: 'JSON-LD PostalAddress', confidence: 'HIGH' });
        }
      }
    }

    if (dataObj.openingHours && !data.openingHours) {
      const hours = Array.isArray(dataObj.openingHours) ? dataObj.openingHours.join(', ') : String(dataObj.openingHours);
      if (hours.length > 3) {
        data.openingHours = hours;
        data.evidence.push({ field: 'opening_hours', value: hours, url, method: 'JSON-LD openingHours', confidence: 'HIGH' });
      }
    }
  }

  private static cleanPhoneNumber(phone: string): string {
    return phone.trim().replace(/\s+/g, ' ');
  }

  private static isValidPhoneNumber(phone: string): boolean {
    const digitsOnly = phone.replace(/\D/g, '');
    if (digitsOnly.length < 7 || digitsOnly.length > 15) return false;
    if (/^(\d)\1+$/.test(digitsOnly)) return false;
    if (digitsOnly.startsWith('12345678') || digitsOnly.startsWith('012345678')) return false;
    return true;
  }

  private static isValidEmail(email: string): boolean {
    const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!re.test(email)) return false;
    const lower = email.toLowerCase();
    const invalidExtensions = ['.png', '.jpg', '.jpeg', '.svg', '.webp', '.gif', '.css', '.js'];
    if (invalidExtensions.some(ext => lower.endsWith(ext))) return false;
    const blockedKeywords = ['sentry', 'wixpress', 'example.com', 'domain.com', 'yourcompany', 'email.com', 'user@'];
    if (blockedKeywords.some(b => lower.includes(b))) return false;
    return true;
  }

  private static cleanSocialUrl(rawUrl: string): string {
    try {
      const u = new URL(rawUrl);
      return `${u.origin}${u.pathname}`.replace(/\/$/, '');
    } catch {
      return rawUrl.split('?')[0].replace(/\/$/, '');
    }
  }
}
