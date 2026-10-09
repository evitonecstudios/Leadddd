import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let firebaseConfig: any = {};
try {
  // Use path.join for better cross-platform compatibility
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  }
} catch (error) {
  console.warn('[FIREBASE-ADMIN] Could not load config from disk, relying on env vars.');
}

const DEFAULT_PROJECT_ID = 'majestic-safeguard-nvr20';

const getAdminAuth = () => {
  if (!getApps().length) {
    try {
      const projectId = 
        process.env.VITE_FIREBASE_PROJECT_ID || 
        process.env.FIREBASE_PROJECT_ID || 
        firebaseConfig.projectId || 
        process.env.GCLOUD_PROJECT ||
        DEFAULT_PROJECT_ID;
      
      console.log(`[FIREBASE-ADMIN] Initialization with Project ID: ${projectId}`);
      initializeApp({
        projectId: projectId,
      });
    } catch (error: any) {
      console.error('[FIREBASE-ADMIN] Initialization error:', error.message);
    }
  }
  return getAuth();
};

export const adminAuth = {
  verifyIdToken: async (token: string) => {
    try {
      const auth = getAdminAuth();
      return await auth.verifyIdToken(token);
    } catch (error: any) {
      console.error('[FIREBASE-ADMIN] Token verification error:', error.message);
      throw error;
    }
  }
};



