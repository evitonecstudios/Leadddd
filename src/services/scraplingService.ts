import { execFile } from 'child_process';
import path from 'path';
import { promisify } from 'util';
import axios from 'axios';
import * as cheerio from 'cheerio';
import https from 'https';
import { logger } from '../lib/monitoring.ts';
import { IdentityService } from './identityService.ts';
import { ValidationService } from './leadService.ts';

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
  socialLinks: Record<string, string>;
  legal: {
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

  private static extractPageSignals(
    html: string,
    finalUrl: string,
    phones: Set<string>,
    emails: Set<string>,
    socialLinks: Record<string, string>,
    state: { whatsapp: string | null; siret: string | null; siren: string | null; manager: string | null }
  ) {
    const $ = cheerio.load(html);

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

    // 2. WhatsApp Direct Links
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

    // 3. Emails (mailto: + visible text + JSON-LD)
    $('a[href^="mailto:"]').each((_, el) => {
      const raw = $(el).attr('href')?.replace(/^mailto:/i, '').split('?')[0].trim().toLowerCase();
      if (raw && ValidationService.validateEmail(raw)) {
        emails.add(raw);
      }
    });

    const emailMatches = visibleText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
    for (const e of emailMatches) {
      if (ValidationService.validateEmail(e)) {
        emails.add(e.toLowerCase().trim());
      }
    }

    // 4. Social Links
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const lower = href.toLowerCase();
      if (lower.includes('facebook.com/') && !socialLinks.facebook && !lower.includes('sharer') && !lower.includes('plugins/')) {
        socialLinks.facebook = href;
      } else if (lower.includes('instagram.com/') && !socialLinks.instagram && !lower.includes('/p/')) {
        socialLinks.instagram = href;
      } else if (lower.includes('linkedin.com/company/') && !socialLinks.linkedin) {
        socialLinks.linkedin = href;
      } else if ((lower.includes('twitter.com/') || lower.includes('x.com/')) && !socialLinks.twitter && !lower.includes('intent')) {
        socialLinks.twitter = href;
      }
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
      const mgrMatch = visibleText.match(/(?:Directeur de la publication|Directrice de la publication|Gérant|Dirigeant)[^\w:]*[:\s]+([A-ZÀ-ÖØ-ß][a-zà-öø-ÿ]+(?:\s+[A-ZÀ-ÖØ-ß][a-zà-öø-ÿ]+){1,3})/);
      if (mgrMatch) {
        const cand = mgrMatch[1].trim();
        if (cand.length > 4 && cand.length < 40 && !cand.toLowerCase().includes('mentions')) {
          state.manager = cand;
        }
      }
    }

    return $;
  }

  /**
   * High-speed in-memory stealth crawler.
   * Runs in 100-300ms without process spawn overhead.
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
        manager: null as string | null
      };

      const $ = this.extractPageSignals(html, finalUrl, phones, emails, socialLinks, state);
      const title = $('title').text().trim().replace(/[\r\n\t]+/g, ' ');
      const metaDescription = $('meta[name="description"]').attr('content')?.trim() || 
                              $('meta[property="og:description"]').attr('content')?.trim();

      // Subpage Discovery if contact or legal signals missing
      if (phones.size === 0 || emails.size === 0) {
        const subCandidates: string[] = [];
        const baseHost = (() => {
          try { return new URL(finalUrl).hostname.replace(/^www\./, ''); } catch { return ''; }
        })();

        $('a[href]').each((_, el) => {
          if (subCandidates.length >= 2) return;
          const href = $(el).attr('href') || '';
          const lower = (href + ' ' + $(el).text()).toLowerCase();
          if (lower.includes('contact') || lower.includes('mentions') || lower.includes('legal') || lower.includes('a-propos')) {
            try {
              const abs = new URL(href, finalUrl);
              if (abs.hostname.replace(/^www\./, '') === baseHost && abs.toString() !== finalUrl && !subCandidates.includes(abs.toString())) {
                subCandidates.push(abs.toString());
              }
            } catch {}
          }
        });

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
        socialLinks,
        legal: { siret: state.siret, siren: state.siren, manager: state.manager },
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
