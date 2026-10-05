import {
  DuckDuckGoSearchProvider,
  GeminiSearchProvider,
  LocalWebsiteDiscoveryProvider,
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
  search(query: string, limit?: number): Promise<SearchResult[]>;
  getName(): string;
  isVerified(): boolean;
}

export class SearchProviderFactory {
  private static providers: SearchProvider[] = [
    new GeminiSearchProvider(),
    new DuckDuckGoSearchProvider(),
    new LocalWebsiteDiscoveryProvider(),
    new GoogleSearchProvider(),
    new FirecrawlProvider(),
    new BingSearchProvider()
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
   */
  static async findWebsites(companyName: string, city: string): Promise<SearchResult[]> {
    const query = `${companyName} ${city} official website`;
    const allResults: SearchResult[] = [];
    
    for (const provider of this.getProviders()) {
      try {
        const results = await provider.search(query, 3);
        allResults.push(...results);
      } catch (err) {
        console.error(`Search provider ${provider.getName()} failed:`, err);
      }
    }

    return allResults;
  }
}
