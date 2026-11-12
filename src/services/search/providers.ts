import axios from 'axios';
import * as cheerio from 'cheerio';
import { GoogleGenAI } from '@google/genai';
import type { SearchProvider, SearchResult } from './types.ts';

const DIRECTORY_AND_SOCIAL_DOMAINS = [
  'duckduckgo.com', 'bing.com', 'yahoo.com', 'google.com', 'wikipedia.org', 'wikidata.org',
  'yelp.', 'tripadvisor.', 'yellowpages.', 'pagesjaunes.fr', 'societe.com', 'pappers.fr',
  'manageo.fr', 'verif.com', 'infobel.com', 'local.ch', 'search.ch', 'mapp.apple.com',
  'facebook.com', 'fb.com', 'instagram.com', 'linkedin.com', 'twitter.com', 'x.com',
  'pinterest.', 'tiktok.com', 'youtube.com'
];

const DIRECTORY_ONLY_DOMAINS = [
  'duckduckgo.com', 'bing.com', 'yahoo.com', 'google.com', 'wikipedia.org', 'wikidata.org',
  'yelp.', 'tripadvisor.', 'yellowpages.', 'pagesjaunes.fr', 'societe.com', 'pappers.fr',
  'manageo.fr', 'verif.com', 'infobel.com', 'local.ch', 'search.ch', 'mapp.apple.com'
];

function isExcludedDomain(url: string, includeSocial: boolean): boolean {
  const lowerUrl = url.toLowerCase();
  const blocklist = includeSocial ? DIRECTORY_ONLY_DOMAINS : DIRECTORY_AND_SOCIAL_DOMAINS;
  return blocklist.some(d => lowerUrl.includes(d));
}

function unwrapYahooUrl(rawHref: string): string {
  if (!rawHref) return '';
  if (rawHref.includes('/RU=')) {
    const m = rawHref.match(/\/RU=([^/]+)\//);
    if (m?.[1]) {
      try {
        return decodeURIComponent(m[1]);
      } catch {
        return rawHref;
      }
    }
  }
  return rawHref;
}

function unwrapBingUrl(rawHref: string): string {
  if (!rawHref) return '';
  if (rawHref.includes('bing.com/ck/a') && rawHref.includes('&u=a1')) {
    const m = rawHref.match(/[?&]u=a1([^&]+)/);
    if (m?.[1]) {
      try {
        // Bing URL-safe base64 after "a1"
        const b64 = m[1].replace(/-/g, '+').replace(/_/g, '/');
        const decoded = Buffer.from(b64, 'base64').toString('utf8');
        if (decoded.startsWith('http://') || decoded.startsWith('https://')) {
          return decoded;
        }
      } catch {}
    }
  }
  return rawHref;
}

/**
 * Yahoo Search Provider ($0 cost, reliable HTTP scraping, returns direct URLs + snippets)
 */
export class YahooSearchProvider implements SearchProvider {
  getName(): string {
    return 'YahooSearch';
  }

  isVerified(): boolean {
    return true;
  }

  async search(query: string, limit: number = 3, options?: { includeSocial?: boolean }): Promise<SearchResult[]> {
    const includeSocial = Boolean(options?.includeSocial);
    try {
      const response = await axios.get('https://fr.search.yahoo.com/search', {
        params: { p: query },
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7'
        },
        timeout: 4500,
        validateStatus: (s) => s === 200
      });

      const html = typeof response.data === 'string' ? response.data : '';
      if (!html) return [];

      const $ = cheerio.load(html);
      const results: SearchResult[] = [];
      const seenUrls = new Set<string>();

      $('div.algo, #web ol li').each((_, el) => {
        if (results.length >= limit) return false;
        const link = $(el).find('h3 a, a.d-ib').first();
        const rawHref = link.attr('href') || '';
        const url = unwrapYahooUrl(rawHref);
        if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) return;
        if (seenUrls.has(url) || isExcludedDomain(url, includeSocial)) return;

        const title = link.text().trim() || $(el).find('h3').text().trim();
        const snippet = $(el).find('.compText, p').text().trim() || title;
        seenUrls.add(url);
        results.push({
          title,
          url,
          snippet,
          source: 'YAHOO_SEARCH'
        });
      });

      return results;
    } catch {
      return [];
    }
  }
}

/**
 * Bing Web Search Scraper Provider ($0 cost, zero API key fallback)
 */
export class BingWebSearchProvider implements SearchProvider {
  getName(): string {
    return 'BingWebSearch';
  }

  isVerified(): boolean {
    return true;
  }

  async search(query: string, limit: number = 3, options?: { includeSocial?: boolean }): Promise<SearchResult[]> {
    const includeSocial = Boolean(options?.includeSocial);
    try {
      const response = await axios.get('https://www.bing.com/search', {
        params: { q: query, setlang: 'fr' },
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8'
        },
        timeout: 4500,
        validateStatus: (s) => s === 200
      });

      const html = typeof response.data === 'string' ? response.data : '';
      if (!html) return [];

      const $ = cheerio.load(html);
      const results: SearchResult[] = [];
      const seenUrls = new Set<string>();

      $('li.b_algo').each((_, el) => {
        if (results.length >= limit) return false;
        const link = $(el).find('h2 a').first();
        const rawHref = link.attr('href') || '';
        const url = unwrapBingUrl(rawHref);
        if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) return;
        if (seenUrls.has(url) || isExcludedDomain(url, includeSocial)) return;

        const title = link.text().trim();
        const snippet = $(el).find('.b_caption p').text().trim() || title;
        seenUrls.add(url);
        results.push({
          title,
          url,
          snippet,
          source: 'BING_WEB_SEARCH'
        });
      });

      return results;
    } catch {
      return [];
    }
  }
}

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

  async search(query: string, limit: number = 3, options?: { includeSocial?: boolean }): Promise<SearchResult[]> {
    const includeSocial = Boolean(options?.includeSocial);
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
          timeout: 4500,
          validateStatus: (status) => status === 200 || status === 202
        }
      );

      if (!response.data || response.status === 202) {
        return [];
      }
      const $ = cheerio.load(response.data);
      const results: SearchResult[] = [];

      $('a.result-link').each((_, el) => {
        if (results.length >= limit) return false;
        const title = $(el).text().trim();
        let url = $(el).attr('href') || '';

        if (url.includes('uddg=')) {
          const match = url.match(/uddg=([^&]+)/);
          if (match) url = decodeURIComponent(match[1]);
        }

        if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
          if (!isExcludedDomain(url, includeSocial)) {
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
    } catch {
      return [];
    }
  }
}

const GEMINI_SEARCH_MODELS = ['gemini-4-hydrogen', 'gemini-3.8-flash'] as const;

/**
 * Gemini Search Provider (Reliable, High-Quality, Using Google Search Grounding)
 * Uses Gemini's built-in Google Search tool to find official business websites and social pages.
 */
export class GeminiSearchProvider implements SearchProvider {
  private ai: GoogleGenAI | null = null;
  private cachedApiKey = '';
  private activeModel: string = GEMINI_SEARCH_MODELS[0];

  private getApiKey(): string {
    return (
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      ''
    ).trim();
  }

  private getClient(): GoogleGenAI | null {
    const apiKey = this.getApiKey();
    if (!apiKey) return null;
    if (!this.ai || this.cachedApiKey !== apiKey) {
      this.cachedApiKey = apiKey;
      this.ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    }
    return this.ai;
  }

  getName(): string {
    return 'GeminiSearch';
  }

  isVerified(): boolean {
    return Boolean(this.getApiKey());
  }

  private parseSearchItems(text: string | undefined, includeSocial: boolean, limit: number): SearchResult[] {
    if (!text) return [];
    const cleaned = text.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
    const jsonCandidate = arrayMatch ? arrayMatch[0] : cleaned;

    try {
      const parsed = JSON.parse(jsonCandidate);
      if (!Array.isArray(parsed)) return [];
      const results: SearchResult[] = [];
      const seen = new Set<string>();
      for (const item of parsed) {
        const url = typeof item?.url === 'string' ? item.url.trim() : '';
        if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) continue;
        if (url.includes('vertexaisearch.cloud.google.com')) continue;
        if (seen.has(url) || isExcludedDomain(url, includeSocial)) continue;
        seen.add(url);
        const title = (typeof item?.title === 'string' && item.title.trim()) || 'Official Website';
        results.push({
          title,
          url,
          snippet: title,
          source: 'GEMINI_GOOGLE_SEARCH',
        });
        if (results.length >= limit) break;
      }
      return results;
    } catch {
      return [];
    }
  }

  private extractGroundingResults(response: any, includeSocial: boolean, limit: number): SearchResult[] {
    const chunks = response?.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (!Array.isArray(chunks)) return [];
    const results: SearchResult[] = [];
    const seen = new Set<string>();

    for (const chunk of chunks) {
      const url = typeof chunk?.web?.uri === 'string' ? chunk.web.uri.trim() : '';
      if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) continue;
      if (url.includes('vertexaisearch.cloud.google.com')) continue;
      if (seen.has(url) || isExcludedDomain(url, includeSocial)) continue;
      seen.add(url);
      const title = (typeof chunk?.web?.title === 'string' && chunk.web.title.trim()) || 'Official Website';
      results.push({
        title,
        url,
        snippet: title,
        source: 'GEMINI_GOOGLE_SEARCH',
      });
      if (results.length >= limit) break;
    }
    return results;
  }

  async search(query: string, limit: number = 3, options?: { includeSocial?: boolean }): Promise<SearchResult[]> {
    const ai = this.getClient();
    if (!ai) return [];

    const includeSocial = Boolean(options?.includeSocial);
    const modelsToTry = [
      this.activeModel,
      ...GEMINI_SEARCH_MODELS.filter((m) => m !== this.activeModel),
    ];

    const prompt = includeSocial
      ? `Find the official Facebook page or website for this business. Return ONLY a raw JSON array of objects with "title" and "url" fields (no markdown). Business query: ${query}. Limit to ${limit} results.`
      : `Find the official website for this business (exclude directories like Yelp, PagesJaunes, Societe.com, TripAdvisor, Facebook). Return ONLY a raw JSON array of objects with "title" and "url" fields (no markdown). Business query: ${query}. Limit to ${limit} results.`;

    for (let i = 0; i < modelsToTry.length; i++) {
      const model = modelsToTry[i];
      try {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            tools: [{ googleSearch: {} }],
          },
        });

        this.activeModel = model;
        const parsed = this.parseSearchItems(response.text, includeSocial, limit);
        if (parsed.length > 0) return parsed;
        return this.extractGroundingResults(response, includeSocial, limit);
      } catch (err: any) {
        const msg = err?.message || String(err);
        const isNotFound = err?.status === 404 || msg.includes('404') || msg.includes('NOT_FOUND');
        if (isNotFound && i < modelsToTry.length - 1) {
          continue;
        }
        const isQuotaError = msg.includes('429') || err?.status === 429 || msg.includes('RESOURCE_EXHAUSTED');
        if (isQuotaError) {
          console.warn('[GeminiSearchProvider] Quota exceeded (429). Falling back to other providers.');
        } else {
          console.warn(`[GeminiSearchProvider] Search failed (${model}): ${msg}`);
        }
        return [];
      }
    }

    return [];
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

