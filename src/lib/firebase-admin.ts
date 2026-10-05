import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let firebaseConfig: any = {};
try {
  const configPath = path.resolve(__dirname, '../../firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  }
} catch (error) {
  // Silent fail here, we check projectId later
}

const getAdminAuth = () => {
  if (!getApps().length) {
    try {
      const projectId = firebaseConfig.projectId || process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT;
      
      if (projectId) {
        initializeApp({
          projectId: projectId,
        });
        console.log('[FIREBASE-ADMIN] Initialized for project:', projectId);
      } else {
        console.warn('[FIREBASE-ADMIN] No Project ID found. Using default initialization or failing.');
        initializeApp();
      }
    } catch (error) {
      console.error('[FIREBASE-ADMIN] Initialization error:', error);
    }
  }
  return getAuth();
};

export const adminAuth = {
  verifyIdToken: async (token: string) => {
    try {
      return await getAdminAuth().verifyIdToken(token);
    } catch (error) {
      throw error;
    }
  }
};


