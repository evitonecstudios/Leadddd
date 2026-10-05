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

const getAdminAuth = () => {
  if (!getApps().length) {
    try {
      const projectId = 
        process.env.VITE_FIREBASE_PROJECT_ID || 
        process.env.FIREBASE_PROJECT_ID || 
        firebaseConfig.projectId || 
        process.env.GCLOUD_PROJECT;
      
      if (projectId) {
        initializeApp({
          projectId: projectId,
        });
        console.log('[FIREBASE-ADMIN] Initialized with Project ID:', projectId);
      } else {
        // Fallback to default which might use GOOGLE_APPLICATION_CREDENTIALS or metadata service
        console.warn('[FIREBASE-ADMIN] No explicit Project ID found. Initializing with defaults.');
        initializeApp();
      }
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



