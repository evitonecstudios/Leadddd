import { db } from '../db/index.ts';
import { opportunities, leads, audits, auditFindings } from '../db/schema.ts';
import { eq, and } from 'drizzle-orm';

export interface OpportunityDefinition {
  type: 'WEBSITE' | 'SEO' | 'LOCAL_SEO' | 'PERFORMANCE' | 'MOBILE' | 'CONVERSION' | 'BOOKING' | 'WHATSAPP' | 'E_COMMERCE' | 'SECURITY' | 'CONTENT' | 'STRUCTURED_DATA' | 'TECHNICAL';
  title: string;
  description: string;
  severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  recommendedService: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
}

export class OpportunityService {
  private static CATEGORY_RULES: Record<string, string[]> = {
    'restaurant': ['BOOKING', 'WHATSAPP', 'LOCAL_SEO', 'WEBSITE'],
    'dentist': ['BOOKING', 'WHATSAPP', 'LOCAL_SEO', 'WEBSITE'],
    'car_repair': ['WHATSAPP', 'LOCAL_SEO', 'WEBSITE'],
    'plumber': ['WHATSAPP', 'LOCAL_SEO', 'WEBSITE'],
    'architect': ['CONTENT', 'WEBSITE', 'SEO'],
    'phone_repair': ['WHATSAPP', 'LOCAL_SEO', 'WEBSITE', 'BOOKING'],
  };

  static async analyzeLead(leadId: number) {
    const lead = await db.query.leads.findFirst({
      where: eq(leads.id, leadId),
      with: {
        audits: {
          orderBy: (audits: any, { desc }: any) => [desc(audits.createdAt)],
          limit: 1,
          with: {
            findings: true
          }
        }
      }
    });

    if (!lead) throw new Error('Lead not found');

    const audit = lead.audits[0];
    const newOpportunities: any[] = [];

    // 1. WEBSITE OPPORTUNITY
    if (lead.websiteStatus === 'not_detected') {
      newOpportunities.push({
        leadId,
        type: 'WEBSITE',
        title: 'Website development opportunity',
        description: 'The business does not appear to have an official website.',
        severity: 'HIGH',
        evidence: 'Discovery process failed to find a valid website candidate.',
        confidence: 'HIGH',
        recommendedService: 'Website Development',
        score: 40
      });
    }

    // If audit exists, run more granular rules
    if (audit && audit.status === 'completed') {
      const findings = audit.findings;

      // 2. SEO OPPORTUNITIES
      if (audit.seoScore !== null && audit.seoScore < 70) {
        newOpportunities.push({
          leadId,
          auditId: audit.id,
          type: 'SEO',
          title: 'SEO Optimization',
          description: 'Technical SEO issues are affecting search engine visibility.',
          severity: 'MEDIUM',
          evidence: findings.filter((f: any) => f.category === 'SEO').map((f: any) => f.title).join(', '),
          confidence: 'HIGH',
          recommendedService: 'SEO Audit & Implementation',
          score: 20
        });
      }

      // 3. BOOKING OPPORTUNITY
      const category = lead.category?.toLowerCase() || '';
      const supportsBooking = this.CATEGORY_RULES[category]?.includes('BOOKING') || 
                             findings.some((f: any) => f.category === 'Conversion' && f.title.includes('Booking'));
      
      if (supportsBooking && findings.some((f: any) => f.title === 'Booking System not detected')) {
        newOpportunities.push({
          leadId,
          auditId: audit.id,
          type: 'BOOKING',
          title: 'Online Booking System',
          description: 'Improve customer experience by allowing direct online appointments.',
          severity: 'HIGH',
          evidence: 'No booking link or form detected on audited pages.',
          confidence: 'MEDIUM',
          recommendedService: 'Appointment Booking Integration',
          score: 25
        });
      }

      // 4. WHATSAPP OPPORTUNITY
      const supportsWhatsApp = this.CATEGORY_RULES[category]?.includes('WHATSAPP');
      if (supportsWhatsApp && findings.some((f: any) => f.title === 'WhatsApp not detected')) {
        newOpportunities.push({
          leadId,
          auditId: audit.id,
          type: 'WHATSAPP',
          title: 'WhatsApp Contact CTA',
          description: 'Increase conversions by adding a direct WhatsApp contact button.',
          severity: 'MEDIUM',
          evidence: 'No WhatsApp integration found on the homepage.',
          confidence: 'MEDIUM',
          recommendedService: 'Messaging Automation',
          score: 15
        });
      }

      // 5. LOCAL SEO
      if (audit.localSeoScore !== null && audit.localSeoScore < 60) {
        newOpportunities.push({
          leadId,
          auditId: audit.id,
          type: 'LOCAL_SEO',
          title: 'Local SEO & Schema',
          description: 'Missing structured data prevents the business from ranking in map packs.',
          severity: 'HIGH',
          evidence: findings.filter((f: any) => f.category === 'Local SEO').map((f: any) => f.title).join(', '),
          confidence: 'HIGH',
          recommendedService: 'Local SEO Package',
          score: 20
        });
      }

      // 6. PERFORMANCE
      if (audit.performanceScore !== null && audit.performanceScore < 50) {
        newOpportunities.push({
          leadId,
          auditId: audit.id,
          type: 'PERFORMANCE',
          title: 'Page Speed Improvement',
          description: 'Slow load times are likely increasing bounce rates.',
          severity: 'MEDIUM',
          evidence: `Measured TTFB: ${(audit.metrics as any).ttfb}ms`,
          confidence: 'HIGH',
          recommendedService: 'Performance Optimization',
          score: 15
        });
      }

      // 7. SECURITY & SSL CERTIFICATE FIX
      const hasSecurityIssue = findings.some((f: any) => f.category === 'Security' || f.title.includes('SSL') || f.title.includes('Certificate'));
      if (hasSecurityIssue) {
        newOpportunities.push({
          leadId,
          auditId: audit.id,
          type: 'SECURITY',
          title: 'SSL / Security Certificate Fix',
          description: 'The website has an invalid, mismatched, or expired SSL certificate triggering browser warnings.',
          severity: 'CRITICAL',
          evidence: findings.filter((f: any) => f.category === 'Security' || f.title.includes('SSL') || f.title.includes('Certificate')).map((f: any) => f.title).join(', '),
          confidence: 'HIGH',
          recommendedService: 'SSL Certificate & Domain Setup',
          score: 35
        });
      }

      // 8. SERVER / HOSTING RELIABILITY FIX
      const hasHostingIssue = findings.some((f: any) => f.title.includes('Timeout') || f.title.includes('Restricted') || f.title.includes('Server Error') || f.title.includes('Failure'));
      if (hasHostingIssue) {
        newOpportunities.push({
          leadId,
          auditId: audit.id,
          type: 'TECHNICAL',
          title: 'Hosting & Server Reliability Fix',
          description: 'The website experiences severe server latency, timeouts, or access restrictions.',
          severity: 'HIGH',
          evidence: findings.filter((f: any) => f.title.includes('Timeout') || f.title.includes('Restricted') || f.title.includes('Server Error') || f.title.includes('Failure')).map((f: any) => f.title).join(', '),
          confidence: 'HIGH',
          recommendedService: 'Managed Cloud Hosting & Modernization',
          score: 30
        });
      }
    }

    // Calculate Opportunity Score
    const totalScore = newOpportunities.reduce((sum, opt) => sum + (opt.score || 0), 0);
    
    // Cleanup old opportunities and save new ones
    await db.delete(opportunities).where(eq(opportunities.leadId, leadId));
    
    if (newOpportunities.length > 0) {
      await db.insert(opportunities).values(newOpportunities.map(o => ({
        ...o,
        score: o.score || 0
      })));
    }

    // Update lead overall opportunity score
    await db.update(leads)
      .set({ opportunityScore: Math.min(100, totalScore), updatedAt: new Date() })
      .where(eq(leads.id, leadId));

    return {
      leadId,
      opportunityScore: totalScore,
      opportunitiesCount: newOpportunities.length
    };
  }
}
