import axios from 'axios';
import * as cheerio from 'cheerio';
import https from 'https';
import { db } from '../db/index.ts';
import { leads, audits, auditFindings } from '../db/schema.ts';
import { eq } from 'drizzle-orm';
import { logger, metrics } from '../lib/monitoring.ts';
import { IdentityService } from './identityService.ts';

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
        // Fallback for SSL certificate errors (including altnames mismatches)
        if (err.code?.includes('CERT') || err.message?.includes('certificate') || err.message?.includes('altnames') || err.code === 'ERR_TLS_CERT_ALTNAME_INVALID') {
          response = await axios.get(url, {
            timeout: 10000,
            headers: { 'User-Agent': 'LeadForge-Audit-Bot/1.0' },
            httpsAgent: new https.Agent({ 
              rejectUnauthorized: false,
              checkServerIdentity: () => undefined 
            }),
            maxRedirects: 5,
            validateStatus: () => true
          });
        } else {
          throw err;
        }
      }

      const isParked = typeof response.data === 'string' && IdentityService.isParkedOrBrokerDomain(response.data, url);
      const isReachable = response.status >= 200 && response.status < 400 && !isParked;
      await db.update(leads).set({
        websiteStatus: isReachable ? 'verified' : (isParked ? 'not_detected' : 'unreachable'),
        websiteLastChecked: new Date(),
        websiteExists: isReachable
      }).where(eq(leads.id, leadId));
      
      await metrics.record('AUDIT', 'WEBSITE_VALIDATION', 'SUCCESS', Date.now() - startTime, { leadId, url, status: response.status, isParked });
      return { reachable: isReachable, status: response.status, isParked };
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
    const permissiveAgent = new https.Agent({ 
      rejectUnauthorized: false,
      checkServerIdentity: () => undefined 
    });

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
            httpsAgent: sslIssueDetected ? permissiveAgent : undefined,
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
                                 err.message?.includes('altnames') ||
                                 err.code === 'ERR_TLS_CERT_ALTNAME_INVALID' ||
                                 err.code === 'DEPTH_ZERO_SELF_SIGNED_CERT';

          // If SSL certificate mismatch occurs (e.g. ets-gerard.com, www.schaefer-zuerich.ch), capture as critical security finding and retry with permissiveAgent
          if (isSslCertError) {
            sslIssueDetected = true;
            if (!sslIssueDetails) sslIssueDetails = err.message;

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
      
      // Critical Check: Detect Parked / Expired / For-Sale Domain Broker pages
      if (IdentityService.isParkedOrBrokerDomain(html, currentUrl)) {
        findings.push({
          category: 'Technical',
          severity: 'CRITICAL',
          title: 'Nom de domaine inactif / En vente (Aucun site d’entreprise)',
          description: 'Ce nom de domaine est parqué ou mis en vente par un courtier (ex: GoDaddy, Sedo, DomainMarket). Aucun site web actif n’existe pour cette entreprise.',
          evidence: 'Présence de liens d’enchères, parking ou vente de nom de domaine.',
          recommendation: 'Le prospect n’a aucun site web opérationnel : opportunité directe de création de site vitrine.',
          confidence: 'HIGH'
        });

        await db.insert(auditFindings).values(findings.map(f => ({ auditId, ...f })));
        await db.update(audits).set({
          status: 'completed',
          finalUrl: currentUrl,
          overallScore: 0,
          technicalScore: 0,
          seoScore: 0,
          conversionScore: 0,
          localSeoScore: 0,
          mobileScore: 0,
          performanceScore: 0,
          completedAt: new Date()
        }).where(eq(audits.id, auditId));

        await db.update(leads).set({
          websiteStatus: 'not_detected',
          websiteExists: false,
          auditScore: 0
        }).where(eq(leads.id, leadId));

        return { auditId, overallScore: 0 };
      }

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

      // --- MOBILE RESPONSIVENESS AUDIT ---
      const mobileScore = this.auditMobile($, html, findings);
      const perfScore = this.calculatePerformanceScore(duration, html.length);

      // --- DETERMINISTIC SCORING ---
      const scores: Record<string, number | null> = {
        technical: techScore,
        seo: seoScore,
        conversion: convScore,
        localSeo: localSeoScore,
        mobile: mobileScore,
        performance: perfScore,
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
        mobileScore: mobileScore,
        performanceScore: perfScore,
        metrics: auditMetrics,
        completedAt: new Date()
      }).where(eq(audits.id, auditId));

      await db.update(leads).set({ auditScore: finalOverall }).where(eq(leads.id, leadId));

      await metrics.record('AUDIT', 'WEBSITE', 'SUCCESS', Date.now() - startTime, { leadId, auditId, score: finalOverall });
      return { auditId, overallScore: finalOverall };

    } catch (error: any) {
      const isTimeout = error.code === 'ECONNABORTED' || error.message?.includes('timeout');
      const isNetworkIssue = error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || error.code === 'EHOSTUNREACH';
      const isSslCertError = error.code?.includes('CERT') || 
                             error.message?.includes('certificate') || 
                             error.message?.includes('altnames') ||
                             error.code === 'ERR_TLS_CERT_ALTNAME_INVALID';

      // Transform fatal network timeouts, DNS failures, and SSL altname errors into completed audits with critical findings
      if (isTimeout || isNetworkIssue || isSslCertError) {
        if (isSslCertError) {
          findings.push({
            category: 'Security',
            severity: 'CRITICAL',
            title: 'Erreur Certificat SSL / Nom de Domaine Mismatch',
            description: 'Le certificat SSL/TLS ne correspond pas au nom de domaine du site. Les navigateurs (Chrome, Safari, Firefox) bloquent totalement l’accès avec un écran rouge d’avertissement de sécurité.',
            evidence: error.message || 'Hostname/IP does not match certificate altnames',
            recommendation: 'Installer un certificat SSL/TLS valide (Let’s Encrypt / hébergeur OVH) correspondant au nom de domaine principal.',
            confidence: 'HIGH'
          });
        } else if (isTimeout) {
          findings.push({
            category: 'Performance',
            severity: 'CRITICAL',
            title: 'Délai d’attente serveur dépassé (>12s)',
            description: 'Le serveur web n’a pas répondu dans le délai imparti de 12 secondes.',
            evidence: error.message || 'Request timed out after 12000ms',
            recommendation: 'Migrer vers un hébergement web performant avec mise en cache CDN.',
            confidence: 'HIGH'
          });
        } else {
          findings.push({
            category: 'Technical',
            severity: 'CRITICAL',
            title: 'Échec de résolution DNS ou connexion serveur refusée',
            description: 'Le nom de domaine n’a pas pu être résolu ou le serveur a refusé la connexion.',
            evidence: error.message,
            recommendation: 'Vérifier la zone DNS du domaine et s’assurer que le serveur web est démarré.',
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
          overallScore: isSslCertError ? 25 : 20,
          technicalScore: isSslCertError ? 10 : (isTimeout ? 40 : 15),
          seoScore: null,
          conversionScore: null,
          localSeoScore: null,
          mobileScore: null,
          performanceScore: isTimeout ? 10 : 0,
          metrics: { status: isSslCertError ? 526 : (isTimeout ? 504 : 503), error: error.message, ttfb: isTimeout ? 12000 : 0 },
          completedAt: new Date()
        };

        await db.update(audits).set(fallbackScores).where(eq(audits.id, auditId));
        await db.update(leads).set({ auditScore: fallbackScores.overallScore }).where(eq(leads.id, leadId));
        await metrics.record('AUDIT', 'WEBSITE', isTimeout ? 'TIMEOUT' : 'FAILURE', Date.now() - startTime, { leadId, auditId, error: error.message, isSslCertError });
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
    let score = 90; // Realistic start (not 100)
    const url = metrics.finalUrl || metrics.targetUrl || '';

    if (url && !url.startsWith('https:')) {
      score -= 40;
      findings.push({
        category: 'Technical',
        severity: 'HIGH',
        title: 'Connexion non sécurisée (HTTP au lieu de HTTPS)',
        description: 'Le site ne force pas le protocole HTTPS sécurisé. Google Chrome et Firefox affichent un avertissement « Non sécurisé ».',
        evidence: `Protocole URL: ${url.split(':')[0]}`,
        recommendation: 'Installer un certificat SSL/TLS et forcer la redirection 301 de HTTP vers HTTPS.',
        confidence: 'HIGH'
      });
    }

    // Check Mixed Content
    if (url.startsWith('https:')) {
      const mixedContent = $('script[src^="http://"], link[href^="http://"], img[src^="http://"]');
      if (mixedContent.length > 0) {
        score -= 15;
        findings.push({
          category: 'Technical',
          severity: 'MEDIUM',
          title: 'Contenu mixte détecté (Ressources HTTP non sécurisées)',
          description: `${mixedContent.length} ressource(s) sont chargées en HTTP non sécurisé sur une page HTTPS.`,
          evidence: `${mixedContent.length} éléments avec URL HTTP détectés`,
          recommendation: 'Mettre à jour tous les liens d’assets vers https://.',
          confidence: 'HIGH'
        });
      }
    }

    const securityHeaders = [
      { name: 'strict-transport-security', label: 'HSTS (Strict-Transport-Security)', penalty: 8 },
      { name: 'x-content-type-options', label: 'X-Content-Type-Options', penalty: 6 },
      { name: 'x-frame-options', label: 'X-Frame-Options (Protection Clickjacking)', penalty: 8 },
      { name: 'referrer-policy', label: 'Referrer-Policy', penalty: 5 }
    ];

    securityHeaders.forEach(h => {
      if (!response.headers[h.name]) {
        score -= h.penalty;
        findings.push({
          category: 'Technical',
          severity: 'LOW',
          title: `En-tête de sécurité manquant: ${h.label}`,
          description: `L'en-tête HTTP ${h.name} n'est pas envoyé par le serveur.`,
          evidence: 'En-tête absent de la réponse HTTP.',
          recommendation: `Configurer l'en-tête ${h.name} au niveau du serveur web (Nginx/Apache/Cloudflare).`,
          confidence: 'HIGH'
        });
      }
    });

    return Math.max(10, Math.min(100, score));
  }

  private static auditSEO($: any, findings: AuditFinding[], metrics: any): number {
    let score = 90; // Realistic start (not 100)
    
    const title = $('title').text().trim();
    if (!title) {
      score -= 35;
      findings.push({
        category: 'SEO',
        severity: 'HIGH',
        title: 'Balise <title> manquante',
        description: 'Aucune balise de titre SEO n’a été trouvée sur la page d’accueil.',
        evidence: 'Balise title vide ou inexistante.',
        recommendation: 'Ajouter une balise <title> unique et optimisée de 50 à 60 caractères.',
        confidence: 'HIGH'
      });
    } else if (title.length < 25) {
      score -= 12;
      findings.push({
        category: 'SEO',
        severity: 'LOW',
        title: 'Titre SEO trop court ou non optimisé',
        description: `Le titre SEO (« ${title} ») fait seulement ${title.length} caractères, sans mots-clés d'activité ou de localisation.`,
        evidence: `Longueur du titre: ${title.length} caractères`,
        recommendation: 'Étendre le titre entre 50 et 60 caractères avec le métier et la ville.',
        confidence: 'HIGH'
      });
    } else if (title.length > 70) {
      score -= 8;
      findings.push({
        category: 'SEO',
        severity: 'LOW',
        title: 'Titre SEO trop long (Risque de troncature Google)',
        description: `Le titre (${title.length} car.) dépasse la limite d'affichage des résultats Google.`,
        evidence: `Longueur du titre: ${title.length} caractères`,
        recommendation: 'Raccourcir sous les 65 caractères.',
        confidence: 'HIGH'
      });
    }

    const description = $('meta[name="description"]').attr('content')?.trim();
    if (!description) {
      score -= 25;
      findings.push({
        category: 'SEO',
        severity: 'MEDIUM',
        title: 'Méta-description manquante',
        description: 'La méta-description est absente. Google choisira un extrait aléatoire dans le texte.',
        evidence: 'meta[name="description"] absent.',
        recommendation: 'Rédiger une méta-description persuasive de 140 à 160 caractères.',
        confidence: 'HIGH'
      });
    } else if (description.length < 60) {
      score -= 10;
      findings.push({
        category: 'SEO',
        severity: 'LOW',
        title: 'Méta-description trop courte',
        description: `La méta-description ne fait que ${description.length} caractères.`,
        evidence: `Longueur: ${description.length} caractères`,
        recommendation: 'Développer une proposition de valeur complète (140-160 car.).',
        confidence: 'HIGH'
      });
    }

    const h1s = $('h1');
    if (h1s.length === 0) {
      score -= 20;
      findings.push({
        category: 'SEO',
        severity: 'MEDIUM',
        title: 'Titre principal <h1> manquant',
        description: 'La page n’a aucun titre <h1> pour structurer son sujet principal.',
        evidence: '0 balise <h1> détectée.',
        recommendation: 'Ajouter un titre <h1> unique ciblant votre activité principale.',
        confidence: 'HIGH'
      });
    } else if (h1s.length > 1) {
      score -= 8;
      findings.push({
        category: 'SEO',
        severity: 'LOW',
        title: 'Multiples balises <h1> détectées',
        description: `${h1s.length} balises <h1> trouvées sur la même page.`,
        evidence: `${h1s.length} éléments <h1>`,
        recommendation: 'Ne conserver qu’un seul <h1> par page pour une structure sémantique claire.',
        confidence: 'HIGH'
      });
    }

    // OpenGraph Social Tags
    const ogTitle = $('meta[property="og:title"]').attr('content');
    const ogImage = $('meta[property="og:image"]').attr('content');
    if (!ogTitle || !ogImage) {
      score -= 12;
      findings.push({
        category: 'SEO',
        severity: 'LOW',
        title: 'Balises Open Graph (Partage Réseaux Sociaux) incomplètes',
        description: 'Les balises og:title et og:image sont absentes. Les partages sur WhatsApp, Facebook et LinkedIn afficheront un aperçu vide.',
        evidence: 'Balises OpenGraph absentes ou incomplètes',
        recommendation: 'Configurer les balises OpenGraph pour valoriser les partages sociaux.',
        confidence: 'HIGH'
      });
    }

    // Canonical link
    const canonical = $('link[rel="canonical"]').attr('href');
    if (!canonical) {
      score -= 10;
      findings.push({
        category: 'SEO',
        severity: 'LOW',
        title: 'Balise Canonical manquante',
        description: 'Aucune URL canonique définie pour éviter les problèmes de contenu dupliqué.',
        evidence: 'link[rel="canonical"] absent',
        recommendation: 'Ajouter une balise <link rel="canonical" href="...">.',
        confidence: 'HIGH'
      });
    }

    // Image Alt attributes
    const allImgs = $('img');
    const missingAlt = $('img:not([alt]), img[alt=""]');
    if (allImgs.length > 2 && (missingAlt.length / allImgs.length) > 0.3) {
      score -= 12;
      findings.push({
        category: 'SEO',
        severity: 'LOW',
        title: `Images sans texte alternatif (${missingAlt.length}/${allImgs.length})`,
        description: `${missingAlt.length} image(s) n’ont pas de balise alt descriptive pour les moteurs de recherche et l’accessibilité.`,
        evidence: `${missingAlt.length} images sans alt`,
        recommendation: 'Renseigner un attribut alt descriptif sur toutes les images importantes.',
        confidence: 'HIGH'
      });
    }

    return Math.max(10, Math.min(100, score));
  }

  private static auditConversion($: any, html: string, findings: AuditFinding[], metrics: any): number {
    let score = 0;
    const lowerHtml = html.toLowerCase();

    // 1. Phone CTA Check: tel: hrefs or formatted phone strings
    const hasTelLink = $('a[href^="tel:"]').length > 0;
    const hasPhonePattern = /(?:(?:\+|00)33[\s.-]?|0)[1-9](?:[\s.-]?\d{2}){4}/.test(html) ||
                            /(?:\+?(\d{1,3}))?[-. (]*(\d{3})[-. )]*(\d{3})[-. ]*(\d{4})/.test(html);
    if (hasTelLink || hasPhonePattern) {
      score += 25;
    } else {
      findings.push({
        category: 'Conversion',
        severity: 'MEDIUM',
        title: 'Appel direct 1-clic non détecté',
        description: 'Aucun lien d’appel direct (tel:) ou numéro de téléphone immédiatement cliquable n’a été identifié sur la page d’accueil.',
        evidence: 'Absence de balise <a href="tel:...">',
        recommendation: 'Ajouter un bouton d’appel 1-clic bien visible pour les visiteurs mobiles.',
        confidence: 'HIGH'
      });
    }

    // 2. Email CTA Check: mailto: link or visible email address
    const hasMailto = $('a[href^="mailto:"]').length > 0;
    const hasEmailInText = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(html) && !lowerHtml.includes('wixpress') && !lowerHtml.includes('sentry');
    if (hasMailto || hasEmailInText) {
      score += 20;
    } else {
      findings.push({
        category: 'Conversion',
        severity: 'LOW',
        title: 'Email cliquable non détecté',
        description: 'Aucun lien mailto: direct n’a été détecté sur la page d’accueil.',
        evidence: 'Absence de lien mailto:',
        recommendation: 'Afficher une adresse email de contact direct ou un lien mailto:.',
        confidence: 'MEDIUM'
      });
    }

    // 3. Contact Form Check: robust detection (form tags, input textareas, form plugins, embed iframes, contact links)
    const hasHtmlForm = $('form').length > 0 && ($('form input').length > 0 || $('form textarea').length > 0);
    const hasFormPlugin = lowerHtml.includes('wpforms') || 
                          lowerHtml.includes('contact-form-7') || 
                          lowerHtml.includes('formidable') || 
                          lowerHtml.includes('gravityforms') || 
                          lowerHtml.includes('typeform') || 
                          lowerHtml.includes('hubspot') || 
                          lowerHtml.includes('tally.so') || 
                          lowerHtml.includes('formspree') ||
                          lowerHtml.includes('jotform') ||
                          lowerHtml.includes('ninja-forms');
    const hasContactModalOrIframe = $('iframe[src*="form"], iframe[src*="contact"], [class*="contact-form"], [id*="contact-form"]').length > 0;
    const hasContactPageLink = $('a[href*="contact"]').length > 0;

    if (hasHtmlForm || hasFormPlugin || hasContactModalOrIframe) {
      score += 25;
    } else if (hasContactPageLink) {
      // Form likely on a dedicated /contact subpage
      score += 15;
    } else {
      findings.push({
        category: 'Conversion',
        severity: 'HIGH',
        title: 'Formulaire de contact non détecté sur la page d’accueil',
        description: 'Aucun formulaire de devis ou prise de contact interactif n’est présent directement sur la page d’accueil.',
        evidence: 'Aucune balise <form> avec champs de saisie ou widget de contact détecté',
        recommendation: 'Intégrer un formulaire de contact simplifié au-dessus de la ligne de flottaison.',
        confidence: 'HIGH'
      });
    }

    // 4. Instant Messaging / WhatsApp / Messenger
    const hasWhatsApp = /wa\.me|whatsapp\.com\/send|api\.whatsapp/.test(html);
    const hasMessenger = /m\.me|messenger\.com/.test(html);
    if (hasWhatsApp || hasMessenger) {
      score += 15;
    } else {
      findings.push({
        category: 'Conversion',
        severity: 'LOW',
        title: 'Canal de messagerie instantanée (WhatsApp) absent',
        description: 'Aucun bouton de contact WhatsApp ou messagerie directe n’est présent pour les demandes rapides.',
        evidence: 'Absence de lien WhatsApp ou widget chat',
        recommendation: 'Ajouter un bouton WhatsApp flottant pour convertir les visiteurs mobiles.',
        confidence: 'HIGH'
      });
    }

    // 5. Booking / Appointment System
    const hasBooking = /calendly|doctolib|planity|resalib|reserv|rendez-vous|appointment|treatwell|thefork/i.test(html) ||
                       $('a[href*="calendly"], a[href*="doctolib"], a[href*="planity"], a[href*="resalib"]').length > 0;
    if (hasBooking) {
      score += 15;
    }

    return Math.min(100, score);
  }

  private static auditLocalSEO($: any, findings: AuditFinding[], metrics: any): number {
    let score = 0;
    
    // Check for Schema.org LocalBusiness or Organization
    const jsonLd = $('script[type="application/ld+json"]');
    let hasLocalSchema = false;
    jsonLd.each((i: number, el: any) => {
      try {
        const data = JSON.parse($(el).html());
        const types = Array.isArray(data['@type']) ? data['@type'] : [data['@type']];
        if (types.some((t: string) => t && (t.includes('LocalBusiness') || t.includes('Organization') || t.includes('Store') || t.includes('ProfessionalService')))) {
          hasLocalSchema = true;
        }
      } catch {}
    });

    if (hasLocalSchema) {
      score += 50;
    } else {
      findings.push({
        category: 'Local SEO',
        severity: 'MEDIUM',
        title: 'Données structurées Schema.org LocalBusiness manquantes',
        description: 'Le balisage Schema.org LocalBusiness n’est pas configuré pour indiquer explicitement l’adresse, les horaires et l’activité aux moteurs de recherche.',
        evidence: 'Aucun script JSON-LD de type LocalBusiness identifié',
        recommendation: 'Ajouter les données structurées JSON-LD LocalBusiness pour renforcer la position dans le pack local Google.',
        confidence: 'HIGH'
      });
    }

    // Physical Address detection
    const addressKeywords = ['rue', 'avenue', 'boulevard', 'chemin', 'route', 'place', 'street', 'road', 'adresse', 'postal', 'cedex'];
    const bodyText = $('body').text().toLowerCase();
    const hasAddress = addressKeywords.some(k => bodyText.includes(k)) && /\d{4,5}/.test(bodyText);
    
    if (hasAddress) {
      score += 50;
    } else {
      findings.push({
        category: 'Local SEO',
        severity: 'LOW',
        title: 'Adresse postale non explicite dans le texte',
        description: 'L’adresse postale complète avec code postal n’est pas facilement identifiable dans le contenu textuel ou le pied de page.',
        evidence: 'Aucune adresse avec code postal reconnue dans le texte visible',
        recommendation: 'Indiquer clairement l’adresse physique et la zone desservie dans le pied de page.',
        confidence: 'LOW'
      });
    }

    return score;
  }

  private static auditMobile($: any, html: string, findings: AuditFinding[]): number {
    let score = 85; // Realistic baseline (not 100)
    const viewport = $('meta[name="viewport"]').attr('content');
    
    if (!viewport) {
      score -= 50;
      findings.push({
        category: 'Mobile',
        severity: 'HIGH',
        title: 'Balise Meta Viewport manquante',
        description: 'Le site ne définit pas de balise viewport. Les smartphones afficheront la version bureau dézoomée.',
        evidence: 'Balise <meta name="viewport"> absente',
        recommendation: 'Ajouter <meta name="viewport" content="width=device-width, initial-scale=1">.',
        confidence: 'HIGH'
      });
    } else if (!viewport.includes('width=device-width')) {
      score -= 20;
      findings.push({
        category: 'Mobile',
        severity: 'MEDIUM',
        title: 'Configuration viewport incomplète',
        description: 'La balise viewport ne s’adapte pas à la largeur native du smartphone.',
        evidence: `meta viewport: "${viewport}"`,
        recommendation: 'Utiliser width=device-width, initial-scale=1.0.',
        confidence: 'HIGH'
      });
    }

    // Check media queries or responsive frameworks
    const lower = html.toLowerCase();
    const hasResponsiveClues = lower.includes('@media') || 
                               lower.includes('tailwind') || 
                               lower.includes('bootstrap') || 
                               lower.includes('col-') || 
                               lower.includes('flex') ||
                               lower.includes('grid');
    if (!hasResponsiveClues && html.length > 3000) {
      score -= 25;
      findings.push({
        category: 'Mobile',
        severity: 'HIGH',
        title: 'Absence de framework responsive ou Media Queries détectés',
        description: 'La mise en page semble rigide et peut nécessiter un zoom horizontal sur mobile.',
        evidence: 'Aucune règle @media ou framework CSS responsive détecté dans le code source HTML.',
        recommendation: 'Refondre la mise en page selon une approche Mobile-First.',
        confidence: 'HIGH'
      });
    }

    // Check modern responsive images (srcset / picture)
    const hasPictureOrSrcset = $('picture').length > 0 || $('img[srcset]').length > 0;
    if ($('img').length > 2 && !hasPictureOrSrcset) {
      score -= 10;
      findings.push({
        category: 'Mobile',
        severity: 'LOW',
        title: 'Images non dimensionnées dynamiquement pour mobile (srcset)',
        description: 'Les images ne disposent pas d’attribut srcset pour servir des versions légères adaptées aux smartphones.',
        evidence: 'Balises <img> sans attribut srcset',
        recommendation: 'Servir des images responsives en format WebP/AVIF via la balise <picture> ou l’attribut srcset.',
        confidence: 'MEDIUM'
      });
    }

    return Math.max(10, Math.min(100, score));
  }

  private static calculatePerformanceScore(duration: number, size: number): number {
    let score = 80; // Realistic baseline for web agency audits
    
    // Server TTFB / Latency
    if (duration > 5000) score -= 45;
    else if (duration > 3000) score -= 30;
    else if (duration > 1800) score -= 20;
    else if (duration > 900) score -= 10;

    // Page HTML Payload weight
    if (size > 2000000) score -= 35; // >2MB
    else if (size > 1000000) score -= 20; // >1MB
    else if (size > 400000) score -= 10; // >400KB

    return Math.max(10, Math.min(100, score));
  }
}

