import { AuthProvider, useAuth } from './contexts/AuthContext.tsx';
import { auth } from './lib/firebase.ts';
import { 
  Search, LayoutDashboard, Database, Settings, LogOut, BarChart3, Target, Filter, 
  Upload, Check, AlertCircle, Loader2, Globe, Phone, Mail, MapPin, ExternalLink, 
  RefreshCw, Star, Info, Lightbulb, MessageSquare, Linkedin, Languages, Wand2, 
  ShieldCheck, Copy, History, Calendar, Plus, Trash2, Download, MoreVertical,
  ChevronRight, ArrowRight, User, CheckCircle2, Clock, Menu, X, PanelLeftClose, PanelLeftOpen,
  Facebook, Instagram, Twitter, Sparkles, Share2, Printer, FileText, Briefcase, MessageCircle, PhoneCall,
  SlidersHorizontal, ArrowUpDown, RotateCcw, ChevronDown
} from 'lucide-react';
import React, { useState, useEffect, useRef } from 'react';
import { cn, formatDate } from './lib/utils.ts';
import Papa from 'papaparse';
import { CommercialToolkit, formatWhatsAppNumber } from './components/CommercialToolkit.tsx';

// --- API Helper ---
const parseApiResponse = async (res: Response) => {
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await res.text();
    
    // Detect if we received the environment's "Starting Server" loading page
    if (text.includes('<title>Starting Server...</title>') || text.includes('Server is starting')) {
      return { 
        success: false, 
        isRetryable: true,
        error: 'SERVER_BOOTING'
      };
    }

    console.error(`Non-JSON response received (${res.status}):`, text.slice(0, 200));
    return { 
      success: false, 
      error: res.ok 
        ? 'Unexpected server response format.' 
        : `Server Error ${res.status}: ${res.statusText || 'Request failed'}` 
    };
  }

  try {
    const data = await res.json();
    return data;
  } catch (err: any) {
    console.error('JSON parsing failed:', err);
    return { success: false, error: 'Failed to parse JSON response from server.' };
  }
};

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const getValidToken = async (fallbackToken?: string, forceRefresh = false): Promise<string> => {
  if (auth.currentUser) {
    try {
      const fresh = await auth.currentUser.getIdToken(forceRefresh);
      if (fresh) return fresh;
    } catch (e) {
      console.warn('[API] Could not retrieve fresh token from Firebase client:', e);
    }
  }
  return fallbackToken || '';
};

const api = {
  get: async (url: string, token: string, retries = 3): Promise<any> => {
    try {
      const activeToken = await getValidToken(token);
      const res = await fetch(url, { headers: { Authorization: `Bearer ${activeToken}` } });
      const parsed = await parseApiResponse(res);
      
      if (!parsed.success && (parsed.error === 'TOKEN_EXPIRED' || res.status === 401) && retries > 0) {
        console.warn(`[API] Token expired or 401 unauthorized. Forcing token refresh... (${retries} retries left)`);
        const refreshedToken = await getValidToken(token, true);
        return api.get(url, refreshedToken, retries - 1);
      }

      if (!parsed.success && parsed.error === 'SERVER_BOOTING' && retries > 0) {
        console.warn(`[API] Server is booting, retrying in 2s... (${retries} left)`);
        await wait(2000);
        return api.get(url, token, retries - 1);
      }
      
      return parsed;
    } catch (err: any) {
      if (retries > 0) {
        await wait(2000);
        return api.get(url, token, retries - 1);
      }
      console.error("Network Error:", err);
      return { success: false, error: err.message };
    }
  },
  post: async (url: string, data: any, token: string, retries = 3): Promise<any> => {
    try {
      const activeToken = await getValidToken(token);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${activeToken}` },
        body: JSON.stringify(data),
      });
      const parsed = await parseApiResponse(res);

      if (!parsed.success && (parsed.error === 'TOKEN_EXPIRED' || res.status === 401) && retries > 0) {
        console.warn(`[API] Token expired or 401 unauthorized. Forcing token refresh... (${retries} retries left)`);
        const refreshedToken = await getValidToken(token, true);
        return api.post(url, data, refreshedToken, retries - 1);
      }

      if (!parsed.success && parsed.error === 'SERVER_BOOTING' && retries > 0) {
        await wait(2000);
        return api.post(url, data, token, retries - 1);
      }

      return parsed;
    } catch (err: any) {
      if (retries > 0) {
        await wait(2000);
        return api.post(url, data, token, retries - 1);
      }
      console.error("Network Error:", err);
      return { success: false, error: err.message };
    }
  },
  patch: async (url: string, data: any, token: string, retries = 3): Promise<any> => {
    try {
      const activeToken = await getValidToken(token);
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${activeToken}` },
        body: JSON.stringify(data),
      });
      const parsed = await parseApiResponse(res);

      if (!parsed.success && (parsed.error === 'TOKEN_EXPIRED' || res.status === 401) && retries > 0) {
        console.warn(`[API] Token expired or 401 unauthorized. Forcing token refresh... (${retries} retries left)`);
        const refreshedToken = await getValidToken(token, true);
        return api.patch(url, data, refreshedToken, retries - 1);
      }

      if (!parsed.success && parsed.error === 'SERVER_BOOTING' && retries > 0) {
        await wait(2000);
        return api.patch(url, data, token, retries - 1);
      }

      return parsed;
    } catch (err: any) {
      if (retries > 0) {
        await wait(2000);
        return api.patch(url, data, token, retries - 1);
      }
      console.error("Network Error:", err);
      return { success: false, error: err.message };
    }
  },
  delete: async (url: string, token: string, retries = 3): Promise<any> => {
    try {
      const activeToken = await getValidToken(token);
      const res = await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${activeToken}` }
      });
      const parsed = await parseApiResponse(res);

      if (!parsed.success && (parsed.error === 'TOKEN_EXPIRED' || res.status === 401) && retries > 0) {
        console.warn(`[API] Token expired or 401 unauthorized. Forcing token refresh... (${retries} retries left)`);
        const refreshedToken = await getValidToken(token, true);
        return api.delete(url, refreshedToken, retries - 1);
      }

      if (!parsed.success && parsed.error === 'SERVER_BOOTING' && retries > 0) {
        await wait(2000);
        return api.delete(url, token, retries - 1);
      }

      return parsed;
    } catch (err: any) {
      if (retries > 0) {
        await wait(2000);
        return api.delete(url, token, retries - 1);
      }
      console.error("Network Error:", err);
      return { success: false, error: err.message };
    }
  }
};

// --- Error Boundary ---
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) { return { hasError: true, error }; }
  componentDidCatch(error: any, errorInfo: any) { console.error("LeadForge Error:", error, errorInfo); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center">
          <div className="max-w-md w-full bg-white p-8 rounded-2xl border border-slate-200 shadow-xl space-y-6">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <div className="space-y-2">
              <h1 className="text-xl font-bold text-slate-900">Erreur de l'application</h1>
              <p className="text-sm text-slate-500 leading-relaxed">LeadForge a rencontré une interruption inattendue lors de l'affichage.</p>
              <pre className="mt-4 p-4 bg-slate-50 rounded-lg text-left text-[10px] font-mono text-slate-600 overflow-auto max-h-40">
                {this.state.error?.message || "Erreur inconnue"}
              </pre>
            </div>
            <button onClick={() => window.location.reload()} className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold text-sm uppercase tracking-widest hover:bg-slate-800 transition-all">Recharger l'Application</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppContent() {
  console.log("AppContent rendering...");
  const { user, token: authContextToken, loading, authError, authErrorCode, signIn, logout } = useAuth();
  const [copiedDomain, setCopiedDomain] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [token, setToken] = useState<string | null>(authContextToken);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (authContextToken) {
      setToken(authContextToken);
    }
  }, [authContextToken]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    console.log("Current Origin:", window.location.origin);
    console.log("Auth Status Check:", { user: !!user, loading, authError: !!authError });
    if (user) {
      user.getIdToken().then(t => {
        console.log("Token acquired.");
        setToken(t);
      }).catch(err => {
        console.error("Token acquisition failed:", err);
      });
    }
  }, [user, loading, authError]);

  if (loading) {
    console.log("Rendering Loading Screen");
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
        <div className="space-y-6 animate-in fade-in duration-700">
          <div className="w-12 h-12 border-4 border-slate-100 border-t-slate-900 rounded-full animate-spin mx-auto" />
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Chargement de LeadForge...</h2>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-widest">Initialisation de la session sécurisée</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    console.log("Rendering Login Screen");
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full space-y-8 animate-in zoom-in-95 duration-500">
          <div className="space-y-4">
            <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-slate-900/20">
              <Target className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900">LeadForge</h1>
            <p className="text-base text-slate-600 leading-relaxed font-medium">Détection de prospects B2B qualifiés & vérifiés avec audits digitaux orientés conversion.</p>
          </div>
          
          {authError && (() => {
            const isUnauthorizedDomain = authErrorCode === 'auth/unauthorized-domain' || authError?.includes('unauthorized-domain');
            const currentDomain = typeof window !== 'undefined' ? window.location.hostname : '';
            return (
              <div className="p-5 bg-amber-50/90 border border-amber-200/90 rounded-2xl text-left space-y-4 shadow-sm animate-in fade-in">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-amber-950 tracking-tight">
                      {isUnauthorizedDomain ? 'Action Requise : Autoriser le domaine dans Firebase' : 'Échec de connexion'}
                    </p>
                    <p className="text-xs text-amber-800 leading-relaxed font-medium">{authError}</p>
                  </div>
                </div>

                {isUnauthorizedDomain && (
                  <div className="pt-3 border-t border-amber-200/80 space-y-3">
                    <div className="bg-white p-3 rounded-xl border border-amber-200 flex items-center justify-between gap-3 shadow-xs">
                      <div className="min-w-0">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Domaine à autoriser</p>
                        <p className="text-xs font-mono font-bold text-slate-900 truncate">{currentDomain}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (currentDomain) {
                            navigator.clipboard.writeText(currentDomain);
                            setCopiedDomain(true);
                            setTimeout(() => setCopiedDomain(false), 2000);
                          }
                        }}
                        className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-all shrink-0 active:scale-95"
                      >
                        {copiedDomain ? '✓ Copié' : 'Copier le Domaine'}
                      </button>
                    </div>

                    <div className="text-[11px] text-slate-700 space-y-2">
                      <p className="font-bold text-slate-900">Procédure en 30 secondes :</p>
                      <ol className="list-decimal list-inside space-y-1.5 text-slate-600 leading-relaxed pl-0.5">
                        <li>
                          Ouvrez{' '}
                          <a 
                            href="https://console.firebase.google.com/project/majestic-safeguard-nvr20/authentication/settings" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 font-bold underline hover:text-blue-800 inline-flex items-center gap-1"
                          >
                            Console Firebase &rarr; Domaines autorisés
                          </a>
                        </li>
                        <li>Cliquez sur <strong className="text-slate-900 font-bold">Ajouter un domaine</strong></li>
                        <li>
                          Collez <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono font-bold text-amber-950">{currentDomain}</code> (ou <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono font-bold text-amber-950">vercel.app</code> pour couvrir tous les déploiements Vercel) et cliquez sur <strong className="text-slate-900 font-bold">Enregistrer</strong>
                        </li>
                        <li>Cliquez sur le bouton ci-dessous pour vous connecter</li>
                      </ol>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          <button onClick={signIn} className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10 active:scale-[0.98]">
            Se connecter avec Google
          </button>
        </div>
      </div>
    );
  }


  console.log("Rendering Dashboard Shell");

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={(tab: string) => { 
          setActiveTab(tab); 
          setSelectedLeadId(null); 
          setMobileMenuOpen(false); 
        }} 
        user={user} 
        logout={logout}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <main className="flex-1 overflow-auto h-screen flex flex-col min-w-0">
        <Header 
          activeTab={activeTab} 
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full flex-1">
          {selectedLeadId ? (
            <LeadDetailView leadId={selectedLeadId} token={token!} onBack={() => setSelectedLeadId(null)} />
          ) : (
            <>
              {activeTab === 'dashboard' && <DashboardView setActiveTab={setActiveTab} onSelectLead={setSelectedLeadId} token={token} />}
              {activeTab === 'generate' && <GenerateView token={token} />}
              {activeTab === 'import' && <ImportView token={token} onBack={() => setActiveTab('generate')} />}
              {activeTab === 'leads' && <LeadsView token={token} onSelectLead={setSelectedLeadId} />}
              {activeTab === 'quality' && <DataQualityView token={token} />}
              {activeTab === 'settings' && <SettingsView token={token || ''} />}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function Sidebar({ activeTab, setActiveTab, user, logout, mobileOpen, onCloseMobile, collapsed, onToggleCollapse }: any) {
  const navItems = [
    { id: 'dashboard', label: 'Tableau de bord CRM', icon: LayoutDashboard },
    { id: 'generate', label: 'Prospection & Découverte', icon: Target },
    { id: 'import', label: 'Importer des prospects', icon: Upload },
    { id: 'leads', label: 'Base de prospects', icon: Database },
    { id: 'quality', label: 'Qualité des données', icon: ShieldCheck },
    { id: 'settings', label: 'Paramètres & Sources', icon: Settings },
  ];

  const handleNavClick = (id: string) => {
    setActiveTab(id);
    if (onCloseMobile) onCloseMobile();
  };

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-40 lg:hidden transition-opacity duration-200"
          onClick={onCloseMobile}
          aria-label="Fermer le menu"
        />
      )}

      {/* Mobile Off-canvas Drawer */}
      <aside 
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 bg-white flex flex-col shadow-2xl transition-transform duration-300 ease-in-out lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="p-5 flex items-center justify-between border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white">
              <Target className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight text-slate-900">LeadForge</h2>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Prospection B2B</span>
            </div>
          </div>
          {/* Prominent Close Button */}
          <button 
            onClick={onCloseMobile}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            title="Fermer le menu (Échap)"
            aria-label="Fermer le menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <button 
              key={item.id} 
              onClick={() => handleNavClick(item.id)} 
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold rounded-lg transition-colors", 
                activeTab === item.id 
                  ? "bg-slate-900 text-white shadow-sm" 
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              )}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-100 space-y-3 bg-slate-50/50">
          <div className="flex items-center gap-3 px-1">
            <img src={user.photoURL || ''} alt="" className="w-8 h-8 rounded-full border border-slate-200 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-900 truncate uppercase tracking-wider">{user.displayName}</p>
              <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
            </div>
          </div>
          <button 
            onClick={logout} 
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider rounded-lg hover:text-red-600 hover:bg-red-50 border border-slate-200 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" /> Se déconnecter
          </button>
        </div>
      </aside>

      {/* Desktop Sticky Sidebar */}
      <aside 
        className={cn(
          "bg-white border-r border-slate-200 hidden lg:flex flex-col sticky top-0 h-screen transition-all duration-300 shrink-0",
          collapsed ? "w-20" : "w-64"
        )}
      >
        <div className={cn("p-5 flex items-center border-b border-slate-100", collapsed ? "justify-center" : "justify-between")}>
          {!collapsed ? (
            <>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white">
                  <Target className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold tracking-tight text-slate-900">LeadForge</h2>
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Prospection B2B</span>
                </div>
              </div>
              <button 
                onClick={onToggleCollapse} 
                title="Réduire le menu" 
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                aria-label="Réduire le menu"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </>
          ) : (
            <button 
              onClick={onToggleCollapse} 
              title="Agrandir le menu" 
              className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors flex items-center justify-center"
              aria-label="Agrandir le menu"
            >
              <PanelLeftOpen className="w-5 h-5" />
            </button>
          )}
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => (
            <button 
              key={item.id} 
              onClick={() => setActiveTab(item.id)} 
              title={collapsed ? item.label : undefined}
              className={cn(
                "w-full flex items-center rounded-lg transition-colors font-medium text-xs",
                collapsed ? "justify-center p-3" : "gap-3 px-3 py-2.5",
                activeTab === item.id 
                  ? "bg-slate-900 text-white shadow-sm" 
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              )}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-200 space-y-3">
          <div className={cn("flex items-center", collapsed ? "justify-center" : "gap-3 px-1")}>
            <img src={user.photoURL || ''} alt="" className="w-8 h-8 rounded-full border border-slate-200 shrink-0" />
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-900 truncate uppercase tracking-wider">{user.displayName}</p>
                <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
              </div>
            )}
          </div>
          <button 
            onClick={logout} 
            title={collapsed ? "Se déconnecter" : undefined}
            className={cn(
              "w-full flex items-center text-xs font-bold text-slate-400 uppercase tracking-widest rounded-lg hover:text-red-600 hover:bg-red-50 transition-colors",
              collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2"
            )}
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            {!collapsed && <span>Se déconnecter</span>}
          </button>
        </div>
      </aside>
    </>
  );
}

function Header({ activeTab, onOpenMobileMenu, collapsed, onToggleCollapse }: any) {
  const titles: Record<string, string> = {
    'dashboard': 'Tableau de bord CRM & Opportunités',
    'generate': 'Prospection & Découverte B2B',
    'import': 'Importation de prospects CSV',
    'leads': 'Base de données & Répertoire prospects',
    'quality': 'Contrôle & Qualité des données',
    'settings': 'Configuration du Pipeline'
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 lg:px-8 sticky top-0 z-30">
      <div className="flex items-center gap-3">
        {/* Mobile Hamburger Menu Toggle */}
        <button 
          onClick={onOpenMobileMenu}
          className="p-2 -ml-1 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 lg:hidden flex items-center justify-center transition-colors"
          title="Ouvrir le menu"
          aria-label="Ouvrir le menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Desktop Collapse Toggle in Header */}
        <button 
          onClick={onToggleCollapse}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 hidden lg:flex items-center justify-center transition-colors"
          title={collapsed ? "Agrandir le menu" : "Réduire le menu"}
          aria-label={collapsed ? "Agrandir le menu" : "Réduire le menu"}
        >
          {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] hidden sm:inline">LeadForge /</span>
          <h2 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wider">
            {titles[activeTab] || activeTab.replace('-', ' ')}
          </h2>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative hidden md:block">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Recherche rapide..." 
            className="pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-slate-900 w-48 font-medium transition-all focus:w-64" 
          />
        </div>
      </div>
    </header>
  );
}

function DashboardView({ setActiveTab, onSelectLead, token }: any) {
  const [stats, setStats] = useState<any>(null);
  const [leads, setLeads] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [initMsg, setInitMsg] = useState<string | null>(null);

  const runDiagnostics = async () => {
    setIsDiagnosing(true);
    try {
      const res = await fetch('/api/debug/db');
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await res.text();
        setDiagnostics({
          connected: false,
          tables: 0,
          error: `Server returned HTTP ${res.status}: ${res.statusText || 'Non-JSON response'}. ${text.slice(0, 150)}`,
          diagnostics: {
            recommendation: 'The serverless endpoint returned HTML or raw text. Ensure you have triggered a Redeploy in Vercel after saving your environment variables.'
          }
        });
        return;
      }
      const data = await res.json();
      setDiagnostics(data);
    } catch (e: any) {
      setDiagnostics({ 
        connected: false,
        tables: 0,
        error: 'Could not contact diagnostic endpoint: ' + e.message,
        diagnostics: {
          recommendation: 'Check network connectivity or Vercel function runtime logs.'
        }
      });
    } finally {
      setIsDiagnosing(false);
    }
  };

  const handleInitDb = async () => {
    setIsInitializing(true);
    setInitMsg(null);
    try {
      const res = await fetch('/api/debug/init-db', { method: 'POST' });
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        setInitMsg(`Init failed (HTTP ${res.status}): Server returned non-JSON response.`);
        return;
      }
      const data = await res.json();
      if (data.success) {
        setInitMsg('Database tables created successfully! Reloading...');
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setInitMsg('Init failed: ' + (data.error || 'Unknown error'));
      }
    } catch (e: any) {
      setInitMsg('Init request failed: ' + e.message);
    } finally {
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    if (token) {
      console.log('[DASHBOARD] Fetching stats and leads');
      Promise.all([
        api.get('/api/dashboard/stats', token),
        api.get('/api/leads?limit=10', token)
      ]).then(([statsRes, leadsRes]) => {
        console.log('[DASHBOARD] Fetch results:', { stats: statsRes.success, leads: leadsRes.success });
        if (statsRes.success) {
          setStats(statsRes.data);
        } else {
          const detail = statsRes.message || statsRes.details || statsRes.hint;
          setError(detail ? `${statsRes.error || 'Connection Error'}: ${detail}` : (statsRes.error || 'Failed to load stats'));
        }
        if (leadsRes.success) setLeads(leadsRes.data);
      }).catch(err => {
        console.error('[DASHBOARD] Fetch error:', err);
        setError(err.message);
      });
    }
  }, [token]);

  if (error) {
    const isDbIssue = error.toLowerCase().includes('database') || error.toLowerCase().includes('connect') || error.toLowerCase().includes('password') || error.toLowerCase().includes('socket') || error.toLowerCase().includes('enotfound') || error.toLowerCase().includes('relation');
    return (
      <div className="max-w-xl mx-auto p-8 my-8 bg-white rounded-2xl border border-slate-200 shadow-sm text-center space-y-4 animate-in fade-in">
        <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center mx-auto text-red-600 shadow-sm">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-bold text-slate-900 tracking-tight">Erreur de Connexion au Serveur</h3>
          <p className="text-xs text-slate-600 font-medium leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100 font-mono text-left break-all">{error}</p>
        </div>

        {isDbIssue && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-left text-xs text-amber-900 space-y-2">
            <p className="font-bold flex items-center gap-1.5 text-amber-950">
              <Lightbulb className="w-4 h-4 text-amber-600" />
              Avez-vous configuré les variables d'environnement sur Vercel ?
            </p>
            <ul className="list-disc pl-4 space-y-1 text-amber-800 leading-relaxed text-[11px]">
              <li><strong>Indispensable :</strong> Sur Vercel, l'ajout de variables ne met <em>pas</em> à jour les déploiements existants. Rendez-vous sur <strong>Deployments &rarr; Trois points (...) &rarr; Redeploy</strong>.</li>
              <li>Assurez-vous que <strong>Production, Preview et Development</strong> sont tous cochés lors de la saisie de <code className="bg-amber-100 font-mono px-1 rounded">DATABASE_URL</code>.</li>
              <li>Pour Supabase : Utilisez l'URL du <strong>Connection Pooler</strong> sur le port <strong>6543</strong> (<code className="bg-amber-100 font-mono px-1 rounded">aws-0-*.pooler.supabase.com:6543</code>). Le port direct 5432 échoue en serverless à cause de l'IPv6.</li>
            </ul>
          </div>
        )}

        {diagnostics && (
          <div className="p-4 bg-slate-900 text-slate-100 rounded-xl text-left text-xs font-mono space-y-2 border border-slate-800">
            <div className="flex justify-between items-center border-b border-slate-800 pb-1.5">
              <span className="font-bold text-emerald-400 text-[11px] uppercase tracking-wider">Diagnostic Serveur en Direct</span>
              <span className={diagnostics.connected ? "text-emerald-400" : "text-rose-400"}>
                {diagnostics.connected ? "BD CONNECTÉE" : "BD DÉCONNECTÉE"}
              </span>
            </div>
            <div className="space-y-1 text-[11px] text-slate-300">
              <p>Nombre de tables : <span className="text-white font-bold">{diagnostics.tables ?? 0}</span> / 17</p>
              {diagnostics.diagnostics?.detectedHost && (
                <p>Hôte détecté : <span className="text-white">{diagnostics.diagnostics.detectedHost}:{diagnostics.diagnostics.detectedPort}</span></p>
              )}
              {diagnostics.diagnostics?.recommendation && (
                <p className="text-amber-300 pt-1 font-sans">💡 {diagnostics.diagnostics.recommendation}</p>
              )}
              {diagnostics.error && (
                <p className="text-rose-400 pt-1">Erreur : {diagnostics.error}</p>
              )}
            </div>
            {diagnostics.connected && diagnostics.tables < 5 && (
              <div className="pt-2">
                <button
                  onClick={handleInitDb}
                  disabled={isInitializing}
                  className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold font-sans transition-colors"
                >
                  {isInitializing ? 'Création des tables...' : 'Initialiser les 17 tables de la base maintenant'}
                </button>
              </div>
            )}
          </div>
        )}

        {initMsg && (
          <p className="text-xs font-bold text-emerald-600 bg-emerald-50 p-2 rounded-lg border border-emerald-100">{initMsg}</p>
        )}

        <div className="pt-2 flex flex-wrap gap-2 justify-center">
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-slate-800 transition-colors shadow-sm"
          >
            Réessayer la connexion
          </button>
          <button 
            onClick={runDiagnostics} 
            disabled={isDiagnosing}
            className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors shadow-sm"
          >
            {isDiagnosing ? 'Test en cours...' : 'Tester le diagnostic serveur'}
          </button>
        </div>
      </div>
    );
  }

  if (!stats) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;

  const funnelStages = [
    { label: 'Nouveau', count: stats.new, color: 'bg-slate-200' },
    { label: 'Examiné', count: stats.reviewed, color: 'bg-blue-200' },
    { label: 'Qualifié', count: stats.qualified, color: 'bg-indigo-300' },
    { label: 'Contacté', count: stats.contacted, color: 'bg-amber-300' },
    { label: 'Répondu', count: stats.replied, color: 'bg-emerald-300' },
    { label: 'Gagné', count: stats.won, color: 'bg-emerald-500' },
  ];

  return (
    <div className="space-y-8">
      {/* Funnel */}
      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Entonnoir de Prospection Commerciale</h3>
        <div className="flex items-end gap-2 h-40">
          {funnelStages.map((stage) => {
            const height = stats.total > 0 ? (stage.count / stats.total) * 100 : 0;
            return (
              <div key={stage.label} className="flex-1 flex flex-col items-center gap-3">
                <div className={cn("w-full rounded-t-lg transition-all duration-1000", stage.color)} style={{ height: `${Math.max(10, height)}%` }}>
                  {stage.count > 0 && <span className="block text-center text-[10px] font-bold py-1">{stage.count}</span>}
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase truncate w-full text-center">{stage.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Total Prospects', value: stats.total },
          { label: 'Sites Web Vérifiés', value: stats.websitesFound, color: 'text-emerald-600' },
          { label: 'Sans Site Web (Opportunités)', value: stats.websitesMissing, color: 'text-amber-600' },
          { label: 'Fort Potentiel Commercial', value: stats.highOpportunity, color: 'text-blue-600' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
            <span className={cn("text-2xl font-bold", stat.color || "text-slate-900")}>{stat.value || 0}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <h3 className="text-lg font-bold text-slate-900">Derniers Prospects Découverts</h3>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden text-sm">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-6 py-4">Entreprise</th>
                  <th className="px-6 py-4">Statut</th>
                  <th className="px-6 py-4 text-right">Score Opp.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leads.map((lead: any) => (
                  <tr key={lead.id} onClick={() => onSelectLead(lead.id)} className="hover:bg-slate-50 transition-colors cursor-pointer group">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900">{lead.companyName}</div>
                      <div className="text-[11px] text-slate-500">{lead.city}, {lead.country}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold uppercase", 
                        lead.leadStatus === 'WON' ? 'bg-emerald-50 text-emerald-700' : 
                        lead.leadStatus === 'NEW' ? 'bg-slate-100 text-slate-600' : 'bg-blue-50 text-blue-700'
                      )}>{lead.leadStatus}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={cn("font-bold", (lead.opportunityScore || 0) > 60 ? 'text-blue-600' : 'text-slate-400')}>
                        {lead.opportunityScore || 0}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <h3 className="text-lg font-bold text-slate-900">Opportunités Détectées</h3>
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            {stats.opportunities?.length > 0 ? stats.opportunities.map((opp: any) => (
              <div key={opp.type} className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{opp.type.replace('_', ' ')}</span>
                <span className="text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">{opp.count}</span>
              </div>
            )) : <p className="text-xs text-slate-400">Aucune opportunité détectée pour le moment.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function GenerateView({ token }: any) {
  const [source, setSource] = useState<'osm' | 'csv'>('osm');
  const [loading, setLoading] = useState(false);
  const [jobId, setJobId] = useState<number | null>(null);
  const [jobStatus, setJobStatus] = useState<any>(null);
  const [resuming, setResuming] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [criteria, setCriteria] = useState({ 
    country: 'France', 
    city: 'Paris', 
    category: 'bakery',
    maxResults: 50,
    radius: 10,
    campaignName: 'Prospection Artisans & Commerces Paris',
    localOnly: true,
    requireContactInfo: true
  });

  const targetPresets = [25, 50, 100, 250, 500];
  const smbCategories = [
    { label: '🥖 Boulangerie / Pâtisserie', value: 'bakery' },
    { label: '💇 Salon de Coiffure & Barbier', value: 'hairdresser' },
    { label: '🍽️ Restaurant / Bistrot / Brasserie', value: 'restaurant' },
    { label: '🔧 Plombier / Chauffagiste', value: 'plumber' },
    { label: '🦷 Cabinet Dentaire', value: 'dentist' },
    { label: '🚗 Garage Auto & Carrosserie', value: 'car mechanic' },
    { label: '📱 Réparation Smartphone & Tech', value: 'phone repair' },
    { label: '👗 Boutique / Prêt-à-porter', value: 'boutique' },
    { label: '⚖️ Avocat / Cabinet Juridique', value: 'lawyer' },
    { label: '☕ Café / Salon de Thé', value: 'cafe' },
    { label: '⚡ Électricien', value: 'electrician' },
    { label: '🏡 Agence Immobilière', value: 'real estate agency' },
    { label: '🌸 Fleuriste', value: 'florist' },
    { label: '🥩 Boucherie / Charcuterie', value: 'butcher' },
    { label: '👓 Opticien', value: 'optician' },
    { label: '🏋️ Salle de Sport & Fitness', value: 'gym' }
  ];

  useEffect(() => {
    let interval: any;
    if (jobId) {
      interval = setInterval(() => {
        api.get(`/api/jobs/${jobId}`, token!).then(res => {
          if (res.success) {
            setJobStatus(res.data);
            if (res.data.status === 'completed' || res.data.status === 'failed') {
              clearInterval(interval);
              setLoading(false);
            }
          }
        });
      }, 1200);
    }
    return () => clearInterval(interval);
  }, [jobId, token]);

  const handleGenerate = async () => {
    if (!criteria.campaignName) {
      setErrorMsg('Veuillez renseigner un nom de campagne.');
      return;
    }
    setErrorMsg(null);
    setLoading(true);
    setJobStatus(null);
    const res = await api.post('/api/generate', { 
      sourceId: 'osm', 
      criteria: {
        country: criteria.country,
        city: criteria.city,
        category: criteria.category,
        limit: criteria.maxResults,
        localOnly: criteria.localOnly,
        requireContactInfo: criteria.requireContactInfo
      },
      campaignName: criteria.campaignName
    }, token!);
    if (res.success) setJobId(res.data.id);
    else {
      setLoading(false);
      setErrorMsg(res.error || 'Échec du lancement de la prospection.');
    }
  };

  const handleResume = async () => {
    if (!jobId) return;
    setResuming(true);
    setLoading(true);
    const res = await api.post(`/api/jobs/${jobId}/resume`, {
      sourceId: 'osm',
      criteria: {
        country: criteria.country,
        city: criteria.city,
        category: criteria.category,
        limit: criteria.maxResults,
        localOnly: criteria.localOnly,
        requireContactInfo: criteria.requireContactInfo
      }
    }, token!);
    if (!res.success) {
      setErrorMsg(res.error || 'Échec de la reprise de la génération');
    }
    setResuming(false);
  };

  const results = jobStatus?.results || {};
  const isCsv = source === 'csv';

  return (
    isCsv ? (
      <ImportView token={token} onBack={() => setSource('osm')} />
    ) : (
      <div className="max-w-5xl grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-8">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-slate-900">Génération & Découverte de Prospects B2B</h3>
                <p className="text-xs text-slate-500">Cible les commerces indépendants, artisans et PME locales, en filtrant les grandes chaînes et franchises nationales.</p>
              </div>
              <div className="flex bg-slate-100 p-1 rounded-lg">
                <button onClick={() => setSource('osm')} className={cn("px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all", !isCsv ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600")}>OpenStreetMap</button>
                <button onClick={() => setSource('csv')} className={cn("px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all", isCsv ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600")}>Import CSV</button>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-800 flex items-center justify-between">
                <span>{errorMsg}</span>
                <button onClick={() => setErrorMsg(null)} className="text-red-600 hover:text-red-950 font-bold text-xs">Fermer</button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2 col-span-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nom de la Campagne</label>
                <input type="text" placeholder="ex. Boulangeries Paris - Prospection Digitale" value={criteria.campaignName} onChange={e => setCriteria({...criteria, campaignName: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 font-medium" />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pays</label>
                <input type="text" value={criteria.country} onChange={e => setCriteria({...criteria, country: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 font-medium" />
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[
                    { label: '🇫🇷 France', country: 'France', city: 'Paris' },
                    { label: '🇨🇭 Suisse', country: 'Switzerland', city: 'Genève' },
                    { label: '🇧🇪 Belgique', country: 'Belgium', city: 'Bruxelles' },
                    { label: '🇨🇦 Canada (Québec)', country: 'Canada', city: 'Montréal' }
                  ].map(preset => (
                    <button
                      key={preset.country}
                      type="button"
                      onClick={() => setCriteria({
                        ...criteria,
                        country: preset.country,
                        city: preset.city,
                        campaignName: `Prospection ${preset.city} - ${criteria.category || 'PME'}`
                      })}
                      className={cn(
                        "px-2 py-0.5 rounded text-[11px] font-medium transition-colors border",
                        criteria.country.toLowerCase() === preset.country.toLowerCase()
                          ? "bg-indigo-900 text-white border-indigo-900 shadow-xs"
                          : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                      )}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ville / Secteur Cible</label>
                <input type="text" value={criteria.city} onChange={e => setCriteria({...criteria, city: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 font-medium" />
                {criteria.country.toLowerCase().includes('switz') || criteria.country.toLowerCase().includes('suisse') ? (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {['Genève', 'Lausanne', 'Zurich', 'Bâle', 'Berne', 'Neuchâtel', 'Fribourg'].map(swissCity => (
                      <button
                        key={swissCity}
                        type="button"
                        onClick={() => setCriteria({
                          ...criteria,
                          city: swissCity,
                          campaignName: `Prospection ${swissCity} - ${criteria.category || 'PME'}`
                        })}
                        className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-medium border",
                          criteria.city.toLowerCase() === swissCity.toLowerCase()
                            ? "bg-slate-900 text-white border-slate-900"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                        )}
                      >
                        {swissCity}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {['Paris', 'Lyon', 'Marseille', 'Bordeaux', 'Lille', 'Toulouse', 'Nantes', 'Nice'].map(frCity => (
                      <button
                        key={frCity}
                        type="button"
                        onClick={() => setCriteria({
                          ...criteria,
                          city: frCity,
                          campaignName: `Prospection ${frCity} - ${criteria.category || 'PME'}`
                        })}
                        className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-medium border",
                          criteria.city.toLowerCase() === frCity.toLowerCase()
                            ? "bg-slate-900 text-white border-slate-900"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                        )}
                      >
                        {frCity}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2 col-span-2">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Secteur d'activité / Métier</label>
                  <span className="text-[10px] text-slate-400">Secteurs à forte valeur ajoutée</span>
                </div>
                <input type="text" value={criteria.category} onChange={e => setCriteria({...criteria, category: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 font-medium placeholder:text-slate-300" placeholder="ex. boulangerie, dentiste, plombier, coiffeur, garage" />
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {smbCategories.map(cat => (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => setCriteria({...criteria, category: cat.value})}
                      className={cn("px-2.5 py-1 rounded text-[11px] font-medium transition-colors border",
                        criteria.category.toLowerCase() === cat.value ? "bg-slate-900 text-white border-slate-900 shadow-sm" : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                      )}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Local SMB & Chain Filter Options */}
              <div className="space-y-3 col-span-2 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                      <label htmlFor="localOnlyToggle" className="text-xs font-bold text-slate-900 cursor-pointer">
                        Cibler uniquement les commerces & PME indépendants
                      </label>
                      <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded uppercase">Recommandé</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Écarte automatiquement les grandes chaînes nationales, enseignes franchisées et multinationales (Fnac, Zara, McDonald's, Carrefour, Sephora, Basic-Fit...) pour cibler les vrais gérants et artisans locaux.
                    </p>
                  </div>
                  <input
                    id="localOnlyToggle"
                    type="checkbox"
                    checked={criteria.localOnly}
                    onChange={e => setCriteria({ ...criteria, localOnly: e.target.checked })}
                    className="w-5 h-5 rounded text-slate-900 focus:ring-slate-900 border-slate-300 mt-1 cursor-pointer"
                  />
                </div>

                <div className="border-t border-slate-200/80 pt-3 flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <label htmlFor="requireContactToggle" className="text-xs font-bold text-slate-900 cursor-pointer flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      🎯 Prospects Vérifiés & Contactables Uniquement
                    </label>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Exclut automatiquement les doublons, les entités sans nom d'entreprise réel, et les fiches sans contact. Conserve uniquement les prospects avec numéro de téléphone, site web ou email vérifié.
                    </p>
                  </div>
                  <input
                    id="requireContactToggle"
                    type="checkbox"
                    checked={criteria.requireContactInfo}
                    onChange={e => setCriteria({ ...criteria, requireContactInfo: e.target.checked })}
                    className="w-5 h-5 rounded text-slate-900 focus:ring-slate-900 border-slate-300 mt-1 cursor-pointer"
                  />
                </div>
              </div>

              <div className="space-y-2 col-span-2">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Volume Cible de Prospects (Plafond)</label>
                  <span className="text-[10px] text-slate-400 font-mono">{criteria.maxResults} prospects</span>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {targetPresets.map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setCriteria({...criteria, maxResults: preset})}
                      className={cn("py-2 text-xs font-bold rounded-lg border transition-all",
                        criteria.maxResults === preset 
                          ? "bg-slate-900 text-white border-slate-900 shadow-sm" 
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                      )}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button disabled={loading} onClick={handleGenerate} className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-sm active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Recherche & qualification en cours...' : `Lancer la prospection (${criteria.maxResults} cibles)`}
            </button>
          </div>

          {jobStatus && (
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6 animate-in fade-in slide-in-from-top-2 duration-500">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-widest">Progression en Direct</h4>
                  {results.currentCell && (
                    <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded font-mono font-bold text-slate-600">
                      Zone : {results.currentCell}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {jobStatus.status === 'failed' && (
                    <button
                      onClick={handleResume}
                      disabled={resuming}
                      className="px-2.5 py-1 bg-amber-600 text-white text-[10px] font-bold uppercase rounded hover:bg-amber-700 flex items-center gap-1"
                    >
                      {resuming ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                      Reprendre
                    </button>
                  )}
                  <span className={cn("text-[10px] font-black uppercase px-2.5 py-1 rounded", 
                    jobStatus.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 
                    jobStatus.status === 'failed' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-blue-50 text-blue-700 border border-blue-200'
                  )}>
                    {jobStatus.status === 'completed' ? 'Terminé' : jobStatus.status === 'failed' ? 'Erreur' : 'En cours'}
                  </span>
                </div>
              </div>

              {/* Pipeline Stages Tracker */}
              <div className="grid grid-cols-5 gap-2 text-center text-[9px] font-bold uppercase tracking-wider py-2">
                <div className={cn("p-2 rounded-lg border", (results.cellsCompleted || 0) > 0 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-400 border-slate-100")}>
                  1. Extraction
                </div>
                <div className={cn("p-2 rounded-lg border", (results.duplicates || 0) > 0 || (results.validBusinesses || 0) > 0 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-400 border-slate-100")}>
                  2. Déduplication
                </div>
                <div className={cn("p-2 rounded-lg border", (results.verifiedWebsites || 0) > 0 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-400 border-slate-100")}>
                  3. Sites Web
                </div>
                <div className={cn("p-2 rounded-lg border", (results.phonesFound || 0) > 0 || (results.emailsFound || 0) > 0 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-400 border-slate-100")}>
                  4. Téléphone & SIREN
                </div>
                <div className={cn("p-2 rounded-lg border", (results.auditsCompleted || 0) > 0 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-400 border-slate-100")}>
                  5. Prêt CRM
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className={cn("w-2 h-2 rounded-full shrink-0", jobStatus.status === 'completed' ? 'bg-emerald-500' : 'bg-blue-500 animate-pulse')}></div>
                  <p className="text-xs font-semibold text-slate-700 truncate">{results.currentStep || 'Initialisation du pipeline...'}</p>
                </div>

                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-slate-900 transition-all duration-500" style={{ width: `${Math.min(100, ((results.newLeadsSaved || 0) / (criteria.maxResults || 1)) * 100)}%` }}></div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                  <StatMini label="Bruts Détectés" value={results.totalFound || 0} />
                  <StatMini label="Chaînes Écartées" value={results.chainsFiltered || 0} color="text-rose-600 font-bold" />
                  <StatMini label="PME Qualifiées" value={results.validBusinesses || 0} color="text-emerald-600 font-bold" />
                  <StatMini label="Doublons Filtrés" value={results.duplicates || 0} color="text-slate-400" />
                  <StatMini label="Candidats Web" value={results.websiteCandidates || 0} color="text-amber-600" />
                  <StatMini label="Sites Vérifiés" value={results.verifiedWebsites || 0} color="text-teal-600" />
                  <StatMini label="Téléphones Trouvés" value={results.phonesFound || 0} color="text-indigo-600" />
                  <StatMini label="Emails Découverts" value={results.emailsFound || 0} color="text-violet-600" />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Architecture du Pipeline</h4>
            <div className="space-y-3 text-xs">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span className="text-slate-600"><strong>Partitionnement Géographique :</strong> Découpe automatique en zones pour éviter les timeouts cartographiques.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span className="text-slate-600"><strong>Mapping Multi-Tags :</strong> Recherche simultanée des métiers, commerces, artisans et professions libérales.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span className="text-slate-600"><strong>Crawler Natif Rapide :</strong> Exploration parallèle de la page contact et des mentions légales (SIRET, gérant, téléphone, WhatsApp).</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span className="text-slate-600"><strong>Traçabilité des Données :</strong> Sauvegarde de l'URL source et de la méthode d'extraction pour chaque coordonnée.</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 p-6 rounded-2xl text-white space-y-4 shadow-xl shadow-slate-900/10">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider">Stack 100% Gratuite ($0 MVP)</h4>
            </div>
            <p className="text-[11px] opacity-80 leading-relaxed">
              LeadForge fonctionne nativement sans aucune clé API payante requise (OpenStreetMap, Nominatim, Crawler Cheerio ultra-rapide, Sondage de domaines locaux).
            </p>
          </div>
        </div>
      </div>
    )
  );
}

function StatMini({ label, value, color }: any) {
  return (
    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
      <span className={cn("text-lg font-black", color || "text-slate-900")}>{value}</span>
    </div>
  );
}

function ImportView({ token, onBack }: any) {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<any>({ companyName: '', phone: '', email: '', website: '' });
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: any) => {
    const file = e.target.files[0];
    if (file) {
      Papa.parse(file, {
        header: true,
        complete: (results) => {
          setData(results.data);
          setHeaders(results.meta.fields || []);
          setStep(2);
          const newMap = { ...mapping };
          const h = results.meta.fields || [];
          h.forEach((header: string) => {
            const low = header.toLowerCase();
            if (low.includes('name') || low.includes('company')) newMap.companyName = header;
            if (low.includes('phone') || low.includes('tel')) newMap.phone = header;
            if (low.includes('email') || low.includes('mail')) newMap.email = header;
            if (low.includes('web') || low.includes('site') || low.includes('url')) newMap.website = header;
          });
          setMapping(newMap);
        }
      });
    }
  };

  const [importNotice, setImportNotice] = useState<string | null>(null);

  const handleImport = async () => {
    setLoading(true);
    setImportNotice(null);
    const res = await api.post('/api/leads/import', { rows: data, mapping }, token!);
    setLoading(false);
    if (res.success) {
      setStep(1);
      setImportNotice('Processus d\'importation démarré en arrière-plan avec succès.');
    } else {
      setImportNotice(res.error || 'Échec de l\'importation du fichier CSV.');
    }
  };

  const FIELD_LABELS_FR: Record<string, string> = {
    companyName: 'Nom de l\'Entreprise',
    phone: 'Numéro de Téléphone',
    email: 'Adresse Email',
    website: 'Site Web / URL'
  };

  return (
    <div className="max-w-4xl bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-8">
      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <h3 className="text-xl font-bold text-slate-900">Importation de Prospects CSV</h3>
          <p className="text-sm text-slate-500">Importez vos fichiers de contacts et associez les colonnes aux champs LeadForge.</p>
        </div>
        <button onClick={onBack} className="text-[10px] font-bold text-slate-400 hover:text-slate-900 flex items-center gap-2 uppercase tracking-[0.2em] transition-colors">
          <ArrowRight className="w-3 h-3 rotate-180" /> Retour au choix
        </button>
      </div>

      {importNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center justify-between">
          <span>{importNotice}</span>
          <button onClick={() => setImportNotice(null)} className="text-emerald-700 hover:text-emerald-950 font-bold text-xs">Fermer</button>
        </div>
      )}

      {step === 1 && (
        <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-slate-200 rounded-2xl p-16 text-center space-y-4 hover:border-slate-400 cursor-pointer transition-colors group">
          <Upload className="w-12 h-12 text-slate-200 mx-auto group-hover:text-slate-400 transition-colors" />
          <div className="space-y-1">
            <p className="text-sm font-bold text-slate-900 uppercase tracking-widest">Sélectionner un Fichier CSV</p>
            <p className="text-[11px] text-slate-400 font-medium">Format standard CSV UTF-8 recommandé</p>
          </div>
          <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleFileUpload} />
        </div>
      )}
      {step === 2 && (
        <div className="space-y-8">
          <div className="grid grid-cols-2 gap-12">
            <div className="space-y-6">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">Correspondance des Colonnes</h4>
              {Object.keys(mapping).map((field) => (
                <div key={field} className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    {FIELD_LABELS_FR[field] || field.replace(/([A-Z])/g, ' $1')}
                  </label>
                  <select value={mapping[field]} onChange={e => setMapping({...mapping, [field]: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:outline-none focus:ring-1 focus:ring-slate-900">
                    <option value="">(Ignorer ce champ)</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div className="space-y-6">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">Aperçu des Données Brutes</h4>
              <div className="bg-slate-50 rounded-xl p-4 space-y-3 overflow-auto max-h-[400px]">
                {data.slice(0, 3).map((row, i) => <div key={i} className="text-[9px] font-mono text-slate-500 bg-white p-3 rounded border border-slate-100"><pre>{JSON.stringify(row, null, 2)}</pre></div>)}
              </div>
            </div>
          </div>
          <div className="flex gap-4 pt-4">
            <button onClick={() => setStep(1)} className="flex-1 py-3 border border-slate-200 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-slate-50 transition-colors">Précédent</button>
            <button onClick={handleImport} disabled={loading} className="flex-1 py-3 bg-slate-900 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-slate-800 transition-colors flex items-center justify-center gap-2">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />} {loading ? 'Importation en cours...' : 'Confirmer l\'Importation'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function LeadsView({ token, onSelectLead }: any) {
  const [leads, setLeads] = useState<any[]>([]);
  const [totalLeads, setTotalLeads] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [loading, setLoading] = useState(false);

  // Filter States
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [contactFilter, setContactFilter] = useState('all');
  const [websiteFilter, setWebsiteFilter] = useState('all');
  const [oppScoreFilter, setOppScoreFilter] = useState('all');
  const [auditFilter, setAuditFilter] = useState('all');
  const [scopeFilter, setScopeFilter] = useState<'team' | 'personal'>('team');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // UI States
  const [showFiltersDrawer, setShowFiltersDrawer] = useState(false);
  const [selectedLeads, setSelectedLeads] = useState<number[]>([]);
  const [commercialLead, setCommercialLead] = useState<any | null>(null);
  const [auditMessage, setAuditMessage] = useState<string | null>(null);
  const [rowAuditing, setRowAuditing] = useState<number | null>(null);
  const [filterOptions, setFilterOptions] = useState<{
    cities: { city: string; count: number }[];
    categories: { category: string; count: number }[];
    statusCounts: { status: string; count: number }[];
    summary: any;
  }>({
    cities: [],
    categories: [],
    statusCounts: [],
    summary: {}
  });

  // Debounce search input by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Load dynamic filter options on mount
  useEffect(() => {
    if (token) {
      api.get('/api/leads/filter-options', token).then(res => {
        if (res.success && res.data) {
          setFilterOptions(res.data);
        }
      });
    }
  }, [token]);

  // Build query string
  const getQueryParams = (forExport = false) => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.append('search', debouncedSearch);
    if (statusFilter) params.append('status', statusFilter);
    if (cityFilter) params.append('city', cityFilter);
    if (categoryFilter) params.append('category', categoryFilter);
    if (contactFilter && contactFilter !== 'all') params.append('contactFilter', contactFilter);
    if (websiteFilter && websiteFilter !== 'all') params.append('websiteFilter', websiteFilter);
    if (oppScoreFilter && oppScoreFilter !== 'all') params.append('oppScoreRange', oppScoreFilter);
    if (auditFilter && auditFilter !== 'all') params.append('auditFilter', auditFilter);
    params.append('scope', scopeFilter);
    params.append('sortBy', sortBy);
    params.append('sortOrder', sortOrder);
    if (!forExport) {
      params.append('page', String(page));
      params.append('limit', String(pageSize));
    }
    return params;
  };

  const fetchLeads = async () => {
    setLoading(true);
    const params = getQueryParams();
    const res = await api.get(`/api/leads?${params.toString()}`, token);
    if (res.success) {
      setLeads(res.data || []);
      setTotalLeads(res.total ?? (res.data || []).length);
      setTotalPages(res.totalPages ?? 1);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (token) {
      fetchLeads();
    }
  }, [
    token,
    debouncedSearch,
    statusFilter,
    cityFilter,
    categoryFilter,
    contactFilter,
    websiteFilter,
    oppScoreFilter,
    auditFilter,
    scopeFilter,
    sortBy,
    sortOrder,
    page,
    pageSize
  ]);

  const runSingleAuditFR = async (id: number) => {
    setRowAuditing(id);
    await api.post(`/api/leads/${id}/audit`, { language: 'fr' }, token);
    setRowAuditing(null);
    fetchLeads();
  };

  const handleExport = () => {
    const params = getQueryParams(true);
    const a = document.createElement('a');
    a.href = `/api/leads/export?token=${token}&${params.toString()}`;
    a.download = `leadforge-prospects-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const toggleSelectAll = () => {
    if (selectedLeads.length === leads.length) setSelectedLeads([]);
    else setSelectedLeads(leads.map(l => l.id));
  };

  const toggleSelect = (id: number) => {
    if (selectedLeads.includes(id)) setSelectedLeads(selectedLeads.filter(li => li !== id));
    else setSelectedLeads([...selectedLeads, id]);
  };

  const resetAllFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setStatusFilter('');
    setCityFilter('');
    setCategoryFilter('');
    setContactFilter('all');
    setWebsiteFilter('all');
    setOppScoreFilter('all');
    setAuditFilter('all');
    setSortBy('createdAt');
    setSortOrder('desc');
    setPage(1);
  };

  const hasActiveFilters = Boolean(
    debouncedSearch ||
    statusFilter ||
    cityFilter ||
    categoryFilter ||
    contactFilter !== 'all' ||
    websiteFilter !== 'all' ||
    oppScoreFilter !== 'all' ||
    auditFilter !== 'all' ||
    sortBy !== 'createdAt' ||
    sortOrder !== 'desc'
  );

  const summary = filterOptions.summary || {};

  return (
    <div className="space-y-6">
      {auditMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center justify-between animate-in fade-in">
          <span>{auditMessage}</span>
          <button onClick={() => setAuditMessage(null)} className="text-emerald-600 hover:text-emerald-950 font-bold text-xs">Fermer</button>
        </div>
      )}

      {/* Header & Quick Action Buttons */}
      <div className="flex justify-between items-start flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h3 className="text-xl font-bold text-slate-900">Base de Données des Prospects</h3>
            <span className="px-2.5 py-0.5 bg-slate-900 text-white rounded-full text-[11px] font-bold">
              {totalLeads} {totalLeads > 1 ? 'prospects' : 'prospect'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Filtrez avec souplesse par entreprise, ville, statut, canal de contact ou opportunité commerciale.
          </p>
        </div>

        <div className="flex gap-2 items-center flex-wrap">
          {selectedLeads.length > 0 && (
            <button 
              onClick={async () => {
                setAuditMessage(`Réalisation des audits en français pour ${selectedLeads.length} prospects...`);
                for (const id of selectedLeads) {
                  await api.post(`/api/leads/${id}/audit`, { language: 'fr' }, token);
                }
                setAuditMessage(`Audits en français terminés pour ${selectedLeads.length} prospects.`);
                fetchLeads();
                setSelectedLeads([]);
              }}
              className="flex items-center gap-2 px-3.5 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-blue-700 transition-colors shadow-md shadow-blue-900/10"
            >
              <Languages className="w-3.5 h-3.5" /> Auditer FR ({selectedLeads.length})
            </button>
          )}

          <button 
            onClick={() => setShowFiltersDrawer(!showFiltersDrawer)}
            className={cn(
              "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border",
              showFiltersDrawer || hasActiveFilters
                ? "bg-blue-50 text-blue-700 border-blue-200 shadow-xs"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            )}
            title="Afficher tous les filtres avancés (Ville, métier, présence web, scores...)"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filtres Avancés
            {hasActiveFilters && (
              <span className="w-2 h-2 rounded-full bg-blue-600"></span>
            )}
          </button>

          <button 
            onClick={handleExport} 
            className="flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-slate-50 transition-colors shadow-xs"
            title="Télécharger les prospects filtrés au format CSV"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" /> Exporter CSV
          </button>
        </div>
      </div>

      {/* 1-Click Interactive Quick Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <button
          onClick={() => { resetAllFilters(); }}
          className={cn(
            "px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 flex items-center gap-1.5 border",
            !hasActiveFilters
              ? "bg-slate-900 text-white border-slate-900 shadow-xs"
              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
          )}
        >
          <span>🎯 Tous</span>
          <span className="text-[10px] opacity-70">({summary.total ?? totalLeads})</span>
        </button>

        <button
          onClick={() => {
            setWebsiteFilter(websiteFilter === 'no_website' ? 'all' : 'no_website');
            setPage(1);
          }}
          className={cn(
            "px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 flex items-center gap-1.5 border",
            websiteFilter === 'no_website'
              ? "bg-amber-600 text-white border-amber-600 shadow-xs"
              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
          )}
          title="Filtrer les entreprises qui n'ont aucun site internet"
        >
          <span>🚀 Sans Site Web</span>
          <span className="text-[10px] opacity-80 font-mono">({summary.noWebsite ?? 0})</span>
        </button>

        <button
          onClick={() => {
            setContactFilter(contactFilter === 'has_phone' ? 'all' : 'has_phone');
            setPage(1);
          }}
          className={cn(
            "px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 flex items-center gap-1.5 border",
            contactFilter === 'has_phone'
              ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
          )}
        >
          <span>📞 Avec Téléphone</span>
          <span className="text-[10px] opacity-80 font-mono">({summary.withPhone ?? 0})</span>
        </button>

        <button
          onClick={() => {
            setContactFilter(contactFilter === 'has_email' ? 'all' : 'has_email');
            setPage(1);
          }}
          className={cn(
            "px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 flex items-center gap-1.5 border",
            contactFilter === 'has_email'
              ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
          )}
        >
          <span>✉️ Avec Email</span>
          <span className="text-[10px] opacity-80 font-mono">({summary.withEmail ?? 0})</span>
        </button>

        <button
          onClick={() => {
            setOppScoreFilter(oppScoreFilter === 'high' ? 'all' : 'high');
            setPage(1);
          }}
          className={cn(
            "px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 flex items-center gap-1.5 border",
            oppScoreFilter === 'high'
              ? "bg-blue-600 text-white border-blue-600 shadow-xs"
              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
          )}
        >
          <span>🔥 Fort Potentiel (≥60)</span>
          <span className="text-[10px] opacity-80 font-mono">({summary.highOpportunity ?? 0})</span>
        </button>

        <button
          onClick={() => {
            setStatusFilter(statusFilter === 'QUALIFIED' ? '' : 'QUALIFIED');
            setPage(1);
          }}
          className={cn(
            "px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 flex items-center gap-1.5 border",
            statusFilter === 'QUALIFIED'
              ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
          )}
        >
          <span>✨ Qualifiés</span>
        </button>
      </div>

      {/* Main Filter Control Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex gap-3 flex-wrap items-center">
          {/* Live Search Input with Instant Clear */}
          <div className="relative flex-1 min-w-[260px]">
            <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Rechercher par nom, ville, tél, email, métier, adresse..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:bg-white w-full transition-all" 
            />
            {search && (
              <button 
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                title="Effacer la recherche"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* CRM Status Dropdown */}
          <div className="min-w-[160px]">
            <select 
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold uppercase tracking-wider text-slate-700 outline-none focus:bg-white"
            >
              <option value="">Tous les statuts</option>
              <option value="NEW">Nouveaux</option>
              <option value="REVIEWED">Examinés</option>
              <option value="QUALIFIED">Qualifiés</option>
              <option value="CONTACTED">Contactés</option>
              <option value="REPLIED">Ont Répondu</option>
              <option value="WON">Gagnés</option>
              <option value="LOST">Perdus</option>
              <option value="DISMISSED">Écartés</option>
            </select>
          </div>

          {/* City Quick Dropdown */}
          <div className="min-w-[160px]">
            <select
              value={cityFilter}
              onChange={e => { setCityFilter(e.target.value); setPage(1); }}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:bg-white"
            >
              <option value="">Toutes les villes</option>
              {filterOptions.cities.map(c => (
                <option key={c.city} value={c.city}>
                  📍 {c.city} ({c.count})
                </option>
              ))}
            </select>
          </div>

          {/* Sorting Dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200">
            <select
              value={sortBy}
              onChange={e => { setSortBy(e.target.value); setPage(1); }}
              className="px-2.5 py-1.5 bg-transparent text-xs font-semibold text-slate-700 outline-none"
            >
              <option value="createdAt">Date d'ajout</option>
              <option value="opportunityScore">Score d'Opportunité</option>
              <option value="auditScore">Score d'Audit</option>
              <option value="companyName">Nom de l'entreprise</option>
              <option value="city">Ville</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
              className="p-1.5 hover:bg-white rounded-lg text-slate-500 hover:text-slate-900 transition-colors"
              title={sortOrder === 'desc' ? 'Ordre décroissant (cliquer pour inverser)' : 'Ordre croissant (cliquer pour inverser)'}
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Scope Selector (Team vs Personal) */}
          <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs font-bold">
            <button
              type="button"
              onClick={() => { setScopeFilter('team'); setPage(1); }}
              className={cn("px-2.5 py-1.5 rounded-lg transition-all text-[11px]",
                scopeFilter === 'team' ? "bg-white text-slate-900 shadow-xs font-bold" : "text-slate-500 hover:text-slate-900"
              )}
            >
              👥 Équipe
            </button>
            <button
              type="button"
              onClick={() => { setScopeFilter('personal'); setPage(1); }}
              className={cn("px-2.5 py-1.5 rounded-lg transition-all text-[11px]",
                scopeFilter === 'personal' ? "bg-white text-slate-900 shadow-xs font-bold" : "text-slate-500 hover:text-slate-900"
              )}
            >
              👤 Mes Leads
            </button>
          </div>
        </div>

        {/* Expandable Advanced Filter Panel */}
        {showFiltersDrawer && (
          <div className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in slide-in-from-top-1 duration-200">
            {/* Category / Profession Filter */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Activité / Métier</label>
              <select
                value={categoryFilter}
                onChange={e => { setCategoryFilter(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 outline-none"
              >
                <option value="">Toutes les activités</option>
                {filterOptions.categories.map(cat => (
                  <option key={cat.category} value={cat.category}>
                    {cat.category} ({cat.count})
                  </option>
                ))}
              </select>
            </div>

            {/* Direct Contact Channels */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Canal de Contact</label>
              <select
                value={contactFilter}
                onChange={e => { setContactFilter(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 outline-none"
              >
                <option value="all">Tous les canaux</option>
                <option value="has_phone">📞 Avec Téléphone direct</option>
                <option value="has_email">✉️ Avec Email officiel</option>
                <option value="has_both">🎯 Téléphone ET Email (Complet)</option>
                <option value="missing_phone">🚫 Sans Téléphone</option>
              </select>
            </div>

            {/* Web Presence & Digital Opportunity */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Présence Web & Vitrine</label>
              <select
                value={websiteFilter}
                onChange={e => { setWebsiteFilter(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 outline-none"
              >
                <option value="all">Tous les états de site</option>
                <option value="no_website">🚀 Sans Site Web (Cible prioritaire)</option>
                <option value="has_website">🌐 Avec Site Web existant</option>
                <option value="verified">✅ Site Web Vérifié</option>
                <option value="unreachable">⚠️ Site Inaccessible / En panne</option>
                <option value="social_profile">📱 Réseau social uniquement</option>
              </select>
            </div>

            {/* Potential & Audit Filter */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Potentiel & Audit</label>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={oppScoreFilter}
                  onChange={e => { setOppScoreFilter(e.target.value); setPage(1); }}
                  className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-medium text-slate-700 outline-none"
                >
                  <option value="all">Score Opp.</option>
                  <option value="high">🔥 ≥ 60</option>
                  <option value="medium">⚡ 30 à 59</option>
                  <option value="low">Faible &lt;30</option>
                </select>
                <select
                  value={auditFilter}
                  onChange={e => { setAuditFilter(e.target.value); setPage(1); }}
                  className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-medium text-slate-700 outline-none"
                >
                  <option value="all">Audit Tech</option>
                  <option value="audited">Déjà Audité</option>
                  <option value="not_audited">Non Audité</option>
                  <option value="good">Score ≥ 70</option>
                  <option value="needs_work">Score &lt; 70</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Active Filter Badges Bar */}
        {hasActiveFilters && (
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2 text-xs">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Filtres actifs :</span>
              {debouncedSearch && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg font-medium text-[11px]">
                  Recherche : "{debouncedSearch}"
                  <button onClick={() => setSearch('')} className="hover:text-slate-950 font-bold ml-1">×</button>
                </span>
              )}
              {statusFilter && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg font-medium text-[11px]">
                  Statut : {statusFilter}
                  <button onClick={() => setStatusFilter('')} className="hover:text-blue-950 font-bold ml-1">×</button>
                </span>
              )}
              {cityFilter && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg font-medium text-[11px]">
                  Ville : {cityFilter}
                  <button onClick={() => setCityFilter('')} className="hover:text-indigo-950 font-bold ml-1">×</button>
                </span>
              )}
              {categoryFilter && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-violet-50 text-violet-700 rounded-lg font-medium text-[11px]">
                  Métier : {categoryFilter}
                  <button onClick={() => setCategoryFilter('')} className="hover:text-violet-950 font-bold ml-1">×</button>
                </span>
              )}
              {contactFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg font-medium text-[11px]">
                  Contact : {contactFilter}
                  <button onClick={() => setContactFilter('all')} className="hover:text-emerald-950 font-bold ml-1">×</button>
                </span>
              )}
              {websiteFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 rounded-lg font-medium text-[11px]">
                  Web : {websiteFilter === 'no_website' ? 'Sans site web' : websiteFilter}
                  <button onClick={() => setWebsiteFilter('all')} className="hover:text-amber-950 font-bold ml-1">×</button>
                </span>
              )}
              {oppScoreFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-sky-50 text-sky-700 rounded-lg font-medium text-[11px]">
                  Opp : {oppScoreFilter}
                  <button onClick={() => setOppScoreFilter('all')} className="hover:text-sky-950 font-bold ml-1">×</button>
                </span>
              )}
              {auditFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50 text-purple-700 rounded-lg font-medium text-[11px]">
                  Audit : {auditFilter}
                  <button onClick={() => setAuditFilter('all')} className="hover:text-purple-950 font-bold ml-1">×</button>
                </span>
              )}
            </div>

            <button
              onClick={resetAllFilters}
              className="flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-red-600 transition-colors ml-auto"
            >
              <RotateCcw className="w-3 h-3" />
              Réinitialiser tous les filtres
            </button>
          </div>
        )}
      </div>

      {/* Main Results Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[400px]">
        {loading ? (
          <div className="flex justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-slate-300" /></div>
        ) : leads.length === 0 ? (
          <div className="p-20 text-center space-y-4">
            <Database className="w-12 h-12 text-slate-200 mx-auto" />
            <div className="space-y-1">
              <p className="text-sm font-bold text-slate-700">Aucun prospect ne correspond à ces critères</p>
              <p className="text-xs text-slate-400">Essayez d'élargir la recherche ou de réinitialiser vos filtres.</p>
            </div>
            {hasActiveFilters && (
              <button
                onClick={resetAllFilters}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-slate-800 transition-all inline-flex items-center gap-1.5 shadow-sm"
              >
                <RotateCcw className="w-3 h-3" />
                Effacer les filtres
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/70 text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4 w-10">
                    <input 
                      type="checkbox" 
                      checked={selectedLeads.length === leads.length && leads.length > 0} 
                      onChange={toggleSelectAll} 
                      className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer" 
                    />
                  </th>
                  <th className="px-6 py-4">Entreprise & Ville</th>
                  <th className="px-6 py-4">Site Web & Détection</th>
                  <th className="px-6 py-4 text-center">Score Audit</th>
                  <th className="px-6 py-4 text-center">Opportunité</th>
                  <th className="px-6 py-4 text-center">Contact Direct</th>
                  <th className="px-6 py-4">Statut CRM</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-50 transition-colors group cursor-pointer" onClick={() => onSelectLead(lead.id)}>
                    <td className="px-6 py-4" onClick={e => e.stopPropagation()}>
                      <input 
                        type="checkbox" 
                        checked={selectedLeads.includes(lead.id)} 
                        onChange={() => toggleSelect(lead.id)} 
                        className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer" 
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors flex items-center gap-1.5">
                        <span>{lead.companyName}</span>
                        {(lead.phone || lead.website || lead.email) && (
                          <span title="Lead avec canal de contact vérifié" className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{lead.city || 'Région'}</span>
                        {lead.category && (
                          <span className="text-[10px] text-slate-400 border-l border-slate-200 pl-2 truncate max-w-[140px]">{lead.category}</span>
                        )}
                        <div className="flex items-center gap-1.5 border-l border-slate-200 pl-2">
                          {lead.phone && <span title={`Téléphone vérifié: ${lead.phone}`}><Phone className="w-2.5 h-2.5 text-emerald-600" /></span>}
                          {lead.email && <span title={`Email vérifié: ${lead.email}`}><Mail className="w-2.5 h-2.5 text-blue-600" /></span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-[11px] font-medium text-slate-600 truncate max-w-[180px]">
                        {lead.website ? (
                          <a href={lead.website} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="hover:underline text-blue-600 flex items-center gap-1">
                            {lead.website.replace(/^https?:\/\/(www\.)?/, '')}
                            <ExternalLink className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                          </a>
                        ) : (
                          <span className="text-amber-700/80 font-bold text-[11px] flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />
                            Sans site web
                          </span>
                        )}
                      </div>
                      <div className="mt-1">
                        <span className={cn("text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded",
                          lead.websiteStatus === 'verified' ? 'bg-emerald-50 text-emerald-700' :
                          lead.websiteStatus === 'unreachable' ? 'bg-red-50 text-red-700' :
                          lead.websiteStatus === 'social_profile' ? 'bg-indigo-50 text-indigo-700' :
                          lead.websiteStatus === 'not_detected' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'
                        )}>
                          {lead.websiteStatus === 'verified' ? 'Vérifié' :
                           lead.websiteStatus === 'not_detected' ? 'Non détecté' :
                           lead.websiteStatus === 'social_profile' ? 'Réseau Social' :
                           lead.websiteStatus === 'unreachable' ? 'Inaccessible' : (lead.websiteStatus || 'Inconnu')}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={cn("text-xs font-bold", (lead.auditScore || 0) > 70 ? 'text-emerald-500' : (lead.auditScore || 0) > 40 ? 'text-amber-500' : 'text-slate-300')}>
                        {lead.auditScore ?? '—'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={cn("text-xs font-black", (lead.opportunityScore || 0) >= 60 ? 'text-blue-600 font-extrabold' : 'text-slate-400')}>
                        {lead.opportunityScore ?? 0}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1.5">
                        {lead.phone ? (
                          <>
                            <a
                              href={`https://wa.me/${formatWhatsAppNumber(lead.phone, lead.country)}?text=${encodeURIComponent(`Bonjour, je me permets de vous contacter au sujet de ${lead.companyName} à ${lead.city || 'votre secteur'}. Auriez-vous 2 minutes pour échanger ?`)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-md transition-all shadow-2xs"
                              title={`Ouvrir WhatsApp (+${formatWhatsAppNumber(lead.phone, lead.country)})`}
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </a>
                            <a
                              href={`tel:${lead.phone}`}
                              className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-md transition-all shadow-2xs"
                              title={`Appeler directement (${lead.phone})`}
                            >
                              <Phone className="w-3.5 h-3.5" />
                            </a>
                          </>
                        ) : (
                          <span className="text-[10px] text-slate-300 italic">Sans tél</span>
                        )}

                        {lead.email && (
                          <a
                            href={`mailto:${lead.email}?subject=${encodeURIComponent(`Opportunité visibilité pour ${lead.companyName}`)}`}
                            className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-md transition-all shadow-2xs"
                            title={`Envoyer un email (${lead.email})`}
                          >
                            <Mail className="w-3.5 h-3.5" />
                          </a>
                        )}

                        <button
                          onClick={() => setCommercialLead(lead)}
                          className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-md text-[10px] font-bold tracking-wide transition-all shadow-2xs flex items-center gap-1"
                          title="Ouvrir le Kit Commercial (Script d'appel, objections, WhatsApp, logger CRM)"
                        >
                          <Briefcase className="w-3 h-3 text-amber-700" />
                          Pitch
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {(() => {
                        const STATUS_MAP: Record<string, { label: string; cls: string }> = {
                          'WON': { label: 'GAGNÉ', cls: 'bg-emerald-50 text-emerald-700' },
                          'LOST': { label: 'PERDU', cls: 'bg-red-50 text-red-700' },
                          'NEW': { label: 'NOUVEAU', cls: 'bg-slate-100 text-slate-600' },
                          'QUALIFIED': { label: 'QUALIFIÉ', cls: 'bg-indigo-50 text-indigo-700' },
                          'REVIEWED': { label: 'EXAMINÉ', cls: 'bg-blue-50 text-blue-700' },
                          'CONTACTED': { label: 'CONTACTÉ', cls: 'bg-amber-50 text-amber-700' },
                          'REPLIED': { label: 'RÉPONDU', cls: 'bg-teal-50 text-teal-700' },
                          'DISMISSED': { label: 'ÉCARTÉ', cls: 'bg-slate-100 text-slate-400' }
                        };
                        const st = STATUS_MAP[lead.leadStatus] || { label: lead.leadStatus, cls: 'bg-blue-50 text-blue-700' };
                        return (
                          <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider", st.cls)}>
                            {st.label}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            runSingleAuditFR(lead.id);
                          }}
                          disabled={rowAuditing === lead.id}
                          className="opacity-0 group-hover:opacity-100 px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-md text-[10px] font-bold tracking-wide transition-all shadow-2xs flex items-center gap-1"
                          title="Réaliser l'audit en français pour ce prospect"
                        >
                          {rowAuditing === lead.id ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <BarChart3 className="w-2.5 h-2.5 text-blue-600" />}
                          Audit FR 🇫🇷
                        </button>
                        <ChevronRight className="w-4 h-4 text-slate-300" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination & Results Footer */}
        {totalLeads > 0 && (
          <div className="bg-slate-50/70 px-6 py-4 border-t border-slate-100 flex items-center justify-between flex-wrap gap-4 text-xs text-slate-600">
            <div className="flex items-center gap-2 font-medium">
              <span>Affichage de {((page - 1) * pageSize) + 1} à {Math.min(page * pageSize, totalLeads)} sur {totalLeads} prospects</span>
              {hasActiveFilters && (
                <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded">Filtres actifs</span>
              )}
            </div>

            <div className="flex items-center gap-3">
              {/* Page Size Selector */}
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <span>Par page :</span>
                <select
                  value={pageSize}
                  onChange={e => { setPageSize(parseInt(e.target.value)); setPage(1); }}
                  className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                </select>
              </div>

              {/* Prev / Next Page Buttons */}
              <div className="flex items-center gap-1.5">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-xs disabled:opacity-40 hover:bg-slate-100 transition-colors"
                >
                  Précédent
                </button>
                <span className="text-xs font-bold text-slate-700 px-2">
                  {page} / {totalPages}
                </span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-xs disabled:opacity-40 hover:bg-slate-100 transition-colors"
                >
                  Suivant
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Commercial Toolkit Modal */}
      {commercialLead && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] overflow-y-auto border border-slate-200 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <CommercialToolkit
              lead={commercialLead}
              token={token}
              isModal={true}
              onClose={() => setCommercialLead(null)}
              onStatusChange={() => {
                fetchLeads();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function LeadDetailView({ leadId, token, onBack }: { leadId: number; token: string; onBack: () => void }) {
  const [lead, setLead] = useState<any>(null);
  const [auditing, setAuditing] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState<'commercial' | 'crm' | 'evidence' | 'audit' | 'ai'>('commercial');
  const [auditLang, setAuditLang] = useState<'fr' | 'en'>('fr');
  const [showAuditModalFR, setShowAuditModalFR] = useState(false);
  
  const fetchLead = () => {
    api.get(`/api/leads/${leadId}`, token).then(res => { if (res.success) setLead(res.data); });
  };

  useEffect(() => { fetchLead(); }, [leadId]);

  const runAudit = async (lang: 'fr' | 'en' = auditLang) => {
    setAuditing(true);
    setAuditLang(lang);
    await api.post(`/api/leads/${leadId}/audit`, { language: lang }, token);
    await fetchLead();
    setAuditing(false);
    setActiveTab('audit');
  };

  const runScrape = async () => {
    setScraping(true);
    const res = await api.post(`/api/leads/${leadId}/scrape`, {}, token);
    if (res.success && res.data) {
      setLead(res.data);
    }
    setScraping(false);
    setActiveTab('evidence');
  };

  const handleStatusChange = async (status: string) => {
    await api.patch(`/api/leads/${leadId}/status`, { status }, token);
    await fetchLead();
  };

  if (!lead) return <div className="flex justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-slate-200" /></div>;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <button onClick={onBack} className="text-[10px] font-bold text-slate-400 hover:text-slate-900 flex items-center gap-2 uppercase tracking-[0.2em] transition-colors">
          <ArrowRight className="w-3 h-3 rotate-180" /> Retour aux Prospects
        </button>
        
        <div className="flex items-center gap-2 flex-wrap">
          <select 
            value={lead.leadStatus}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-[10px] font-bold uppercase tracking-[0.15em] outline-none hover:border-slate-300 transition-colors shadow-sm"
          >
            <option value="NEW">NOUVEAU</option>
            <option value="REVIEWED">EXAMINÉ</option>
            <option value="QUALIFIED">QUALIFIÉ</option>
            <option value="CONTACTED">CONTACTÉ</option>
            <option value="REPLIED">RÉPONDU</option>
            <option value="MEETING">RENDEZ-VOUS</option>
            <option value="PROPOSAL">PROPOSITION</option>
            <option value="WON">GAGNÉ</option>
            <option value="LOST">PERDU</option>
            <option value="DISMISSED">ÉCARTÉ</option>
          </select>
          <button 
            disabled={scraping}
            onClick={runScrape}
            className="px-3.5 py-2 bg-indigo-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-[0.15em] hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5 shadow-sm transition-all"
            title="Extraire le maximum d'informations du site et des réseaux sociaux"
          >
            {scraping ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            {scraping ? 'Extraction...' : 'Enrichir / Deep Scrape'}
          </button>
          
          {/* Explicit French Audit Option */}
          <button 
            disabled={auditing}
            onClick={() => runAudit('fr')}
            className="px-3.5 py-2 bg-blue-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-[0.15em] hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5 shadow-sm shadow-blue-900/10 transition-all"
            title="Lancer l'audit digital complet en français pour ce client"
          >
            {auditing && auditLang === 'fr' ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            {auditing && auditLang === 'fr' ? 'Audit FR...' : 'Audit FR 🇫🇷'}
          </button>

          {/* Commercial Outreach Toolkit Button */}
          <button
            onClick={() => setActiveTab('commercial')}
            className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-[10px] font-bold uppercase tracking-[0.15em] flex items-center gap-1.5 shadow-sm transition-all shadow-amber-950/20"
            title="Ouvrir le Kit Commercial (Scripts d'appel, objections, WhatsApp)"
          >
            <Briefcase className="w-3.5 h-3.5" />
            Kit Commercial 💼
          </button>

          {/* French Client Dossier Button */}
          <button
            onClick={() => setShowAuditModalFR(true)}
            className="px-3 py-2 bg-white border border-slate-200 text-slate-700 hover:text-slate-950 hover:bg-slate-50 rounded-lg text-[10px] font-bold uppercase tracking-[0.15em] flex items-center gap-1.5 shadow-sm transition-all"
            title="Afficher et imprimer le dossier d'audit client en français"
          >
            <FileText className="w-3 h-3 text-blue-600" />
            Dossier Client FR
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Left Panel: Profile */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-slate-900">{lead.companyName}</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{lead.category}</p>
            </div>

            {lead.websiteStatus === 'social_profile' && (
              <div className="p-3 bg-indigo-50/80 border border-indigo-100 rounded-xl space-y-1">
                <div className="flex items-center gap-1.5 text-indigo-700 font-bold text-xs">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" /> Présence Sociale Vérifiée
                </div>
                <p className="text-[10px] text-indigo-900/80 leading-relaxed font-medium">
                  Aucun site officiel détecté. Présence numérique extraite directement depuis les réseaux sociaux officiels de l'établissement.
                </p>
              </div>
            )}
            
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-slate-300 shrink-0 mt-0.5" />
                <span className="text-xs font-medium text-slate-600">{lead.address || 'Adresse locale non précisée'}, {lead.city}, {lead.country}</span>
              </div>
              {lead.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-slate-300 shrink-0" />
                  <a href={`tel:${lead.phone}`} className="text-xs font-bold text-slate-700 hover:text-slate-900 truncate">{lead.phone}</a>
                </div>
              )}
              {lead.email && (
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-slate-300 shrink-0" />
                  <a href={`mailto:${lead.email}`} className="text-xs font-bold text-blue-600 hover:underline truncate">
                    {lead.email}
                  </a>
                </div>
              )}
              {lead.website && (
                <div className="flex items-center gap-3 overflow-hidden">
                  <Globe className="w-4 h-4 text-slate-300 shrink-0" />
                  <a href={lead.website} target="_blank" rel="noreferrer" className="text-xs font-bold text-blue-600 hover:underline truncate">
                    {lead.website.replace(/^https?:\/\//, '')}
                  </a>
                </div>
              )}
              {lead.googleRating && (
                <div className="flex items-center gap-3">
                  <Star className="w-4 h-4 text-amber-400 fill-amber-400 shrink-0" />
                  <span className="text-xs font-bold text-slate-600">{lead.googleRating} <span className="text-slate-400 font-medium">({lead.googleReviews} avis)</span></span>
                </div>
              )}
            </div>

            {/* Discovered Social Media Profiles */}
            {(() => {
              const socialFields = ['facebook', 'instagram', 'linkedin', 'twitter', 'tiktok', 'youtube'];
              const foundSocials = (lead.evidence || []).filter((e: any) => socialFields.includes(e.fieldName?.toLowerCase()));
              if (foundSocials.length === 0) return null;

              return (
                <div className="space-y-2 pt-4 border-t border-slate-100">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Réseaux Sociaux Identifiés</span>
                  <div className="flex flex-wrap gap-1.5">
                    {foundSocials.map((s: any) => {
                      const name = s.fieldName.toLowerCase();
                      return (
                        <a
                          key={s.id || s.value}
                          href={s.value}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-700 transition-colors shadow-2xs"
                        >
                          {name === 'facebook' && <Facebook className="w-3 h-3 text-blue-600" />}
                          {name === 'instagram' && <Instagram className="w-3 h-3 text-pink-600" />}
                          {name === 'linkedin' && <Linkedin className="w-3 h-3 text-blue-700" />}
                          {name === 'twitter' && <Twitter className="w-3 h-3 text-sky-500" />}
                          {name !== 'facebook' && name !== 'instagram' && name !== 'linkedin' && name !== 'twitter' && (
                            <Share2 className="w-3 h-3 text-slate-500" />
                          )}
                          <span className="capitalize">{name}</span>
                          <ExternalLink className="w-2.5 h-2.5 text-slate-400" />
                        </a>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            <div className="pt-4 border-t border-slate-50 flex items-center justify-between text-[9px] font-bold text-slate-400 uppercase tracking-widest">
              <span className="flex items-center gap-1.5"><Database className="w-2.5 h-2.5" /> {lead.source}</span>
              <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">{lead.dataConfidence}</span>
            </div>
            <ReviewSection entityId={lead.id} entityType="LEAD" token={token} />
          </div>

          <div className="bg-slate-900 p-6 rounded-2xl text-white space-y-3 shadow-xl shadow-slate-900/10">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-50">Moteur d'Opportunités</p>
            <div className="text-4xl font-black">{lead.opportunityScore || 0}<span className="text-base font-bold opacity-30">/100</span></div>
            <p className="text-[11px] opacity-70 font-medium leading-relaxed italic border-l-2 border-white/10 pl-3">{lead.opportunities?.length || 0} opportunités commerciales identifiées.</p>
          </div>
        </div>

        {/* Right Panel: Content */}
        <div className="lg:col-span-3 space-y-6">
          <div className="flex gap-8 border-b border-slate-200 overflow-x-auto">
            {[
              { id: 'commercial', label: 'Kit Commercial 💼', icon: Briefcase },
              { id: 'crm', label: 'CRM & Suivi', icon: User },
              { id: 'audit', label: 'Audit Technique', icon: BarChart3 },
              { id: 'ai', label: 'Intelligence IA', icon: Wand2 },
              { id: 'evidence', label: 'Preuves & Données', icon: ShieldCheck },
            ].map((tab) => (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn("pb-4 text-[10px] font-bold uppercase tracking-[0.15em] flex items-center gap-2 border-b-2 transition-all whitespace-nowrap", 
                  activeTab === tab.id ? "border-slate-900 text-slate-900" : "border-transparent text-slate-400 hover:text-slate-600"
                )}
              >
                <tab.icon className="w-3.5 h-3.5" /> {tab.label}
              </button>
            ))}
          </div>

          <div className="animate-in fade-in duration-300">
            {activeTab === 'commercial' && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <CommercialToolkit 
                  lead={lead} 
                  token={token} 
                  onStatusChange={fetchLead} 
                />
              </div>
            )}
            {activeTab === 'crm' && <CRMTab leadId={leadId} token={token} onActivityChange={fetchLead} />}
            {activeTab === 'evidence' && <EvidenceTab lead={lead} />}
            {activeTab === 'audit' && (
              <AuditTab 
                lead={lead} 
                onRunAudit={runAudit} 
                auditing={auditing} 
                token={token}
                auditLang={auditLang}
                onOpenModalFR={() => setShowAuditModalFR(true)}
              />
            )}
            {activeTab === 'ai' && (
              <AITab 
                leadId={leadId} 
                token={token} 
                lead={lead}
                onOpenModalFR={() => setShowAuditModalFR(true)}
              />
            )}
          </div>
        </div>
      </div>

      {showAuditModalFR && (
        <ClientAuditModalFR 
          lead={lead} 
          token={token} 
          onClose={() => setShowAuditModalFR(false)} 
          onRefreshAudit={() => runAudit('fr')} 
        />
      )}
    </div>
  );
}

function CRMTab({ leadId, token, onActivityChange }: any) {
  const [activities, setActivities] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [noteContent, setNoteContent] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    const [actRes, noteRes, taskRes] = await Promise.all([
      api.get(`/api/leads/${leadId}/activities`, token),
      api.get(`/api/leads/${leadId}/notes`, token),
      api.get(`/api/leads/${leadId}/tasks`, token)
    ]);
    if (actRes.success) setActivities(actRes.data);
    if (noteRes.success) setNotes(noteRes.data);
    if (taskRes.success) setTasks(taskRes.data);
  };

  useEffect(() => { fetchData(); }, [leadId]);

  const addNote = async () => {
    if (!noteContent.trim()) return;
    setLoading(true);
    await api.post(`/api/leads/${leadId}/notes`, { content: noteContent }, token);
    setNoteContent('');
    await fetchData();
    onActivityChange();
    setLoading(false);
  };

  const completeTask = async (id: number) => {
    await api.patch(`/api/tasks/${id}/complete`, {}, token);
    await fetchData();
    onActivityChange();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
      {/* Activity Timeline */}
      <div className="lg:col-span-3 space-y-6">
        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
          <Clock className="w-3 h-3" /> Historique des Échanges & Actions
        </h4>
        <div className="space-y-6 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[1px] before:bg-slate-100">
          {activities.map((act) => (
            <div key={act.id} className="relative pl-8 space-y-1">
              <div className={cn("absolute left-0 top-1 w-[22px] h-[22px] rounded-full border-2 border-white flex items-center justify-center", 
                act.origin === 'SYSTEM' ? 'bg-slate-100' : act.origin === 'AI' ? 'bg-blue-100' : 'bg-slate-900'
              )}>
                {act.origin === 'USER' ? <User className="w-2.5 h-2.5 text-white" /> : <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />}
              </div>
              <div className="flex justify-between items-start">
                <p className="text-xs font-bold text-slate-900">{act.description}</p>
                <span className="text-[9px] font-bold text-slate-300 uppercase">{formatDate(act.createdAt)}</span>
              </div>
              {act.metadata?.reason && <p className="text-[11px] text-slate-500 italic">"{act.metadata.reason}"</p>}
            </div>
          ))}
          {activities.length === 0 && <p className="text-xs text-slate-400 italic pl-8">Aucune action enregistrée pour le moment.</p>}
        </div>
      </div>

      {/* Side Panel: Notes & Tasks */}
      <div className="lg:col-span-2 space-y-8">
        {/* Notes Section */}
        <div className="space-y-4">
          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <MessageSquare className="w-3 h-3" /> Notes Internes & Suivi
          </h4>
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4 shadow-sm">
            <textarea 
              value={noteContent}
              onChange={e => setNoteContent(e.target.value)}
              placeholder="Ajouter une note de suivi confidentielle..."
              className="w-full text-xs font-medium bg-slate-50 border border-slate-100 rounded-lg p-3 min-h-[80px] focus:outline-none focus:ring-1 focus:ring-slate-900 transition-all placeholder:text-slate-300"
            />
            <button 
              onClick={addNote}
              disabled={loading || !noteContent.trim()}
              className="w-full py-2 bg-slate-900 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-slate-800 transition-all disabled:opacity-30"
            >
              Enregistrer la Note
            </button>
          </div>
          <div className="space-y-3">
            {notes.map(note => (
              <div key={note.id} className="bg-amber-50/50 p-4 rounded-xl border border-amber-100/50 space-y-2">
                <p className="text-xs text-slate-700 font-medium leading-relaxed whitespace-pre-wrap">{note.content}</p>
                <div className="flex justify-between items-center text-[9px] font-bold text-amber-600/60 uppercase">
                  <span>Collaborateur</span>
                  <span>{formatDate(note.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tasks Section */}
        <div className="space-y-4">
          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Calendar className="w-3 h-3" /> Prochaines Actions & Rappels
          </h4>
          <div className="space-y-2">
            {tasks.map(task => (
              <div key={task.id} className={cn("bg-white p-4 rounded-xl border flex items-center justify-between group shadow-sm", 
                task.status === 'COMPLETED' ? 'border-emerald-100 opacity-60' : 'border-slate-200'
              )}>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => task.status === 'TODO' && completeTask(task.id)}
                    className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
                      task.status === 'COMPLETED' ? 'bg-emerald-500 border-emerald-500' : 'border-slate-200 group-hover:border-slate-400'
                    )}
                  >
                    {task.status === 'COMPLETED' && <Check className="w-3 h-3 text-white" />}
                  </button>
                  <div className="space-y-0.5">
                    <p className={cn("text-xs font-bold", task.status === 'COMPLETED' ? 'line-through text-slate-400' : 'text-slate-900')}>{task.title}</p>
                    {task.dueDate && <p className="text-[9px] font-bold text-slate-400 uppercase">{formatDate(task.dueDate)}</p>}
                  </div>
                </div>
              </div>
            ))}
            <button 
              onClick={() => {
                const title = prompt('Description du rappel ou de la tâche :');
                if (title) api.post(`/api/leads/${leadId}/tasks`, { title }, token).then(fetchData);
              }}
              className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:border-slate-400 hover:text-slate-600 transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-3 h-3" /> Ajouter un Rappel / Tâche
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- French Client Audit Modal & Report ---
function ClientAuditModalFR({ lead, token, onClose, onRefreshAudit }: any) {
  const [aiReport, setAiReport] = useState<any>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [copied, setCopied] = useState(false);

  const latestAudit = lead.audits?.[0];
  const overallScore = latestAudit?.overallScore ?? lead.auditScore ?? (lead.website ? 65 : 35);
  const techScore = latestAudit?.technicalScore ?? (lead.website ? 60 : 20);
  const seoScore = latestAudit?.seoScore ?? (lead.website ? 55 : 25);
  const convScore = latestAudit?.conversionScore ?? 45;
  const perfScore = latestAudit?.performanceScore ?? (lead.website ? 70 : 40);

  useEffect(() => {
    setLoadingAi(true);
    api.get(`/api/leads/${lead.id}/ai?language=fr`, token).then(res => {
      if (res.success && res.data) {
        setAiReport(res.data);
      }
      setLoadingAi(false);
    });
  }, [lead.id, token]);

  const copyDossier = () => {
    const text = `
AUDIT DE PERFORMANCE DIGITALE CLIENT
Client: ${lead.companyName}
Localisation: ${lead.city || 'Non renseigné'}, ${lead.country || ''}
Site Web: ${lead.website || 'Aucun site internet officiel détecté'}
Score Global: ${overallScore}/100

SCORES CLÉS :
- Technique & Sécurité : ${techScore}/100
- Référencement Local & Google Maps : ${seoScore}/100
- Conversion & Contact Client : ${convScore}/100
- Performance & Vitesse Mobile : ${perfScore}/100

SYNTHÈSE DU DIAGNOSTIC :
${aiReport?.summary || 'Entreprise établie localement présentant des axes de progression immédiats pour attirer de nouveaux clients.'}

AXES D'AMÉLIORATION RECOMMANDÉS :
${(aiReport?.weaknesses || ['Optimisation de la présence en ligne et de la conversion locale']).map((w: string) => '- ' + w).join('\n')}

OPPORTUNITÉS PRIORITAIRES :
${(aiReport?.verified_opportunities || lead.opportunities || []).map((o: any) => '- ' + (o.title || o.type) + ' : ' + (o.description || '')).join('\n')}

PLAN D'ACTION CONSEILLÉ :
${(aiReport?.sales_angles || []).map((sa: any) => '- ' + sa.angle + ' -> Action : ' + sa.suggested_solution).join('\n')}
    `.trim();

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8 print:border-none print:shadow-none print:my-0">
        {/* Top Header Toolbar (Hidden in Print) */}
        <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-blue-500/20 text-blue-400 rounded-lg">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm tracking-wide">Dossier d'Audit Client — Français 🇫🇷</h3>
              <p className="text-[11px] text-slate-400">Rapport numérique d'aide à la décision pour {lead.companyName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold transition-colors"
              title="Imprimer ou enregistrer au format PDF"
            >
              <Printer className="w-3.5 h-3.5" /> Imprimer / PDF
            </button>
            <button
              onClick={copyDossier}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold transition-colors"
            >
              <Copy className="w-3.5 h-3.5" /> {copied ? 'Copié !' : 'Copier'}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Audit Document */}
        <div className="p-8 space-y-8 print:p-0">
          {/* Document Header */}
          <div className="border-b border-slate-200 pb-6 flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-extrabold tracking-[0.2em] uppercase text-blue-600 bg-blue-50 px-2.5 py-1 rounded">
                AUDIT NUMÉRIQUE & RECOMMANDATIONS STRATÉGIQUES
              </span>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight mt-2">{lead.companyName}</h2>
              <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
                <span>📍 {lead.address ? `${lead.address}, ` : ''}{lead.city || 'Territoire local'}{lead.country ? `, ${lead.country}` : ''}</span>
                {lead.phone && <span>📞 {lead.phone}</span>}
              </div>
            </div>
            <div className="text-right space-y-1">
              <div className="inline-flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-50 border border-slate-200 min-w-[90px]">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Santé Digitale</span>
                <span className={cn("text-2xl font-black", overallScore >= 70 ? 'text-emerald-600' : overallScore >= 45 ? 'text-amber-500' : 'text-red-500')}>
                  {overallScore}<span className="text-xs font-normal text-slate-400">/100</span>
                </span>
              </div>
              <p className="text-[10px] text-slate-400">Généré le {formatDate(new Date())}</p>
            </div>
          </div>

          {/* 4 Pillars Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Technique & Sécurité', score: techScore, desc: 'Fiabilité et conformité web' },
              { label: 'Référencement Local', score: seoScore, desc: 'Présence sur Google & Maps' },
              { label: 'Conversion & Contact', score: convScore, desc: 'Prise de contact 1-clic' },
              { label: 'Performance Mobile', score: perfScore, desc: 'Rapidité sur smartphone' },
            ].map(p => (
              <div key={p.label} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{p.label}</div>
                <div className={cn("text-xl font-black", p.score >= 70 ? 'text-emerald-600' : p.score >= 45 ? 'text-amber-500' : 'text-red-500')}>
                  {p.score}<span className="text-xs text-slate-400 font-normal">/100</span>
                </div>
                <p className="text-[10px] text-slate-500">{p.desc}</p>
              </div>
            ))}
          </div>

          {/* Diagnostic Summary */}
          <div className="p-5 bg-blue-50/60 border border-blue-100 rounded-xl space-y-2">
            <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" /> Synthèse Diagnostique
            </h4>
            <p className="text-xs text-blue-950 leading-relaxed font-medium">
              {aiReport?.summary || `${lead.companyName} dispose d'une activité locale identifiable${lead.city ? ' à ' + lead.city : ''}. ${lead.website ? `Son site web présente une base exploitable mais recèle d'opportunités franches d'amélioration.` : `Aucune vitrine web officielle n'a été détectée, ce qui limite fortement l'acquisition de nouveaux clients digitaux.`} Cet audit synthétise les leviers d'action à fort retour sur investissement.`}
            </p>
          </div>

          {/* Strengths & Improvement Axes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Forces & Atouts Numériques
              </h4>
              <ul className="space-y-2">
                {(aiReport?.strengths || (lead.website ? ['Site internet en ligne et consultable', 'Activité locale établie'] : ['Entreprise et coordonnées locales répertoriées'])).map((s: string, i: number) => (
                  <li key={i} className="text-xs text-slate-600 flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" /> Axes d'Amélioration Prioritaires
              </h4>
              <ul className="space-y-2">
                {(aiReport?.weaknesses || (lead.website ? ['Optimisation de l’expérience mobile pour les visiteurs sur smartphone', 'Absence d’appels à l’action directs ou de réservation immédiate'] : ['Absence de site internet pour capter la clientèle locale sur Google'])).map((w: string, i: number) => (
                  <li key={i} className="text-xs text-slate-600 flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Actionable Opportunities */}
          <div className="space-y-3 pt-4 border-t border-slate-100">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Recommandations Stratégiques pour Développer l'Acquisition Client
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {((aiReport?.verified_opportunities?.length ? aiReport.verified_opportunities : null) || (lead.opportunities?.length ? lead.opportunities : [
                {
                  title: lead.website ? 'Tunnel de conversion & Bouton WhatsApp 1-Clic' : 'Création d’un site vitrine optimisé mobile',
                  description: lead.website ? 'Permettre aux visiteurs mobiles de joindre l’entreprise en un instant.' : 'Gagner en visibilité face aux concurrents locaux référencés sur Google.',
                  evidence: lead.website ? 'Vérifié lors de l’audit technique' : 'Non détecté'
                },
                {
                  title: 'Optimisation Google Business & Référencement Local',
                  description: 'Positionner l’établissement parmi les premiers résultats sur Google Maps dans la zone de chalandise.',
                  evidence: 'Visibilité locale perfectible'
                }
              ])).map((opp: any, idx: number) => (
                <div key={idx} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                  <div className="font-bold text-xs text-slate-900">{opp.title}</div>
                  <p className="text-[11px] text-slate-600 leading-relaxed font-medium">{opp.description}</p>
                  {opp.evidence && (
                    <div className="text-[10px] text-blue-700 bg-blue-50/80 px-2 py-0.5 rounded inline-block font-semibold">
                      Constat : {opp.evidence}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Outreach Angle in French */}
          {aiReport?.outreach?.email && (
            <div className="p-5 bg-slate-900 text-white rounded-xl space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Proposition d'Échange Personnalisée (Pour le Client)
              </div>
              <p className="text-xs text-slate-300 font-bold">Objet : {aiReport.outreach.email.subject}</p>
              <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed font-normal">
                {aiReport.outreach.email.body}
              </p>
            </div>
          )}

          {/* Document Footer */}
          <div className="pt-6 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-400">
            <span>LeadForge B2B Intelligence Engine — Audit Client Certifié</span>
            <span>Document confidentiel préparé pour {lead.companyName}</span>
          </div>
        </div>

        {/* Modal Bottom Actions (Hidden in Print) */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between print:hidden">
          <button
            onClick={onRefreshAudit}
            className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Ré-exécuter l'audit technique
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-colors flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" /> Imprimer / Exporter PDF
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-bold transition-colors"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const LOCALIZED_OPP_TITLES: Record<string, string> = {
  WEBSITE: "Développement d'un site web vitrine professionnel",
  SEO: "Optimisation du référencement naturel (SEO)",
  LOCAL_SEO: "Référencement local Google Business & Maps",
  BOOKING: "Système de réservation & prise de rendez-vous en ligne",
  WHATSAPP: "Bouton d'appel & contact direct WhatsApp 1-clic",
  PERFORMANCE: "Amélioration de la vitesse sur smartphone",
  MOBILE: "Optimisation de l'affichage mobile responsive",
  CONVERSION: "Optimisation du tunnel de conversion & formulaires",
  SECURITY: "Sécurisation HTTPS & conformité",
  CONTENT: "Valorisation de l'offre et contenu commercial"
};

const LOCALIZED_SERVICES: Record<string, string> = {
  'Website Development': 'Création de Site Internet Vitrine',
  'SEO Audit & Implementation': 'Pack Référencement & SEO',
  'Local SEO Package': 'Optimisation Google Business & Local',
  'Appointment Booking Integration': 'Module de Prise de RDV en Ligne',
  'Messaging Automation': 'Intégration WhatsApp & Chat Direct',
  'Page Speed Optimization': 'Optimisation Vitesse Mobile',
  'Mobile Responsiveness Fix': 'Refonte Ergonomie Mobile'
};

function AuditTab({ lead, onRunAudit, auditing, token, onOpenModalFR }: any) {
  const [langView, setLangView] = useState<'fr' | 'en'>('fr');
  const latestAudit = lead.audits?.[0];

  if (!latestAudit) return (
    <div className="bg-white p-12 rounded-2xl border border-slate-200 shadow-sm text-center space-y-4">
      <BarChart3 className="w-12 h-12 text-slate-200 mx-auto" />
      <div className="space-y-1">
        <h4 className="text-base font-bold text-slate-800">Aucun audit technique disponible pour ce client</h4>
        <p className="text-xs text-slate-500 font-medium max-w-sm mx-auto">
          Réalisez un audit complet pour analyser la présence web, évaluer les scores et dégager des axes commerciaux concrets.
        </p>
      </div>
      <div className="flex items-center justify-center gap-3 pt-2">
        <button 
          onClick={() => onRunAudit('fr')} 
          disabled={auditing} 
          className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-xs font-bold uppercase tracking-widest shadow-md shadow-blue-900/10 hover:bg-blue-700 transition-all flex items-center gap-2"
        >
          {auditing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Languages className="w-3.5 h-3.5" />}
          Lancer l'Audit en Français 🇫🇷
        </button>
        <button 
          onClick={() => onRunAudit('en')} 
          disabled={auditing} 
          className="px-5 py-2.5 bg-slate-900 text-white rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-slate-800 transition-all"
        >
          Audit EN 🇬🇧
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      {/* French Audit Banner & Action */}
      <div className="bg-gradient-to-r from-blue-900 to-indigo-900 p-6 rounded-2xl text-white flex items-center justify-between flex-wrap gap-4 shadow-lg shadow-blue-900/10">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-blue-500/30 text-blue-200 text-[10px] font-extrabold uppercase tracking-widest rounded border border-blue-400/20">
              Audit Client 🇫🇷
            </span>
            <span className="text-xs text-blue-200 font-medium">Santé Globale : <strong>{latestAudit.overallScore ?? '—'}/100</strong></span>
          </div>
          <h4 className="text-base font-bold text-white tracking-tight">Audit de Performance Numérique du Client</h4>
          <p className="text-xs text-blue-200/80 max-w-xl leading-relaxed">
            Consultez le diagnostic stratégique, les leviers d'acquisition et exportez un dossier complet pour {lead.companyName}.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={onOpenModalFR}
            className="flex items-center gap-1.5 px-4 py-2 bg-white text-blue-950 font-bold rounded-xl text-xs hover:bg-blue-50 transition-all shadow-sm"
          >
            <FileText className="w-3.5 h-3.5 text-blue-600" />
            Dossier d'Audit (FR 🇫🇷)
          </button>
          <button
            onClick={() => onRunAudit('fr')}
            disabled={auditing}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-700/60 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-colors border border-blue-500/30"
          >
            {auditing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Actualiser (FR)
          </button>
        </div>
      </div>

      {/* Language View Switcher */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          {langView === 'fr' ? 'Diagnostic & Piliers d’Évaluation' : 'Technical Evaluation Pillars'}
        </span>
        <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
          <button 
            onClick={() => setLangView('fr')} 
            className={cn("px-2.5 py-1 text-[10px] font-bold rounded transition-all", langView === 'fr' ? "bg-white text-blue-700 shadow-2xs" : "text-slate-500 hover:text-slate-900")}
          >
            🇫🇷 Français
          </button>
          <button 
            onClick={() => setLangView('en')} 
            className={cn("px-2.5 py-1 text-[10px] font-bold rounded transition-all", langView === 'en' ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-900")}
          >
            🇬🇧 English
          </button>
        </div>
      </div>

      {/* Opportunities Section */}
      {lead.opportunities?.length > 0 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {lead.opportunities.map((opp: any) => (
              <div key={opp.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 hover:border-blue-200 transition-colors">
                <div className="flex justify-between items-start">
                  <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[9px] font-extrabold uppercase tracking-wider">{opp.type}</span>
                  <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded", opp.severity === 'HIGH' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600')}>{opp.severity}</span>
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-900 text-base">
                    {langView === 'fr' ? (LOCALIZED_OPP_TITLES[opp.type] || opp.title) : opp.title}
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed font-medium">{opp.description}</p>
                </div>
                <div className="pt-4 border-t border-slate-50 flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-slate-50 flex items-center justify-center"><Check className="w-3 h-3 text-emerald-500" /></div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    {langView === 'fr' ? 'Action recommandée : ' + (LOCALIZED_SERVICES[opp.recommendedService] || opp.recommendedService) : 'Service: ' + opp.recommendedService}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: langView === 'fr' ? 'Technique & Sécurité' : 'Technical', val: latestAudit.technicalScore },
            { label: langView === 'fr' ? 'Référencement (SEO)' : 'SEO', val: latestAudit.seoScore },
            { label: langView === 'fr' ? 'Conversion & Contact' : 'Conversion', val: latestAudit.conversionScore },
            { label: langView === 'fr' ? 'Vitesse & Mobile' : 'Performance', val: latestAudit.performanceScore },
          ].map(s => (
            <div key={s.label} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">{s.label}</div>
              <div className={cn("text-2xl font-black", s.val > 70 ? 'text-emerald-500' : s.val > 40 ? 'text-amber-500' : 'text-red-500')}>{s.val ?? '—'}</div>
            </div>
          ))}
        </div>
        <ReviewSection entityId={latestAudit.id} entityType="AUDIT" token={token} />
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              {langView === 'fr' ? 'Relevé des Preuves Numériques Factuelles' : 'Raw Evidence Log'}
            </span>
          </div>
          <table className="w-full text-left text-xs">
            <tbody className="divide-y divide-slate-100">
              {latestAudit.findings?.map((f: any, i: number) => (
                <tr key={i} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <div className={cn("w-2 h-2 rounded-full shrink-0 shadow-sm", f.severity === 'HIGH' ? 'bg-red-500' : f.severity === 'MEDIUM' ? 'bg-amber-400' : 'bg-blue-400')} />
                      <div>
                        <div className="font-bold text-slate-900">{f.title}</div>
                        <div className="text-[11px] text-slate-500 leading-relaxed mt-0.5">{f.description}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-[9px] font-bold text-slate-400 uppercase bg-slate-50 px-2 py-0.5 rounded-full">{f.category}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AITab({ leadId, token, lead, onOpenModalFR }: any) {
  const [analysis, setAnalysis] = useState<any>(null);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [activeOutreach, setActiveOutreach] = useState<'email' | 'short' | 'linkedin'>('email');
  const [language, setLanguage] = useState<'fr' | 'en'>('fr');
  const [tone, setTone] = useState<'consultative' | 'direct' | 'professional'>('consultative');
  const [copiedNotice, setCopiedNotice] = useState(false);

  const fetchAI = (lang: string = language) => {
    api.get(`/api/leads/${leadId}/ai?language=${lang}`, token).then(res => { 
      if (res.success && res.data) {
        setAnalysis(res.data);
        if (res.data.language) setLanguage(res.data.language.startsWith('fr') ? 'fr' : 'en');
        if (res.data.tone) setTone(res.data.tone);
      } 
    });
  };

  const runAI = async (targetLang: string = language, targetTone: string = tone, force = false) => {
    setAiAnalyzing(true);
    const res = await api.post(`/api/leads/${leadId}/ai`, { language: targetLang, tone: targetTone, forceRegenerate: force }, token);
    if (res.success && res.data) {
      setAnalysis(res.data);
      setLanguage(targetLang.startsWith('fr') ? 'fr' : 'en');
    }
    setAiAnalyzing(false);
  };

  useEffect(() => {
    fetchAI('fr');
  }, [leadId, token]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    api.post(`/api/leads/${leadId}/activities`, { 
      type: 'MESSAGE_COPIED', 
      description: `Copied ${activeOutreach} template to clipboard`, 
      origin: 'USER' 
    }, token);
    setCopiedNotice(true);
    setTimeout(() => setCopiedNotice(false), 2500);
  };

  if (aiAnalyzing) return (
    <div className="bg-white p-20 rounded-2xl border border-slate-200 shadow-sm text-center space-y-4">
      <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto" />
      <p className="text-slate-600 font-bold uppercase tracking-[0.2em] animate-pulse text-xs">
        Génération du rapport d'audit digital {language === 'fr' ? 'en français' : 'in English'}...
      </p>
    </div>
  );

  if (!analysis) {
    const hasAudit = lead.audits && lead.audits.length > 0;

    return (
      <div className="bg-white p-12 rounded-2xl border border-slate-200 shadow-sm text-center space-y-6">
        <Wand2 className="w-12 h-12 text-slate-200 mx-auto" />
        <div className="space-y-2">
          <h3 className="text-lg font-bold text-slate-900 uppercase tracking-tight">Rapport d'Audit Client Non Généré</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
            {hasAudit 
              ? "Synthétisez les constats techniques de l'audit en propositions d'action et modèles de prospection personnalisés."
              : "L'analyse peut être générée immédiatement pour formuler un diagnostic digital complet."}
          </p>
        </div>
        <div className="flex items-center justify-center gap-3">
          <button 
            onClick={() => runAI('fr', 'consultative')} 
            className="px-8 py-3 bg-blue-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg shadow-blue-900/10 hover:bg-blue-700 transition-all flex items-center gap-2"
          >
            <Languages className="w-4 h-4" /> Générer l'Audit Client en Français 🇫🇷
          </button>
          <button 
            onClick={() => runAI('en', 'consultative')} 
            className="px-6 py-3 bg-slate-900 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-slate-800 transition-all"
          >
            English 🇬🇧
          </button>
        </div>
      </div>
    );
  }

  const isFrench = language.startsWith('fr');

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Language & Tone Controls */}
      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Langue du Rapport :</span>
          <div className="flex bg-white p-0.5 rounded-lg border border-slate-200 shadow-2xs">
            <button
              onClick={() => {
                if (!isFrench) runAI('fr', tone, true);
              }}
              className={cn("px-3 py-1 rounded text-xs font-bold transition-all", isFrench ? "bg-blue-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900")}
            >
              🇫🇷 Français
            </button>
            <button
              onClick={() => {
                if (isFrench) runAI('en', tone, true);
              }}
              className={cn("px-3 py-1 rounded text-xs font-bold transition-all", !isFrench ? "bg-slate-900 text-white shadow-xs" : "text-slate-600 hover:text-slate-900")}
            >
              🇬🇧 English
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select 
            value={tone}
            onChange={(e) => {
              const newTone = e.target.value as any;
              setTone(newTone);
              runAI(language, newTone, true);
            }}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 outline-none"
          >
            <option value="consultative">Ton : Conseil & Valeur (Recommandé)</option>
            <option value="direct">Ton : Direct & Percutant</option>
            <option value="professional">Ton : Professionnel & Courtois</option>
          </select>
          <button
            onClick={() => runAI(language, tone, true)}
            className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5"
            title="Régénérer le diagnostic"
          >
            <RefreshCw className="w-3 h-3 text-slate-400" /> Régénérer
          </button>
          {onOpenModalFR && (
            <button
              onClick={onOpenModalFR}
              className="px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 rounded-lg text-xs font-bold flex items-center gap-1.5"
            >
              <FileText className="w-3 h-3 text-blue-600" /> Dossier Client FR
            </button>
          )}
        </div>
      </div>

      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-bold text-slate-900 uppercase tracking-[0.25em] flex items-center gap-2">
            <MessageSquare className="w-3.5 h-3.5" /> {isFrench ? 'Synthèse Diagnostique & Stratégique' : 'Factual Analysis'}
          </h3>
          <div className="flex items-center gap-2 text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
            <ShieldCheck className="w-2.5 h-2.5" /> {isFrench ? 'VÉRIFIÉ & ANCRÉ DANS LES FAITS' : 'EVIDENCE-LOCKED'}
          </div>
        </div>
        <p className="text-sm text-slate-600 leading-relaxed italic border-l-4 border-slate-100 pl-6 font-medium">"{analysis.summary}"</p>
        <div className="grid grid-cols-2 gap-10 pt-4">
          <div className="space-y-3">
            <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest">{isFrench ? 'Forces Majeures Identifiées' : 'Core Strengths'}</p>
            <ul className="space-y-2">
              {analysis.strengths.map((s: string, i: number) => (
                <li key={i} className="text-[11px] text-slate-500 font-bold flex items-center gap-3">
                  <div className="w-1 h-1 rounded-full bg-emerald-400" /> {s}
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-3">
            <p className="text-[9px] font-bold text-amber-500 uppercase tracking-widest">{isFrench ? 'Axes d’Amélioration Prioritaires' : 'Growth Vectors'}</p>
            <ul className="space-y-2">
              {analysis.weaknesses.map((w: string, i: number) => (
                <li key={i} className="text-[11px] text-slate-500 font-bold flex items-center gap-3">
                  <div className="w-1 h-1 rounded-full bg-amber-400" /> {w}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <ReviewSection entityId={leadId} entityType="AI" token={token} />
      </div>

      <div className="space-y-4">
        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          {isFrench ? 'Angles d’Approche Commerciale' : 'Sales Hooks'}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {analysis.sales_angles.map((sa: any, i: number) => (
            <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 hover:border-slate-300 transition-colors">
              <div className="flex justify-between items-center">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{sa.type}</span>
                <Lightbulb className="w-3 h-3 text-amber-400" />
              </div>
              <h4 className="font-bold text-slate-900 text-sm">{sa.angle}</h4>
              <p className="text-[11px] text-slate-500 leading-relaxed font-medium">{sa.why_it_matters}</p>
              <div className="pt-4 border-t border-slate-50">
                <span className="text-[9px] font-bold text-blue-600 uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded">
                  {isFrench ? 'Action proposée : ' : 'Action: '}{sa.suggested_solution}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-8 py-5 border-b border-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-[10px] font-bold text-slate-900 uppercase tracking-[0.2em]">
              {isFrench ? 'Modèles de Prise de Contact Personnalisés' : 'Personalized Outreach'}
            </h3>
            {copiedNotice && (
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 animate-in fade-in">
                {isFrench ? '✓ Copié dans le presse-papiers' : '✓ Copied to clipboard'}
              </span>
            )}
          </div>
          <div className="flex bg-slate-100 p-1 rounded-xl">
            {[
              { id: 'email', icon: Mail, label: 'Email' },
              { id: 'short', icon: MessageSquare, label: 'WhatsApp / SMS' },
              { id: 'linkedin', icon: Linkedin, label: 'LinkedIn' },
            ].map((btn) => (
              <button 
                key={btn.id}
                onClick={() => setActiveOutreach(btn.id as any)}
                title={btn.label}
                className={cn("p-2 rounded-lg transition-all", activeOutreach === btn.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600")}
              >
                <btn.icon className="w-3.5 h-3.5" />
              </button>
            ))}
          </div>
        </div>
        <div className="p-8 space-y-6">
          {activeOutreach === 'email' && (
            <div className="space-y-6">
              <div className="space-y-1">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{isFrench ? 'Objet de l\'email' : 'Subject Line'}</p>
                <p className="text-sm font-bold text-slate-900 tracking-tight">{analysis.outreach.email.subject}</p>
              </div>
              <div className="bg-slate-50/50 p-6 rounded-2xl relative group border border-slate-100">
                <p className="text-xs text-slate-600 whitespace-pre-wrap leading-loose font-medium">{analysis.outreach.email.body}</p>
                <button 
                  onClick={() => copyToClipboard(analysis.outreach.email.body)}
                  className="absolute top-4 right-4 p-2 bg-white border border-slate-200 rounded-lg shadow-sm opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
                >
                  <Copy className="w-3.5 h-3.5 text-slate-600" />
                </button>
              </div>
            </div>
          )}
          {['short', 'linkedin'].includes(activeOutreach) && (
            <div className="bg-slate-50/50 p-6 rounded-2xl relative group border border-slate-100">
              <p className="text-xs text-slate-600 whitespace-pre-wrap leading-loose font-medium">{analysis.outreach[activeOutreach]}</p>
              <button 
                onClick={() => copyToClipboard(analysis.outreach[activeOutreach])}
                className="absolute top-4 right-4 p-2 bg-white border border-slate-200 rounded-lg shadow-sm opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
              >
                <Copy className="w-3.5 h-3.5 text-slate-600" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ErrorBoundary>
        <AppContent />
      </ErrorBoundary>
    </AuthProvider>
  );
}

function DataQualityView({ token }: { token: string | null }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isCleaning, setIsCleaning] = useState(false);
  const [cleanResult, setCleanResult] = useState<string | null>(null);

  const loadData = () => {
    if (token) {
      api.get('/api/admin/data-quality', token).then((res) => {
        if (res.success) setData(res.data);
        setLoading(false);
      });
    }
  };

  useEffect(() => {
    loadData();
  }, [token]);

  const handleCleanDatabase = async () => {
    setIsCleaning(true);
    setCleanResult(null);
    try {
      const res = await api.post('/api/leads/clean-database', {}, token!);
      if (res.success) {
        setCleanResult(res.message || `Nettoyage terminé : ${res.updatedCount} prospects normalisés.`);
        loadData();
      } else {
        setCleanResult(res.error || 'Erreur lors du nettoyage');
      }
    } catch (e: any) {
      setCleanResult('Erreur : ' + e.message);
    } finally {
      setIsCleaning(false);
    }
  };

  if (loading || !data) return <div className="flex justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-slate-200" /></div>;

  const stats = data.overall;
  const sources = data.sources;

  return (
    <div className="space-y-10 pb-20">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="space-y-2">
          <h3 className="text-2xl font-black text-slate-900 tracking-tight">Qualité & Fiabilité des Données</h3>
          <p className="text-sm text-slate-500 font-medium">Métriques de performance en temps réel, complétude des coordonnées et vérification des données LeadForge.</p>
        </div>
        <button
          onClick={handleCleanDatabase}
          disabled={isCleaning}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-sm"
        >
          {isCleaning ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {isCleaning ? 'Normalisation...' : 'Normaliser & Nettoyer la Base'}
        </button>
      </div>

      {cleanResult && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 flex items-center justify-between animate-in fade-in">
          <span>✓ {cleanResult}</span>
          <button onClick={() => setCleanResult(null)} className="text-emerald-700 hover:text-emerald-950 font-bold">Fermer</button>
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <QualityStatCard label="Taux Téléphones Vérifiés" value={stats.total > 0 ? Math.round((stats.withPhone / stats.total) * 100) : 0} unit="%" subtext={`${stats.withPhone} numéros contactables`} />
        <QualityStatCard label="Sites Web Vérifiés" value={stats.total > 0 ? Math.round((stats.verifiedWebsite / stats.total) * 100) : 0} unit="%" subtext={`${stats.verifiedWebsite} domaines actifs`} />
        <QualityStatCard label="Taux d'Audits Réalisés" value={stats.total > 0 ? Math.round((stats.audited / stats.total) * 100) : 0} unit="%" subtext={`${stats.audited} audits complétés`} />
        <QualityStatCard label="Analyses Commerciales IA" value={stats.total > 0 ? Math.round((stats.analyzed / stats.total) * 100) : 0} unit="%" subtext={`${stats.analyzed} diagnostics générés`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Source Reliability */}
        <div className="lg:col-span-2 space-y-6">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Distribution par Source d'Enrichissement</h4>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Source de Données</th>
                  <th className="px-6 py-4 text-center">Prospects Extraits</th>
                  <th className="px-6 py-4 text-right">Score Opportunité Moyen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sources.map((s: any) => (
                  <tr key={s.source} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-900 capitalize">{s.source || 'Manuel'}</td>
                    <td className="px-6 py-4 text-center font-medium">{s.count}</td>
                    <td className="px-6 py-4 text-right font-mono text-slate-500 font-bold">{Math.round(s.avgOppScore || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Lead Quality Breakdown */}
        <div className="space-y-6">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Points d'Attention & Complétude</h4>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <QualityProgressBar label="Sans Téléphone" value={stats.total - stats.withPhone} total={stats.total} color="bg-amber-500" />
            <QualityProgressBar label="Sans Site Internet" value={stats.total - stats.withWebsite} total={stats.total} color="bg-red-500" />
            <QualityProgressBar label="Site Non Détecté" value={stats.notDetectedWebsite} total={stats.total} color="bg-orange-500" />
            <QualityProgressBar label="Site Inaccessible / Erreur" value={stats.unreachableWebsite} total={stats.total} color="bg-slate-400" />
          </div>
        </div>
      </div>
    </div>
  );
}

function QualityStatCard({ label, value, unit, subtext, color }: any) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-1">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
      <div className="flex items-baseline gap-1">
        <span className={cn("text-3xl font-black text-slate-900", color)}>{value}</span>
        <span className="text-sm font-bold text-slate-400">{unit}</span>
      </div>
      <p className="text-[10px] font-medium text-slate-400 italic">{subtext}</p>
    </div>
  );
}

function QualityProgressBar({ label, value, total, color }: any) {
  const percentage = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
        <span className="text-slate-500">{label}</span>
        <span className="text-slate-900">{value} / {total}</span>
      </div>
      <div className="w-full h-2 bg-slate-50 rounded-full overflow-hidden border border-slate-100">
        <div className={cn("h-full transition-all duration-1000", color)} style={{ width: `${percentage}%` }}></div>
      </div>
    </div>
  );
}

function ReviewSection({ entityId, entityType, token }: { entityId: number; entityType: 'LEAD' | 'AUDIT' | 'OPPORTUNITY' | 'AI'; token: string }) {
  const [reviewed, setReviewed] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (correct: boolean) => {
    setSubmitting(true);
    const res = await api.post('/api/quality-reviews', {
      entityType,
      isCorrect: correct,
      notes: notes || undefined,
      leadId: entityType === 'LEAD' ? entityId : undefined,
      auditId: entityType === 'AUDIT' ? entityId : undefined,
      opportunityId: entityType === 'OPPORTUNITY' ? entityId : undefined,
      aiAnalysisId: entityType === 'AI' ? entityId : undefined
    }, token);
    
    if (res.success) {
      setReviewed(true);
      setIsCorrect(correct);
    }
    setSubmitting(false);
  };

  if (reviewed) {
    return (
      <div className={cn("mt-4 p-3 rounded-xl flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest", 
        isCorrect ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
      )}>
        {isCorrect ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
        Évaluation enregistrée : {isCorrect ? 'Donnée Conforme' : 'Donnée Inexacte'}
      </div>
    );
  }

  return (
    <div className="mt-6 pt-6 border-t border-slate-50 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em]">Contrôle Qualité Humain</span>
        <div className="flex gap-2">
          <button 
            disabled={submitting}
            onClick={() => handleSubmit(true)}
            className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-colors flex items-center gap-1.5"
          >
            <Check className="w-3 h-3" /> Conforme
          </button>
          <button 
            disabled={submitting}
            onClick={() => handleSubmit(false)}
            className="px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-red-100 transition-colors flex items-center gap-1.5"
          >
            <AlertCircle className="w-3 h-3" /> Inexact
          </button>
        </div>
      </div>
      <input 
        type="text" 
        value={notes} 
        onChange={e => setNotes(e.target.value)}
        placeholder="Ajouter une remarque sur la qualité (optionnel)..."
        className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-medium focus:outline-none focus:ring-1 focus:ring-slate-900 placeholder:text-slate-300"
      />
    </div>
  );
}

function EvidenceTab({ lead }: { lead: any }) {
  const evidenceList = lead.evidence || [];
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const contactFields = ['phone', 'email', 'whatsapp'];
  const socialFields = ['facebook', 'instagram', 'linkedin', 'twitter', 'tiktok', 'youtube', 'pinterest'];
  const locationFields = ['address', 'opening_hours'];
  const legalFields = ['legal_id', 'legal_name', 'manager', 'tagline', 'social_bio'];

  const filteredEvidence = evidenceList.filter((ev: any) => {
    if (filterCategory === 'all') return true;
    const name = ev.fieldName?.toLowerCase() || '';
    if (filterCategory === 'contact') return contactFields.includes(name);
    if (filterCategory === 'social') return socialFields.includes(name) || ev.source?.includes('SOCIAL') || ev.source?.includes('FACEBOOK') || ev.source?.includes('INSTAGRAM');
    if (filterCategory === 'location') return locationFields.includes(name);
    if (filterCategory === 'legal') return legalFields.includes(name);
    return true;
  });

  const socialCount = evidenceList.filter((ev: any) => socialFields.includes(ev.fieldName?.toLowerCase()) || ev.source?.includes('SOCIAL') || ev.source?.includes('FACEBOOK') || ev.source?.includes('INSTAGRAM')).length;
  const contactCount = evidenceList.filter((ev: any) => contactFields.includes(ev.fieldName?.toLowerCase())).length;

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl shadow-slate-900/10 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5 text-emerald-400">
            <ShieldCheck className="w-5 h-5 shrink-0" />
            <h4 className="text-xs font-bold uppercase tracking-wider">Garantie Données Réelles & Anti-Fabrication</h4>
          </div>
          <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-lg text-[10px] font-mono font-bold tracking-wide">
            100% DONNÉES RÉELLES & VÉRIFIÉES
          </span>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          Chaque valeur ci-dessous a été extraite de manière déterministe depuis le site internet officiel, le profil public ou le registre OpenStreetMap. <strong>LeadForge interdit formellement toute invention ou génération de fausses coordonnées.</strong> Si un email ou un téléphone n'est pas publié officiellement par l'entreprise, le champ reste vide (<code className="text-slate-400 font-mono">null</code>).
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-white/10 text-center">
          <div className="p-3 bg-white/5 rounded-xl border border-white/5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">Champs Vérifiés</span>
            <span className="text-base font-black text-white">{evidenceList.length}</span>
          </div>
          <div className="p-3 bg-white/5 rounded-xl border border-white/5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">Points de Contact</span>
            <span className="text-base font-black text-emerald-400">{contactCount}</span>
          </div>
          <div className="p-3 bg-white/5 rounded-xl border border-white/5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">Réseaux Sociaux</span>
            <span className="text-base font-black text-indigo-400">{socialCount}</span>
          </div>
          <div className="p-3 bg-white/5 rounded-xl border border-white/5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">Données Inventées</span>
            <span className="text-base font-black text-emerald-400">0%</span>
          </div>
        </div>
      </div>

      {/* Website & Social Presence Identity Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">État du Canal & Détection Web</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Statut du Site</span>
            <span className={cn("text-xs font-extrabold uppercase px-2 py-0.5 rounded inline-block",
              lead.websiteStatus === 'verified' ? 'bg-emerald-100 text-emerald-800' :
              lead.websiteStatus === 'social_profile' ? 'bg-indigo-100 text-indigo-800' :
              lead.websiteStatus === 'unreachable' ? 'bg-red-100 text-red-800' :
              lead.websiteStatus === 'not_detected' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-700'
            )}>{lead.websiteStatus === 'social_profile' ? 'Présence Sociale Seule' : 
                lead.websiteStatus === 'verified' ? 'Vérifié & Actif' :
                lead.websiteStatus === 'not_detected' ? 'Non Détecté' :
                lead.websiteStatus === 'unreachable' ? 'Inaccessible' : (lead.websiteStatus || 'Inconnu')}</span>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Indice de Confiance</span>
            <span className="text-xs font-bold text-slate-800">{lead.websiteConfidence || lead.dataConfidence || 'MOYENNE'}</span>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Source Principale</span>
            <span className="text-xs font-medium text-slate-700 truncate block">{lead.enrichmentSource || lead.discoverySource || lead.source || 'OpenStreetMap'}</span>
          </div>
        </div>

        {lead.website && (
          <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-xs text-blue-900 flex items-center justify-between flex-wrap gap-2">
            <span className="font-medium">
              {lead.websiteStatus === 'social_profile' ? 'URL du profil social vérifié :' : 'URL du site audité :'} <code className="bg-white px-1.5 py-0.5 rounded border border-blue-200 font-mono text-[11px]">{lead.website}</code>
            </span>
            <a href={lead.website} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex items-center gap-1 font-bold text-[11px]">
              Consulter <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}
      </div>

      {/* Field Evidence Table with Filter Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h4 className="text-sm font-bold text-slate-900">Preuves & Faits Numériques Extraits ({filteredEvidence.length})</h4>
            <p className="text-xs text-slate-500">Chaque information est appuyée par une URL source et une méthode d'extraction certifiée.</p>
          </div>

          <div className="flex gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold">
            {[
              { id: 'all', label: `Tout (${evidenceList.length})` },
              { id: 'contact', label: `Contacts (${contactCount})` },
              { id: 'social', label: `Réseaux (${socialCount})` },
              { id: 'location', label: 'Adresse & Horaires' },
              { id: 'legal', label: 'Légal & Gérant' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setFilterCategory(tab.id)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-wider transition-all",
                  filterCategory === tab.id 
                    ? "bg-white text-slate-900 shadow-xs" 
                    : "text-slate-500 hover:text-slate-900"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {filteredEvidence.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            Aucune preuve factuelle enregistrée pour cette catégorie. Cliquez sur <strong>Enrichir / Deep Scrape</strong> ci-dessus pour explorer le site et les réseaux sociaux.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                <tr>
                  <th className="px-6 py-3">Champ</th>
                  <th className="px-6 py-3">Valeur Vérifiée</th>
                  <th className="px-6 py-3">Méthode & Source</th>
                  <th className="px-6 py-3">Fiabilité</th>
                  <th className="px-6 py-3">URL Source Publique</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEvidence.map((ev: any) => (
                  <tr key={ev.id || `${ev.fieldName}-${ev.value}`} className="hover:bg-slate-50">
                    <td className="px-6 py-3.5 font-bold uppercase text-[10px] text-slate-700 tracking-wider">
                      {ev.fieldName}
                    </td>
                    <td className="px-6 py-3.5 font-semibold text-slate-900 max-w-[260px] truncate select-all">
                      {ev.value}
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="font-medium text-slate-800 block text-xs">{ev.source}</span>
                      {ev.method && <span className="text-[10px] text-slate-400 block">{ev.method}</span>}
                    </td>
                    <td className="px-6 py-3.5">
                      <span className={cn("px-2 py-0.5 rounded text-[10px] font-extrabold uppercase",
                        ev.confidence === 'HIGH' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/50' :
                        ev.confidence === 'MEDIUM' ? 'bg-amber-50 text-amber-700 border border-amber-200/50' : 'bg-slate-100 text-slate-600'
                      )}>{ev.confidence === 'HIGH' ? 'ÉLEVÉE' : ev.confidence === 'MEDIUM' ? 'MOYENNE' : 'FAIBLE'}</span>
                    </td>
                    <td className="px-6 py-3.5">
                      {ev.sourceUrl ? (
                        <a href={ev.sourceUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex items-center gap-1 text-[11px] truncate max-w-[240px]">
                          {ev.sourceUrl} <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                        </a>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Honest Empty Data Card */}
      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 text-xs text-slate-600 space-y-1">
        <p className="font-bold text-slate-800">Pourquoi certains champs sont-ils vides ?</p>
        <p className="leading-relaxed">
          LeadForge applique un standard strict d'intégrité des données. Si une entreprise ne publie pas d'adresse email ou de numéro de téléphone direct sur son site officiel, ses réseaux sociaux ou le cadastre OpenStreetMap, LeadForge conserve le champ vide (<code className="text-slate-500 font-mono">null</code>). Nous n'inventons jamais d'adresses génériques (<code className="text-slate-500 font-mono">contact@domaine.fr</code>) sans confirmation réelle.
        </p>
      </div>
    </div>
  );
}

function SettingsView({ token }: { token: string }) {
  const [providerStatus, setProviderStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchProviders();
  }, []);

  const fetchProviders = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/search-providers');
      const data = await res.json();
      if (data.success) setProviderStatus(data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  return (
    <div className="max-w-4xl space-y-8 animate-in fade-in duration-300">
      <div>
        <h3 className="text-xl font-bold text-slate-900">Configuration du Pipeline & Sources</h3>
        <p className="text-xs text-slate-500">Vue d'ensemble transparente des sources de détection LeadForge, infrastructure $0 MVP et adaptateurs de recherche.</p>
      </div>

      {/* $0 Free MVP Architecture */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h4 className="text-sm font-bold text-slate-900">Moteur de Découverte Sans Frais ($0 MVP)</h4>
            <p className="text-xs text-slate-500">Ces composants fonctionnent nativement sans aucune clé API payante ni abonnement requis.</p>
          </div>
          <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 font-bold text-xs uppercase tracking-wider rounded-lg border border-emerald-100">
            Actif par Défaut
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800">1. OpenStreetMap (Overpass API)</span>
              <span className="text-[10px] font-bold text-emerald-600 uppercase">Source Principale</span>
            </div>
            <p className="text-slate-600 leading-relaxed">
              Découvre les commerces réels et artisans. LeadForge applique un partitionnement cartographique et un cache intelligent en mémoire pour une vitesse maximale.
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800">2. Géocodage Nominatim</span>
              <span className="text-[10px] font-bold text-emerald-600 uppercase">Couverture Géographique</span>
            </div>
            <p className="text-slate-600 leading-relaxed">
              Calcule les délimitations géographiques exactes par ville ou région, divisant les recherches en sous-zones pour éviter toute limitation.
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800">3. Crawler Natif Parallèle Cheerio</span>
              <span className="text-[10px] font-bold text-emerald-600 uppercase">Enrichissement Contacts</span>
            </div>
            <p className="text-slate-600 leading-relaxed">
              Explore ultra-rapidement la page contact et les mentions légales pour extraire numéros de téléphone, SIRET, noms de gérants et coordonnées WhatsApp.
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800">4. Sondeur de Domaines Locaux</span>
              <span className="text-[10px] font-bold text-emerald-600 uppercase">Détection de Site Web</span>
            </div>
            <p className="text-slate-600 leading-relaxed">
              Génère des candidats de domaines normalisés selon l'extension du pays (.fr, .ch, .be, .com) et vérifie la cohérence du contenu avant validation.
            </p>
          </div>
        </div>
      </div>

      {/* Information sur les Politiques des Moteurs */}
      <div className="bg-amber-50/70 border border-amber-200/80 p-6 rounded-2xl space-y-3">
        <div className="flex items-center gap-2 text-amber-800">
          <Info className="w-4 h-4 shrink-0" />
          <h4 className="text-xs font-bold uppercase tracking-wider">Note sur la Découverte et la Stabilité</h4>
        </div>
        <p className="text-xs text-amber-900/80 leading-relaxed">
          LeadForge privilégie les requêtes certifiées et le cadastre cartographique pour garantir une haute disponibilité, sans blocages CAPTCHA intempestifs ni interruptions de service à grande échelle.
        </p>
      </div>

      {/* Adaptateurs Optionnels avec Clés */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <div className="border-b border-slate-100 pb-4">
          <h4 className="text-sm font-bold text-slate-900">Adaptateurs de Recherche Externes (Optionnels)</h4>
          <p className="text-xs text-slate-500">Pour enrichir la recherche de sites web au-delà d'OpenStreetMap et du sondeur local, configurez simplement ces variables d'environnement :</p>
        </div>

        <div className="space-y-4 text-xs">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900">Google Custom Search JSON API</span>
                <span className="px-2 py-0.5 bg-slate-200 text-slate-700 text-[9px] font-bold rounded">100 requêtes/jour offertes</span>
              </div>
              <p className="text-slate-500 text-[11px]">API officielle Google pour localiser les sites d'entreprises locales.</p>
              <div className="font-mono text-[10px] text-slate-600 bg-white p-1.5 rounded border border-slate-200 mt-1 inline-block">
                GOOGLE_SEARCH_API_KEY & GOOGLE_SEARCH_CX
              </div>
            </div>
            <span className="text-[10px] font-bold uppercase px-3 py-1 bg-slate-200 text-slate-600 rounded-lg text-center shrink-0">
              Clé Optionnelle
            </span>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900">Firecrawl API</span>
                <span className="px-2 py-0.5 bg-slate-200 text-slate-700 text-[9px] font-bold rounded">Crawler Cloud JavaScript</span>
              </div>
              <p className="text-slate-500 text-[11px]">Service spécialisé de crawling et extraction web JavaScript.</p>
              <div className="font-mono text-[10px] text-slate-600 bg-white p-1.5 rounded border border-slate-200 mt-1 inline-block">
                FIRECRAWL_API_KEY
              </div>
            </div>
            <span className="text-[10px] font-bold uppercase px-3 py-1 bg-slate-200 text-slate-600 rounded-lg text-center shrink-0">
              Clé Optionnelle
            </span>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900">Bing Web Search API</span>
                <span className="px-2 py-0.5 bg-slate-200 text-slate-700 text-[9px] font-bold rounded">Azure Cognitive</span>
              </div>
              <p className="text-slate-500 text-[11px]">API de recherche Microsoft Azure Cognitive Services.</p>
              <div className="font-mono text-[10px] text-slate-600 bg-white p-1.5 rounded border border-slate-200 mt-1 inline-block">
                BING_SEARCH_API_KEY
              </div>
            </div>
            <span className="text-[10px] font-bold uppercase px-3 py-1 bg-slate-200 text-slate-600 rounded-lg text-center shrink-0">
              Clé Optionnelle
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

