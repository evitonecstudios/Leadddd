import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { DecodedIdToken } from 'firebase-admin/auth';

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Missing token' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error: any) {
    console.error('[AUTH-MIDDLEWARE] Token verification failed:', error.message);
    
    // Distinguish between invalid token and service failure
    if (error.code?.startsWith('auth/')) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Invalid or expired token' });
    }

    // If it's a structural failure (e.g. Firebase Admin not initialized), return 500 but with JSON
    return res.status(500).json({ 
      success: false, 
      error: 'Authentication service error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

