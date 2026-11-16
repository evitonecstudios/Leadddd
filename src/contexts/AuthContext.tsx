import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, onIdTokenChanged, User, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase.ts';

export type BackendMode = 'loading' | 'postgres' | 'zero_config' | 'db_error';

const LOCAL_OVERRIDE_KEY = 'leadforge_local_workspace_override';

let _useLocalWorkspace = false;
export const isLocalWorkspaceActive = () => _useLocalWorkspace;
export const setLocalWorkspaceActive = (val: boolean) => {
  _useLocalWorkspace = val;
};

const createLocalUser = (): User => ({
  uid: 'local-workspace-user',
  email: 'local@leadforge.app',
  displayName: 'Espace Autonome',
  photoURL: null,
  emailVerified: true,
  isAnonymous: false,
  metadata: {} as any,
  providerData: [],
  refreshToken: '',
  tenantId: null,
  delete: async () => {},
  getIdToken: async () => 'local-workspace-token',
  getIdTokenResult: async () => ({} as any),
  reload: async () => {},
  toJSON: () => ({}),
  phoneNumber: null,
  providerId: 'local'
});

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  authError: string | null;
  authErrorCode: string | null;
  backendMode: BackendMode;
  isLocalWorkspace: boolean;
  signIn: () => Promise<void>;
  enterLocalWorkspace: () => void;
  exitLocalWorkspace: () => void;
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
  const [backendMode, setBackendMode] = useState<BackendMode>('loading');
  const [isLocalWorkspace, setIsLocalWorkspace] = useState(false);

  const activateLocalWorkspace = (persistOverride = false) => {
    if (persistOverride && typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_OVERRIDE_KEY, '1');
    }
    setLocalWorkspaceActive(true);
    setIsLocalWorkspace(true);
    if (!auth.currentUser) {
      setUser(createLocalUser());
      setToken('local-workspace-token');
    }
  };

  useEffect(() => {
    let mounted = true;
    let firebaseResolved = false;

    const init = async () => {
      let detectedMode: BackendMode = 'postgres';
      try {
        const res = await fetch('/api/health');
        if (res.ok) {
          const health = await res.json();
          if (health.mode === 'zero_config') detectedMode = 'zero_config';
          else if (health.mode === 'db_error') detectedMode = 'db_error';
          else detectedMode = 'postgres';
        }
      } catch {
        // Ignore network error; rely on default
      }

      if (!mounted) return;
      setBackendMode(detectedMode);

      const hasOverride = typeof localStorage !== 'undefined' && localStorage.getItem(LOCAL_OVERRIDE_KEY) === '1';

      // Zero-Config Mode: No DATABASE_URL configured -> use IndexedDB + Stateless Serverless automatically!
      if (detectedMode === 'zero_config' || hasOverride) {
        setLocalWorkspaceActive(true);
        setIsLocalWorkspace(true);
        if (!auth.currentUser) {
          setUser(createLocalUser());
          setToken('local-workspace-token');
        }
        if (firebaseResolved) setLoading(false);
      }
    };

    const healthPromise = init();

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      firebaseResolved = true;
      await healthPromise;
      if (!mounted) return;

      if (currentUser) {
        setUser(currentUser);
        try {
          const t = await currentUser.getIdToken();
          setToken(t);
        } catch (e) {
          console.error('[AUTH] Failed to get initial token:', e);
        }
      } else {
        const hasOverride = typeof localStorage !== 'undefined' && localStorage.getItem(LOCAL_OVERRIDE_KEY) === '1';
        if (isLocalWorkspaceActive() || hasOverride) {
          setUser(createLocalUser());
          setToken('local-workspace-token');
        } else {
          setUser(null);
          setToken(null);
        }
      }
      setLoading(false);
    });

    const unsubscribeToken = onIdTokenChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const t = await currentUser.getIdToken();
          setToken(t);
        } catch {}
      }
    });

    return () => {
      mounted = false;
      unsubscribeAuth();
      unsubscribeToken();
    };
  }, []);

  const getToken = async (forceRefresh = false): Promise<string | null> => {
    if (!auth.currentUser) {
      return isLocalWorkspaceActive() ? 'local-workspace-token' : null;
    }
    try {
      const freshToken = await auth.currentUser.getIdToken(forceRefresh);
      setToken(freshToken);
      return freshToken;
    } catch {
      return token;
    }
  };

  const signIn = async () => {
    setAuthError(null);
    setAuthErrorCode(null);
    try {
      const result = await signInWithPopup(auth, googleAuthProvider);
      const t = await result.user.getIdToken();
      setToken(t);
      setUser(result.user);
    } catch (error: any) {
      console.error('[AUTH] Sign in failed:', error);
      setAuthError(error.message);
      setAuthErrorCode(error.code || null);
    }
  };

  const enterLocalWorkspace = () => {
    setAuthError(null);
    setAuthErrorCode(null);
    activateLocalWorkspace(true);
  };

  const exitLocalWorkspace = () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(LOCAL_OVERRIDE_KEY);
    }
    setLocalWorkspaceActive(false);
    setIsLocalWorkspace(false);
    if (!auth.currentUser) {
      setUser(null);
      setToken(null);
    }
  };

  const logout = async () => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(LOCAL_OVERRIDE_KEY);
      }
      setLocalWorkspaceActive(false);
      setIsLocalWorkspace(false);
      if (auth.currentUser) {
        await signOut(auth);
      }
      setUser(null);
      setToken(null);
    } catch (error) {
      console.error('[AUTH] Logout failed:', error);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      authError,
      authErrorCode,
      backendMode,
      isLocalWorkspace,
      signIn,
      enterLocalWorkspace,
      exitLocalWorkspace,
      logout,
      getToken
    }}>
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
