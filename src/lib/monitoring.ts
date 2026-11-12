import { db } from '../db/index.ts';
import { systemLogs, requestMetrics } from '../db/schema.ts';

export const logger = {
  info: async (component: string, message: string, metadata?: any, source?: string, requestId?: string) => {
    try {
      await db.insert(systemLogs).values({
        level: 'INFO',
        component,
        message,
        metadata,
        source,
        requestId,
      });
    } catch (error) {
      console.error('Failed to write log to DB:', error);
    }
  },
  warn: async (component: string, message: string, metadata?: any, source?: string, requestId?: string) => {
    try {
      await db.insert(systemLogs).values({
        level: 'WARN',
        component,
        message,
        metadata,
        source,
        requestId,
      });
    } catch (error) {
      console.error('Failed to write log to DB:', error);
    }
  },
  error: async (component: string, message: string, error?: any, metadata?: any, source?: string, requestId?: string, retryCount?: number) => {
    try {
      await db.insert(systemLogs).values({
        level: 'ERROR',
        component,
        message,
        errorType: error instanceof Error ? error.name : (typeof error === 'string' ? error : undefined),
        metadata: {
          errorMessage: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          ...metadata
        },
        source,
        requestId,
        retryCount,
      });
    } catch (err) {
      console.error('Failed to write log to DB:', err);
    }
  }
};

export const metrics = {
  record: async (category: 'SOURCE' | 'AUDIT' | 'AI' | 'JOB', source: string, status: 'SUCCESS' | 'FAILURE' | 'TIMEOUT' | 'RETRY_SUCCESS', durationMs?: number, metadata?: any, tokenCount?: number, estimatedCost?: number) => {
    try {
      await db.insert(requestMetrics).values({
        category,
        source,
        status,
        durationMs,
        tokenCount,
        estimatedCost,
        metadata,
      });
    } catch (error) {
      console.error('Failed to record metric to DB:', error);
    }
  }
};

export const AI_COSTS = {
  'gemini-4-hydrogen': {
    input: 0.0001 / 1000,
    output: 0.0003 / 1000,
  },
  'gemini-4-argon': {
    input: 0.00125 / 1000,
    output: 0.005 / 1000,
  },
  'gemini-4-carbon': {
    input: 0.0035 / 1000,
    output: 0.0105 / 1000,
  },
  'gemini-3.8-flash': {
    input: 0.0001 / 1000,
    output: 0.0003 / 1000,
  },
};

export function estimateAiCost(model: string, inputTokens: number, outputTokens: number): number {
  let modelKey: keyof typeof AI_COSTS = 'gemini-4-hydrogen';
  if (model.includes('3.8-flash')) modelKey = 'gemini-3.8-flash';
  else if (model.includes('argon')) modelKey = 'gemini-4-argon';
  else if (model.includes('carbon')) modelKey = 'gemini-4-carbon';
  const rates = AI_COSTS[modelKey];
  if (!rates) return 0;
  return (inputTokens * rates.input) + (outputTokens * rates.output);
}
