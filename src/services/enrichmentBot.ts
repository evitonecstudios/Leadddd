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
  private static MAX_PAGES = 6;
  private static USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 (compatible; LeadForge-Bot/2.0; +https://leadforge.app/)';

  static async enrich(url: string): Promise<EnrichedData> {
    const data: EnrichedData = { 
      socialLinks: {}, 
      evidence: [],
      allPhones: [],
      allEmails: []
    };
    const visited = new Set<string>();
    const queue: string[] = [url];
    
    let pagesCrawled = 0;
    const permissiveAgent = new https.Agent({ rejectUnauthorized: false });

    // Normalize base URL
    let baseUrl: URL;
    try {
      baseUrl = new URL(url);
    } catch {
      return data;
    }

    while (queue.length > 0 && pagesCrawled < this.MAX_PAGES) {
      const currentUrl = queue.shift()!;
      if (visited.has(currentUrl)) continue;
      visited.add(currentUrl);
      pagesCrawled++;

      try {
        const response = await axios.get(currentUrl, {
          headers: { 
            'User-Agent': this.USER_AGENT,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8,de;q=0.7',
            'Cache-Control': 'no-cache'
          },
          httpsAgent: permissiveAgent,
          timeout: 10000,
          maxRedirects: 4,
          validateStatus: (status) => status >= 200 && status < 400
        });

        if (typeof response.data !== 'string') continue;
        const $ = cheerio.load(response.data);
        this.extractInfo($, currentUrl, data);

        // On initial page crawl, discover subpages (Contact, About, Legal/Impressum, Team, Services)
        if (pagesCrawled === 1) {
          const subpageCandidates = new Set<string>();
          $('a').each((_, el) => {
            const href = $(el).attr('href');
            const linkText = $(el).text();
            if (href && this.isLikelyContactOrInfoPage(href, linkText)) {
              try {
                const absoluteUrl = new URL(href, currentUrl).href;
                const parsed = new URL(absoluteUrl);
                // Ensure same origin or same root domain
                if (parsed.hostname === baseUrl.hostname || parsed.hostname.endsWith('.' + baseUrl.hostname.replace(/^www\./, ''))) {
                  // Ignore fragments and image/pdf downloads
                  if (!parsed.hash && !/\.(pdf|jpg|jpeg|png|gif|zip|doc)$/i.test(parsed.pathname)) {
                    subpageCandidates.add(parsed.origin + parsed.pathname);
                  }
                }
              } catch {
                // Invalid link
              }
            }
          });

          // Add up to 5 prioritized subpages to queue
          const prioritized = Array.from(subpageCandidates).slice(0, 5);
          queue.push(...prioritized);
        }
      } catch (err: any) {
        await logger.warn('CRAWLER', `Notice while crawling ${currentUrl}: ${err.message}`, { url }, 'WEBSITE_SCRAPER');
      }
    }

    return data;
  }

  private static isLikelyContactOrInfoPage(href: string, text: string): boolean {
    const lower = (href + ' ' + text).toLowerCase();
    return lower.includes('contact') || lower.includes('contacter') || 
           lower.includes('about') || lower.includes('propos') || 
           lower.includes('legal') || lower.includes('imprint') || 
           lower.includes('impressum') || lower.includes('mention') || 
           lower.includes('kontakt') || lower.includes('nous-trouver') || 
           lower.includes('qui-sommes-nous') || lower.includes('team') || 
           lower.includes('equipe') || lower.includes('services') ||
           lower.includes('info') || lower.includes('coordonnees');
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

    // 1. JSON-LD / Schema.org Structured Data Extraction (Highest Reliability)
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const jsonContent = $(el).html();
        if (!jsonContent) return;
        const parsed = JSON.parse(jsonContent);
        this.extractFromJsonLd(parsed, url, data);
      } catch {
        // Skip malformed JSON
      }
    });

    // 2. Extract Phones from tel: links
    const telLinks = $('a[href^="tel:"]');
    telLinks.each((_, el) => {
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

    // 3. Fallback phone regex extraction from body text
    const textPhoneRegex = /(?:(?:\+|00)(?:[1-9]\d{0,2})[\s.-]*)?(?:\(?\d{1,4}\)?[\s.-]*)?\d{2,4}[\s.-]*\d{2,4}[\s.-]*\d{2,4}/g;
    const phoneCandidates = bodyText.match(textPhoneRegex);
    if (phoneCandidates) {
      for (const raw of phoneCandidates) {
        // Verify not part of a date, postal code, or SIRET
        const clean = this.cleanPhoneNumber(raw);
        if (clean && this.isValidPhoneNumber(clean)) {
          // Avoid 14-digit SIRET or pure zeros
          const digits = clean.replace(/\D/g, '');
          if (digits.length >= 8 && digits.length <= 13) {
            if (!data.phone) data.phone = clean;
            if (!data.allPhones?.includes(clean) && (data.allPhones?.length || 0) < 3) {
              data.allPhones?.push(clean);
              data.evidence.push({ field: 'phone', value: clean, url, method: 'regex text', confidence: 'MEDIUM' });
            }
          }
        }
      }
    }

    // 4. Extract Emails from mailto: links
    const mailtoLinks = $('a[href^="mailto:"]');
    mailtoLinks.each((_, el) => {
      const email = $(el).attr('href')?.replace('mailto:', '').split('?')[0].trim().toLowerCase();
      if (email && this.isValidEmail(email)) {
        if (!data.email) data.email = email;
        if (!data.allEmails?.includes(email)) {
          data.allEmails?.push(email);
          data.evidence.push({ field: 'email', value: email, url, method: 'mailto link', confidence: 'HIGH' });
        }
      }
    });

    // 5. Fallback email extraction with anti-obfuscation ([at], (at), &#64;)
    let normalizedBodyText = bodyText
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

    // 6. Extract WhatsApp links
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

    // 8. Social Media Profile Links (Comprehensive detection & normalization)
    $('a').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;

      try {
        const lowerHref = href.toLowerCase();
        
        // Facebook
        if (lowerHref.includes('facebook.com/') && !lowerHref.includes('/sharer') && !lowerHref.includes('/dialog') && !lowerHref.includes('/tr?')) {
          const cleanUrl = this.cleanSocialUrl(href);
          if (cleanUrl && !data.socialLinks.facebook) {
            data.socialLinks.facebook = cleanUrl;
            data.evidence.push({ field: 'facebook', value: cleanUrl, url, method: 'page link', confidence: 'HIGH' });
          }
        }

        // Instagram
        if (lowerHref.includes('instagram.com/') && !lowerHref.includes('/p/') && !lowerHref.includes('/explore/')) {
          const cleanUrl = this.cleanSocialUrl(href);
          if (cleanUrl && !data.socialLinks.instagram) {
            data.socialLinks.instagram = cleanUrl;
            data.evidence.push({ field: 'instagram', value: cleanUrl, url, method: 'page link', confidence: 'HIGH' });
          }
        }

        // LinkedIn (Company or Showcase)
        if (lowerHref.includes('linkedin.com/company/') || lowerHref.includes('linkedin.com/in/')) {
          const cleanUrl = this.cleanSocialUrl(href);
          if (cleanUrl && !data.socialLinks.linkedin) {
            data.socialLinks.linkedin = cleanUrl;
            data.evidence.push({ field: 'linkedin', value: cleanUrl, url, method: 'page link', confidence: 'HIGH' });
          }
        }

        // Twitter / X
        if ((lowerHref.includes('twitter.com/') || lowerHref.includes('x.com/')) && !lowerHref.includes('/intent') && !lowerHref.includes('/share')) {
          const cleanUrl = this.cleanSocialUrl(href);
          if (cleanUrl && !data.socialLinks.twitter) {
            data.socialLinks.twitter = cleanUrl;
            data.evidence.push({ field: 'twitter', value: cleanUrl, url, method: 'page link', confidence: 'HIGH' });
          }
        }

        // TikTok
        if (lowerHref.includes('tiktok.com/@')) {
          const cleanUrl = this.cleanSocialUrl(href);
          if (cleanUrl && !data.socialLinks.tiktok) {
            data.socialLinks.tiktok = cleanUrl;
            data.evidence.push({ field: 'tiktok', value: cleanUrl, url, method: 'page link', confidence: 'HIGH' });
          }
        }

        // YouTube
        if (lowerHref.includes('youtube.com/@') || lowerHref.includes('youtube.com/channel/') || lowerHref.includes('youtube.com/c/')) {
          const cleanUrl = this.cleanSocialUrl(href);
          if (cleanUrl && !data.socialLinks.youtube) {
            data.socialLinks.youtube = cleanUrl;
            data.evidence.push({ field: 'youtube', value: cleanUrl, url, method: 'page link', confidence: 'HIGH' });
          }
        }

        // Pinterest
        if (lowerHref.includes('pinterest.com/') || lowerHref.includes('pinterest.fr/')) {
          const cleanUrl = this.cleanSocialUrl(href);
          if (cleanUrl && !data.socialLinks.pinterest) {
            data.socialLinks.pinterest = cleanUrl;
            data.evidence.push({ field: 'pinterest', value: cleanUrl, url, method: 'page link', confidence: 'HIGH' });
          }
        }
      } catch {
        // Skip link parsing errors
      }
    });

    // 9. Legal / Registry Data Extraction (SIRET, SIREN, TVA, Manager) on Legal / Impressum pages
    if (url.includes('mention') || url.includes('legal') || url.includes('impressum')) {
      // SIRET (14 digits)
      if (!data.siretOrVat) {
        const siretMatch = bodyText.match(/(?:siret|siren|rcs|tva|ide|vat)[\s:.-]*([0-9\s]{9,18}[0-9A-Z])/i);
        if (siretMatch && siretMatch[1]) {
          const cleanSiret = siretMatch[1].trim();
          data.siretOrVat = cleanSiret;
          data.evidence.push({ field: 'legal_id', value: cleanSiret, url, method: 'legal notice text', confidence: 'HIGH' });
        }
      }

      // Legal Representative / Manager
      if (!data.managerName) {
        const managerMatch = bodyText.match(/(?:dirigeant|gérant|directeur|responsable de la publication|geschäftsführer|managing director|ceo|fondateur)[\s:.-]*([A-Z][a-zÀ-ÿ]+(?:\s+[A-Z][a-zÀ-ÿ]+){1,3})/i);
        if (managerMatch && managerMatch[1]) {
          const manager = managerMatch[1].trim();
          if (manager.length > 3 && manager.length < 40) {
            data.managerName = manager;
            data.evidence.push({ field: 'manager', value: manager, url, method: 'legal notice text', confidence: 'HIGH' });
          }
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

    // Telephone
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

    // Email
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

    // Address
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

    // Opening Hours
    if (dataObj.openingHours && !data.openingHours) {
      const hours = Array.isArray(dataObj.openingHours) ? dataObj.openingHours.join(', ') : String(dataObj.openingHours);
      if (hours.length > 3) {
        data.openingHours = hours;
        data.evidence.push({ field: 'opening_hours', value: hours, url, method: 'JSON-LD openingHours', confidence: 'HIGH' });
      }
    }

    // Legal Name
    if (dataObj.legalName && !data.legalName) {
      data.legalName = String(dataObj.legalName).trim();
      data.evidence.push({ field: 'legal_name', value: data.legalName, url, method: 'JSON-LD legalName', confidence: 'HIGH' });
    }

    // sameAs (Social Media Profiles declared in Schema.org)
    if (dataObj.sameAs) {
      const sameAsList = Array.isArray(dataObj.sameAs) ? dataObj.sameAs : [dataObj.sameAs];
      for (const item of sameAsList) {
        if (typeof item === 'string') {
          const lower = item.toLowerCase();
          if (lower.includes('facebook.com') && !data.socialLinks.facebook) {
            data.socialLinks.facebook = item;
            data.evidence.push({ field: 'facebook', value: item, url, method: 'Schema sameAs', confidence: 'HIGH' });
          } else if (lower.includes('instagram.com') && !data.socialLinks.instagram) {
            data.socialLinks.instagram = item;
            data.evidence.push({ field: 'instagram', value: item, url, method: 'Schema sameAs', confidence: 'HIGH' });
          } else if (lower.includes('linkedin.com') && !data.socialLinks.linkedin) {
            data.socialLinks.linkedin = item;
            data.evidence.push({ field: 'linkedin', value: item, url, method: 'Schema sameAs', confidence: 'HIGH' });
          } else if ((lower.includes('twitter.com') || lower.includes('x.com')) && !data.socialLinks.twitter) {
            data.socialLinks.twitter = item;
            data.evidence.push({ field: 'twitter', value: item, url, method: 'Schema sameAs', confidence: 'HIGH' });
          } else if (lower.includes('tiktok.com') && !data.socialLinks.tiktok) {
            data.socialLinks.tiktok = item;
            data.evidence.push({ field: 'tiktok', value: item, url, method: 'Schema sameAs', confidence: 'HIGH' });
          } else if (lower.includes('youtube.com') && !data.socialLinks.youtube) {
            data.socialLinks.youtube = item;
            data.evidence.push({ field: 'youtube', value: item, url, method: 'Schema sameAs', confidence: 'HIGH' });
          }
        }
      }
    }
  }

  private static cleanPhoneNumber(phone: string): string {
    return phone.trim().replace(/\s+/g, ' ');
  }

  private static isValidPhoneNumber(phone: string): boolean {
    const digitsOnly = phone.replace(/\D/g, '');
    if (digitsOnly.length < 7 || digitsOnly.length > 15) return false;
    // Exclude repeated identical numbers (e.g. 000000000)
    if (/^(\d)\1+$/.test(digitsOnly)) return false;
    // Exclude dummy sequences
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
      // Remove query parameters (e.g. ?utm_source, ?ref, ?fbclid)
      return `${u.origin}${u.pathname}`.replace(/\/$/, '');
    } catch {
      return rawUrl.split('?')[0].replace(/\/$/, '');
    }
  }
}
