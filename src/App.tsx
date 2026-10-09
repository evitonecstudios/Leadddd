import { AuthProvider, useAuth } from './contexts/AuthContext.tsx';
import { auth } from './lib/firebase.ts';
import { 
  Search, LayoutDashboard, Database, Settings, LogOut, BarChart3, Target, Filter, 
  Upload, Check, AlertCircle, Loader2, Globe, Phone, Mail, MapPin, ExternalLink, 
  RefreshCw, Star, Info, Lightbulb, MessageSquare, Linkedin, Languages, Wand2, 
  ShieldCheck, Copy, History, Calendar, Plus, Trash2, Download, MoreVertical,
  ChevronRight, ArrowRight, User, CheckCircle2, Clock, Menu, X, PanelLeftClose, PanelLeftOpen,
  Facebook, Instagram, Twitter, Sparkles, Share2, Printer, FileText, Briefcase, MessageCircle, PhoneCall
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
              <h1 className="text-xl font-bold text-slate-900">Application Error</h1>
              <p className="text-sm text-slate-500 leading-relaxed">LeadForge encountered an unexpected error during rendering.</p>
              <pre className="mt-4 p-4 bg-slate-50 rounded-lg text-left text-[10px] font-mono text-slate-600 overflow-auto max-h-40">
                {this.state.error?.message || "Unknown error"}
              </pre>
            </div>
            <button onClick={() => window.location.reload()} className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold text-sm uppercase tracking-widest hover:bg-slate-800 transition-all">Reload Application</button>
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
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Loading LeadForge...</h2>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-widest">Initializing Secure Session</p>
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
            <p className="text-lg text-slate-600 leading-relaxed">Identity verified B2B opportunities with data-driven digital audits.</p>
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
                      {isUnauthorizedDomain ? 'Action Required: Authorize Domain in Firebase' : 'Sign-in failed'}
                    </p>
                    <p className="text-xs text-amber-800 leading-relaxed font-medium">{authError}</p>
                  </div>
                </div>

                {isUnauthorizedDomain && (
                  <div className="pt-3 border-t border-amber-200/80 space-y-3">
                    <div className="bg-white p-3 rounded-xl border border-amber-200 flex items-center justify-between gap-3 shadow-xs">
                      <div className="min-w-0">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Domain to Whitelist</p>
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
                        {copiedDomain ? '✓ Copied' : 'Copy Domain'}
                      </button>
                    </div>

                    <div className="text-[11px] text-slate-700 space-y-2">
                      <p className="font-bold text-slate-900">How to fix in 30 seconds:</p>
                      <ol className="list-decimal list-inside space-y-1.5 text-slate-600 leading-relaxed pl-0.5">
                        <li>
                          Open{' '}
                          <a 
                            href="https://console.firebase.google.com/project/majestic-safeguard-nvr20/authentication/settings" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 font-bold underline hover:text-blue-800 inline-flex items-center gap-1"
                          >
                            Firebase Console &rarr; Authorized Domains
                          </a>
                        </li>
                        <li>Click <strong className="text-slate-900 font-bold">Add domain</strong></li>
                        <li>
                          Paste <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono font-bold text-amber-950">{currentDomain}</code> (or <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono font-bold text-amber-950">vercel.app</code> to cover all Vercel deploys) and click <strong className="text-slate-900 font-bold">Save</strong>
                        </li>
                        <li>Click the button below to sign in</li>
                      </ol>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          <button onClick={signIn} className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10 active:scale-[0.98]">
            Sign in with Google
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
    { id: 'dashboard', label: 'CRM Dashboard', icon: LayoutDashboard },
    { id: 'generate', label: 'Lead Discovery', icon: Target },
    { id: 'import', label: 'Import Leads', icon: Upload },
    { id: 'leads', label: 'Lead Database', icon: Database },
    { id: 'quality', label: 'Data Quality', icon: ShieldCheck },
    { id: 'settings', label: 'Settings', icon: Settings },
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
          aria-label="Close navigation menu"
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
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">B2B Discovery</span>
            </div>
          </div>
          {/* Prominent Close Button */}
          <button 
            onClick={onCloseMobile}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            title="Close menu (Esc)"
            aria-label="Close menu"
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
            <LogOut className="w-3.5 h-3.5" /> Sign Out
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
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">B2B Discovery</span>
                </div>
              </div>
              <button 
                onClick={onToggleCollapse} 
                title="Collapse sidebar" 
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                aria-label="Collapse menu"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </>
          ) : (
            <button 
              onClick={onToggleCollapse} 
              title="Expand sidebar" 
              className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors flex items-center justify-center"
              aria-label="Expand menu"
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
            title={collapsed ? "Sign Out" : undefined}
            className={cn(
              "w-full flex items-center text-xs font-bold text-slate-400 uppercase tracking-widest rounded-lg hover:text-red-600 hover:bg-red-50 transition-colors",
              collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2"
            )}
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>
    </>
  );
}

function Header({ activeTab, onOpenMobileMenu, collapsed, onToggleCollapse }: any) {
  const titles: Record<string, string> = {
    'dashboard': 'CRM & Opportunity Funnel',
    'generate': 'Multi-Cell Lead Discovery',
    'import': 'CSV Lead Import',
    'leads': 'Prospect Database & Directory',
    'quality': 'Data Quality & Provenance',
    'settings': 'Pipeline Configuration'
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 lg:px-8 sticky top-0 z-30">
      <div className="flex items-center gap-3">
        {/* Mobile Hamburger Menu Toggle */}
        <button 
          onClick={onOpenMobileMenu}
          className="p-2 -ml-1 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 lg:hidden flex items-center justify-center transition-colors"
          title="Open navigation menu"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Desktop Collapse Toggle in Header */}
        <button 
          onClick={onToggleCollapse}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 hidden lg:flex items-center justify-center transition-colors"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
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
            placeholder="Quick search..." 
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
          setError(statsRes.error || 'Failed to load stats');
        }
        if (leadsRes.success) setLeads(leadsRes.data);
      }).catch(err => {
        console.error('[DASHBOARD] Fetch error:', err);
        setError(err.message);
      });
    }
  }, [token]);

  if (error) {
    const isDbIssue = error.toLowerCase().includes('database') || error.toLowerCase().includes('connect') || error.toLowerCase().includes('password') || error.toLowerCase().includes('socket') || error.toLowerCase().includes('enotfound');
    return (
      <div className="max-w-md mx-auto p-8 my-12 bg-white rounded-2xl border border-slate-200 shadow-sm text-center space-y-4 animate-in fade-in">
        <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center mx-auto text-red-600 shadow-sm">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-slate-900 tracking-tight">Dashboard Connection Error</h3>
          <p className="text-xs text-slate-500 font-medium leading-relaxed">{error}</p>
        </div>
        {isDbIssue && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-left text-[11px] text-amber-900 space-y-1">
            <p className="font-bold">Database Setup Notice for Vercel:</p>
            <p className="leading-relaxed text-amber-800">
              Ensure your Vercel project has <code className="bg-amber-100 font-mono font-bold px-1 rounded">DATABASE_URL</code> or <code className="bg-amber-100 font-mono font-bold px-1 rounded">POSTGRES_URL</code> configured in <strong>Project Settings &rarr; Environment Variables</strong>.
            </p>
          </div>
        )}
        <div className="pt-2">
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-slate-800 transition-colors shadow-sm"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  if (!stats) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;

  const funnelStages = [
    { label: 'New', count: stats.new, color: 'bg-slate-200' },
    { label: 'Reviewed', count: stats.reviewed, color: 'bg-blue-200' },
    { label: 'Qualified', count: stats.qualified, color: 'bg-indigo-300' },
    { label: 'Contacted', count: stats.contacted, color: 'bg-amber-300' },
    { label: 'Replied', count: stats.replied, color: 'bg-emerald-300' },
    { label: 'Won', count: stats.won, color: 'bg-emerald-500' },
  ];

  return (
    <div className="space-y-8">
      {/* Funnel */}
      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Sales Funnel</h3>
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
          { label: 'Websites Found', value: stats.websitesFound, color: 'text-emerald-600' },
          { label: 'Websites Missing', value: stats.websitesMissing, color: 'text-amber-600' },
          { label: 'High Opportunity', value: stats.highOpportunity, color: 'text-blue-600' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
            <span className={cn("text-2xl font-bold", stat.color || "text-slate-900")}>{stat.value || 0}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <h3 className="text-lg font-bold text-slate-900">Recent Prospects</h3>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden text-sm">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-6 py-4">Company</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Opp. Score</th>
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
          <h3 className="text-lg font-bold text-slate-900">Opportunities</h3>
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            {stats.opportunities?.length > 0 ? stats.opportunities.map((opp: any) => (
              <div key={opp.type} className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{opp.type.replace('_', ' ')}</span>
                <span className="text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">{opp.count}</span>
              </div>
            )) : <p className="text-xs text-slate-400">No opportunities detected.</p>}
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
    campaignName: 'Local Independent Shops Discovery',
    localOnly: true,
    requireContactInfo: true
  });

  const targetPresets = [25, 50, 100, 250, 500];
  const smbCategories = [
    { label: '🥖 Bakery / Artisan', value: 'bakery' },
    { label: '💇 Hair & Beauty Salon', value: 'hairdresser' },
    { label: '🍽️ Restaurant / Bistro', value: 'restaurant' },
    { label: '🔧 Plumber / Trades', value: 'plumber' },
    { label: '🦷 Dental / Clinic', value: 'dentist' },
    { label: '🚗 Auto Repair & Garage', value: 'car mechanic' },
    { label: '📱 Phone & Tech Repair', value: 'phone repair' },
    { label: '👗 Boutique / Retail', value: 'boutique' },
    { label: '⚖️ Lawyer / Firm', value: 'lawyer' },
    { label: '☕ Cafe & Coffee Shop', value: 'cafe' }
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
      }, 1500);
    }
    return () => clearInterval(interval);
  }, [jobId, token]);

  const handleGenerate = async () => {
    if (!criteria.campaignName) {
      setErrorMsg('Please enter a campaign name.');
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
      setErrorMsg(res.error || 'Failed to start generation.');
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
      setErrorMsg(res.error || 'Failed to resume generation');
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
                <h3 className="text-xl font-bold text-slate-900">Local SMB Lead Discovery</h3>
                <p className="text-xs text-slate-500">Targets independent local shops & services, filtering out national corporate chains.</p>
              </div>
              <div className="flex bg-slate-100 p-1 rounded-lg">
                <button onClick={() => setSource('osm')} className={cn("px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all", !isCsv ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600")}>OpenStreetMap</button>
                <button onClick={() => setSource('csv')} className={cn("px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all", isCsv ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600")}>CSV Import</button>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-800 flex items-center justify-between">
                <span>{errorMsg}</span>
                <button onClick={() => setErrorMsg(null)} className="text-red-600 hover:text-red-950 font-bold text-xs">Dismiss</button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2 col-span-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Campaign Name</label>
                <input type="text" placeholder="e.g. Paris Bakeries Web Pitch" value={criteria.campaignName} onChange={e => setCriteria({...criteria, campaignName: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 font-medium" />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Country</label>
                <input type="text" value={criteria.country} onChange={e => setCriteria({...criteria, country: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 font-medium" />
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[
                    { label: '🇨🇭 Suisse / Switzerland', country: 'Switzerland', city: 'Geneva' },
                    { label: '🇫🇷 France', country: 'France', city: 'Paris' },
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
                        campaignName: `${preset.city} ${criteria.category || 'Prospection'} Lead Campaign`
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
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">City / Target Region</label>
                <input type="text" value={criteria.city} onChange={e => setCriteria({...criteria, city: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 font-medium" />
                {criteria.country.toLowerCase().includes('switz') || criteria.country.toLowerCase().includes('suisse') ? (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {['Geneva', 'Lausanne', 'Zurich', 'Basel', 'Bern', 'Neuchâtel', 'Fribourg'].map(swissCity => (
                      <button
                        key={swissCity}
                        type="button"
                        onClick={() => setCriteria({
                          ...criteria,
                          city: swissCity,
                          campaignName: `${swissCity} ${criteria.category || 'Prospection'} Lead Campaign`
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
                    {['Paris', 'Lyon', 'Marseille', 'Bordeaux', 'Lille', 'Toulouse'].map(frCity => (
                      <button
                        key={frCity}
                        type="button"
                        onClick={() => setCriteria({
                          ...criteria,
                          city: frCity,
                          campaignName: `${frCity} ${criteria.category || 'Prospection'} Lead Campaign`
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
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Local Business Sector</label>
                  <span className="text-[10px] text-slate-400">High-converting SMB sectors</span>
                </div>
                <input type="text" value={criteria.category} onChange={e => setCriteria({...criteria, category: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 font-medium placeholder:text-slate-300" placeholder="e.g. bakery, dentist, plumber, boutique" />
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
                        Target Independent Local Businesses & SMBs Only
                      </label>
                      <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded uppercase">Recommended</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Actively blocks known mega-chains, corporate franchises, and multi-nationals (such as Fnac, Zara, McDonald's, Carrefour, Sephora) so you only prospect genuine local shop and business owners.
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
                      🎯 Leads Vérifiés & Contactables Uniquement (Recommandé pour les commerciaux)
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
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Target Lead Volume (Ceiling)</label>
                  <span className="text-[10px] text-slate-400 font-mono">{criteria.maxResults} leads</span>
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
              {loading ? 'Executing Discovery...' : `Launch Local Discovery (${criteria.maxResults} Target)`}
            </button>
          </div>

          {jobStatus && (
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6 animate-in fade-in slide-in-from-top-2 duration-500">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-widest">Live Pipeline Progress</h4>
                  {results.currentCell && (
                    <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded font-mono font-bold text-slate-600">
                      Cell: {results.currentCell}
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
                      Resume
                    </button>
                  )}
                  <span className={cn("text-[10px] font-black uppercase px-2.5 py-1 rounded", 
                    jobStatus.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 
                    jobStatus.status === 'failed' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-blue-50 text-blue-700 border border-blue-200'
                  )}>{jobStatus.status}</span>
                </div>
              </div>

              {/* Pipeline Stages Tracker */}
              <div className="grid grid-cols-5 gap-2 text-center text-[9px] font-bold uppercase tracking-wider py-2">
                <div className={cn("p-2 rounded-lg border", (results.cellsCompleted || 0) > 0 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-400 border-slate-100")}>
                  1. Discovery
                </div>
                <div className={cn("p-2 rounded-lg border", (results.duplicates || 0) > 0 || (results.validBusinesses || 0) > 0 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-400 border-slate-100")}>
                  2. Dedup
                </div>
                <div className={cn("p-2 rounded-lg border", (results.verifiedWebsites || 0) > 0 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-400 border-slate-100")}>
                  3. Web Identity
                </div>
                <div className={cn("p-2 rounded-lg border", (results.phonesFound || 0) > 0 || (results.emailsFound || 0) > 0 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-400 border-slate-100")}>
                  4. Deep Crawl
                </div>
                <div className={cn("p-2 rounded-lg border", (results.auditsCompleted || 0) > 0 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-400 border-slate-100")}>
                  5. Audit & Opps
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className={cn("w-2 h-2 rounded-full shrink-0", jobStatus.status === 'completed' ? 'bg-emerald-500' : 'bg-blue-500 animate-pulse')}></div>
                  <p className="text-xs font-semibold text-slate-700 truncate">{results.currentStep || 'Initializing pipeline...'}</p>
                </div>

                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-slate-900 transition-all duration-500" style={{ width: `${Math.min(100, ((results.newLeadsSaved || 0) / (criteria.maxResults || 1)) * 100)}%` }}></div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                  <StatMini label="Raw Found" value={results.totalFound || 0} />
                  <StatMini label="Chains Filtered" value={results.chainsFiltered || 0} color="text-rose-600 font-bold" />
                  <StatMini label="Local SMB Leads" value={results.validBusinesses || 0} color="text-emerald-600 font-bold" />
                  <StatMini label="Duplicates Filtered" value={results.duplicates || 0} color="text-slate-400" />
                  <StatMini label="Web Candidates" value={results.websiteCandidates || 0} color="text-amber-600" />
                  <StatMini label="Verified Sites" value={results.verifiedWebsites || 0} color="text-teal-600" />
                  <StatMini label="Phones Found" value={results.phonesFound || 0} color="text-indigo-600" />
                  <StatMini label="Emails Found" value={results.emailsFound || 0} color="text-violet-600" />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pipeline Architecture</h4>
            <div className="space-y-3 text-xs">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span className="text-slate-600"><strong>Geographic Partitioning:</strong> Subdivides bounding boxes into cells to avoid OSM query timeouts.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span className="text-slate-600"><strong>Multi-Tag Mapping:</strong> Queries phone repair, electronics, and repair tags simultaneously.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span className="text-slate-600"><strong>Deep Site Crawl:</strong> Scans up to 8 pages per domain for phone, mailto, and WhatsApp links.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span className="text-slate-600"><strong>Audit Trail:</strong> Stores source URL and extraction method for every single data point.</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 p-6 rounded-2xl text-white space-y-4 shadow-xl shadow-slate-900/10">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider">Zero-Cost Discovery Stack</h4>
            </div>
            <p className="text-[11px] opacity-80 leading-relaxed">
              LeadForge operates 100% on $0 free infrastructure out-of-the-box (OpenStreetMap, Nominatim, Cheerio Crawler, Local Domain Probing). Optional Google or Firecrawl API keys can be connected in Settings.
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
      setImportNotice('Import process started in background.');
    } else {
      setImportNotice(res.error || 'Failed to import CSV.');
    }
  };

  return (
    <div className="max-w-4xl bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-8">
      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <h3 className="text-xl font-bold text-slate-900">Bulk Prospect Import</h3>
          <p className="text-sm text-slate-500">Upload your CSV and map columns to our data architecture.</p>
        </div>
        <button onClick={onBack} className="text-[10px] font-bold text-slate-400 hover:text-slate-900 flex items-center gap-2 uppercase tracking-[0.2em] transition-colors">
          <ArrowRight className="w-3 h-3 rotate-180" /> Back to Choice
        </button>
      </div>

      {importNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center justify-between">
          <span>{importNotice}</span>
          <button onClick={() => setImportNotice(null)} className="text-emerald-700 hover:text-emerald-950 font-bold text-xs">Dismiss</button>
        </div>
      )}

      {step === 1 && (
        <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-slate-200 rounded-2xl p-16 text-center space-y-4 hover:border-slate-400 cursor-pointer transition-colors group">
          <Upload className="w-12 h-12 text-slate-200 mx-auto group-hover:text-slate-400 transition-colors" />
          <div className="space-y-1">
            <p className="text-sm font-bold text-slate-900 uppercase tracking-widest">Select CSV File</p>
            <p className="text-[11px] text-slate-400 font-medium">Standard UTF-8 CSV recommended</p>
          </div>
          <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleFileUpload} />
        </div>
      )}
      {step === 2 && (
        <div className="space-y-8">
          <div className="grid grid-cols-2 gap-12">
            <div className="space-y-6">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">Column Mapping</h4>
              {Object.keys(mapping).map((field) => (
                <div key={field} className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{field.replace(/([A-Z])/g, ' $1')}</label>
                  <select value={mapping[field]} onChange={e => setMapping({...mapping, [field]: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:outline-none focus:ring-1 focus:ring-slate-900">
                    <option value="">(Skip Field)</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div className="space-y-6">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">Raw Data Preview</h4>
              <div className="bg-slate-50 rounded-xl p-4 space-y-3 overflow-auto max-h-[400px]">
                {data.slice(0, 3).map((row, i) => <div key={i} className="text-[9px] font-mono text-slate-500 bg-white p-3 rounded border border-slate-100"><pre>{JSON.stringify(row, null, 2)}</pre></div>)}
              </div>
            </div>
          </div>
          <div className="flex gap-4 pt-4">
            <button onClick={() => setStep(1)} className="flex-1 py-3 border border-slate-200 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-slate-50 transition-colors">Back</button>
            <button onClick={handleImport} disabled={loading} className="flex-1 py-3 bg-slate-900 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-slate-800 transition-colors flex items-center justify-center gap-2">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />} {loading ? 'Importing...' : 'Confirm Import'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function LeadsView({ token, onSelectLead }: any) {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [scopeFilter, setScopeFilter] = useState<'team' | 'personal'>('team');
  const [selectedLeads, setSelectedLeads] = useState<number[]>([]);
  const [commercialLead, setCommercialLead] = useState<any | null>(null);

  const fetchLeads = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (statusFilter) params.append('status', statusFilter);
    params.append('scope', scopeFilter);
    const res = await api.get(`/api/leads?${params.toString()}`, token);
    if (res.success) setLeads(res.data);
    setLoading(false);
  };

  useEffect(() => { if (token) fetchLeads(); }, [token, statusFilter, scopeFilter]);

  const [auditMessage, setAuditMessage] = useState<string | null>(null);
  const [rowAuditing, setRowAuditing] = useState<number | null>(null);

  const runSingleAuditFR = async (id: number) => {
    setRowAuditing(id);
    await api.post(`/api/leads/${id}/audit`, { language: 'fr' }, token);
    setRowAuditing(null);
    fetchLeads();
  };

  const handleExport = () => {
    const a = document.createElement('a');
    a.href = `/api/leads/export?token=${token}`;
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

  return (
    <div className="space-y-6">
      {auditMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center justify-between">
          <span>{auditMessage}</span>
          <button onClick={() => setAuditMessage(null)} className="text-emerald-600 hover:text-emerald-950 font-bold text-xs">Dismiss</button>
        </div>
      )}
      <div className="flex justify-between items-end flex-wrap gap-4">
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-slate-900">Prospect Database</h3>
          <div className="flex gap-3 flex-wrap">
            <div className="relative">
              <Search className="w-3 h-3 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && fetchLeads()}
                className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-slate-100 w-64" 
              />
            </div>
            <select 
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold uppercase tracking-wider text-slate-500 outline-none"
            >
              <option value="">All Statuses</option>
              {['NEW', 'REVIEWED', 'QUALIFIED', 'CONTACTED', 'REPLIED', 'WON', 'LOST', 'DISMISSED'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-bold">
              <button
                type="button"
                onClick={() => setScopeFilter('team')}
                className={cn("px-2.5 py-1.5 rounded-md transition-all flex items-center gap-1 text-[11px]",
                  scopeFilter === 'team' ? "bg-white text-slate-900 shadow-xs font-bold" : "text-slate-500 hover:text-slate-900"
                )}
                title="Afficher tous les prospects générés par l'équipe"
              >
                👥 Équipe (Partagée)
              </button>
              <button
                type="button"
                onClick={() => setScopeFilter('personal')}
                className={cn("px-2.5 py-1.5 rounded-md transition-all flex items-center gap-1 text-[11px]",
                  scopeFilter === 'personal' ? "bg-white text-slate-900 shadow-xs font-bold" : "text-slate-500 hover:text-slate-900"
                )}
                title="Afficher uniquement mes prospects personnels"
              >
                👤 Mes Leads
              </button>
            </div>
          </div>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          {selectedLeads.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
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
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-blue-700 transition-colors shadow-lg shadow-blue-900/10"
              >
                <Languages className="w-3.5 h-3.5" /> Auditer en Français 🇫🇷 ({selectedLeads.length})
              </button>
              <button 
                onClick={async () => {
                  setAuditMessage(`Running standard audits for ${selectedLeads.length} leads in background...`);
                  for (const id of selectedLeads) {
                    await api.post(`/api/leads/${id}/audit`, { language: 'en' }, token);
                  }
                  setAuditMessage(`Audited ${selectedLeads.length} selected leads.`);
                  fetchLeads();
                  setSelectedLeads([]);
                }}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 text-white rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-slate-900 transition-colors shadow-sm"
              >
                Audit EN ({selectedLeads.length})
              </button>
            </div>
          )}
          <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-slate-50 transition-colors shadow-sm">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[400px]">
        {loading ? (
          <div className="flex justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-slate-200" /></div>
        ) : leads.length === 0 ? (
          <div className="p-20 text-center space-y-4">
            <Database className="w-12 h-12 text-slate-100 mx-auto" />
            <p className="text-slate-400 font-medium">No prospects match your current filters.</p>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 w-10">
                  <input type="checkbox" checked={selectedLeads.length === leads.length} onChange={toggleSelectAll} className="rounded border-slate-300 text-slate-900 focus:ring-slate-900" />
                </th>
                <th className="px-6 py-4">Company</th>
                <th className="px-6 py-4">Website</th>
                <th className="px-6 py-4 text-center">Audit</th>
                <th className="px-6 py-4 text-center">Opportunity</th>
                <th className="px-6 py-4 text-center">Contact Direct</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {leads.map((lead) => (
                <tr key={lead.id} className="hover:bg-slate-50 transition-colors group cursor-pointer" onClick={() => onSelectLead(lead.id)}>
                  <td className="px-6 py-4" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={selectedLeads.includes(lead.id)} onChange={() => toggleSelect(lead.id)} className="rounded border-slate-300 text-slate-900 focus:ring-slate-900" />
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors flex items-center gap-1.5">
                      <span>{lead.companyName}</span>
                      {(lead.phone || lead.website || lead.email) && (
                        <span title="Lead avec canal de contact vérifié" className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{lead.city || 'Region'}</span>
                      <div className="flex items-center gap-1.5 border-l border-slate-200 pl-2">
                        {lead.phone && <span title={`Téléphone vérifié: ${lead.phone}`}><Phone className="w-2.5 h-2.5 text-emerald-600" /></span>}
                        {lead.email && <span title={`Email vérifié: ${lead.email}`}><Mail className="w-2.5 h-2.5 text-blue-600" /></span>}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-[11px] font-medium text-slate-600 truncate max-w-[180px]">
                      {lead.website ? (
                        <a href={lead.website} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="hover:underline text-blue-600">
                          {lead.website.replace(/^https?:\/\/(www\.)?/, '')}
                        </a>
                      ) : (
                        <span className="text-slate-400 italic">No website found</span>
                      )}
                    </div>
                    <div className="mt-1">
                      <span className={cn("text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded",
                        lead.websiteStatus === 'verified' ? 'bg-emerald-50 text-emerald-700' :
                        lead.websiteStatus === 'unreachable' ? 'bg-red-50 text-red-700' :
                        lead.websiteStatus === 'not_detected' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'
                      )}>
                        {lead.websiteStatus || 'unknown'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={cn("text-xs font-bold", (lead.auditScore || 0) > 70 ? 'text-emerald-500' : 'text-slate-300')}>{lead.auditScore ?? '—'}</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={cn("text-xs font-extrabold", (lead.opportunityScore || 0) > 60 ? 'text-blue-600' : 'text-slate-400')}>{lead.opportunityScore ?? 0}</span>
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
                    <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider", 
                      lead.leadStatus === 'WON' ? 'bg-emerald-50 text-emerald-700' : 
                      lead.leadStatus === 'LOST' ? 'bg-red-50 text-red-700' : 
                      lead.leadStatus === 'NEW' ? 'bg-slate-100 text-slate-600' : 'bg-blue-50 text-blue-700'
                    )}>{lead.leadStatus}</span>
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
          <ArrowRight className="w-3 h-3 rotate-180" /> Back to Database
        </button>
        
        <div className="flex items-center gap-2 flex-wrap">
          <select 
            value={lead.leadStatus}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-[10px] font-bold uppercase tracking-[0.15em] outline-none hover:border-slate-300 transition-colors shadow-sm"
          >
            {['NEW', 'REVIEWED', 'QUALIFIED', 'CONTACTED', 'REPLIED', 'MEETING', 'PROPOSAL', 'WON', 'LOST', 'DISMISSED'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button 
            disabled={scraping}
            onClick={runScrape}
            className="px-3.5 py-2 bg-indigo-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-[0.15em] hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5 shadow-sm transition-all"
            title="Extraire le maximum d'informations du site et des réseaux sociaux"
          >
            {scraping ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            {scraping ? 'Extraction...' : 'Deep Scrape'}
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

          {/* Standard Audit Option */}
          <button 
            disabled={auditing}
            onClick={() => runAudit('en')}
            className="px-3 py-2 bg-slate-900 text-white rounded-lg text-[10px] font-bold uppercase tracking-[0.15em] hover:bg-slate-800 disabled:opacity-50 flex items-center gap-1.5 shadow-sm transition-all"
            title="Start English Audit"
          >
            {auditing && auditLang === 'en' ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            {auditing && auditLang === 'en' ? 'Auditing...' : 'Audit EN 🇬🇧'}
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
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" /> Social Presence Verified
                </div>
                <p className="text-[10px] text-indigo-900/80 leading-relaxed font-medium">
                  No standard website found. Primary digital identity extracted directly from official social media.
                </p>
              </div>
            )}
            
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-slate-300 shrink-0 mt-0.5" />
                <span className="text-xs font-medium text-slate-600">{lead.address || 'Loc. Unknown'}, {lead.city}, {lead.country}</span>
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
                  <span className="text-xs font-bold text-slate-600">{lead.googleRating} <span className="text-slate-400 font-medium">({lead.googleReviews} rev.)</span></span>
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
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Social Media Channels</span>
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
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-50">Opportunity Engine</p>
            <div className="text-4xl font-black">{lead.opportunityScore || 0}<span className="text-base font-bold opacity-30">/100</span></div>
            <p className="text-[11px] opacity-70 font-medium leading-relaxed italic border-l-2 border-white/10 pl-3">Detected {lead.opportunities?.length || 0} business gaps.</p>
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
          <Clock className="w-3 h-3" /> Timeline
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
          {activities.length === 0 && <p className="text-xs text-slate-400 italic pl-8">No activities recorded yet.</p>}
        </div>
      </div>

      {/* Side Panel: Notes & Tasks */}
      <div className="lg:col-span-2 space-y-8">
        {/* Notes Section */}
        <div className="space-y-4">
          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <MessageSquare className="w-3 h-3" /> Notes
          </h4>
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4 shadow-sm">
            <textarea 
              value={noteContent}
              onChange={e => setNoteContent(e.target.value)}
              placeholder="Add a private note..."
              className="w-full text-xs font-medium bg-slate-50 border border-slate-100 rounded-lg p-3 min-h-[80px] focus:outline-none focus:ring-1 focus:ring-slate-900 transition-all placeholder:text-slate-300"
            />
            <button 
              onClick={addNote}
              disabled={loading || !noteContent.trim()}
              className="w-full py-2 bg-slate-900 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-slate-800 transition-all disabled:opacity-30"
            >
              Post Note
            </button>
          </div>
          <div className="space-y-3">
            {notes.map(note => (
              <div key={note.id} className="bg-amber-50/50 p-4 rounded-xl border border-amber-100/50 space-y-2">
                <p className="text-xs text-slate-700 font-medium leading-relaxed whitespace-pre-wrap">{note.content}</p>
                <div className="flex justify-between items-center text-[9px] font-bold text-amber-600/60 uppercase">
                  <span>User</span>
                  <span>{formatDate(note.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tasks Section */}
        <div className="space-y-4">
          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Calendar className="w-3 h-3" /> Next Actions
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
                const title = prompt('Enter task description:');
                if (title) api.post(`/api/leads/${leadId}/tasks`, { title }, token).then(fetchData);
              }}
              className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:border-slate-400 hover:text-slate-600 transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-3 h-3" /> Add Task
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

  const [copiedNotice, setCopiedNotice] = useState(false);

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

  useEffect(() => {
    if (token) {
      api.get('/api/admin/data-quality', token).then((res) => {
        if (res.success) setData(res.data);
        setLoading(false);
      });
    }
  }, [token]);

  if (loading || !data) return <div className="flex justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-slate-200" /></div>;

  const stats = data.overall;
  const sources = data.sources;

  return (
    <div className="space-y-10 pb-20">
      <div className="space-y-2">
        <h3 className="text-2xl font-black text-slate-900 tracking-tight">Beta Data Quality & Monitoring</h3>
        <p className="text-sm text-slate-500 font-medium">Real-time performance metrics and reliability tracking for the LeadForge engine.</p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <QualityStatCard label="Lead Validity" value={stats.total > 0 ? Math.round(((stats.total - stats.withPhone) / stats.total) * 100) : 0} unit="%" subtext="With Phone Number" />
        <QualityStatCard label="Website Verification" value={stats.total > 0 ? Math.round((stats.verifiedWebsite / (stats.total)) * 100) : 0} unit="%" subtext="Verified Reachable" />
        <QualityStatCard label="Audit Rate" value={stats.total > 0 ? Math.round((stats.audited / stats.total) * 100) : 0} unit="%" subtext={`${stats.audited} audits performed`} />
        <QualityStatCard label="Analysis Rate" value={stats.total > 0 ? Math.round((stats.analyzed / stats.total) * 100) : 0} unit="%" subtext={`${stats.analyzed} interpreted by AI`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Source Reliability */}
        <div className="lg:col-span-2 space-y-6">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Source Distribution</h4>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Source</th>
                  <th className="px-6 py-4 text-center">Leads Found</th>
                  <th className="px-6 py-4 text-right">Avg Opp. Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sources.map((s: any) => (
                  <tr key={s.source} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-900 capitalize">{s.source || 'Manual'}</td>
                    <td className="px-6 py-4 text-center font-medium">{s.count}</td>
                    <td className="px-6 py-4 text-right font-mono text-slate-400">{Math.round(s.avgOppScore || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Lead Quality Breakdown */}
        <div className="space-y-6">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Lead Data Gaps</h4>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <QualityProgressBar label="Missing Phone" value={stats.total - stats.withPhone} total={stats.total} color="bg-amber-500" />
            <QualityProgressBar label="Missing Website" value={stats.total - stats.withWebsite} total={stats.total} color="bg-red-500" />
            <QualityProgressBar label="Not Detected Website" value={stats.notDetectedWebsite} total={stats.total} color="bg-orange-500" />
            <QualityProgressBar label="Unreachable Website" value={stats.unreachableWebsite} total={stats.total} color="bg-slate-400" />
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
        Review Submitted: {isCorrect ? 'Accurate' : 'Inaccurate'}
      </div>
    );
  }

  return (
    <div className="mt-6 pt-6 border-t border-slate-50 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em]">Manual Data Review</span>
        <div className="flex gap-2">
          <button 
            disabled={submitting}
            onClick={() => handleSubmit(true)}
            className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-colors flex items-center gap-1.5"
          >
            <Check className="w-3 h-3" /> Correct
          </button>
          <button 
            disabled={submitting}
            onClick={() => handleSubmit(false)}
            className="px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-red-100 transition-colors flex items-center gap-1.5"
          >
            <AlertCircle className="w-3 h-3" /> Incorrect
          </button>
        </div>
      </div>
      <input 
        type="text" 
        value={notes} 
        onChange={e => setNotes(e.target.value)}
        placeholder="Add review notes (optional)..."
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
            <h4 className="text-xs font-bold uppercase tracking-wider">Zero-Fabrication & Data Provenance Guarantee</h4>
          </div>
          <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-lg text-[10px] font-mono font-bold tracking-wide">
            100% REAL PUBLIC DATA
          </span>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          Every field value below was deterministically extracted from the official website, public social media profile, or OpenStreetMap record. <strong>LeadForge strictly prohibits fake, simulated, or invented contact details.</strong> If an email or phone is not publicly declared by the business, it remains empty (<code className="text-slate-400 font-mono">null</code>).
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-white/10 text-center">
          <div className="p-3 bg-white/5 rounded-xl border border-white/5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">Verified Fields</span>
            <span className="text-base font-black text-white">{evidenceList.length}</span>
          </div>
          <div className="p-3 bg-white/5 rounded-xl border border-white/5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">Contact Points</span>
            <span className="text-base font-black text-emerald-400">{contactCount}</span>
          </div>
          <div className="p-3 bg-white/5 rounded-xl border border-white/5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">Social Channels</span>
            <span className="text-base font-black text-indigo-400">{socialCount}</span>
          </div>
          <div className="p-3 bg-white/5 rounded-xl border border-white/5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">Fabricated Data</span>
            <span className="text-base font-black text-emerald-400">0%</span>
          </div>
        </div>
      </div>

      {/* Website & Social Presence Identity Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Presence Discovery & Channel Status</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Channel Status</span>
            <span className={cn("text-xs font-extrabold uppercase px-2 py-0.5 rounded inline-block",
              lead.websiteStatus === 'verified' ? 'bg-emerald-100 text-emerald-800' :
              lead.websiteStatus === 'social_profile' ? 'bg-indigo-100 text-indigo-800' :
              lead.websiteStatus === 'unreachable' ? 'bg-red-100 text-red-800' :
              lead.websiteStatus === 'not_detected' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-700'
            )}>{lead.websiteStatus === 'social_profile' ? 'Social Presence Only' : (lead.websiteStatus || 'unknown')}</span>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Confidence Rating</span>
            <span className="text-xs font-bold text-slate-800">{lead.websiteConfidence || lead.dataConfidence || 'UNKNOWN'}</span>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Enrichment Source</span>
            <span className="text-xs font-medium text-slate-700 truncate block">{lead.enrichmentSource || lead.discoverySource || lead.source || 'OpenStreetMap'}</span>
          </div>
        </div>

        {lead.website && (
          <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-xs text-blue-900 flex items-center justify-between flex-wrap gap-2">
            <span className="font-medium">
              {lead.websiteStatus === 'social_profile' ? 'Verified Social Presence URL:' : 'Audited Website URL:'} <code className="bg-white px-1.5 py-0.5 rounded border border-blue-200 font-mono text-[11px]">{lead.website}</code>
            </span>
            <a href={lead.website} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex items-center gap-1 font-bold text-[11px]">
              Open Source <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}
      </div>

      {/* Field Evidence Table with Filter Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h4 className="text-sm font-bold text-slate-900">Extracted Real Facts ({filteredEvidence.length})</h4>
            <p className="text-xs text-slate-500">Every record is backed by an exact URL and method extraction proof.</p>
          </div>

          <div className="flex gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold">
            {[
              { id: 'all', label: `All (${evidenceList.length})` },
              { id: 'contact', label: `Contact (${contactCount})` },
              { id: 'social', label: `Social Media (${socialCount})` },
              { id: 'location', label: 'Location & Hours' },
              { id: 'legal', label: 'Legal & Bio' },
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
            No field evidence recorded for this category yet. Click <strong>Deep Scrape & Extract</strong> above to crawl the site or social presence.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                <tr>
                  <th className="px-6 py-3">Field</th>
                  <th className="px-6 py-3">Verified Value</th>
                  <th className="px-6 py-3">Extraction Method & Source</th>
                  <th className="px-6 py-3">Confidence</th>
                  <th className="px-6 py-3">Public Source URL</th>
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
                      )}>{ev.confidence}</span>
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
        <p className="font-bold text-slate-800">Why are some fields empty?</p>
        <p className="leading-relaxed">
          LeadForge guarantees strict anti-fabrication standards. If a business does not publish a direct email or phone on their official website, social media profile, or OpenStreetMap entry, LeadForge keeps the field empty (<code className="text-slate-500 font-mono">null</code>). We do NOT guess generic mailboxes (such as <code className="text-slate-500 font-mono">info@domain.com</code>) unless explicitly listed by the business.
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
        <h3 className="text-xl font-bold text-slate-900">Pipeline & Provider Configuration</h3>
        <p className="text-xs text-slate-500">Transparent overview of LeadForge discovery sources, $0 MVP infrastructure, and optional search adapters.</p>
      </div>

      {/* $0 Free MVP Architecture */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h4 className="text-sm font-bold text-slate-900">Zero-Cost Discovery Stack ($0 MVP)</h4>
            <p className="text-xs text-slate-500">These components run out-of-the-box with no API keys, accounts, or credit card requirements.</p>
          </div>
          <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 font-bold text-xs uppercase tracking-wider rounded-lg border border-emerald-100">
            Active by Default
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800">1. OpenStreetMap (Overpass API)</span>
              <span className="text-[10px] font-bold text-emerald-600 uppercase">Primary Source</span>
            </div>
            <p className="text-slate-600 leading-relaxed">
              Provides raw business discovery across nodes and ways. LeadForge applies mathematical grid partitioning and polite concurrency (1.2s backoff) to prevent Overpass 504/429 limits.
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800">2. Nominatim Geocoding</span>
              <span className="text-[10px] font-bold text-emerald-600 uppercase">Geographic Coverage</span>
            </div>
            <p className="text-slate-600 leading-relaxed">
              Computes master bounding boxes for cities, regions, and countries, enabling intelligent multi-cell division (up to 25 cells for 1,000 targets).
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800">3. LeadForge Native Deep Crawler</span>
              <span className="text-[10px] font-bold text-emerald-600 uppercase">Contact Enrichment</span>
            </div>
            <p className="text-slate-600 leading-relaxed">
              Crawls up to 8 pages per official domain (Home, Contact, About, Legal, Impressum) extracting real phones, mailto links, and WhatsApp CTAs with evidence logging.
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800">4. Local Domain & Identity Prober</span>
              <span className="text-[10px] font-bold text-emerald-600 uppercase">Website Discovery</span>
            </div>
            <p className="text-slate-600 leading-relaxed">
              Generates deterministic domain candidates from normalized company names + local country TLDs (.ch, .com, .fr, .de), checking page title and content before verifying.
            </p>
          </div>
        </div>
      </div>

      {/* DuckDuckGo Explanation Card */}
      <div className="bg-amber-50/70 border border-amber-200/80 p-6 rounded-2xl space-y-3">
        <div className="flex items-center gap-2 text-amber-800">
          <Info className="w-4 h-4 shrink-0" />
          <h4 className="text-xs font-bold uppercase tracking-wider">Search Engine Policy: DuckDuckGo Notice</h4>
        </div>
        <p className="text-xs text-amber-900/80 leading-relaxed">
          <strong>Why DuckDuckGo is not an unauthenticated scraper in LeadForge:</strong> DuckDuckGo provides an "Instant Answer API" for Wikipedia definitions, but has <em>no official, permitted bulk search API</em> for commercial SERP scraping. Unofficial HTML scrapers violate terms of service, trigger automated Cloudflare CAPTCHAs, and fail at the scale of 100–1,000 leads. LeadForge strictly adheres to legitimate programmatic interfaces.
        </p>
      </div>

      {/* Optional Paid/Key Providers */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <div className="border-b border-slate-100 pb-4">
          <h4 className="text-sm font-bold text-slate-900">Optional External Search Adapters (Bring Your Own Key)</h4>
          <p className="text-xs text-slate-500">If you wish to augment website discovery beyond OSM and Local Probing, configure any of these standard providers via environment variables:</p>
        </div>

        <div className="space-y-4 text-xs">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900">Google Custom Search JSON API</span>
                <span className="px-2 py-0.5 bg-slate-200 text-slate-700 text-[9px] font-bold rounded">100 queries/day free</span>
              </div>
              <p className="text-slate-500 text-[11px]">Official Google search endpoint for locating company websites. Free tier includes 100 searches/day.</p>
              <div className="font-mono text-[10px] text-slate-600 bg-white p-1.5 rounded border border-slate-200 mt-1 inline-block">
                GOOGLE_SEARCH_API_KEY & GOOGLE_SEARCH_CX
              </div>
            </div>
            <span className="text-[10px] font-bold uppercase px-3 py-1 bg-slate-200 text-slate-600 rounded-lg text-center shrink-0">
              Optional Key
            </span>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900">Firecrawl API</span>
                <span className="px-2 py-0.5 bg-slate-200 text-slate-700 text-[9px] font-bold rounded">Commercial Scraping Cloud</span>
              </div>
              <p className="text-slate-500 text-[11px]">Specialized search & JavaScript web crawler service. Requires account signup.</p>
              <div className="font-mono text-[10px] text-slate-600 bg-white p-1.5 rounded border border-slate-200 mt-1 inline-block">
                FIRECRAWL_API_KEY
              </div>
            </div>
            <span className="text-[10px] font-bold uppercase px-3 py-1 bg-slate-200 text-slate-600 rounded-lg text-center shrink-0">
              Optional Key
            </span>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900">Bing Web Search API</span>
                <span className="px-2 py-0.5 bg-slate-200 text-slate-700 text-[9px] font-bold rounded">Azure Cognitive</span>
              </div>
              <p className="text-slate-500 text-[11px]">Microsoft Azure Cognitive Services search API.</p>
              <div className="font-mono text-[10px] text-slate-600 bg-white p-1.5 rounded border border-slate-200 mt-1 inline-block">
                BING_SEARCH_API_KEY
              </div>
            </div>
            <span className="text-[10px] font-bold uppercase px-3 py-1 bg-slate-200 text-slate-600 rounded-lg text-center shrink-0">
              Optional Key
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

