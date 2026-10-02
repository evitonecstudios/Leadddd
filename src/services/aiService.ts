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
          throw new Error(`AI Model error: ${error.message}`);
        }

        await logger.error('AI', 'Gemini Analysis failed', error, { leadId, model: this.DEFAULT_MODEL }, 'GEMINI_API');
        await metrics.record('AI', 'GEMINI', 'FAILURE', Date.now() - startTime, { leadId, error: error.message, model: this.DEFAULT_MODEL });
        throw new Error(`AI Analysis failed: ${error.message}`);
      }
    }
    throw lastError;
  }

  private static calculateHash(input: AIInput, language: string, tone: string): string {
    const data = JSON.stringify({ input, language, tone, version: this.PROMPT_VERSION });
    return crypto.createHash('md5').update(data).digest('hex');
  }

  private static buildPrompt(input: AIInput, language: string, tone: string): string {
    return `
You are an expert B2B Digital Audit Assistant. Your task is to interpret verified digital audit data for a business and provide a professional, evidence-backed summary and outreach recommendations.

STRICT ARCHITECTURE & SAFETY RULES:
1. NEVER invent facts. You are only allowed to interpret the provided data.
2. If data is NULL, UNKNOWN, NOT_MEASURED, or NOT_DETECTED, preserve that uncertainty. Use phrases like "Not detected", "Could not be verified", or "Not measured".
3. NO HALLUCINATIONS: Do not invent revenue, employee counts, traffic numbers, Google rankings, or specific business problems not found in the evidence.
4. EVIDENCE LOCK: Every factual claim must be supported by the provided findings or opportunities.
5. NO UNSUPPORTED PROMISES: Do not claim that changes will "double sales" or "guarantee results". Use "could improve" or "potential opportunity".
6. TONE: The requested tone is ${tone}.
7. LANGUAGE: All output must be in ${language}. Do NOT translate company names.

INPUT DATA:
${JSON.stringify(input, null, 2)}

OUTPUT FORMAT (JSON ONLY):
{
  "summary": "A 2-3 sentence factual summary of the business and its digital presence based on the audit.",
  "strengths": ["List of verified strengths based on high scores or positive findings"],
  "weaknesses": ["List of verified weaknesses based on low scores or negative findings"],
  "verified_opportunities": [
    {
      "title": "Title of the opportunity",
      "description": "Explanation tied to evidence",
      "evidence": "The specific data point that supports this"
    }
  ],
  "sales_angles": [
    {
      "type": "The category (e.g. SEO, Conversion)",
      "angle": "Professional hook",
      "why_it_matters": "Business value explanation",
      "suggested_solution": "Concrete next step"
    }
  ],
  "outreach": {
    "email": {
      "subject": "Compelling subject line",
      "body": "Personalized email body. Use [Name] as placeholder for signature."
    },
    "short_message": "Concise version for WhatsApp/SMS",
    "linkedin": "LinkedIn connection request or message"
  },
  "fact_check": {
    "passed": true,
    "unsupported_claims": []
  }
}

The summary should be neutral and factual. Example: "ABC Chauffage is a heating business in Geneva. Its website was reachable, but no booking functionality was detected."
    `;
  }
}
