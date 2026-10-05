import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase.ts';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  authError: string | null;
  authErrorCode: string | null;
  signIn: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authErrorCode, setAuthErrorCode] = useState<string | null>(null);

  useEffect(() => {
    console.log('[AUTH] Setting up onAuthStateChanged listener');
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log('[AUTH] State changed:', user ? `User: ${user.email} (${user.uid})` : 'No user');
      setUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signIn = async () => {
    console.log('[AUTH] signIn called');
    setAuthError(null);
    setAuthErrorCode(null);
    try {
      console.log('[AUTH] Calling signInWithPopup');
      const result = await signInWithPopup(auth, googleAuthProvider);
      console.log('[AUTH] signInWithPopup success:', result.user.email);
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
      console.log('[AUTH] signOut success');
    } catch (error) {
      console.error('[AUTH] Logout failed:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, authError, authErrorCode, signIn, logout }}>
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
