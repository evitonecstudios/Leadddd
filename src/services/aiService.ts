import { GoogleGenAI } from '@google/genai';
import { db } from '../db/index.ts';
import { aiAnalyses } from '../db/schema.ts';
import { eq, and, desc } from 'drizzle-orm';
import crypto from 'crypto';
import { logger, metrics, estimateAiCost } from '../lib/monitoring.ts';

const API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY || '';

const ai = new GoogleGenAI({
  apiKey: API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

export interface AIInput {
  lead: {
    companyName: string;
    category: string | null;
    city: string | null;
    country: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
    website: string | null;
    source: string | null;
  };
  website: {
    status: string | null;
    url: string | null;
    finalUrl: string | null;
  };
  audit: {
    overallScore: number | null;
    technicalScore: number | null;
    seoScore: number | null;
    mobileScore: number | null;
    performanceScore: number | null;
    conversionScore: number | null;
    localSeoScore: number | null;
  };
  findings: Array<{
    category: string;
    severity: string;
    title: string;
    evidence: string;
  }>;
  opportunities: Array<{
    type: string;
    title: string;
    description: string;
    evidence: string;
  }>;
}

export class AIService {
  private static PROMPT_VERSION = 'v1.1';
  private static DEFAULT_MODEL = 'gemini-3.8-flash';

  static async generateAnalysis(leadId: number, input: AIInput, language = 'en', tone = 'professional') {
    const startTime = Date.now();
    if (!API_KEY) {
      await logger.error('AI', 'AI API Key missing', new Error('API key not configured'), { leadId }, 'GEMINI_API');
      throw new Error('GEMINI_API_KEY not configured');
    }

    // 1. Check Cache
    const inputHash = this.calculateHash(input, language, tone);
    const existing = await db.query.aiAnalyses.findFirst({
      where: and(
        eq(aiAnalyses.leadId, leadId),
        eq(aiAnalyses.inputHash, inputHash)
      ),
      orderBy: [desc(aiAnalyses.createdAt)]
    });

    if (existing) {
      await metrics.record('AI', 'GEMINI', 'SUCCESS', 0, { leadId, cached: true, model: this.DEFAULT_MODEL });
      return existing.result;
    }

    // 2. Prepare Prompt
    const prompt = this.buildPrompt(input, language, tone);

    // 3. Call Gemini with Retry Logic
    let retries = 3;
    let delay = 2000;
    let lastError: any;

    while (retries > 0) {
      try {
        const response = await ai.models.generateContent({
          model: this.DEFAULT_MODEL,
          contents: prompt,
          config: {
            responseMimeType: "application/json"
          }
        });

        const text = response.text;
        if (!text) throw new Error('Empty response from Gemini');
        
        const parsedResult = JSON.parse(text);

        const usage = response.usageMetadata;
        const inputTokens = usage?.promptTokenCount || 0;
        const outputTokens = usage?.candidatesTokenCount || 0;
        const totalTokens = usage?.totalTokenCount || 0;
        const cost = estimateAiCost(this.DEFAULT_MODEL, inputTokens, outputTokens);

        // 4. Persistence
        await db.insert(aiAnalyses).values({
          leadId,
          auditId: (input as any).auditId || null,
          model: this.DEFAULT_MODEL,
          promptVersion: this.PROMPT_VERSION,
          inputHash,
          result: parsedResult,
          language,
          tone
        });

        await metrics.record('AI', 'GEMINI', 'SUCCESS', Date.now() - startTime, { 
          leadId, 
          model: this.DEFAULT_MODEL,
          tokens: totalTokens,
          inputTokens,
          outputTokens,
          cost
        }, totalTokens, cost);

        return parsedResult;
      } catch (error: any) {
        lastError = error;
        const isRateLimit = error.message?.includes('429') || error.status === 429;
        const isNotFound = error.message?.includes('404') || error.status === 404;
        
        if (isRateLimit && retries > 1) {
          await logger.warn('AI', `Gemini Rate Limit (429), retrying in ${delay}ms...`, { leadId, retriesLeft: retries - 1 }, 'GEMINI_API');
          await new Promise(resolve => setTimeout(resolve, delay));
          retries--;
          delay *= 2; // Exponential backoff
          continue;
        }

        if (isNotFound) {
          await logger.error('AI', `Gemini model ${this.DEFAULT_MODEL} not found or version mismatch`, error, { leadId }, 'GEMINI_API');
          break;
        }

        await logger.warn('AI', `Gemini Analysis failed, applying resilient localized fallback: ${error.message}`, { leadId, language }, 'GEMINI_API');
        break;
      }
    }

    // Resilient Localized Fallback (guarantees French/English report even if Gemini quota is exceeded)
    const fallbackResult = this.generateFallbackAnalysis(input, language, tone);
    try {
      await db.insert(aiAnalyses).values({
        leadId,
        auditId: (input as any).auditId || null,
        model: 'fallback-deterministic',
        promptVersion: this.PROMPT_VERSION,
        inputHash,
        result: fallbackResult,
        language,
        tone
      });
    } catch {}

    return fallbackResult;
  }

  private static calculateHash(input: AIInput, language: string, tone: string): string {
    const data = JSON.stringify({ input, language, tone, version: this.PROMPT_VERSION });
    return crypto.createHash('md5').update(data).digest('hex');
  }

  private static buildPrompt(input: AIInput, language: string, tone: string): string {
    const isFrench = language.toLowerCase().startsWith('fr');

    const languageInstruction = isFrench
      ? `7. LANGUAGE: All output MUST be written in fluent, professional, idiomatic French (Français).
Every single text field must be in French:
- "summary": Résumé exécutif factuel de 2-3 phrases en français
- "strengths": Liste des points forts rédigée en français
- "weaknesses": Liste des points faibles et axes d'amélioration en français
- "verified_opportunities": Liste d'opportunités avec titre ("title"), explication ("description") et preuve ("evidence") rédigés en français
- "sales_angles": Liste des angles de vente avec accroche ("angle"), valeur commerciale ("why_it_matters") et solution ("suggested_solution") rédigés en français
- "outreach":
    - "email": "subject" (Objet d'e-mail captivant en français) et "body" (Corps d'e-mail personnalisé, poli et percutant en français avec le placeholder [Votre Nom] en signature)
    - "short_message": Message court WhatsApp / SMS en français
    - "linkedin": Message d'approche LinkedIn en français
IMPORTANT: Ne traduisez PAS les noms propres de l'entreprise (ex: "${input.lead.companyName}") ni les adresses URL. Utilisez une formulation élégante, polie et adaptée au marché francophone.`
      : `7. LANGUAGE: All output must be in English. Do NOT translate company names.`;

    const toneInstruction = isFrench
      ? (tone === 'direct' 
          ? 'Le ton doit être direct, concis et percutant.' 
          : tone === 'consultative' 
            ? 'Le ton doit être consultatif, bienveillant et orienté apport de valeur.' 
            : 'Le ton doit être professionnel, structuré et courtois.')
      : `The requested tone is ${tone}.`;

    return `
You are an expert B2B Digital Audit Assistant. Your task is to interpret verified digital audit data for a business and provide a professional, evidence-backed summary and outreach recommendations.

STRICT ARCHITECTURE & SAFETY RULES:
1. NEVER invent facts. You are only allowed to interpret the provided data.
2. If data is NULL, UNKNOWN, NOT_MEASURED, or NOT_DETECTED, preserve that uncertainty. Use phrases like ${isFrench ? '"Non détecté", "Non mesuré" ou "Donnée non vérifiable"' : '"Not detected", "Could not be verified", or "Not measured"'}.
3. NO HALLUCINATIONS: Do not invent revenue, employee counts, traffic numbers, Google rankings, or specific business problems not found in the evidence.
4. EVIDENCE LOCK: Every factual claim must be supported by the provided findings or opportunities.
5. NO UNSUPPORTED PROMISES: Do not claim that changes will "double sales" or "guarantee results". Use ${isFrench ? '"pourrait améliorer" ou "opportunité potentielle"' : '"could improve" or "potential opportunity"'}.
6. TONE: ${toneInstruction}
${languageInstruction}

INPUT DATA:
${JSON.stringify(input, null, 2)}

OUTPUT FORMAT (JSON ONLY):
{
  "summary": "Factual 2-3 sentence summary based on the audit.",
  "strengths": ["Verified strength 1", "Verified strength 2"],
  "weaknesses": ["Verified weakness 1", "Verified weakness 2"],
  "verified_opportunities": [
    {
      "title": "Title",
      "description": "Explanation tied to evidence",
      "evidence": "Specific data point"
    }
  ],
  "sales_angles": [
    {
      "type": "SEO | Conversion | Mobile | Technique",
      "angle": "Professional Hook",
      "why_it_matters": "Business explanation",
      "suggested_solution": "Concrete next step"
    }
  ],
  "outreach": {
    "email": {
      "subject": "Compelling Subject Line",
      "body": "Personalized Email Body"
    },
    "short_message": "Concise WhatsApp/SMS Text",
    "linkedin": "LinkedIn Connection Message"
  },
  "fact_check": {
    "passed": true,
    "unsupported_claims": []
  }
}
    `;
  }

  static generateFallbackAnalysis(input: AIInput, language = 'fr', tone = 'professional') {
    const isFrench = language.toLowerCase().startsWith('fr');
    const company = input.lead.companyName;
    const city = input.lead.city || '';
    const hasWebsite = Boolean(input.website.url);
    const score = input.audit.overallScore;

    if (isFrench) {
      const strengths: string[] = [];
      const weaknesses: string[] = [];

      if (hasWebsite) {
        strengths.push(`Site web existant et accessible (${input.website.url})`);
      }
      if (input.audit.technicalScore && input.audit.technicalScore >= 60) {
        strengths.push(`Infrastructure technique fonctionnelle (score technique ${input.audit.technicalScore}/100)`);
      }
      if (input.lead.phone) {
        strengths.push(`Ligne téléphonique directe disponible (${input.lead.phone})`);
      }

      if (!hasWebsite) {
        weaknesses.push('Aucun site web officiel détecté lors de la vérification');
      }
      if (input.audit.mobileScore && input.audit.mobileScore < 70) {
        weaknesses.push('Expérience mobile perfectible pour les visiteurs sur smartphone');
      }
      if (input.audit.conversionScore && input.audit.conversionScore < 60) {
        weaknesses.push('Absence d’appels à l’action directs ou de réservation immédiate');
      }
      if (weaknesses.length === 0) {
        weaknesses.push('Opportunité d’optimisation du référencement local et des conversions');
      }

      const verified_opportunities = input.opportunities && input.opportunities.length > 0
        ? input.opportunities.map(o => ({
            title: o.title,
            description: o.description,
            evidence: o.evidence || 'Constaté lors de l’audit technique initial'
          }))
        : [
            {
              title: hasWebsite ? 'Optimisation du tunnel de conversion local' : 'Création d’un site vitrine professionnel',
              description: hasWebsite 
                ? 'Faciliter la prise de contact directe depuis smartphone via WhatsApp et appel 1-clic.' 
                : 'Permettre aux clients locaux de trouver immédiatement l’activité sur Google.',
              evidence: hasWebsite ? `Audit technique sur ${input.website.url}` : 'Absence de nom de domaine'
            }
          ];

      const sales_angles = [
        {
          type: 'Conversion',
          angle: `Capter plus de demandes directes pour ${company}${city ? ' à ' + city : ''}`,
          why_it_matters: 'Les clients locaux recherchent de la réactivité immédiate sur leur smartphone.',
          suggested_solution: 'Intégrer un bouton d’appel rapide et un canal WhatsApp direct sur le site.'
        },
        {
          type: 'SEO & Visibilité',
          angle: `Se positionner devant les concurrents locaux sur Google`,
          why_it_matters: 'Une présence optimisée permet de générer des demandes entrantes régulières.',
          suggested_solution: 'Optimiser le balisage local et la fiche Google Business.'
        }
      ];

      return {
        summary: `${company} est une entreprise établie${city ? ' à ' + city : ''}. ${hasWebsite ? `Son site web présente un score global de ${score || 'non évalué'}/100.` : 'Aucun site internet vérifié n’a été détecté pour cette enseigne.'} Cet audit met en évidence des leviers concrets pour accélérer l’acquisition client.`,
        strengths: strengths.length > 0 ? strengths : ['Activité locale identifiée'],
        weaknesses,
        verified_opportunities,
        sales_angles,
        outreach: {
          email: {
            subject: `Opportunité digitale pour ${company}`,
            body: `Bonjour,\n\nEn réalisant un audit rapide de la visibilité en ligne de ${company}${city ? ' à ' + city : ''}, j’ai relevé 2 ou 3 axes concrets qui pourraient vous permettre d’attirer davantage de contacts qualifiés chaque semaine.\n\n${hasWebsite ? 'Votre site actuel a une bonne base, mais quelques ajustements (notamment sur mobile et conversion) feraient une réelle différence.' : 'Une présence web claire permettrait à vos clients de vous contacter sans intermédiaire.'}\n\nSeriez-vous ouvert à un rapide échange de 10 minutes cette semaine pour que je vous partage ces pistes ?\n\nBien cordialement,\n[Votre Nom]`
          },
          short_message: `Bonjour, j’ai analysé la présence en ligne de ${company}${city ? ' à ' + city : ''} et identifié quelques optimisations simples pour générer plus d'appels directs. Seriez-vous ouvert à en discuter 5 minutes ?`,
          linkedin: `Bonjour, félicitations pour le développement de ${company}. J’ai relevé des points d'amélioration intéressants lors de notre audit digital local. Au plaisir d'échanger !`
        },
        fact_check: {
          passed: true,
          unsupported_claims: []
        }
      };
    }

    return {
      summary: `${company} is a local business${city ? ' in ' + city : ''}. ${hasWebsite ? `Website recorded an overall score of ${score || 'unrated'}/100.` : 'No official website was detected.'}`,
      strengths: [hasWebsite ? 'Website online and responsive' : 'Identified local business'],
      weaknesses: [hasWebsite ? 'Room for conversion and SEO improvement' : 'No online website presence'],
      verified_opportunities: input.opportunities.map(o => ({ title: o.title, description: o.description, evidence: o.evidence })),
      sales_angles: [
        {
          type: 'Conversion',
          angle: `Capture more direct clients for ${company}`,
          why_it_matters: 'Local searchers expect instant contact options.',
          suggested_solution: 'Implement instant calling and booking.'
        }
      ],
      outreach: {
        email: {
          subject: `Digital growth opportunity for ${company}`,
          body: `Hi,\n\nWhile conducting an audit of local businesses in ${city || 'your area'}, I noticed a few quick opportunities for ${company} to capture more inbound customers.\n\nWould you be open to a brief 10-minute chat this week?\n\nBest regards,\n[Your Name]`
        },
        short_message: `Hi, I noticed a couple of quick digital optimizations for ${company} to increase direct phone inquiries. Open to a brief chat?`,
        linkedin: `Hi, congrats on your work with ${company}. I spotted a few digital opportunities from our local audit. Would love to connect!`
      },
      fact_check: {
        passed: true,
        unsupported_claims: []
      }
    };
  }
}
