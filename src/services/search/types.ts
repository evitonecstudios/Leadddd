import {
  DuckDuckGoSearchProvider,
  GeminiSearchProvider,
  YahooSearchProvider,
  BingWebSearchProvider,
  GoogleSearchProvider,
  FirecrawlProvider,
  BingSearchProvider
} from './providers.ts';

export interface SearchResult {
  title: string;
  url: string;
  snippet?: string;
  source: string;
}

export interface SearchProvider {
  search(query: string, limit?: number, options?: { includeSocial?: boolean }): Promise<SearchResult[]>;
  getName(): string;
  isVerified(): boolean;
}

export class SearchProviderFactory {
  private static providers: SearchProvider[] = [
    new GeminiSearchProvider(),
    new YahooSearchProvider(),
    new BingWebSearchProvider(),
    new GoogleSearchProvider(),
    new FirecrawlProvider(),
    new BingSearchProvider(),
    new DuckDuckGoSearchProvider()
  ];


  static registerProvider(provider: SearchProvider) {
    this.providers.push(provider);
  }

  static getProviders(): SearchProvider[] {
    return this.providers.filter(p => p.isVerified());
  }

  static getAllProvidersStatus(): Array<{ name: string; verified: boolean }> {
    return this.providers.map(p => ({
      name: p.getName(),
      verified: p.isVerified()
    }));
  }

  /**
   * Primary method to find candidate websites for a business.
   * Stops at the first provider returning real results to keep pipeline fast.
   */
  static async findWebsites(companyName: string, city: string): Promise<SearchResult[]> {
    const query = `"${companyName}" ${city} site officiel`.trim();
    const allResults: SearchResult[] = [];
    
    for (const provider of this.getProviders()) {
      try {
        const results = await provider.search(query, 3, { includeSocial: false });
        if (results.length > 0) {
          allResults.push(...results);
          break;
        }
      } catch (err) {
        console.error(`Search provider ${provider.getName()} failed:`, err);
      }
    }

    return allResults;
  }

  /**
   * Specifically looks for social media profiles when official website is missing.
   */
  static async findSocialProfiles(companyName: string, city: string): Promise<SearchResult[]> {
    const query = `"${companyName}" ${city} site:facebook.com`.trim();
    const allResults: SearchResult[] = [];
    
    for (const provider of this.getProviders()) {
      try {
        const results = await provider.search(query, 3, { includeSocial: true });
        if (results.length > 0) {
          allResults.push(...results);
          break;
        }
      } catch {}
    }

    return allResults;
  }
}
