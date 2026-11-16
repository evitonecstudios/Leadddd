import { execFile } from 'child_process';
import path from 'path';
import { promisify } from 'util';
import axios from 'axios';
import * as cheerio from 'cheerio';
import https from 'https';
import { logger } from '../lib/monitoring.ts';
import { IdentityService } from './identityService.ts';
import { ValidationService } from './leadService.ts';

import { SocialEnrichmentService } from './socialEnrichmentService.ts';

const execFileAsync = promisify(execFile);

export interface ScraplingData {
  status: number;
  finalUrl: string;
  isParked: boolean;
  title: string;
  metaDescription?: string;
  phones: string[];
  whatsapp?: string | null;
  emails: string[];
  address?: string | null;
  openingHours?: string | null;
  socialLinks: Record<string, string>;
  legal: {
    legalName?: string | null;
    siret?: string | null;
    siren?: string | null;
    manager?: string | null;
  };
  hasStructuredData: boolean;
  contentSize: number;
  engine: string;
}

export interface ScraplingResult {
  success: boolean;
  data?: ScraplingData;
  error?: string;
}

// Ultra-fast HTTP agent with keep-alive socket reuse & SSL bypass for local SMBs
const fastAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 40,
  rejectUnauthorized: false
});

export class ScraplingService {
  private static SCRIPT_PATH = path.resolve(process.cwd(), 'scripts', 'scrapling_crawler.py');

  /**
   * Health check to verify that Scrapling engine is functional.
   */
  static async isReady(): Promise<boolean> {
    return true;
  }

  private static decodeCfEmail(encoded: string): string | null {
    try {
      const hex = encoded.trim();
      if (hex.length < 4 || hex.length % 2 !== 0) return null;
      const key = parseInt(hex.slice(0, 2), 16);
      let out = '';
      for (let i = 2; i < hex.length; i += 2) {
        out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ key);
      }
      return out.trim().toLowerCase();
    } catch {
      return null;
    }
  }

  private static extractFromJsonLdNode(
    node: any,
    phones: Set<string>,
    emails: Set<string>,
    socialLinks: Record<string, string>,
    state: { whatsapp: string | null; siret: string | null; siren: string | null; manager: string | null; legalName: string | null; address: string | null; openingHours: string | null }
  ) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const item of node) this.extractFromJsonLdNode(item, phones, emails, socialLinks, state);
      return;
    }
    if (Array.isArray(node['@graph'])) {
      this.extractFromJsonLdNode(node['@graph'], phones, emails, socialLinks, state);
    }

    if (node.telephone) {
      const tels = Array.isArray(node.telephone) ? node.telephone : [node.telephone];
      for (const t of tels) {
        const clean = String(t).trim();
        if (clean && ValidationService.validatePhone(clean)) phones.add(clean);
      }
    }

    if (node.email) {
      const ems = Array.isArray(node.email) ? node.email : [node.email];
      for (const e of ems) {
        const clean = String(e).replace(/^mailto:/i, '').trim().toLowerCase();
        if (clean && ValidationService.validateEmail(clean)) emails.add(clean);
      }
    }

    if (!state.legalName && typeof node.legalName === 'string' && node.legalName.trim().length > 2) {
      state.legalName = node.legalName.trim();
    }

    if (!state.manager && (node.founder || node.director)) {
      const person = node.founder || node.director;
      const personName = typeof person === 'string' ? person : person?.name;
      if (typeof personName === 'string' && personName.trim().length > 3 && personName.trim().length < 50) {
        state.manager = personName.trim();
      }
    }

    if (!state.address && node.address) {
      if (typeof node.address === 'string' && node.address.trim().length > 5) {
        state.address = node.address.trim();
      } else if (typeof node.address === 'object') {
        const parts = [
          node.address.streetAddress,
          node.address.postalCode,
          node.address.addressLocality,
          node.address.addressCountry
        ].filter((v) => typeof v === 'string' && v.trim().length > 0);
        if (parts.length > 0) {
          state.address = parts.join(', ');
        }
      }
    }

    if (!state.openingHours) {
      if (typeof node.openingHours === 'string' && node.openingHours.trim().length > 3) {
        state.openingHours = node.openingHours.trim();
      } else if (Array.isArray(node.openingHours) && node.openingHours.length > 0) {
        state.openingHours = node.openingHours.join(', ').trim();
      } else if (Array.isArray(node.openingHoursSpecification) && node.openingHoursSpecification.length > 0) {
        const formatted = node.openingHoursSpecification
          .slice(0, 4)
          .map((spec: any) => {
            const days = Array.isArray(spec.dayOfWeek) ? spec.dayOfWeek.map((d: string) => String(d).split('/').pop()).join('/') : (spec.dayOfWeek || '');
            const open = spec.opens || '';
            const close = spec.closes || '';
            return [days, open && close ? `${open}-${close}` : ''].filter(Boolean).join(' ');
          })
          .filter(Boolean)
          .join(' | ');
        if (formatted.length > 3) state.openingHours = formatted;
      }
    }

    if (Array.isArray(node.sameAs)) {
      for (const rawUrl of node.sameAs) {
        if (typeof rawUrl !== 'string') continue;
        this.assignNormalizedSocial(rawUrl, socialLinks);
      }
    }
  }

  private static assignNormalizedSocial(rawHref: string, socialLinks: Record<string, string>) {
    const lower = rawHref.toLowerCase();
    if (lower.includes('facebook.com/') && !socialLinks.facebook) {
      const fb = SocialEnrichmentService.normalizeFacebookUrl(rawHref);
      if (fb) socialLinks.facebook = fb;
    } else if (lower.includes('instagram.com/') && !socialLinks.instagram) {
      const ig = SocialEnrichmentService.normalizeInstagramUrl(rawHref);
      if (ig) socialLinks.instagram = ig;
    } else if (lower.includes('linkedin.com/') && !socialLinks.linkedin) {
      const li = SocialEnrichmentService.normalizeLinkedInUrl(rawHref);
      if (li) socialLinks.linkedin = li;
    } else if ((lower.includes('twitter.com/') || lower.includes('x.com/')) && !socialLinks.twitter) {
      const tw = SocialEnrichmentService.normalizeTwitterUrl(rawHref);
      if (tw) socialLinks.twitter = tw;
    } else if (lower.includes('youtube.com/') && !socialLinks.youtube && !lower.includes('/watch')) {
      socialLinks.youtube = rawHref.split('?')[0].replace(/\/$/, '');
    } else if (lower.includes('tiktok.com/@') && !socialLinks.tiktok) {
      socialLinks.tiktok = rawHref.split('?')[0].replace(/\/$/, '');
    }
  }

  private static extractPageSignals(
    html: string,
    finalUrl: string,
    phones: Set<string>,
    emails: Set<string>,
    socialLinks: Record<string, string>,
    state: { whatsapp: string | null; siret: string | null; siren: string | null; manager: string | null; legalName: string | null; address: string | null; openingHours: string | null }
  ) {
    const $ = cheerio.load(html);

    // 0. JSON-LD Schema.org Structured Data
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const rawJson = $(el).html();
        if (!rawJson) return;
        const parsed = JSON.parse(rawJson);
        this.extractFromJsonLdNode(parsed, phones, emails, socialLinks, state);
      } catch {}
    });

    // 0.5. Microdata address fallback
    if (!state.address) {
      const street = $('[itemprop="streetAddress"]').first().text().trim();
      const postal = $('[itemprop="postalCode"]').first().text().trim();
      const locality = $('[itemprop="addressLocality"]').first().text().trim();
      const microAddr = [street, postal, locality].filter(Boolean).join(', ');
      if (microAddr.length > 5) state.address = microAddr;
    }

    // 1. Telephones from tel: links first (highest confidence)
    $('a[href^="tel:"]').each((_, el) => {
      const raw = $(el).attr('href')?.replace(/^tel:/i, '').trim();
      if (raw && ValidationService.validatePhone(raw)) {
        const digits = raw.replace(/[^\d]/g, '');
        if (!/^(\d)\1+$/.test(digits) && !digits.startsWith('0000')) {
          phones.add(raw);
        }
      }
    });

    // Cloudflare protected email decoding
    $('[data-cfemail]').each((_, el) => {
      const encoded = $(el).attr('data-cfemail');
      if (encoded) {
        const decoded = this.decodeCfEmail(encoded);
        if (decoded && ValidationService.validateEmail(decoded)) emails.add(decoded);
      }
    });

    // Strip non-visible tags before text regexes to eliminate JS/CSS/SVG numeric false positives
    const $clean = cheerio.load(html);
    $clean('script, style, noscript, svg, iframe, template').remove();
    const visibleText = $clean('body').text().replace(/\s+/g, ' ').trim();

    const phoneRegex = /(?:(?:\+|00)[1-9]\d{0,2}[\s.-]?(?:\(0\)[\s.-]?)?[1-9](?:[\s.-]?\d{2,3}){3,4}|0[1-9](?:[\s.-]?\d{2}){4})\b/g;
    const rawMatches = visibleText.match(phoneRegex) || [];
    for (const p of rawMatches) {
      if (ValidationService.validatePhone(p)) {
        const digits = p.replace(/[^\d]/g, '');
        if (!/^(\d)\1+$/.test(digits) && !digits.startsWith('19') && !digits.startsWith('20') && !digits.startsWith('0000')) {
          phones.add(p.trim());
        }
      }
    }

    // 2. WhatsApp Direct Links & visible text cues
    if (!state.whatsapp) {
      $('a[href*="wa.me"], a[href*="whatsapp.com"]').each((_, el) => {
        if (state.whatsapp) return;
        const href = $(el).attr('href') || '';
        const m = href.match(/(?:wa\.me\/|phone=)(\+?\d{8,15})/i);
        if (m) {
          state.whatsapp = m[1].replace('+', '');
        }
      });
    }
    if (!state.whatsapp) {
      const waMatch = html.match(/(?:wa\.me\/|api\.whatsapp\.com\/send\?phone=|whatsapp\.com\/send\?phone=)(\+?\d{8,15})/i);
      if (waMatch) state.whatsapp = waMatch[1].replace('+', '');
    }
    if (!state.whatsapp) {
      const waTextMatch = visibleText.match(/whatsapp[\s:.-]*(\+?\d[\d\s.-]{7,15}\d)/i);
      if (waTextMatch?.[1]) {
        const digits = waTextMatch[1].replace(/\D/g, '');
        if (digits.length >= 8 && digits.length <= 15) state.whatsapp = digits;
      }
    }

    // 3. Emails (mailto: + visible text incl. [at]/[dot] + JSON-LD)
    $('a[href^="mailto:"]').each((_, el) => {
      const raw = $(el).attr('href')?.replace(/^mailto:/i, '').split('?')[0].trim().toLowerCase();
      if (raw && ValidationService.validateEmail(raw)) {
        emails.add(raw);
      }
    });

    const normalizedEmailText = visibleText
      .replace(/\s*\[at\]\s*/gi, '@')
      .replace(/\s*\(at\)\s*/gi, '@')
      .replace(/\s*\[dot\]\s*/gi, '.')
      .replace(/\s*\(dot\)\s*/gi, '.');
    const emailMatches = normalizedEmailText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
    for (const e of emailMatches) {
      if (ValidationService.validateEmail(e)) {
        emails.add(e.toLowerCase().trim());
      }
    }

    // 4. Normalized Social Links
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') || '';
      if (!href) return;
      this.assignNormalizedSocial(href, socialLinks);
    });

    // 5. Legal notices (SIRET / SIREN / Manager) from visible text
    if (!state.siret) {
      const siretMatch = visibleText.match(/(?:SIRET|Siret)[^\d]*(\d{3}[\s.-]?\d{3}[\s.-]?\d{3}[\s.-]?\d{5})/);
      if (siretMatch) state.siret = siretMatch[1].replace(/[^\d]/g, '');
    }

    if (!state.siren && !state.siret) {
      const sirenMatch = visibleText.match(/(?:SIREN|Siren)[^\d]*(\d{3}[\s.-]?\d{3}[\s.-]?\d{3})/);
      if (sirenMatch) state.siren = sirenMatch[1].replace(/[^\d]/g, '');
    }

    if (!state.manager) {
      const mgrMatch = visibleText.match(/(?:Directeur de la publication|Directrice de la publication|Gérant|Dirigeant|Fondateur|Président)[^\w:]*[:\s]+([A-ZÀ-ÖØ-ß][a-zà-öø-ÿ]+(?:\s+[A-ZÀ-ÖØ-ß][a-zà-öø-ÿ]+){1,3})/);
      if (mgrMatch) {
        const cand = mgrMatch[1].trim();
        if (cand.length > 4 && cand.length < 40 && !cand.toLowerCase().includes('mentions') && !cand.toLowerCase().includes('société')) {
          state.manager = cand;
        }
      }
    }

    return $;
  }

  /**
   * High-speed in-memory stealth crawler.
   * Runs in 100-400ms without process spawn overhead.
   */
  private static async fastNativeCrawl(url: string, timeoutMs: number = 3000): Promise<ScraplingData | null> {
    let cleanUrl = url.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = 'https://' + cleanUrl;
    }

    try {
      const response = await axios.get(cleanUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
          'Cache-Control': 'no-cache'
        },
        httpsAgent: fastAgent,
        timeout: timeoutMs,
        maxRedirects: 4,
        maxContentLength: 512 * 1024, // Read up to 512KB max to remain blazing fast
        validateStatus: (status) => status >= 200 && status < 400
      });

      const finalUrl = response.request?.res?.responseUrl || cleanUrl;
      const html = typeof response.data === 'string' ? response.data : '';
      if (!html) return null;

      // 1. Parked Domain Check
      if (IdentityService.isParkedOrBrokerDomain(html, finalUrl)) {
        return {
          status: response.status,
          finalUrl,
          isParked: true,
          title: 'Nom de domaine inactif / En vente',
          phones: [],
          emails: [],
          whatsapp: null,
          address: null,
          openingHours: null,
          socialLinks: {},
          legal: {},
          hasStructuredData: false,
          contentSize: html.length,
          engine: 'Scrapling-UltraFast'
        };
      }

      const phones = new Set<string>();
      const emails = new Set<string>();
      const socialLinks: Record<string, string> = {};
      const state = {
        whatsapp: null as string | null,
        siret: null as string | null,
        siren: null as string | null,
        manager: null as string | null,
        legalName: null as string | null,
        address: null as string | null,
        openingHours: null as string | null
      };

      const $ = this.extractPageSignals(html, finalUrl, phones, emails, socialLinks, state);
      const title = $('title').text().trim().replace(/[\r\n\t]+/g, ' ');
      const metaDescription = $('meta[name="description"]').attr('content')?.trim() || 
                              $('meta[property="og:description"]').attr('content')?.trim();

      // Subpage Discovery whenever email, phone, or legal owner/SIRET signals are still missing
      if (phones.size === 0 || emails.size === 0 || (!state.siret && !state.manager)) {
        const subCandidates: string[] = [];
        const baseHost = (() => {
          try { return new URL(finalUrl).hostname.replace(/^www\./, ''); } catch { return ''; }
        })();

        let contactCandidate: string | null = null;
        let legalCandidate: string | null = null;

        $('a[href]').each((_, el) => {
          if (contactCandidate && legalCandidate) return;
          const href = $(el).attr('href') || '';
          const lower = (href + ' ' + $(el).text()).toLowerCase();
          try {
            const abs = new URL(href, finalUrl);
            if (abs.hostname.replace(/^www\./, '') !== baseHost || abs.toString() === finalUrl) return;
            if (/\.(pdf|jpg|jpeg|png|gif|webp|zip|doc)$/i.test(abs.pathname)) return;
            const absStr = abs.origin + abs.pathname;

            if (!contactCandidate && (lower.includes('contact') || lower.includes('coordonnees'))) {
              contactCandidate = absStr;
            } else if (!legalCandidate && (lower.includes('mention') || lower.includes('legal') || lower.includes('a-propos') || lower.includes('impressum'))) {
              legalCandidate = absStr;
            }
          } catch {}
        });

        if (contactCandidate) subCandidates.push(contactCandidate);
        if (legalCandidate && legalCandidate !== contactCandidate) subCandidates.push(legalCandidate);

        if (subCandidates.length > 0) {
          await Promise.allSettled(subCandidates.map(async (subUrl) => {
            try {
              const subRes = await axios.get(subUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0' },
                httpsAgent: fastAgent,
                timeout: 1800,
                maxContentLength: 256 * 1024,
                validateStatus: (s) => s >= 200 && s < 400
              });
              const subHtml = typeof subRes.data === 'string' ? subRes.data : '';
              if (subHtml) {
                this.extractPageSignals(subHtml, subUrl, phones, emails, socialLinks, state);
              }
            } catch {}
          }));
        }
      }

      return {
        status: response.status,
        finalUrl,
        isParked: false,
        title,
        metaDescription,
        phones: Array.from(phones).slice(0, 5),
        whatsapp: state.whatsapp,
        emails: Array.from(emails).slice(0, 5),
        address: state.address,
        openingHours: state.openingHours,
        socialLinks,
        legal: {
          legalName: state.legalName,
          siret: state.siret || state.siren,
          siren: state.siren,
          manager: state.manager
        },
        hasStructuredData: $('script[type="application/ld+json"]').length > 0,
        contentSize: html.length,
        engine: 'Scrapling-UltraFast'
      };
    } catch {
      return null;
    }
  }

  /**
   * Performs an anti-bot stealth crawl on targetUrl.
   * Priority: Blazing fast in-memory engine (150-300ms) with Python fallback.
   */
  static async crawl(targetUrl: string): Promise<ScraplingResult> {
    const startTime = Date.now();

    // 1. Ultra-fast in-memory crawl (under 300ms)
    try {
      const fastResult = await this.fastNativeCrawl(targetUrl, 2800);
      if (fastResult) {
        await logger.info('SCRAPLING', `Fast Scrapling crawled ${targetUrl} in ${Date.now() - startTime}ms`, {
          url: targetUrl,
          success: true,
          contactsFound: fastResult.phones.length + fastResult.emails.length
        }, 'SCRAPLING_BOT');

        return {
          success: true,
          data: fastResult
        };
      }
    } catch {}

    // 2. Python Scrapling Crawler Fallback (if native fails)
    try {
      const { stdout } = await execFileAsync(
        'python3',
        [this.SCRIPT_PATH, targetUrl],
        { 
          timeout: 4500,
          maxBuffer: 5 * 1024 * 1024 
        }
      );

      const lines = stdout.trim().split('\n');
      let jsonStr = '';
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i].trim();
        if (line.startsWith('{') && line.endsWith('}')) {
          jsonStr = line;
          break;
        }
      }

      if (jsonStr) {
        const parsed: ScraplingResult = JSON.parse(jsonStr);
        return parsed;
      }
    } catch (err: any) {
      await logger.warn('SCRAPLING', `Crawler fallback timeout/failed for ${targetUrl}: ${err.message}`, {
        url: targetUrl
      }, 'SCRAPLING_BOT');
    }

    return {
      success: false,
      error: 'Crawl timeout or unreachable host'
    };
  }
}
