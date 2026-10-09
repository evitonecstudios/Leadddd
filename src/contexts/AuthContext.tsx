import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, onIdTokenChanged, User, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase.ts';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  authError: string | null;
  authErrorCode: string | null;
  signIn: () => Promise<void>;
  logout: () => Promise<void>;
  getToken: (forceRefresh?: boolean) => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authErrorCode, setAuthErrorCode] = useState<string | null>(null);

  useEffect(() => {
    console.log('[AUTH] Setting up onAuthStateChanged and onIdTokenChanged listeners');
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      console.log('[AUTH] State changed:', currentUser ? `User: ${currentUser.email} (${currentUser.uid})` : 'No user');
      setUser(currentUser);
      if (currentUser) {
        try {
          const t = await currentUser.getIdToken();
          setToken(t);
        } catch (e) {
          console.error('[AUTH] Failed to get initial token:', e);
        }
      } else {
        setToken(null);
      }
      setLoading(false);
    });

    // Listen for token refresh events (every 50-60 min automatically handled by Firebase)
    const unsubscribeToken = onIdTokenChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const t = await currentUser.getIdToken();
          setToken(t);
        } catch (e) {
          console.error('[AUTH] Failed to refresh token:', e);
        }
      } else {
        setToken(null);
      }
    });

    return () => {
      unsubscribeAuth();
      unsubscribeToken();
    };
  }, []);

  const getToken = async (forceRefresh = false): Promise<string | null> => {
    if (!auth.currentUser) return null;
    try {
      const freshToken = await auth.currentUser.getIdToken(forceRefresh);
      setToken(freshToken);
      return freshToken;
    } catch (e) {
      console.error('[AUTH] Error refreshing token:', e);
      return token;
    }
  };

  const signIn = async () => {
    console.log('[AUTH] signIn called');
    setAuthError(null);
    setAuthErrorCode(null);
    try {
      console.log('[AUTH] Calling signInWithPopup');
      const result = await signInWithPopup(auth, googleAuthProvider);
      console.log('[AUTH] signInWithPopup success:', result.user.email);
      const t = await result.user.getIdToken();
      setToken(t);
    } catch (error: any) {
      console.error('[AUTH] Sign in failed:', error);
      setAuthError(error.message);
      setAuthErrorCode(error.code || null);
      if (error.code === 'auth/popup-blocked') {
        console.warn('[AUTH] Popup was blocked by the browser');
      } else if (error.code === 'auth/cancelled-popup-request') {
        console.warn('[AUTH] Popup request was cancelled');
      } else if (error.code === 'auth/popup-closed-by-user') {
        console.warn('[AUTH] Popup was closed by the user');
      }
    }
  };

  const logout = async () => {
    console.log('[AUTH] logout called');
    try {
      await signOut(auth);
      setToken(null);
      console.log('[AUTH] signOut success');
    } catch (error) {
      console.error('[AUTH] Logout failed:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, authError, authErrorCode, signIn, logout, getToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
