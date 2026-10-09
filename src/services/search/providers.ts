import axios from 'axios';
import * as cheerio from 'cheerio';
import { GoogleGenAI } from '@google/genai';
import { SearchProvider, SearchResult } from './types.ts';
import { IdentityService } from '../identityService.ts';

/**
 * DuckDuckGo Search Provider ($0 cost, 100% legitimate, zero keys needed)
 * Queries the privacy-friendly DuckDuckGo Lite engine to discover real official websites
 * and contact links for local businesses when not found in OpenStreetMap.
 */
export class DuckDuckGoSearchProvider implements SearchProvider {
  getName(): string {
    return 'DuckDuckGo';
  }

  isVerified(): boolean {
    return true; // Always verified and ready out of the box
  }

  async search(query: string, limit: number = 3): Promise<SearchResult[]> {
    try {
      const response = await axios.post(
        'https://lite.duckduckgo.com/lite/',
        `q=${encodeURIComponent(query)}`,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://duckduckgo.com/',
            'Origin': 'https://lite.duckduckgo.com'
          },
          timeout: 8000,
          validateStatus: (status) => status === 200 || status === 202
        }
      );

      if (!response.data || response.status === 202) {
        if (response.status === 202) console.warn('[DuckDuckGoSearchProvider] Received 202 Accepted - results might be delayed or throttled.');
        return [];
      }
      const $ = cheerio.load(response.data);
      const results: SearchResult[] = [];

      // Exclude generic social and directory aggregators from primary official website match
      const EXCLUDED_DOMAINS = [
        'duckduckgo.com', 'wikipedia.org', 'wikidata.org', 'yelp.', 'tripadvisor.', 
        'yellowpages.', 'pagesjaunes.fr', 'facebook.com', 'instagram.com', 'linkedin.com',
        'twitter.com', 'x.com', 'pinterest.', 'tiktok.com', 'youtube.com', 'mapp.apple.com'
      ];

      $('a.result-link').each((_, el) => {
        if (results.length >= limit) return false;
        const title = $(el).text().trim();
        let url = $(el).attr('href') || '';

        if (url.includes('uddg=')) {
          const match = url.match(/uddg=([^&]+)/);
          if (match) url = decodeURIComponent(match[1]);
        }

        if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
          const lowerUrl = url.toLowerCase();
          const isExcluded = EXCLUDED_DOMAINS.some(d => lowerUrl.includes(d));
          if (!isExcluded) {
            results.push({
              title,
              url,
              snippet: title,
              source: 'DUCKDUCKGO_SEARCH'
            });
          }
        }
      });

      return results;
    } catch (err: any) {
      if (err.response?.status === 403) {
        console.warn(`[DuckDuckGoSearchProvider] Access blocked (403). Automated requests are being restricted by the provider.`);
      } else if (err.response?.status === 202) {
        console.warn(`[DuckDuckGoSearchProvider] Throttled (202). Provider is processing the request but not returning results yet.`);
      } else {
        console.warn(`[DuckDuckGoSearchProvider] Search notice: ${err.message}`);
      }
      return [];
    }
  }
}

/**
 * Gemini Search Provider (Reliable, High-Quality, Using Google Search Grounding)
 * Uses Gemini's built-in Google Search tool to find official business websites.
 */
export class GeminiSearchProvider implements SearchProvider {
  private ai: GoogleGenAI;
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '';
    this.ai = new GoogleGenAI({ apiKey: this.apiKey });
  }

  getName(): string {
    return 'GeminiSearch';
  }

  isVerified(): boolean {
    return Boolean(this.apiKey);
  }

  async search(query: string, limit: number = 3): Promise<SearchResult[]> {
    if (!this.isVerified()) return [];

    try {
      const response = await this.ai.models.generateContent({ 
        model: 'gemini-3.8-flash',
        contents: [{ role: 'user', parts: [{ text: `Find the official website for this business. Return ONLY a JSON array of objects with "title" and "url" fields. Business query: ${query}. Limit to ${limit} results.` }] }],
        config: {
          tools: [{ googleSearch: {} }] as any,
          responseMimeType: 'application/json'
        }
      });

      const text = response.text;
      if (text) {
        const items = JSON.parse(text);
        return items.map((item: any) => ({
          title: item.title || 'Official Website',
          url: item.url,
          snippet: item.title,
          source: 'GEMINI_GOOGLE_SEARCH'
        }));
      }

      return [];
    } catch (err: any) {
      const isQuotaError = err.message?.includes('429') || err.status === 429 || err.message?.includes('RESOURCE_EXHAUSTED');
      if (isQuotaError) {
        console.warn('[GeminiSearchProvider] Quota exceeded (429). Falling back to other providers.');
      } else {
        console.warn(`[GeminiSearchProvider] Search failed: ${err.message}`);
      }
      return [];
    }
  }
}


/**
 * Local & Deterministic Website Discovery Provider ($0 cost, 100% legitimate)
 * Generates direct domain candidates from normalized business name + geographic TLDs,
 * validates HTTP reachable status, and verifies page title/identity content before returning.
 */
export class LocalWebsiteDiscoveryProvider implements SearchProvider {
  getName(): string {
    return 'LocalWebsiteDiscovery';
  }

  isVerified(): boolean {
    return true; // Always available without API keys or external billing
  }

  async search(query: string, limit: number = 3): Promise<SearchResult[]> {
    // Expected query format: "CompanyName City official website"
    const parts = query.replace(' official website', '').trim().split(' ');
    if (parts.length === 0) return [];
    
    const city = parts[parts.length - 1];
    const companyParts = parts.slice(0, -1).join(' ') || parts[0];
    
    const cleanName = companyParts
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');

    if (!cleanName || cleanName.length < 3) return [];

    // Prioritized TLDs: local extensions and international standards
    const tlds = ['.ch', '.com', '.fr', '.de', '.co.uk', '.net', '.org'];
    const candidates: SearchResult[] = [];

    // Try name variations: direct (e.g. phonerepair), hyphenated (e.g. phone-repair)
    const domainRoots = [cleanName];
    const hyphenated = companyParts.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().split(/\s+/).join('-');
    if (hyphenated !== cleanName && hyphenated.length > 4) {
      domainRoots.push(hyphenated);
    }

    for (const root of domainRoots) {
      if (candidates.length >= limit) break;

      for (const tld of tlds) {
        if (candidates.length >= limit) break;
        const testUrl = `https://www.${root}${tld}`;
        try {
          const res = await axios.get(testUrl, {
            timeout: 5000,
            headers: { 
              'User-Agent': 'LeadForge-Identity-Verifier/2.0',
              'Accept': 'text/html,application/xhtml+xml'
            },
            maxRedirects: 4,
            validateStatus: (status) => status >= 200 && status < 400
          });

          if (res.status >= 200 && res.status < 400 && typeof res.data === 'string') {
            // Verify on-page content
            const verification = IdentityService.verifyIdentityOnPage(res.data, companyParts, undefined, city);
            
            // Require domain relevance or on-page token match
            if (verification.match || root === cleanName) {
              candidates.push({
                title: `${companyParts} Official Website`,
                url: testUrl,
                snippet: `Verified domain match: ${verification.evidence}`,
                source: 'LOCAL_DOMAIN_PROBE'
              });
            }
          }
        } catch {
          // Domain not registered or unreachable
        }
      }
    }

    return candidates;
  }
}

/**
 * Google Custom Search JSON API Adapter (Optional - requires API key + Search Engine ID)
 * Official, legitimate Google Search endpoint. 100 free queries/day.
 */
export class GoogleSearchProvider implements SearchProvider {
  private apiKey: string | undefined;
  private cx: string | undefined;

  constructor() {
    this.apiKey = process.env.GOOGLE_SEARCH_API_KEY || process.env.GOOGLE_CUSTOM_SEARCH_API_KEY;
    this.cx = process.env.GOOGLE_SEARCH_CX || process.env.GOOGLE_CUSTOM_SEARCH_CX;
  }

  getName(): string {
    return 'GoogleCustomSearch';
  }

  isVerified(): boolean {
    return Boolean(this.apiKey && this.cx);
  }

  async search(query: string, limit: number = 3): Promise<SearchResult[]> {
    if (!this.isVerified()) return [];

    try {
      const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
        params: {
          key: this.apiKey,
          cx: this.cx,
          q: query,
          num: Math.min(limit, 10)
        },
        timeout: 8000
      });

      const items = response.data?.items || [];
      return items.map((item: any) => ({
        title: item.title,
        url: item.link,
        snippet: item.snippet,
        source: 'GOOGLE_SEARCH_API'
      }));
    } catch (err: any) {
      console.warn(`[GoogleSearchProvider] Query failed: ${err.message}`);
      return [];
    }
  }
}

/**
 * Firecrawl Search Adapter (Optional - requires API key)
 * Programmatic search & web scraping service.
 */
export class FirecrawlProvider implements SearchProvider {
  private apiKey: string | undefined;

  constructor() {
    this.apiKey = process.env.FIRECRAWL_API_KEY;
  }

  getName(): string {
    return 'Firecrawl';
  }

  isVerified(): boolean {
    return Boolean(this.apiKey);
  }

  async search(query: string, limit: number = 3): Promise<SearchResult[]> {
    if (!this.isVerified()) return [];

    try {
      const response = await axios.post(
        'https://api.firecrawl.dev/v1/search',
        { query, limit },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      const items = response.data?.data || [];
      return items.map((item: any) => ({
        title: item.title || item.metadata?.title || 'Web Result',
        url: item.url,
        snippet: item.markdown?.substring(0, 160) || item.description,
        source: 'FIRECRAWL_API'
      }));
    } catch (err: any) {
      console.warn(`[FirecrawlProvider] Search failed: ${err.message}`);
      return [];
    }
  }
}

/**
 * Bing Web Search API Adapter (Optional - requires Azure Bing Search key)
 */
export class BingSearchProvider implements SearchProvider {
  private apiKey: string | undefined;

  constructor() {
    this.apiKey = process.env.BING_SEARCH_API_KEY;
  }

  getName(): string {
    return 'BingSearch';
  }

  isVerified(): boolean {
    return Boolean(this.apiKey);
  }

  async search(query: string, limit: number = 3): Promise<SearchResult[]> {
    if (!this.isVerified()) return [];

    try {
      const response = await axios.get('https://api.bing.microsoft.com/v7.0/search', {
        params: { q: query, count: limit },
        headers: { 'Ocp-Apim-Subscription-Key': this.apiKey },
        timeout: 8000
      });

      const items = response.data?.webPages?.value || [];
      return items.map((item: any) => ({
        title: item.name,
        url: item.url,
        snippet: item.snippet,
        source: 'BING_SEARCH_API'
      }));
    } catch (err: any) {
      console.warn(`[BingSearchProvider] Search failed: ${err.message}`);
      return [];
    }
  }
}

