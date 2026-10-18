import { execFile } from 'child_process';
import path from 'path';
import { promisify } from 'util';
import { logger } from '../lib/monitoring.ts';

const execFileAsync = promisify(execFile);

export interface ScraplingData {
  status: number;
  finalUrl: string;
  isParked: boolean;
  title: string;
  metaDescription?: string;
  phones: string[];
  whatsapp?: string | null;
  emails: string[];
  socialLinks: Record<string, string>;
  legal: {
    siret?: string | null;
    siren?: string | null;
    manager?: string | null;
  };
  hasStructuredData: boolean;
  contentSize: number;
  engine: string;
}

export interface ScraplingResult {
  success: boolean;
  data?: ScraplingData;
  error?: string;
}

export class ScraplingService {
  private static SCRIPT_PATH = path.resolve(process.cwd(), 'scripts', 'scrapling_crawler.py');

  /**
   * Health check to verify that Python3 and the Scrapling framework are functional.
   */
  static async isReady(): Promise<boolean> {
    try {
      const { stdout } = await execFileAsync('python3', [
        '-c', 
        'import sys; sys.path.insert(0, "./scrapling-repo"); import scrapling; print(scrapling.__version__)'
      ], { timeout: 4000 });
      return stdout.trim().length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Performs an anti-bot stealth crawl on targetUrl using D4Vinci/Scrapling.
   */
  static async crawl(targetUrl: string): Promise<ScraplingResult> {
    const startTime = Date.now();
    try {
      const { stdout, stderr } = await execFileAsync(
        'python3',
        [this.SCRIPT_PATH, targetUrl],
        { 
          timeout: 20000,
          maxBuffer: 10 * 1024 * 1024 
        }
      );

      // Extract JSON line from stdout
      const lines = stdout.trim().split('\n');
      let jsonStr = '';
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i].trim();
        if (line.startsWith('{') && line.endsWith('}')) {
          jsonStr = line;
          break;
        }
      }

      if (!jsonStr) {
        throw new Error('No JSON output returned from Scrapling crawler');
      }

      const parsed: ScraplingResult = JSON.parse(jsonStr);
      await logger.info('SCRAPLING', `Scrapling crawled ${targetUrl} in ${Date.now() - startTime}ms`, {
        url: targetUrl,
        success: parsed.success,
        contactsFound: (parsed.data?.phones?.length || 0) + (parsed.data?.emails?.length || 0)
      }, 'SCRAPLING_BOT');

      return parsed;
    } catch (err: any) {
      await logger.warn('SCRAPLING', `Scrapling crawl failed for ${targetUrl}: ${err.message}`, {
        url: targetUrl,
        error: err.message
      }, 'SCRAPLING_BOT');

      return {
        success: false,
        error: err.message
      };
    }
  }
}
