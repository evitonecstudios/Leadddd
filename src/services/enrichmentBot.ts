import axios from 'axios';
import * as cheerio from 'cheerio';
import { logger } from '../lib/monitoring.ts';

export interface EnrichedData {
  phone?: string;
  email?: string;
  whatsapp?: string;
  address?: string;
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
  private static MAX_PAGES = 8;
  private static USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 LeadForge-Bot/1.0';

  static async enrich(url: string): Promise<EnrichedData> {
    const data: EnrichedData = { socialLinks: {}, evidence: [] };
    const visited = new Set<string>();
    const queue: string[] = [url];
    
    let pagesCrawled = 0;

    while (queue.length > 0 && pagesCrawled < this.MAX_PAGES) {
      const currentUrl = queue.shift()!;
      if (visited.has(currentUrl)) continue;
      visited.add(currentUrl);
      pagesCrawled++;

      try {
        const response = await axios.get(currentUrl, {
          headers: { 'User-Agent': this.USER_AGENT },
          timeout: 15000,
          maxRedirects: 5
        });

        const $ = cheerio.load(response.data);
        this.extractInfo($, currentUrl, data);

        // Find subpages (Contact, About, Legal)
        if (pagesCrawled === 1) {
          $('a').each((_, el) => {
            const href = $(el).attr('href');
            if (href && this.isLikelyContactPage(href, $(el).text())) {
              const absoluteUrl = new URL(href, url).href;
              if (absoluteUrl.startsWith(url)) queue.push(absoluteUrl);
            }
          });
        }
      } catch (err: any) {
        await logger.warn('CRAWLER', `Failed to crawl ${currentUrl}: ${err.message}`, { url }, 'WEBSITE_SCRAPER');
      }
    }

    return data;
  }

  private static isLikelyContactPage(href: string, text: string): boolean {
    const lower = (href + ' ' + text).toLowerCase();
    return lower.includes('contact') || lower.includes('contacter') || lower.includes('about') || 
           lower.includes('propos') || lower.includes('legal') || lower.includes('imprint') || 
           lower.includes('impressum') || lower.includes('mention') || lower.includes('kontakt') ||
           lower.includes('nous-trouver') || lower.includes('qui-sommes-nous');
  }

  private static extractInfo($: cheerio.CheerioAPI, url: string, data: EnrichedData) {
    const bodyText = $('body').text();

    // 1. Extract Phones from tel: links
    const telLinks = $('a[href^="tel:"]');
    telLinks.each((_, el) => {
      const tel = $(el).attr('href')?.replace('tel:', '').trim();
      if (tel && !data.phone) {
        const clean = tel.replace(/[^\d+]/g, '');
        if (clean.length >= 8) {
          data.phone = tel;
          data.evidence.push({ field: 'phone', value: tel, url, method: 'tel link', confidence: 'HIGH' });
        }
      }
    });

    // Fallback: Extract Phone numbers directly from visible text (French, Swiss, UK, US, European formats)
    if (!data.phone) {
      const textPhoneRegex = /(?:(?:\+|00)(?:33|41|44|49|39|34|1)\s*(?:\(0\)\s*)?|0)[1-9](?:[\s.-]*\d{2}){4}|(?:\+?1[-.\s]?)?\(?[2-9]\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
      const phoneMatches = bodyText.match(textPhoneRegex);
      if (phoneMatches) {
        for (const candidate of phoneMatches) {
          const digitsOnly = candidate.replace(/\D/g, '');
          if (digitsOnly.length >= 9 && digitsOnly.length <= 14 && !digitsOnly.startsWith('0000')) {
            const cleanPhone = candidate.trim().replace(/\s+/g, ' ');
            data.phone = cleanPhone;
            data.evidence.push({ field: 'phone', value: cleanPhone, url, method: 'regex body text', confidence: 'MEDIUM' });
            break;
          }
        }
      }
    }

    // 2. Extract Emails from mailto: links
    const mailtoLinks = $('a[href^="mailto:"]');
    mailtoLinks.each((_, el) => {
      const email = $(el).attr('href')?.replace('mailto:', '').split('?')[0].trim().toLowerCase();
      if (email && !data.email && !email.includes('sentry') && !email.includes('wixpress') && !email.includes('example.com')) {
        data.email = email;
        data.evidence.push({ field: 'email', value: email, url, method: 'mailto link', confidence: 'HIGH' });
      }
    });

    // Fallback: Extract Email from body text with strict validation
    if (!data.email) {
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const found = bodyText.match(emailRegex);
      if (found && found.length > 0) {
        for (const em of found) {
          const cleanEmail = em.toLowerCase().trim();
          if (!cleanEmail.endsWith('.png') && !cleanEmail.endsWith('.jpg') && !cleanEmail.endsWith('.svg') &&
              !cleanEmail.endsWith('.webp') && !cleanEmail.includes('sentry') && !cleanEmail.includes('wixpress') &&
              !cleanEmail.includes('example.com') && !cleanEmail.includes('domain.com')) {
            data.email = cleanEmail;
            data.evidence.push({ field: 'email', value: cleanEmail, url, method: 'regex body', confidence: 'MEDIUM' });
            break;
          }
        }
      }
    }

    // 3. Extract WhatsApp
    const waRegex = /wa\.me\/(\d+)/;
    const waLink = $('a[href*="wa.me"]').attr('href');
    if (waLink && !data.whatsapp) {
      const match = waLink.match(waRegex);
      if (match) {
        data.whatsapp = match[1];
        data.evidence.push({ field: 'whatsapp', value: match[1], url, method: 'whatsapp link', confidence: 'HIGH' });
      }
    }

    // 4. Social Links
    $('a').each((_, el) => {
      const href = $(el).attr('href');
      if (href) {
        if (href.includes('facebook.com')) data.socialLinks.facebook = href;
        if (href.includes('instagram.com')) data.socialLinks.instagram = href;
        if (href.includes('linkedin.com')) data.socialLinks.linkedin = href;
        if (href.includes('twitter.com') || href.includes('x.com')) data.socialLinks.twitter = href;
      }
    });
  }
}
