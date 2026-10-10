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
    'car mechanic': ['WHATSAPP', 'LOCAL_SEO', 'WEBSITE'],
    'plumber': ['WHATSAPP', 'LOCAL_SEO', 'WEBSITE'],
    'electrician': ['WHATSAPP', 'LOCAL_SEO', 'WEBSITE'],
    'architect': ['CONTENT', 'WEBSITE', 'SEO'],
    'phone_repair': ['WHATSAPP', 'LOCAL_SEO', 'WEBSITE', 'BOOKING'],
    'hairdresser': ['BOOKING', 'WHATSAPP', 'LOCAL_SEO', 'WEBSITE'],
    'barber': ['BOOKING', 'WHATSAPP', 'LOCAL_SEO', 'WEBSITE'],
    'lawyer': ['CONTENT', 'WEBSITE', 'LOCAL_SEO', 'SEO'],
    'real estate agency': ['WEBSITE', 'SEO', 'WHATSAPP', 'LOCAL_SEO'],
    'gym': ['BOOKING', 'WHATSAPP', 'WEBSITE', 'LOCAL_SEO']
  };

  private static HIGH_VALUE_SECTORS = [
    'dentist', 'dental', 'doctor', 'clinic', 'physiotherapist', 'osteopath', 'veterinary',
    'plumber', 'electrician', 'heating', 'hvac', 'roofing', 'carpenter', 'car_repair', 'car mechanic', 'locksmith',
    'lawyer', 'notary', 'architect', 'accountant', 'estate_agent', 'real estate agency',
    'restaurant', 'hotel', 'spa', 'beauty', 'hairdresser'
  ];

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
    const categoryLower = (lead.category || '').toLowerCase();

    // 1. CRITICAL BUYING INTENT: NO OFFICIAL WEBSITE OR SOCIAL-ONLY PRESENCE
    const hasOfficialWebsite = Boolean(
      lead.website && 
      lead.websiteStatus === 'verified' && 
      !lead.website.includes('facebook.com') && 
      !lead.website.includes('instagram.com') &&
      !lead.website.includes('linkedin.com')
    );

    if (!hasOfficialWebsite) {
      if (lead.websiteStatus === 'social_profile' || lead.website?.includes('facebook.com') || lead.website?.includes('instagram.com')) {
        newOpportunities.push({
          leadId,
          type: 'WEBSITE',
          title: 'Création de site vitrine professionnel (Remplacement réseaux sociaux)',
          description: 'L’entreprise n’a pas de domaine web indépendant et repose uniquement sur les réseaux sociaux. Elle perd les recherches directes Google & Maps et manque de crédibilité.',
          severity: 'HIGH',
          evidence: 'Présence numérique limitée à une page de réseau social sans domaine propre.',
          confidence: 'HIGH',
          recommendedService: 'Website Development',
          score: 45
        });
      } else {
        newOpportunities.push({
          leadId,
          type: 'WEBSITE',
          title: 'Développement d’un site vitrine officiel',
          description: 'Aucun site internet détecté pour cette entreprise locale. C’est le profil à plus haute valeur : le gérant est actif localement mais invisible sur Google.',
          severity: 'HIGH',
          evidence: 'Absence totale de site internet indexé pour cet établissement actif.',
          confidence: 'HIGH',
          recommendedService: 'Website Development',
          score: 45
        });
      }
    }

    // 2. HIGH BUYING POWER / HIGH TRANSACTION VALUE SECTOR
    const isHighTicket = this.HIGH_VALUE_SECTORS.some(s => categoryLower.includes(s));
    if (isHighTicket) {
      newOpportunities.push({
        leadId,
        type: 'CONTENT',
        title: 'Secteur à Fort Panier Moyen & Budget Élevé',
        description: 'Activité à forte valeur unitaire par client (artisanat, santé, juridique, conseil). Un seul client additionnel acquis via le web rentabilise intégralement le service.',
        severity: 'HIGH',
        evidence: `Activité identifiée : ${lead.category || 'Profession libérale / Artisan'}`,
        confidence: 'HIGH',
        recommendedService: 'Pack Croissance & Visibilité B2B',
        score: 25
      });
    }

    // 3. CONTACTABILITY & DIRECT CLOSING READINESS
    if (lead.phone && lead.phone.trim().length >= 6) {
      if (!hasOfficialWebsite) {
        newOpportunities.push({
          leadId,
          type: 'WHATSAPP',
          title: 'Lead Joignable Directement & Téléphone Garanti',
          description: 'Numéro de contact direct vérifié. Prospect immédiatement actionnable par appel téléphonique ou message commercial pour un closing rapide.',
          severity: 'MEDIUM',
          evidence: `Numéro direct vérifié : ${lead.phone}`,
          confidence: 'HIGH',
          recommendedService: 'Messaging Automation',
          score: 15
        });
      }
    }

    // 4. ESTABLISHED LOCAL REPUTATION WITH HIGH DEMAND (4.0+ Stars or Active Reviews)
    if ((lead.googleRating && lead.googleRating >= 4.0) || (lead.googleReviews && lead.googleReviews >= 5)) {
      newOpportunities.push({
        leadId,
        type: 'LOCAL_SEO',
        title: 'Notoriété Établie & Forte Demande Locale',
        description: `Excellente réputation (${lead.googleRating ? `${lead.googleRating}★` : ''} avec avis clients). Cette entreprise a des flux de clients constants et le budget pour moderniser sa présence digitale.`,
        severity: 'MEDIUM',
        evidence: `${lead.googleRating || 'Bonne note'} sur Google Maps avec avis clients actifs.`,
        confidence: 'HIGH',
        recommendedService: 'Local SEO Package',
        score: 20
      });
    }

    // Granular Audit Findings (if technical audit exists)
    if (audit && audit.status === 'completed') {
      const findings = audit.findings || [];

      // 5. SEO OPPORTUNITIES
      if (audit.seoScore !== null && audit.seoScore < 70) {
        newOpportunities.push({
          leadId,
          auditId: audit.id,
          type: 'SEO',
          title: 'Optimisation SEO & Référencement Google',
          description: 'Des lacunes techniques freinent le positionnement de l’entreprise face à ses concurrents locaux sur les requêtes stratégiques.',
          severity: 'MEDIUM',
          evidence: findings.filter((f: any) => f.category === 'SEO').map((f: any) => f.title).join(', ') || 'Score SEO perfectible',
          confidence: 'HIGH',
          recommendedService: 'SEO Audit & Implementation',
          score: 20
        });
      }

      // 6. BOOKING OPPORTUNITY
      const supportsBooking = this.CATEGORY_RULES[categoryLower]?.includes('BOOKING') || 
                             findings.some((f: any) => f.category === 'Conversion' && f.title.includes('Booking'));
      
      if (supportsBooking && findings.some((f: any) => f.title?.includes('Booking') || f.title?.includes('Réservation'))) {
        newOpportunities.push({
          leadId,
          auditId: audit.id,
          type: 'BOOKING',
          title: 'Prise de Rendez-Vous en Ligne',
          description: 'Permettre aux clients de réserver directement en ligne 24/7 pour augmenter les conversions et désengorger le standard téléphonique.',
          severity: 'HIGH',
          evidence: 'Aucun système de prise de rendez-vous détecté sur les pages du site.',
          confidence: 'HIGH',
          recommendedService: 'Appointment Booking Integration',
          score: 25
        });
      }

      // 7. WHATSAPP & CONTACT DIRECT CTA
      const supportsWhatsApp = this.CATEGORY_RULES[categoryLower]?.includes('WHATSAPP');
      if (supportsWhatsApp && findings.some((f: any) => f.title?.includes('WhatsApp'))) {
        newOpportunities.push({
          leadId,
          auditId: audit.id,
          type: 'WHATSAPP',
          title: 'Bouton d’Appel & Contact Direct WhatsApp 1-Clic',
          description: 'Capter immédiatement les visiteurs sur smartphone via un bouton WhatsApp flottant pour convertir les demandes de devis.',
          severity: 'MEDIUM',
          evidence: 'Absence de bouton direct WhatsApp sur le site.',
          confidence: 'HIGH',
          recommendedService: 'Messaging Automation',
          score: 15
        });
      }

      // 8. LOCAL SEO & SCHEMA
      if (audit.localSeoScore !== null && audit.localSeoScore < 60) {
        newOpportunities.push({
          leadId,
          auditId: audit.id,
          type: 'LOCAL_SEO',
          title: 'Référencement Local Google Maps & Données Structurées',
          description: 'Données d’entreprise locales manquantes pour apparaître dans le pack local Google Maps.',
          severity: 'HIGH',
          evidence: findings.filter((f: any) => f.category === 'Local SEO').map((f: any) => f.title).join(', ') || 'Score Local perfectible',
          confidence: 'HIGH',
          recommendedService: 'Local SEO Package',
          score: 20
        });
      }

      // 9. PERFORMANCE & VITESSE MOBILE
      if (audit.performanceScore !== null && audit.performanceScore < 50) {
        newOpportunities.push({
          leadId,
          auditId: audit.id,
          type: 'PERFORMANCE',
          title: 'Optimisation Vitesse Mobile',
          description: 'Temps de chargement lent faisant fuir les prospects sur smartphone.',
          severity: 'HIGH',
          evidence: `Score de vitesse mobile : ${audit.performanceScore}/100`,
          confidence: 'HIGH',
          recommendedService: 'Page Speed Optimization',
          score: 20
        });
      }

      // 10. CRITICAL SECURITY / SSL CERTIFICATE FIX
      const hasSecurityIssue = findings.some((f: any) => f.category === 'Security' || f.title?.includes('SSL') || f.title?.includes('Certificate'));
      if (hasSecurityIssue) {
        newOpportunities.push({
          leadId,
          auditId: audit.id,
          type: 'SECURITY',
          title: 'Sécurisation HTTPS & Certificat SSL',
          description: 'Le site présente un certificat SSL invalide ou manquant déclenchant des alertes de sécurité dans les navigateurs.',
          severity: 'CRITICAL',
          evidence: 'Alerte de certificat SSL / HTTPS non sécurisé détectée.',
          confidence: 'HIGH',
          recommendedService: 'SSL Certificate & Domain Setup',
          score: 35
        });
      }

      // 11. SERVER / HOSTING RELIABILITY FIX
      const hasHostingIssue = findings.some((f: any) => f.title?.includes('Timeout') || f.title?.includes('Restricted') || f.title?.includes('Server Error') || f.title?.includes('Failure'));
      if (hasHostingIssue) {
        newOpportunities.push({
          leadId,
          auditId: audit.id,
          type: 'TECHNICAL',
          title: 'Hébergement Cloud & Fiabilité Serveur',
          description: 'Le site subit des temps d’attente serveur élevés, des erreurs de connexion ou des coupures intermittentes.',
          severity: 'HIGH',
          evidence: findings.filter((f: any) => f.title?.includes('Timeout') || f.title?.includes('Restricted') || f.title?.includes('Server Error') || f.title?.includes('Failure')).map((f: any) => f.title).join(', ') || 'Latence serveur',
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
      opportunitiesCount: newOpportunities.length,
      opportunities: newOpportunities
    };
  }
}
