import * as cheerio from 'cheerio';

export class IdentityService {
  /**
   * Calculates a similarity score between a business name and a candidate URL/Domain.
   * Deterministic matching based on word presence, length, and city tokens.
   */
  static calculateRelevanceScore(companyName: string, domainOrUrl: string, address?: string, city?: string): number {
    let score = 0;
    
    // Extract domain from URL if full URL is passed
    let domain = domainOrUrl.toLowerCase();
    try {
      if (domain.startsWith('http')) {
        domain = new URL(domain).hostname;
      }
    } catch {
      // Keep as-is
    }
    domain = domain.replace(/^www\./, '');

    const cleanCompanyName = companyName.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, '');

    const normalizedDomain = domain.replace(/[^a-z0-9]/g, '');
    const nameWithoutSpaces = cleanCompanyName.replace(/\s+/g, '');

    // 1. Direct Name Match in Domain (e.g. "swissphonerepair" inside "swissphonerepair.ch")
    if (nameWithoutSpaces.length >= 4 && normalizedDomain.includes(nameWithoutSpaces)) {
      score += 65;
    } else {
      // Partial token match - check significant words (> 2 chars)
      const stopWords = new Set(['the', 'and', 'llc', 'gmbh', 'sarl', 'sa', 'inc', 'ltd', 'service', 'services', 'shop', 'store']);
      const tokens = cleanCompanyName.split(/\s+/).filter(t => t.length > 2 && !stopWords.has(t));
      
      if (tokens.length > 0) {
        let matched = 0;
        for (const token of tokens) {
          if (normalizedDomain.includes(token)) matched++;
        }
        score += Math.round((matched / tokens.length) * 50);
      }
    }

    // 2. City Check in domain (e.g. "geneve" or "geneva")
    if (city) {
      const cleanCity = city.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (cleanCity.length > 3 && normalizedDomain.includes(cleanCity)) {
        score += 15;
      }
    }

    return Math.min(score, 100);
  }

  /**
   * Determines the confidence level based on score.
   */
  static getConfidence(score: number): 'VERIFIED' | 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN' {
    if (score >= 85) return 'VERIFIED';
    if (score >= 65) return 'HIGH';
    if (score >= 40) return 'MEDIUM';
    if (score >= 20) return 'LOW';
    return 'UNKNOWN';
  }

  /**
   * Detects parked, expired, or for-sale domains (e.g. GoDaddy auctions, Sedo, Dan, DomainMarket)
   */
  static isParkedOrBrokerDomain(html: string, url?: string): boolean {
    const lower = (html || '').toLowerCase();
    const urlLower = (url || '').toLowerCase();

    // Check URL signatures
    const brokerUrls = ['domainmarket.com', 'sedo.com', 'dan.com', 'afternic.com', 'hugedomains.com', 'parkingcrew', 'bodis.com', 'godaddy.com/domainsearch'];
    if (brokerUrls.some(b => urlLower.includes(b))) return true;

    // Check page text signatures
    const parkedSignatures = [
      'buy this domain',
      'domain for sale',
      'this domain is for sale',
      'domain is available for purchase',
      'domain available for sale',
      'domain name is for sale',
      'inquire about this domain',
      'make an offer on this domain',
      'the domain is registered without website content',
      'is parked with',
      'parked free, courtesy of',
      'domainmarket.com',
      'afternic.com',
      'hugedomains.com',
      'godaddy auctions',
      'namecheap parking',
      'parkingcrew.net',
      'bodis.com',
      'sav.com',
      'ce domaine est en vente',
      'ce nom de domaine est à vendre',
      'domaine à vendre',
      'acheter ce nom de domaine',
      'acheter ce domaine'
    ];

    return parkedSignatures.some(sig => lower.includes(sig));
  }

  /**
   * Deterministic check for website identity using page HTML content.
   * Matches company name tokens, phone, and city in title, headers, and footer.
   */
  static verifyIdentityOnPage(
    html: string, 
    companyName: string, 
    phone?: string, 
    city?: string,
    url?: string
  ): { match: boolean; confidence: 'VERIFIED' | 'HIGH' | 'MEDIUM' | 'LOW'; score: number; evidence: string } {
    try {
      if (this.isParkedOrBrokerDomain(html, url)) {
        return {
          match: false,
          confidence: 'LOW',
          score: 0,
          evidence: 'Parked / For-Sale domain detected (Domain Broker)'
        };
      }

      const $ = cheerio.load(html);
      const title = $('title').text().toLowerCase();
      const metaDesc = $('meta[name="description"]').attr('content')?.toLowerCase() || '';
      const h1Text = $('h1').text().toLowerCase();
      const bodyText = $('body').text().toLowerCase();

      const cleanName = companyName.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
      const tokens = cleanName.split(/\s+/).filter(t => t.length > 2);

      let score = 0;
      const matchedSignals: string[] = [];

      // Check title & meta description (strongest signal)
      if (title.includes(cleanName) || h1Text.includes(cleanName)) {
        score += 55;
        matchedSignals.push('Full company name in title/h1');
      } else {
        const tokensInTitle = tokens.filter(t => title.includes(t) || metaDesc.includes(t));
        if (tokens.length > 0 && tokensInTitle.length >= Math.ceil(tokens.length / 2)) {
          score += 35;
          matchedSignals.push(`${tokensInTitle.length}/${tokens.length} name tokens in title/meta`);
        }
      }

      // Check phone number match
      if (phone) {
        const digitsOnly = phone.replace(/[^\d]/g, '');
        if (digitsOnly.length >= 7) {
          const bodyDigits = bodyText.replace(/[^\d]/g, '');
          if (bodyDigits.includes(digitsOnly)) {
            score += 35;
            matchedSignals.push(`Phone number ${phone} confirmed on page`);
          }
        }
      }

      // Check city match
      if (city && city.length > 3) {
        if (bodyText.includes(city.toLowerCase())) {
          score += 15;
          matchedSignals.push(`City "${city}" confirmed in page body`);
        }
      }

      const confidence = this.getConfidence(score);
      return {
        match: score >= 40,
        confidence: confidence === 'UNKNOWN' ? 'LOW' : confidence,
        score,
        evidence: matchedSignals.join('; ') || 'No identity match confirmed'
      };
    } catch {
      return { match: false, confidence: 'LOW', score: 0, evidence: 'HTML parsing error' };
    }
  }
}
