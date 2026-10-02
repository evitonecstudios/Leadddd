import axios from 'axios';
import * as cheerio from 'cheerio';
import https from 'https';
import { db } from '../db/index.ts';
import { leads, audits, auditFindings } from '../db/schema.ts';
import { eq } from 'drizzle-orm';
import { logger, metrics } from '../lib/monitoring.ts';

export interface AuditMetric {
  name: string;
  value: any;
  category: string;
}

export interface AuditFinding {
  category: string;
  severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  description: string;
  evidence: string;
  recommendation?: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
}

export class WebsiteService {
  private static MAX_PAGES = 5;

  static isSafeUrl(urlStr: string): boolean {
    try {
      const url = new URL(urlStr);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
      
      const hostname = url.hostname.toLowerCase();
      
      // Prevent SSRF
      const blocked = [
        'localhost', '127.0.0.1', '0.0.0.0', '::1',
        'metadata.google.internal', '169.254.169.254'
      ];
      if (blocked.includes(hostname)) return false;

      // Private IP ranges
      const privateIpRegex = /^(10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.)/;
      if (privateIpRegex.test(hostname)) return false;

      return true;
    } catch {
      return false;
    }
  }

  static async validateWebsite(leadId: number, url: string) {
    const startTime = Date.now();
    try {
      if (!this.isSafeUrl(url)) {
        await metrics.record('AUDIT', 'WEBSITE_VALIDATION', 'FAILURE', Date.now() - startTime, { leadId, url, error: 'Unsafe URL' });
        return { reachable: false, error: 'Unsafe URL' };
      }

      let response: any;
      try {
        response = await axios.get(url, {
          timeout: 10000,
          headers: { 'User-Agent': 'LeadForge-Audit-Bot/1.0' },
          maxRedirects: 5,
          validateStatus: () => true
        });
      } catch (err: any) {
        // Fallback for SSL certificate errors
        if (err.code?.includes('CERT') || err.message?.includes('certificate') || err.message?.includes('altnames')) {
          response = await axios.get(url, {
            timeout: 10000,
            headers: { 'User-Agent': 'LeadForge-Audit-Bot/1.0' },
            httpsAgent: new https.Agent({ rejectUnauthorized: false }),
            maxRedirects: 5,
            validateStatus: () => true
          });
        } else {
          throw err;
        }
      }

      const isReachable = response.status >= 200 && response.status < 500;
      await db.update(leads).set({
        websiteStatus: isReachable ? 'verified' : 'unreachable',
        websiteLastChecked: new Date(),
        websiteExists: isReachable
      }).where(eq(leads.id, leadId));
      
      await metrics.record('AUDIT', 'WEBSITE_VALIDATION', 'SUCCESS', Date.now() - startTime, { leadId, url, status: response.status });
      return { reachable: isReachable, status: response.status };
    } catch (error: any) {
      const isTimeout = error.code === 'ECONNABORTED';
      await metrics.record('AUDIT', 'WEBSITE_VALIDATION', isTimeout ? 'TIMEOUT' : 'FAILURE', Date.now() - startTime, { leadId, url, error: error.message });
      
      await db.update(leads).set({
        websiteStatus: 'unreachable',
        websiteLastChecked: new Date(),
        websiteExists: false
      }).where(eq(leads.id, leadId));
      return { reachable: false, error: error.message };
    }
  }

  static async discoverWebsite(leadId: number, companyName: string, city: string) {
    await db.update(leads).set({
      websiteStatus: 'not_detected',
      websiteLastChecked: new Date(),
    }).where(eq(leads.id, leadId));
    return { status: 'not_detected' };
  }

  static async performAudit(leadId: number, targetUrl: string) {
    const startTime = Date.now();
    if (!this.isSafeUrl(targetUrl)) {
      await logger.warn('AUDIT', 'Blocked attempt to audit unsafe URL', { leadId, targetUrl }, 'WEBSITE_SCRAPER');
      throw new Error('Unsafe URL provided');
    }

    const [auditRecord] = await db.insert(audits).values({
      leadId,
      targetUrl,
      status: 'running',
      metrics: {},
    }).returning();

    const auditId = auditRecord.id;
    const findings: AuditFinding[] = [];
    const auditMetrics: Record<string, any> = {};
    const permissiveAgent = new https.Agent({ rejectUnauthorized: false });

    try {
      let currentUrl = targetUrl;
      let redirects = 0;
      let finalResponse: any = null;
      let sslIssueDetected = false;
      let sslIssueDetails = '';

      // Manual redirect follow with safety checks
      while (redirects < 5) {
        if (!this.isSafeUrl(currentUrl)) {
          await logger.warn('AUDIT', 'Blocked redirect to unsafe URL', { auditId, currentUrl }, 'WEBSITE_SCRAPER');
          throw new Error('Redirected to unsafe URL');
        }
        
        try {
          // Standard request with reasonable 12s timeout
          const response = await axios.get(currentUrl, {
            timeout: 12000,
            headers: { 
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 LeadForge-Audit-Bot/2.0',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.9',
              'Cache-Control': 'no-cache',
            },
            maxRedirects: 0,
            validateStatus: () => true // Allow all status codes (200, 301, 401, 403, 500)
          });

          if (response.status >= 300 && response.status < 400 && response.headers.location) {
            const nextUrl = new URL(response.headers.location, currentUrl).toString();
            currentUrl = nextUrl;
            redirects++;
            continue;
          }

          finalResponse = response;
          break;
        } catch (err: any) {
          const isSslCertError = err.code?.includes('CERT') || 
                                 err.message?.includes('certificate') || 
                                 err.message?.includes('altnames');

          // If SSL certificate mismatch occurs (e.g. www.schaefer-zuerich.ch), capture as critical security finding and retry with fallback
          if (isSslCertError && !sslIssueDetected) {
            sslIssueDetected = true;
            sslIssueDetails = err.message;

            try {
              const fallbackResponse = await axios.get(currentUrl, {
                timeout: 12000,
                headers: { 
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 LeadForge-Audit-Bot/2.0',
                  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                },
                httpsAgent: permissiveAgent,
                maxRedirects: 0,
                validateStatus: () => true
              });

              if (fallbackResponse.status >= 300 && fallbackResponse.status < 400 && fallbackResponse.headers.location) {
                const nextUrl = new URL(fallbackResponse.headers.location, currentUrl).toString();
                currentUrl = nextUrl;
                redirects++;
                continue;
              }

              finalResponse = fallbackResponse;
              break;
            } catch (fallbackErr: any) {
              throw fallbackErr;
            }
          } else {
            throw err;
          }
        }
      }

      if (!finalResponse) throw new Error('Too many redirects or no response');

      const loadEndTime = Date.now();
      const duration = loadEndTime - startTime;
      const html = typeof finalResponse.data === 'string' ? finalResponse.data : '';
      const $ = cheerio.load(html || '<html><body></body></html>');

      auditMetrics.status = finalResponse.status;
      auditMetrics.ttfb = duration;
      auditMetrics.contentSize = html.length;
      auditMetrics.finalUrl = currentUrl;
      auditMetrics.targetUrl = targetUrl;
      auditMetrics.headers = finalResponse.headers || {};

      // 1. SSL/TLS Certificate Findings
      if (sslIssueDetected) {
        findings.push({
          category: 'Security',
          severity: 'CRITICAL',
          title: 'SSL Certificate Mismatch or Invalidation',
          description: 'The website has an invalid or mismatched SSL/TLS certificate. Modern browsers display a warning screen blocking visitors.',
          evidence: sslIssueDetails || 'Certificate altnames mismatch or validation failure.',
          recommendation: 'Configure a valid TLS/SSL certificate matching this domain name.',
          confidence: 'HIGH'
        });
      }

      // 2. HTTP Access / Restriction Findings
      if (finalResponse.status === 401) {
        findings.push({
          category: 'Technical',
          severity: 'HIGH',
          title: 'Website Requires Authentication (HTTP 401)',
          description: 'The website is password protected or requires HTTP Basic Auth. Public customers cannot access the storefront without credentials.',
          evidence: `HTTP 401 returned from ${currentUrl}`,
          recommendation: 'Remove authentication restriction or launch the public-facing storefront.',
          confidence: 'HIGH'
        });
      } else if (finalResponse.status === 403) {
        findings.push({
          category: 'Technical',
          severity: 'MEDIUM',
          title: 'Access Restricted by Server (HTTP 403)',
          description: 'The website web server or firewall blocked automated crawler requests.',
          evidence: `HTTP 403 Forbidden returned from ${currentUrl}`,
          recommendation: 'Review web server permissions and ensure legitimate visitors and crawlers are permitted.',
          confidence: 'HIGH'
        });
      } else if (finalResponse.status >= 500) {
        findings.push({
          category: 'Technical',
          severity: 'CRITICAL',
          title: `Web Server Internal Error (HTTP ${finalResponse.status})`,
          description: 'The web server encountered a fatal internal error when loading the page.',
          evidence: `HTTP ${finalResponse.status} returned from ${currentUrl}`,
          recommendation: 'Resolve server script errors or migrate to high-reliability hosting.',
          confidence: 'HIGH'
        });
      }

      // --- TECHNICAL AUDIT ---
      let techScore = this.auditTechnical($, finalResponse, findings, auditMetrics);
      if (sslIssueDetected) {
        techScore = Math.max(0, techScore - 40);
      }
      if (finalResponse.status >= 400) {
        techScore = Math.max(0, techScore - 40);
      }

      // --- SEO AUDIT ---
      const seoScore = this.auditSEO($, findings, auditMetrics);

      // --- CONVERSION AUDIT ---
      const convScore = this.auditConversion($, html, findings, auditMetrics);

      // --- LOCAL SEO ---
      const localSeoScore = this.auditLocalSEO($, findings, auditMetrics);

      // --- DETERMINISTIC SCORING ---
      const scores: Record<string, number | null> = {
        technical: techScore,
        seo: seoScore,
        conversion: convScore,
        localSeo: localSeoScore,
        mobile: null,
        performance: this.calculatePerformanceScore(duration, html.length),
      };

      const weights = {
        technical: 0.20,
        seo: 0.20,
        mobile: 0.15,
        performance: 0.15,
        conversion: 0.20,
        localSeo: 0.10
      };

      let overallScore = 0;
      let totalWeight = 0;
      
      Object.entries(scores).forEach(([key, val]) => {
        if (val !== null) {
          const weight = (weights as any)[key];
          overallScore += val * weight;
          totalWeight += weight;
        }
      });

      const finalOverall = totalWeight > 0 ? Math.round(overallScore / totalWeight) : null;

      // --- PERSIST FINDINGS ---
      if (findings.length > 0) {
        await db.insert(auditFindings).values(findings.map(f => ({
          auditId,
          ...f
        })));
      }

      // --- UPDATE AUDIT RECORD ---
      await db.update(audits).set({
        status: 'completed',
        finalUrl: auditMetrics.finalUrl,
        overallScore: finalOverall,
        technicalScore: techScore,
        seoScore: seoScore,
        conversionScore: convScore,
        localSeoScore: localSeoScore,
        mobileScore: null,
        performanceScore: scores.performance,
        metrics: auditMetrics,
        completedAt: new Date()
      }).where(eq(audits.id, auditId));

      await metrics.record('AUDIT', 'WEBSITE', 'SUCCESS', Date.now() - startTime, { leadId, auditId, score: finalOverall });
      return { auditId, overallScore: finalOverall };

    } catch (error: any) {
      const isTimeout = error.code === 'ECONNABORTED' || error.message?.includes('timeout');
      const isNetworkIssue = error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || error.code === 'EHOSTUNREACH';

      // Transform fatal network timeouts and DNS failures into completed audits with critical findings
      if (isTimeout || isNetworkIssue) {
        if (isTimeout) {
          findings.push({
            category: 'Performance',
            severity: 'CRITICAL',
            title: 'Server Response Timeout (>12s)',
            description: 'The website web server failed to respond within 12 seconds. Severe latency or unresponsiveness destroys customer acquisition.',
            evidence: error.message || 'Request timed out after 12000ms',
            recommendation: 'Upgrade to high-performance managed hosting with SSD storage and edge CDN caching.',
            confidence: 'HIGH'
          });
        } else {
          findings.push({
            category: 'Technical',
            severity: 'CRITICAL',
            title: 'Domain DNS or Server Connection Failure',
            description: 'The domain name could not be resolved or the web server refused the connection.',
            evidence: error.message,
            recommendation: 'Check domain DNS records and ensure web hosting server is active.',
            confidence: 'HIGH'
          });
        }

        if (findings.length > 0) {
          await db.insert(auditFindings).values(findings.map(f => ({
            auditId,
            ...f
          })));
        }

        const fallbackScores = {
          status: 'completed',
          finalUrl: targetUrl,
          overallScore: 20,
          technicalScore: isTimeout ? 40 : 15,
          seoScore: null,
          conversionScore: null,
          localSeoScore: null,
          mobileScore: null,
          performanceScore: isTimeout ? 10 : 0,
          metrics: { status: isTimeout ? 504 : 503, error: error.message, ttfb: isTimeout ? 12000 : 0 },
          completedAt: new Date()
        };

        await db.update(audits).set(fallbackScores).where(eq(audits.id, auditId));
        await metrics.record('AUDIT', 'WEBSITE', isTimeout ? 'TIMEOUT' : 'FAILURE', Date.now() - startTime, { leadId, auditId, error: error.message });
        return { auditId, overallScore: fallbackScores.overallScore };
      }

      await metrics.record('AUDIT', 'WEBSITE', 'FAILURE', Date.now() - startTime, { leadId, auditId, error: error.message });
      await logger.error('AUDIT', `Audit failed for ${targetUrl}`, error, { leadId, auditId }, 'WEBSITE_SCRAPER');
      
      await db.update(audits).set({
        status: 'failed',
        error: error.message,
        completedAt: new Date()
      }).where(eq(audits.id, auditId));
      throw error;
    }
  }

  private static auditTechnical($: any, response: any, findings: AuditFinding[], metrics: any): number {
    let score = 100;
    const url = metrics.finalUrl || metrics.targetUrl || '';

    if (url && !url.startsWith('https:')) {
      score -= 30;
      findings.push({
        category: 'Technical',
        severity: 'HIGH',
        title: 'HTTPS not enabled',
        description: 'The website does not use a secure HTTPS connection.',
        evidence: `URL protocol is ${url.split(':')[0]}`,
        recommendation: 'Install an SSL certificate and redirect all HTTP traffic to HTTPS.',
        confidence: 'HIGH'
      });
    }

    const securityHeaders = ['content-security-policy', 'strict-transport-security', 'x-content-type-options'];
    securityHeaders.forEach(h => {
      if (!response.headers[h]) {
        score -= 5;
        findings.push({
          category: 'Technical',
          severity: 'LOW',
          title: `Missing security header: ${h}`,
          description: `The ${h} header was not detected.`,
          evidence: 'Header not found in response.',
          recommendation: `Implement the ${h} header to improve website security.`,
          confidence: 'HIGH'
        });
      }
    });

    return Math.max(0, score);
  }

  private static auditSEO($: any, findings: AuditFinding[], metrics: any): number {
    let score = 100;
    
    const title = $('title').text().trim();
    if (!title) {
      score -= 30;
      findings.push({
        category: 'SEO',
        severity: 'HIGH',
        title: 'Missing SEO Title',
        description: 'No <title> tag was found on the homepage.',
        evidence: 'title element is empty or missing.',
        recommendation: 'Add a unique, descriptive title between 50-60 characters.',
        confidence: 'HIGH'
      });
    }

    const description = $('meta[name="description"]').attr('content');
    if (!description) {
      score -= 20;
      findings.push({
        category: 'SEO',
        severity: 'MEDIUM',
        title: 'Missing Meta Description',
        description: 'The meta description tag is missing.',
        evidence: 'meta[name="description"] not found.',
        recommendation: 'Add a meta description that summarizes the page content (150-160 characters).',
        confidence: 'HIGH'
      });
    }

    const h1s = $('h1');
    if (h1s.length === 0) {
      score -= 20;
      findings.push({
        category: 'SEO',
        severity: 'MEDIUM',
        title: 'No H1 Heading',
        description: 'The page lacks a main H1 heading.',
        evidence: '0 H1 elements detected.',
        recommendation: 'Add one primary H1 heading containing your main keyword.',
        confidence: 'HIGH'
      });
    } else if (h1s.length > 1) {
      score -= 5;
      findings.push({
        category: 'SEO',
        severity: 'LOW',
        title: 'Multiple H1 Headings',
        description: 'Detected multiple H1 tags on the same page.',
        evidence: `${h1s.length} H1 elements found.`,
        recommendation: 'Use only one H1 per page for better structural clarity.',
        confidence: 'HIGH'
      });
    }

    return Math.max(0, score);
  }

  private static auditConversion($: any, html: string, findings: AuditFinding[], metrics: any): number {
    let score = 0;
    const checks = [
      { id: 'phone', label: 'Phone CTA', weight: 20, pattern: /tel:|(?:\+?(\d{1,3}))?[-. (]*(\d{3})[-. )]*(\d{3})[-. ]*(\d{4})(?: *x(\d+))?/ },
      { id: 'email', label: 'Email CTA', weight: 20, pattern: /mailto:/ },
      { id: 'form', label: 'Contact Form', weight: 20, element: 'form' },
      { id: 'whatsapp', label: 'WhatsApp', weight: 20, pattern: /wa\.me|whatsapp\.com\/send/ },
      { id: 'booking', label: 'Booking System', weight: 20, pattern: /book|appointment|calendly|doctolib/i }
    ];

    checks.forEach(check => {
      let detected = false;
      if (check.pattern && check.pattern.test(html)) detected = true;
      if (check.element && $(check.element).length > 0) detected = true;

      if (detected) {
        score += check.weight;
      } else {
        findings.push({
          category: 'Conversion',
          severity: 'MEDIUM',
          title: `${check.label} not detected`,
          description: `No obvious ${check.label.toLowerCase()} found on the audited page.`,
          evidence: `Pattern/Element '${check.id}' not found.`,
          recommendation: `Add a visible ${check.label} to improve conversion rates.`,
          confidence: 'MEDIUM'
        });
      }
    });

    return score;
  }

  private static auditLocalSEO($: any, findings: AuditFinding[], metrics: any): number {
    let score = 0;
    
    // Check for Schema.org LocalBusiness
    const jsonLd = $('script[type="application/ld+json"]');
    let hasLocalSchema = false;
    jsonLd.each((i: number, el: any) => {
      try {
        const data = JSON.parse($(el).html());
        const types = Array.isArray(data['@type']) ? data['@type'] : [data['@type']];
        if (types.some((t: string) => t && (t.includes('LocalBusiness') || t.includes('Organization')))) hasLocalSchema = true;
      } catch {}
    });

    if (hasLocalSchema) {
      score += 50;
    } else {
      findings.push({
        category: 'Local SEO',
        severity: 'MEDIUM',
        title: 'LocalBusiness Schema Missing',
        description: 'Structured data for local business was not detected.',
        evidence: 'No JSON-LD with type LocalBusiness found.',
        recommendation: 'Add LocalBusiness structured data to help search engines understand your location and services.',
        confidence: 'HIGH'
      });
    }

    // Address detection
    const addressKeywords = ['street', 'road', 'avenue', 'address', 'city', 'zip', 'postal'];
    const bodyText = $('body').text().toLowerCase();
    const hasAddress = addressKeywords.some(k => bodyText.includes(k)) && /\d+/.test(bodyText);
    
    if (hasAddress) {
      score += 50;
    } else {
      findings.push({
        category: 'Local SEO',
        severity: 'MEDIUM',
        title: 'Address not detected',
        description: 'Physical address information was not clearly found.',
        evidence: 'Text analysis failed to find clear address patterns.',
        recommendation: 'Display your business address clearly in the footer or contact page.',
        confidence: 'LOW'
      });
    }

    return score;
  }

  private static calculatePerformanceScore(duration: number, size: number): number {
    let score = 100;
    
    if (duration > 5000) score -= 40;
    else if (duration > 2000) score -= 20;
    else if (duration > 1000) score -= 5;

    if (size > 1000000) score -= 30; 
    else if (size > 500000) score -= 15;

    return Math.max(0, score);
  }
}

