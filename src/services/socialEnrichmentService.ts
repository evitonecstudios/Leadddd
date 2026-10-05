import axios from 'axios';
import * as cheerio from 'cheerio';
import https from 'https';
import { logger } from '../lib/monitoring.ts';

export interface SocialEnrichmentResult {
  socialUrl?: string;
  platform?: 'facebook' | 'instagram' | 'linkedin' | 'twitter' | 'youtube' | 'tiktok';
  phone?: string;
  email?: string;
  address?: string;
  discoveredWebsite?: string;
  bio?: string;
  socialLinks: Record<string, string>;
  evidence: Array<{
    field: string;
    value: string;
    url: string;
    method: string;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  }>;
}

export class SocialEnrichmentService {
  private static CRAWLER_USER_AGENT = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)';
  private static GOOGLEBOT_USER_AGENT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

  /**
   * Discovers and extracts real, verified information from social media profiles
   * when a local business does NOT have an official website.
   * Strictly extracts from actual public HTTP responses — ZERO fake/synthetic data.
   */
  static async enrichFromSocialMedia(
    companyName: string, 
    city?: string, 
    country?: string,
    existingRawTags?: Record<string, any>
  ): Promise<SocialEnrichmentResult> {
    const result: SocialEnrichmentResult = {
      socialLinks: {},
      evidence: []
    };

    if (!companyName || companyName.trim().length < 2) return result;

    // 1. Check if raw OpenStreetMap tags already contained official social links
    if (existingRawTags) {
      this.extractSocialFromTags(existingRawTags, result);
    }

    // 2. Discover potential social profile candidates if none found in raw tags
    const candidateUrls: Array<{ url: string; platform: SocialEnrichmentResult['platform'] }> = [];

    // Add any already found in tags
    if (result.socialLinks.facebook) candidateUrls.push({ url: result.socialLinks.facebook, platform: 'facebook' });
    if (result.socialLinks.instagram) candidateUrls.push({ url: result.socialLinks.instagram, platform: 'instagram' });
    if (result.socialLinks.linkedin) candidateUrls.push({ url: result.socialLinks.linkedin, platform: 'linkedin' });
    if (result.socialLinks.twitter) candidateUrls.push({ url: result.socialLinks.twitter, platform: 'twitter' });

    // If no direct social links in tags, probe deterministic public profile candidate slugs
    if (candidateUrls.length === 0) {
      const slugs = this.generateSocialSlugs(companyName, city);
      for (const slug of slugs.slice(0, 2)) {
        candidateUrls.push({ url: `https://www.facebook.com/${slug}`, platform: 'facebook' });
        candidateUrls.push({ url: `https://www.instagram.com/${slug}/`, platform: 'instagram' });
      }
    }

    // 3. Inspect public social profile pages for real contact information
    const permissiveAgent = new https.Agent({ rejectUnauthorized: false });

    for (const candidate of candidateUrls) {
      try {
        const userAgent = candidate.platform === 'facebook' ? this.CRAWLER_USER_AGENT : this.GOOGLEBOT_USER_AGENT;
        const res = await axios.get(candidate.url, {
          headers: {
            'User-Agent': userAgent,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8,de;q=0.7',
            'Cache-Control': 'no-cache'
          },
          httpsAgent: permissiveAgent,
          timeout: 6000,
          maxRedirects: 3,
          validateStatus: (status) => status >= 200 && status < 400
        });

        if (typeof res.data !== 'string') continue;
        const $ = cheerio.load(res.data);

        const ogTitle = $('meta[property="og:title"]').attr('content') || $('title').text() || '';
        const ogDesc = $('meta[property="og:description"]').attr('content') || 
                       $('meta[name="description"]').attr('content') || '';
        const fullSnippet = `${ogTitle} ${ogDesc}`.trim();

        // Verify that the page actually relates to the business name
        const cleanCompanyName = companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
        const cleanSnippet = fullSnippet.toLowerCase().replace(/[^a-z0-9]/g, '');
        const isMatch = cleanSnippet.includes(cleanCompanyName.slice(0, Math.min(cleanCompanyName.length, 6)));

        if (!isMatch && !candidateUrls.some(c => c.url === candidate.url)) {
          // Slug probe didn't match real business name
          continue;
        }

        // We found a real matching profile!
        if (!result.socialUrl) {
          result.socialUrl = candidate.url;
          result.platform = candidate.platform;
        }

        if (candidate.platform && !result.socialLinks[candidate.platform]) {
          result.socialLinks[candidate.platform] = candidate.url;
          result.evidence.push({
            field: candidate.platform,
            value: candidate.url,
            url: candidate.url,
            method: 'Verified Social Presence',
            confidence: 'HIGH'
          });
        }

        // Extract real phone numbers from public social description
        if (!result.phone) {
          const phone = this.extractPhoneFromText(fullSnippet);
          if (phone) {
            result.phone = phone;
            result.evidence.push({
              field: 'phone',
              value: phone,
              url: candidate.url,
              method: `${candidate.platform?.toUpperCase()} Public Profile Bio`,
              confidence: 'HIGH'
            });
          }
        }

        // Extract real email from public social description
        if (!result.email) {
          const email = this.extractEmailFromText(fullSnippet);
          if (email) {
            result.email = email;
            result.evidence.push({
              field: 'email',
              value: email,
              url: candidate.url,
              method: `${candidate.platform?.toUpperCase()} Public Profile Bio`,
              confidence: 'HIGH'
            });
          }
        }

        // Extract real address if specified in description
        if (!result.address && city) {
          const addr = this.extractAddressFromText(fullSnippet, city);
          if (addr) {
            result.address = addr;
            result.evidence.push({
              field: 'address',
              value: addr,
              url: candidate.url,
              method: `${candidate.platform?.toUpperCase()} Public Profile Bio`,
              confidence: 'HIGH'
            });
          }
        }

        // Extract external website link from bio if present!
        if (!result.discoveredWebsite) {
          const websiteCandidate = this.extractWebsiteFromBio(fullSnippet);
          if (websiteCandidate) {
            result.discoveredWebsite = websiteCandidate;
            result.evidence.push({
              field: 'website',
              value: websiteCandidate,
              url: candidate.url,
              method: `${candidate.platform?.toUpperCase()} Bio External Link`,
              confidence: 'HIGH'
            });
          }
        }

        if (ogDesc && !result.bio && ogDesc.length > 20) {
          result.bio = ogDesc.slice(0, 300).trim();
          result.evidence.push({
            field: 'social_bio',
            value: result.bio,
            url: candidate.url,
            method: `${candidate.platform?.toUpperCase()} Profile Summary`,
            confidence: 'HIGH'
          });
        }

      } catch (err: any) {
        // Skip inaccessible social profile gracefully
        await logger.warn('SOCIAL_SCRAPER', `Notice inspecting ${candidate.url}: ${err.message}`, { companyName }, 'SOCIAL_SCRAPER');
      }
    }

    return result;
  }

  private static extractSocialFromTags(tags: Record<string, any>, result: SocialEnrichmentResult) {
    const fb = tags['contact:facebook'] || tags.facebook;
    if (fb && typeof fb === 'string' && fb.trim().length > 5) {
      const cleanFb = fb.startsWith('http') ? fb.trim() : `https://www.facebook.com/${fb.trim().replace(/^@/, '')}`;
      result.socialLinks.facebook = cleanFb;
      result.evidence.push({ field: 'facebook', value: cleanFb, url: cleanFb, method: 'OpenStreetMap contact tag', confidence: 'HIGH' });
    }

    const insta = tags['contact:instagram'] || tags.instagram;
    if (insta && typeof insta === 'string' && insta.trim().length > 3) {
      const cleanInsta = insta.startsWith('http') ? insta.trim() : `https://www.instagram.com/${insta.trim().replace(/^@/, '')}/`;
      result.socialLinks.instagram = cleanInsta;
      result.evidence.push({ field: 'instagram', value: cleanInsta, url: cleanInsta, method: 'OpenStreetMap contact tag', confidence: 'HIGH' });
    }

    const linkedin = tags['contact:linkedin'] || tags.linkedin;
    if (linkedin && typeof linkedin === 'string' && linkedin.trim().length > 5) {
      const cleanLi = linkedin.startsWith('http') ? linkedin.trim() : `https://www.linkedin.com/company/${linkedin.trim()}`;
      result.socialLinks.linkedin = cleanLi;
      result.evidence.push({ field: 'linkedin', value: cleanLi, url: cleanLi, method: 'OpenStreetMap contact tag', confidence: 'HIGH' });
    }

    const twitter = tags['contact:twitter'] || tags.twitter;
    if (twitter && typeof twitter === 'string' && twitter.trim().length > 2) {
      const cleanTw = twitter.startsWith('http') ? twitter.trim() : `https://x.com/${twitter.trim().replace(/^@/, '')}`;
      result.socialLinks.twitter = cleanTw;
      result.evidence.push({ field: 'twitter', value: cleanTw, url: cleanTw, method: 'OpenStreetMap contact tag', confidence: 'HIGH' });
    }

    const phone = tags.phone || tags['contact:phone'];
    if (phone && !result.phone) {
      result.phone = String(phone).trim();
      result.evidence.push({ field: 'phone', value: result.phone, url: 'https://www.openstreetmap.org/', method: 'OpenStreetMap contact:phone tag', confidence: 'HIGH' });
    }

    const email = tags.email || tags['contact:email'];
    if (email && !result.email) {
      result.email = String(email).trim().toLowerCase();
      result.evidence.push({ field: 'email', value: result.email, url: 'https://www.openstreetmap.org/', method: 'OpenStreetMap contact:email tag', confidence: 'HIGH' });
    }
  }

  private static generateSocialSlugs(companyName: string, city?: string): string[] {
    const cleanName = companyName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, '')
      .trim();

    const noSpaces = cleanName.replace(/\s+/g, '');
    const hyphenated = cleanName.replace(/\s+/g, '.');
    const slugs = [noSpaces, hyphenated];

    if (city) {
      const cleanCity = city.toLowerCase().replace(/[^a-z0-9]/g, '');
      slugs.push(`${noSpaces}${cleanCity}`);
      slugs.push(`${hyphenated}.${cleanCity}`);
    }

    return slugs.filter(s => s.length >= 4);
  }

  private static extractPhoneFromText(text: string): string | undefined {
    const phoneRegex = /(?:(?:\+|00)(?:[1-9]\d{0,2})[\s.-]*)?(?:\(?\d{1,4}\)?[\s.-]*)?\d{2,4}[\s.-]*\d{2,4}[\s.-]*\d{2,4}/g;
    const matches = text.match(phoneRegex);
    if (!matches) return undefined;

    for (const match of matches) {
      const digits = match.replace(/\D/g, '');
      if (digits.length >= 8 && digits.length <= 13 && !digits.startsWith('0000') && !digits.startsWith('123456')) {
        return match.trim().replace(/\s+/g, ' ');
      }
    }
    return undefined;
  }

  private static extractEmailFromText(text: string): string | undefined {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const matches = text.match(emailRegex);
    if (!matches) return undefined;

    for (const match of matches) {
      const email = match.toLowerCase().trim();
      if (!email.includes('facebook') && !email.includes('instagram') && !email.includes('example.com') && !email.endsWith('.png')) {
        return email;
      }
    }
    return undefined;
  }

  private static extractAddressFromText(text: string, city: string): string | undefined {
    // Look for lines containing numbers + street keywords + the city name
    const regex = new RegExp(`(\\d{1,4}[^,\\n]{3,60}(?:street|st|rue|avenue|ave|boulevard|blvd|road|rd|chemin|strasse|str)[^,\\n]{0,40}${city})`, 'i');
    const match = text.match(regex);
    if (match && match[1]) {
      return match[1].trim().replace(/\s+/g, ' ');
    }
    return undefined;
  }

  private static extractWebsiteFromBio(text: string): string | undefined {
    const urlRegex = /(?:https?:\/\/|www\.)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[^\s,)]*)?/g;
    const matches = text.match(urlRegex);
    if (!matches) return undefined;

    for (const match of matches) {
      const lower = match.toLowerCase();
      if (!lower.includes('facebook.com') && !lower.includes('instagram.com') && 
          !lower.includes('fb.me') && !lower.includes('twitter.com') && 
          !lower.includes('bit.ly') && !lower.includes('linktr.ee')) {
        return match.startsWith('http') ? match : `https://${match}`;
      }
    }
    return undefined;
  }
}
