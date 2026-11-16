import Papa from 'papaparse';
import { analyzePhoneNumber } from './phoneUtils.ts';

interface WorkspaceState {
  nextId: number;
  campaigns: any[];
  leads: any[];
  fieldEvidence: any[];
  audits: any[];
  opportunities: any[];
  aiAnalyses: any[];
  notes: any[];
  activities: any[];
  tasks: any[];
  savedViews: any[];
  qualityReviews: any[];
  jobs: any[];
}

const DB_NAME = 'leadforge_zero_config_v1';
const STORE_NAME = 'workspace';
const STATE_KEY = 'state';

const createEmptyState = (): WorkspaceState => ({
  nextId: 1,
  campaigns: [],
  leads: [],
  fieldEvidence: [],
  audits: [],
  opportunities: [],
  aiAnalyses: [],
  notes: [],
  activities: [],
  tasks: [],
  savedViews: [],
  qualityReviews: [],
  jobs: []
});

class LocalWorkspaceStoreImpl {
  private memoryState: WorkspaceState | null = null;
  private loadPromise: Promise<WorkspaceState> | null = null;
  private activeJobCancel = new Set<number>();

  private openIdb(): Promise<IDBDatabase | null> {
    if (typeof indexedDB === 'undefined') return Promise.resolve(null);
    return new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  private async getState(): Promise<WorkspaceState> {
    if (this.memoryState) return this.memoryState;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = (async () => {
      const idb = await this.openIdb();
      if (idb) {
        try {
          const loaded = await new Promise<WorkspaceState | null>((resolve) => {
            const tx = idb.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const req = store.get(STATE_KEY);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => resolve(null);
          });
          if (loaded && typeof loaded === 'object') {
            this.memoryState = { ...createEmptyState(), ...loaded };
            return this.memoryState;
          }
        } catch {}
      }
      this.memoryState = createEmptyState();
      return this.memoryState;
    })();

    return this.loadPromise;
  }

  private async saveState(state: WorkspaceState): Promise<void> {
    this.memoryState = state;
    const idb = await this.openIdb();
    if (!idb) return;
    try {
      await new Promise<void>((resolve) => {
        const tx = idb.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put(state, STATE_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    } catch {}
  }

  private allocId(state: WorkspaceState): number {
    const id = state.nextId || 1;
    state.nextId = id + 1;
    return id;
  }

  private normalizeDomain(url?: string | null): string | null {
    if (!url) return null;
    try {
      let clean = url.trim().toLowerCase();
      if (!clean.startsWith('http://') && !clean.startsWith('https://')) clean = 'http://' + clean;
      let host = new URL(clean).hostname;
      if (host.startsWith('www.')) host = host.slice(4);
      return host;
    } catch {
      return null;
    }
  }

  private normalizePhone(phone?: string | null): string {
    if (!phone) return '';
    return phone.replace(/[^\d+]/g, '');
  }

  private isDuplicateLead(state: WorkspaceState, candidate: { companyName?: string; city?: string; website?: string | null; phone?: string | null; normalizedDomain?: string | null; normalizedPhone?: string | null }) {
    const active = state.leads.filter(l => !l.deletedAt && l.leadStatus !== 'UNQUALIFIED');
    const dom = candidate.normalizedDomain || this.normalizeDomain(candidate.website);
    if (dom && active.some(l => l.normalizedDomain === dom)) return true;

    const ph = candidate.normalizedPhone || this.normalizePhone(candidate.phone);
    if (ph && ph.length >= 7 && active.some(l => l.normalizedPhone === ph)) return true;

    const normName = (candidate.companyName || '').trim().replace(/\s+/g, ' ').toUpperCase();
    const cityLower = (candidate.city || '').trim().toLowerCase();
    if (normName && active.some(l => l.normalizedCompanyName === normName && (!cityLower || (l.city || '').trim().toLowerCase() === cityLower))) {
      return true;
    }
    return false;
  }

  private filterLeads(state: WorkspaceState, query: URLSearchParams): any[] {
    let list = state.leads.filter(l => !l.deletedAt && l.leadStatus !== 'UNQUALIFIED');

    const search = query.get('search')?.trim();
    if (search) {
      const terms = search.toLowerCase().split(/\s+/).filter(Boolean);
      list = list.filter(l => {
        const haystack = [l.companyName, l.city, l.category, l.address, l.website, l.email, l.notes, l.phone, l.normalizedPhone]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return terms.every(t => haystack.includes(t));
      });
    }

    const statusParam = query.get('status');
    if (statusParam && statusParam.toUpperCase() !== 'ALL') {
      const statuses = statusParam.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
      if (statuses.length > 0) {
        list = list.filter(l => statuses.includes((l.leadStatus || 'NEW').toUpperCase()));
      }
    }

    const cityParam = query.get('city');
    if (cityParam && cityParam.toUpperCase() !== 'ALL') {
      const cities = cityParam.split(',').map(c => c.trim().toLowerCase()).filter(Boolean);
      if (cities.length > 0) {
        list = list.filter(l => cities.some(c => (l.city || '').toLowerCase().includes(c)));
      }
    }

    const catParam = query.get('category');
    if (catParam && catParam.toUpperCase() !== 'ALL') {
      const cats = catParam.split(',').map(c => c.trim().toLowerCase()).filter(Boolean);
      if (cats.length > 0) {
        list = list.filter(l => cats.some(c => (l.category || '').toLowerCase().includes(c)));
      }
    }

    const countryParam = query.get('country');
    if (countryParam && countryParam.toUpperCase() !== 'ALL') {
      const cLower = countryParam.trim().toLowerCase();
      list = list.filter(l => (l.country || '').toLowerCase().includes(cLower));
    }

    const contact = query.get('contactFilter') || query.get('contact');
    if (contact === 'has_whatsapp' || contact === 'whatsapp' || query.get('hasWhatsapp') === 'true' || query.get('hasWhatsApp') === 'true') {
      list = list.filter(l => {
        const hasWaEvidence = state.fieldEvidence.some(fe => fe.leadId === l.id && fe.fieldName === 'whatsapp');
        const hasExplicit = Boolean(l.notes?.toLowerCase().includes('whatsapp') || hasWaEvidence);
        return hasExplicit || analyzePhoneNumber(l.phone, l.country, hasExplicit).isWhatsAppReady;
      });
    } else if (contact === 'has_facebook') {
      list = list.filter(l =>
        l.notes?.toLowerCase().includes('facebook.com') ||
        l.website?.toLowerCase().includes('facebook.com') ||
        state.fieldEvidence.some(fe => fe.leadId === l.id && fe.fieldName === 'facebook')
      );
    } else if (contact === 'valid_contact' || query.get('onlyValidContact') === 'true') {
      list = list.filter(l => Boolean(l.phone || l.email || l.website));
    } else if (contact === 'has_phone' || query.get('hasPhone') === 'true') {
      list = list.filter(l => Boolean(l.phone));
    } else if (contact === 'missing_phone' || query.get('hasPhone') === 'false') {
      list = list.filter(l => !l.phone);
    } else if (contact === 'has_email' || query.get('hasEmail') === 'true') {
      list = list.filter(l => Boolean(l.email));
    } else if (contact === 'missing_email' || query.get('hasEmail') === 'false') {
      list = list.filter(l => !l.email);
    } else if (contact === 'has_both') {
      list = list.filter(l => Boolean(l.phone && l.email));
    } else if (contact === 'has_either') {
      list = list.filter(l => Boolean(l.phone || l.email));
    }

    const web = query.get('websiteFilter') || query.get('hasWebsite');
    if (web === 'has_website' || web === 'true') list = list.filter(l => Boolean(l.website));
    else if (web === 'no_website' || web === 'false') list = list.filter(l => !l.website);
    else if (web && ['verified', 'not_detected', 'unreachable', 'social_profile'].includes(web)) {
      list = list.filter(l => l.websiteStatus === web);
    }

    const websiteStatus = query.get('websiteStatus');
    if (websiteStatus && websiteStatus.toLowerCase() !== 'all') {
      list = list.filter(l => l.websiteStatus === websiteStatus);
    }

    const oppRange = query.get('oppScoreRange') || query.get('opportunityFilter');
    if (oppRange === 'high') list = list.filter(l => (l.opportunityScore || 0) >= 60);
    else if (oppRange === 'medium') list = list.filter(l => (l.opportunityScore || 0) >= 30 && (l.opportunityScore || 0) < 60);
    else if (oppRange === 'low') list = list.filter(l => (l.opportunityScore || 0) < 30);

    const auditFilter = query.get('auditFilter');
    if (auditFilter === 'audited') list = list.filter(l => l.auditScore !== null && l.auditScore !== undefined);
    else if (auditFilter === 'not_audited') list = list.filter(l => l.auditScore === null || l.auditScore === undefined);
    else if (auditFilter === 'good') list = list.filter(l => (l.auditScore ?? -1) >= 70);
    else if (auditFilter === 'needs_work') list = list.filter(l => l.auditScore !== null && l.auditScore !== undefined && l.auditScore < 70);

    const confidence = query.get('confidence');
    if (confidence && confidence.toUpperCase() !== 'ALL') {
      list = list.filter(l => l.dataConfidence === confidence.toUpperCase());
    }

    const intentFilter = query.get('intentFilter');
    if (intentFilter === 'high_intent') list = list.filter(l => (l.opportunityScore || 0) >= 65);
    else if (intentFilter === 'no_website') {
      list = list.filter(l => !l.website || l.websiteStatus === 'social_profile' || l.websiteStatus === 'not_detected');
    } else if (intentFilter === 'call_ready') {
      list = list.filter(l => Boolean(l.phone) && (l.opportunityScore || 0) >= 45);
    } else if (intentFilter === 'high_ticket') {
      const highKw = ['dentist', 'dentaire', 'plombier', 'plumber', 'electricien', 'electrician', 'avocat', 'lawyer', 'architect', 'notaire', 'mecanic', 'garage', 'restaurant', 'chauffagiste', 'hvac'];
      list = list.filter(l => highKw.some(k => (l.category || '').toLowerCase().includes(k)));
    }

    const sortBy = query.get('sortBy') || 'createdAt';
    const sortOrder = query.get('sortOrder') === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      const va = a[sortBy];
      const vb = b[sortBy];
      if (sortBy === 'createdAt') {
        return (new Date(va || 0).getTime() - new Date(vb || 0).getTime()) * sortOrder;
      }
      if (typeof va === 'number' || typeof vb === 'number') {
        return ((Number(va) || 0) - (Number(vb) || 0)) * sortOrder;
      }
      return String(va || '').localeCompare(String(vb || '')) * sortOrder;
    });

    return list;
  }

  private async runStatelessGeneration(jobId: number, sourceId: string, criteria: any, campaignId: number, isResume = false) {
    const state = await this.getState();
    const job = state.jobs.find(j => j.id === jobId);
    if (!job) return;

    const targetCount = Number(criteria?.limit || criteria?.maxResults || 50);
    const results = job.results || {};
    results.target = targetCount;
    if (!isResume) {
      results.totalFound = 0;
      results.validBusinesses = 0;
      results.newLeadsSaved = 0;
      results.duplicates = 0;
      results.chainsFiltered = 0;
      results.websiteCandidates = 0;
      results.verifiedWebsites = 0;
      results.phonesFound = 0;
      results.emailsFound = 0;
      results.pagesCrawled = 0;
      results.auditsCompleted = 0;
      results.opportunitiesAnalyzed = 0;
    }

    const updateJob = async (status: string, progress: number, step: string, cell = results.currentCell) => {
      results.currentStep = step;
      results.currentCell = cell;
      job.status = status;
      job.progress = progress;
      job.results = { ...results };
      job.updatedAt = new Date().toISOString();
      await this.saveState(state);
    };

    try {
      await updateJob('running', results.newLeadsSaved || 0, 'Découverte des établissements via OpenStreetMap...', 'Zone 1');

      const isStrictMode = Boolean(
        criteria.intentMode === 'FACEBOOK_NO_WEBSITE' ||
        criteria.intentMode === 'WHATSAPP' ||
        criteria.intentMode === 'NO_WEBSITE' ||
        criteria.requireWhatsApp
      );
      const fetchLimit = Math.min(Math.max((targetCount - (results.newLeadsSaved || 0)) * (isStrictMode ? 4 : 2), 60), 200);

      const discoverRes = await fetch('/api/stateless/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId, criteria: { ...criteria, limit: fetchLimit } })
      });
      const discoverJson = await discoverRes.json();

      let rawLeads: any[] = discoverJson?.success ? (discoverJson.data?.leads || []) : [];
      if (discoverJson?.data?.chainsExcludedCount) {
        results.chainsFiltered += discoverJson.data.chainsExcludedCount;
      }

      if (rawLeads.length < targetCount && (criteria.city || criteria.country) && criteria.category) {
        await updateJob('running', results.newLeadsSaved || 0, 'Vague complémentaire Nominatim/Photon en cours...', 'Zone complémentaire');
        try {
          const nomRes = await fetch('/api/stateless/discover', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sourceId, criteria: { ...criteria, limit: fetchLimit }, fallbackNominatim: true })
          });
          const nomJson = await nomRes.json();
          if (nomJson?.success && Array.isArray(nomJson.data?.leads)) {
            rawLeads = [...rawLeads, ...nomJson.data.leads];
          }
        } catch {}
      }

      results.totalFound += rawLeads.length;

      // Deduplicate raw candidates locally before sending batches to Vercel serverless
      const seenKeys = new Set<string>();
      const uniqueCandidates: any[] = [];
      for (const r of rawLeads) {
        const key = `${(r.companyName || '').toLowerCase()}|${(r.city || '').toLowerCase()}`;
        if (seenKeys.has(key)) {
          results.duplicates++;
          continue;
        }
        if (this.isDuplicateLead(state, { companyName: r.companyName, city: r.city, website: r.website, phone: r.phone })) {
          results.duplicates++;
          continue;
        }
        seenKeys.add(key);
        uniqueCandidates.push(r);
      }

      const BATCH_SIZE = 8;
      for (let i = 0; i < uniqueCandidates.length; i += BATCH_SIZE) {
        if (this.activeJobCancel.has(jobId) || results.newLeadsSaved >= targetCount) break;
        const batch = uniqueCandidates.slice(i, i + BATCH_SIZE);
        await updateJob(
          'running',
          results.newLeadsSaved,
          `Enrichissement Scrapling & Audits (${results.newLeadsSaved}/${targetCount} prospects)...`,
          `Lot ${Math.floor(i / BATCH_SIZE) + 1}/${Math.max(1, Math.ceil(uniqueCandidates.length / BATCH_SIZE))}`
        );

        const enrichRes = await fetch('/api/stateless/enrich-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rawLeads: batch, criteria })
        });
        const enrichJson = await enrichRes.json();
        const processed: any[] = enrichJson?.success ? (enrichJson.data || []) : [];

        for (const item of processed) {
          if (!item?.matched || !item.lead) {
            if (item?.rejected) results.unverifiedFiltered = (results.unverifiedFiltered || 0) + 1;
            continue;
          }
          if (results.newLeadsSaved >= targetCount) break;
          if (this.isDuplicateLead(state, item.lead)) {
            results.duplicates++;
            continue;
          }

          const leadId = this.allocId(state);
          const nowIso = new Date().toISOString();
          const savedLead = {
            ...item.lead,
            id: leadId,
            campaignId,
            createdAt: nowIso,
            updatedAt: nowIso
          };
          state.leads.push(savedLead);

          for (const ev of item.evidence || []) {
            state.fieldEvidence.push({ ...ev, id: this.allocId(state), leadId, createdAt: nowIso });
          }
          if (item.audit) {
            const auditId = this.allocId(state);
            state.audits.push({
              ...item.audit,
              id: auditId,
              leadId,
              createdAt: nowIso
            });
            results.auditsCompleted++;
          }
          for (const opp of item.opportunities || []) {
            state.opportunities.push({ ...opp, id: this.allocId(state), leadId, createdAt: nowIso });
          }
          if ((item.opportunities || []).length > 0) {
            results.opportunitiesAnalyzed++;
          }

          if (item.statsDelta) {
            results.websiteCandidates += item.statsDelta.websiteCandidates || 0;
            results.verifiedWebsites += item.statsDelta.verifiedWebsites || 0;
            results.pagesCrawled += item.statsDelta.pagesCrawled || 0;
            results.phonesFound += item.statsDelta.phonesFound || 0;
            results.emailsFound += item.statsDelta.emailsFound || 0;
          }

          results.validBusinesses++;
          results.newLeadsSaved++;
        }

        await this.saveState(state);
      }

      results.canResume = false;
      await updateJob(
        'completed',
        results.newLeadsSaved,
        `Terminé avec succès. ${results.validBusinesses} prospects qualifiés découverts.`,
        'Terminé'
      );
    } catch (err: any) {
      job.status = 'failed';
      job.error = err.message;
      job.results = { ...results, currentStep: `Erreur: ${err.message}` };
      await this.saveState(state);
    }
  }

  async exportCsv(urlQuery: string): Promise<void> {
    const state = await this.getState();
    const q = new URLSearchParams(urlQuery.includes('?') ? urlQuery.split('?')[1] : urlQuery);
    const matched = this.filterLeads(state, q);

    const rows = matched.map((l: any) => ({
      'Entreprise': l.companyName || '',
      'Activité / Métier': l.category || '',
      'Ville': l.city || '',
      'Adresse': l.address || '',
      'Pays': l.country || 'France',
      'Téléphone': l.phone || '',
      'Email': l.email || '',
      'Site Web': l.website || '',
      'Statut du Site': l.websiteStatus === 'verified' ? 'Vérifié' : l.websiteStatus === 'not_detected' ? 'Non détecté' : l.websiteStatus === 'unreachable' ? 'Inaccessible' : 'Inconnu',
      'Fiabilité Données': l.dataConfidence || 'MOYENNE',
      'Score Opportunité': l.opportunityScore ?? 0,
      'Score Audit': l.auditScore ?? '—',
      'Statut Prospection': l.leadStatus || 'NEW',
      'Notes & Mentions': l.notes || '',
      'Date Découverte': l.createdAt ? new Date(l.createdAt).toLocaleDateString('fr-FR') : ''
    }));

    const csv = '\uFEFF' + Papa.unparse(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prospects-leadforge-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async handleRequest(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', fullUrl: string, body?: any): Promise<any> {
    const state = await this.getState();
    const [rawPath, queryStr = ''] = fullUrl.split('?');
    const path = rawPath.replace(/^\/api/, '');
    const query = new URLSearchParams(queryStr);

    // 1. User profile
    if (method === 'GET' && path === '/me') {
      return {
        success: true,
        data: { id: 1, uid: 'local-workspace', email: 'local@leadforge.app', name: 'Espace Autonome Vercel' }
      };
    }

    // 2. Dashboard Stats
    if (method === 'GET' && path === '/dashboard/stats') {
      const active = state.leads.filter(l => !l.deletedAt && l.leadStatus !== 'UNQUALIFIED');
      const activeIds = new Set(active.map(l => l.id));
      const oppCountsMap = new Map<string, number>();
      for (const opp of state.opportunities) {
        if (activeIds.has(opp.leadId)) {
          oppCountsMap.set(opp.type, (oppCountsMap.get(opp.type) || 0) + 1);
        }
      }

      return {
        success: true,
        data: {
          total: active.length,
          new: active.filter(l => l.leadStatus === 'NEW').length,
          reviewed: active.filter(l => l.leadStatus === 'REVIEWED').length,
          qualified: active.filter(l => l.leadStatus === 'QUALIFIED').length,
          contacted: active.filter(l => l.leadStatus === 'CONTACTED').length,
          replied: active.filter(l => l.leadStatus === 'REPLIED').length,
          won: active.filter(l => l.leadStatus === 'WON').length,
          websitesFound: active.filter(l => l.websiteStatus === 'verified').length,
          websitesMissing: active.filter(l => l.websiteStatus === 'not_detected').length,
          highOpportunity: active.filter(l => (l.opportunityScore || 0) > 60).length,
          opportunities: Array.from(oppCountsMap.entries()).map(([type, count]) => ({ type, count }))
        }
      };
    }

    // 3. Filter Options
    if (method === 'GET' && path === '/leads/filter-options') {
      const active = state.leads.filter(l => !l.deletedAt && l.leadStatus !== 'UNQUALIFIED');
      const countBy = (arr: any[], key: string) => {
        const map = new Map<string, number>();
        for (const item of arr) {
          const val = item[key];
          if (val) map.set(val, (map.get(val) || 0) + 1);
        }
        return Array.from(map.entries())
          .map(([k, count]) => ({ [key]: k, count }))
          .sort((a: any, b: any) => b.count - a.count)
          .slice(0, 60);
      };

      return {
        success: true,
        data: {
          cities: countBy(active, 'city'),
          categories: countBy(active, 'category'),
          statusCounts: countBy(active, 'leadStatus').map((s: any) => ({ status: s.leadStatus, count: s.count })),
          summary: {
            total: active.length,
            withValidContact: active.filter(l => Boolean(l.phone || l.email)).length,
            withPhone: active.filter(l => Boolean(l.phone)).length,
            withEmail: active.filter(l => Boolean(l.email)).length,
            withWebsite: active.filter(l => Boolean(l.website)).length,
            noWebsite: active.filter(l => !l.website).length,
            withWhatsapp: active.filter(l => {
              const hasWa = Boolean(l.notes?.toLowerCase().includes('whatsapp') || state.fieldEvidence.some(fe => fe.leadId === l.id && fe.fieldName === 'whatsapp'));
              return hasWa || analyzePhoneNumber(l.phone, l.country, hasWa).isWhatsAppReady;
            }).length,
            withFacebook: active.filter(l =>
              l.notes?.toLowerCase().includes('facebook.com') ||
              l.website?.toLowerCase().includes('facebook.com') ||
              state.fieldEvidence.some(fe => fe.leadId === l.id && fe.fieldName === 'facebook')
            ).length,
            highOpportunity: active.filter(l => (l.opportunityScore || 0) >= 60).length
          }
        }
      };
    }

    // 4. Leads list
    if (method === 'GET' && path === '/leads') {
      const filtered = this.filterLeads(state, query);
      const total = filtered.length;
      const page = Math.max(1, parseInt(query.get('page') || '1') || 1);
      const limit = Math.min(500, Math.max(1, parseInt(query.get('limit') || '50') || 50));
      const offset = (page - 1) * limit;
      return {
        success: true,
        data: filtered.slice(offset, offset + limit),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1
      };
    }

    // 5. Campaigns
    if (method === 'GET' && path === '/campaigns') {
      return { success: true, data: state.campaigns };
    }
    if (method === 'POST' && path === '/campaigns') {
      const newCampaign = {
        id: this.allocId(state),
        userId: 1,
        name: body?.name || 'Campagne',
        industry: body?.industry,
        location: body?.location,
        filters: body?.filters || {},
        createdAt: new Date().toISOString()
      };
      state.campaigns.push(newCampaign);
      await this.saveState(state);
      return { success: true, data: newCampaign };
    }

    // 6. Generate & Jobs
    if (method === 'POST' && path === '/generate') {
      const { sourceId = 'osm', criteria = {}, campaignName, campaignId: existingCampaignId } = body || {};
      let campaignId = existingCampaignId;
      if (!campaignId && campaignName) {
        const c = {
          id: this.allocId(state),
          userId: 1,
          name: campaignName,
          industry: criteria.category,
          location: criteria.city || criteria.country,
          createdAt: new Date().toISOString()
        };
        state.campaigns.push(c);
        campaignId = c.id;
      }

      const targetCount = criteria?.limit || criteria?.maxResults || 50;
      const job = {
        id: this.allocId(state),
        userId: 1,
        type: 'LEAD_GEN',
        status: 'running',
        progress: 0,
        total: targetCount,
        results: {
          target: targetCount,
          totalFound: 0,
          validBusinesses: 0,
          newLeadsSaved: 0,
          duplicates: 0,
          chainsFiltered: 0,
          websiteCandidates: 0,
          verifiedWebsites: 0,
          phonesFound: 0,
          emailsFound: 0,
          pagesCrawled: 0,
          auditsCompleted: 0,
          opportunitiesAnalyzed: 0,
          currentStep: 'Initialisation du pipeline...',
          currentCell: 'Démarrage'
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      state.jobs.push(job);
      await this.saveState(state);

      void this.runStatelessGeneration(job.id, sourceId, criteria, campaignId, false);
      return { success: true, data: job };
    }

    const jobMatch = path.match(/^\/jobs\/(\d+)$/);
    if (method === 'GET' && jobMatch) {
      const id = parseInt(jobMatch[1]);
      const job = state.jobs.find(j => j.id === id);
      if (!job) return { success: false, error: 'Job not found' };
      return { success: true, data: job };
    }

    const resumeMatch = path.match(/^\/jobs\/(\d+)\/resume$/);
    if (method === 'POST' && resumeMatch) {
      const id = parseInt(resumeMatch[1]);
      const job = state.jobs.find(j => j.id === id);
      if (!job) return { success: false, error: 'Job not found' };
      const { sourceId = 'osm', criteria = {}, campaignId } = body || {};
      void this.runStatelessGeneration(id, sourceId, criteria, campaignId || 1, true);
      return { success: true, message: 'Job resumed', data: job };
    }

    // 7. CSV Import
    if (method === 'POST' && path === '/leads/import') {
      const { rows = [], mapping = {}, campaignId } = body || {};
      const job = {
        id: this.allocId(state),
        userId: 1,
        type: 'CSV_IMPORT',
        status: 'completed',
        progress: rows.length,
        total: rows.length,
        results: { imported: 0, duplicates: 0, failed: 0 },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      for (const row of rows) {
        const companyName = row[mapping.companyName]?.trim();
        if (!companyName) {
          job.results.failed++;
          continue;
        }
        const phone = row[mapping.phone]?.trim() || null;
        const email = row[mapping.email]?.trim() || null;
        const website = row[mapping.website]?.trim() || null;
        if (this.isDuplicateLead(state, { companyName, website, phone })) {
          job.results.duplicates++;
          continue;
        }
        const nowIso = new Date().toISOString();
        state.leads.push({
          id: this.allocId(state),
          campaignId: campaignId || null,
          companyName,
          normalizedCompanyName: companyName.toUpperCase(),
          phone,
          normalizedPhone: this.normalizePhone(phone),
          email,
          website,
          normalizedDomain: this.normalizeDomain(website),
          source: 'CSV',
          websiteStatus: website ? 'verified' : 'not_detected',
          dataConfidence: phone || email ? 'MEDIUM' : 'LOW',
          opportunityScore: website ? 40 : 65,
          leadStatus: 'NEW',
          createdAt: nowIso,
          updatedAt: nowIso
        });
        job.results.imported++;
      }

      state.jobs.push(job);
      await this.saveState(state);
      return { success: true, data: job };
    }

    // 8. Lead Detail
    const leadMatch = path.match(/^\/leads\/(\d+)$/);
    if (method === 'GET' && leadMatch) {
      const leadId = parseInt(leadMatch[1]);
      const lead = state.leads.find(l => l.id === leadId && !l.deletedAt);
      if (!lead) return { success: false, error: 'Lead not found' };
      return {
        success: true,
        data: {
          ...lead,
          campaign: state.campaigns.find(c => c.id === lead.campaignId) || null,
          opportunities: state.opportunities.filter(o => o.leadId === leadId),
          audits: state.audits
            .filter(a => a.leadId === leadId)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
          evidence: state.fieldEvidence.filter(e => e.leadId === leadId)
        }
      };
    }

    // 9. Update Lead Status
    const statusMatch = path.match(/^\/leads\/(\d+)\/status$/);
    if (method === 'PATCH' && statusMatch) {
      const leadId = parseInt(statusMatch[1]);
      const lead = state.leads.find(l => l.id === leadId);
      if (!lead) return { success: false, error: 'Lead not found' };
      const oldStatus = lead.leadStatus;
      lead.leadStatus = body?.status || lead.leadStatus;
      lead.updatedAt = new Date().toISOString();
      state.activities.push({
        id: this.allocId(state),
        leadId,
        userId: 1,
        type: 'STATUS_CHANGE',
        description: `Statut mis à jour : ${oldStatus} → ${lead.leadStatus}${body?.reason ? ` (${body.reason})` : ''}`,
        origin: 'USER',
        createdAt: new Date().toISOString()
      });
      await this.saveState(state);
      return { success: true };
    }

    // 10. Stateless Scrape for existing lead
    const scrapeMatch = path.match(/^\/leads\/(\d+)\/scrape$/);
    if (method === 'POST' && scrapeMatch) {
      const leadId = parseInt(scrapeMatch[1]);
      const lead = state.leads.find(l => l.id === leadId);
      if (!lead) return { success: false, error: 'Lead not found' };

      const res = await fetch('/api/stateless/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead })
      });
      const json = await res.json();
      if (!json.success) return json;

      const { leadUpdates, evidence, evidenceCount } = json.data;
      Object.assign(lead, leadUpdates, { updatedAt: new Date().toISOString() });
      for (const ev of evidence || []) {
        state.fieldEvidence.push({ ...ev, id: this.allocId(state), leadId, createdAt: new Date().toISOString() });
      }
      state.activities.push({
        id: this.allocId(state),
        leadId,
        userId: 1,
        type: 'SCRAPE_COMPLETED',
        description: `${evidenceCount} points de données vérifiés extraits`,
        origin: 'SYSTEM',
        createdAt: new Date().toISOString()
      });
      await this.saveState(state);

      const refreshed = await this.handleRequest('GET', `/api/leads/${leadId}`);
      return { success: true, data: refreshed.data, evidenceCount };
    }

    // 11. Stateless Audit for existing lead
    const auditMatch = path.match(/^\/leads\/(\d+)\/audit$/);
    if (method === 'POST' && auditMatch) {
      const leadId = parseInt(auditMatch[1]);
      const lead = state.leads.find(l => l.id === leadId);
      if (!lead) return { success: false, error: 'Lead not found' };

      const { language = 'fr', generateAi = true } = body || {};
      const res = await fetch('/api/stateless/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead, language, generateAi })
      });
      const json = await res.json();
      if (!json.success) return json;

      const { leadUpdates, audit, opportunities: newOpps, aiAnalysis, opportunityScore } = json.data;
      Object.assign(lead, leadUpdates, { updatedAt: new Date().toISOString() });
      const nowIso = new Date().toISOString();

      if (audit) {
        state.audits.push({ ...audit, id: this.allocId(state), leadId, createdAt: nowIso });
      }
      state.opportunities = state.opportunities.filter(o => o.leadId !== leadId);
      for (const o of newOpps || []) {
        state.opportunities.push({ ...o, id: this.allocId(state), leadId, createdAt: nowIso });
      }
      if (aiAnalysis) {
        state.aiAnalyses.push({
          id: this.allocId(state),
          leadId,
          language,
          tone: 'consultative',
          result: aiAnalysis,
          createdAt: nowIso
        });
      }
      state.activities.push({
        id: this.allocId(state),
        leadId,
        userId: 1,
        type: 'AUDIT_COMPLETED',
        description: `Audit technique et analyse commerciale finalisés (${language})`,
        origin: 'SYSTEM',
        createdAt: nowIso
      });
      await this.saveState(state);
      return { success: true, data: { leadId, opportunityScore, opportunities: newOpps } };
    }

    // 12. AI Analysis
    const aiMatch = path.match(/^\/leads\/(\d+)\/ai$/);
    if (aiMatch) {
      const leadId = parseInt(aiMatch[1]);
      if (method === 'GET') {
        const lang = query.get('language');
        const list = state.aiAnalyses
          .filter(a => a.leadId === leadId)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        const found = (lang ? list.find(a => a.language === lang) : null) || list[0];
        return {
          success: true,
          data: found ? { ...found.result, language: found.language, tone: found.tone } : null
        };
      }
      if (method === 'POST') {
        const lead = state.leads.find(l => l.id === leadId);
        if (!lead) return { success: false, error: 'Lead not found' };
        const { language = 'fr', tone = 'consultative' } = body || {};
        const latestAudit = state.audits
          .filter(a => a.leadId === leadId)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
        const leadOpps = state.opportunities.filter(o => o.leadId === leadId);

        const aiInput = {
          lead: {
            companyName: lead.companyName,
            category: lead.category || null,
            city: lead.city || null,
            country: lead.country || null,
            address: lead.address || null,
            phone: lead.phone || null,
            email: lead.email || null,
            website: lead.website || null,
            source: lead.source || null
          },
          website: {
            status: lead.websiteStatus || null,
            url: lead.website || null,
            finalUrl: latestAudit?.finalUrl || lead.website || null
          },
          audit: {
            overallScore: latestAudit?.overallScore ?? 45,
            technicalScore: latestAudit?.technicalScore ?? null,
            seoScore: latestAudit?.seoScore ?? null,
            mobileScore: latestAudit?.mobileScore ?? null,
            performanceScore: latestAudit?.performanceScore ?? null,
            conversionScore: latestAudit?.conversionScore ?? null,
            localSeoScore: latestAudit?.localSeoScore ?? null
          },
          findings: (latestAudit?.findings || []).map((f: any) => ({
            category: f.category,
            severity: f.severity,
            title: f.title,
            evidence: f.evidence
          })),
          opportunities: leadOpps.map((o: any) => ({
            type: o.type,
            title: o.title,
            description: o.description,
            evidence: o.evidence
          }))
        };

        const res = await fetch('/api/stateless/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ input: aiInput, language, tone })
        });
        const json = await res.json();
        if (!json.success) return json;

        state.aiAnalyses.push({
          id: this.allocId(state),
          leadId,
          language,
          tone,
          result: json.data,
          createdAt: new Date().toISOString()
        });
        await this.saveState(state);
        return json;
      }
    }

    // 13. Notes, Activities, Tasks
    const notesMatch = path.match(/^\/leads\/(\d+)\/notes$/);
    if (notesMatch) {
      const leadId = parseInt(notesMatch[1]);
      if (method === 'GET') {
        return {
          success: true,
          data: state.notes.filter(n => n.leadId === leadId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        };
      }
      if (method === 'POST') {
        const note = { id: this.allocId(state), leadId, userId: 1, content: body?.content || '', createdAt: new Date().toISOString() };
        state.notes.push(note);
        await this.saveState(state);
        return { success: true, data: note };
      }
    }

    const actMatch = path.match(/^\/leads\/(\d+)\/activities$/);
    if (actMatch) {
      const leadId = parseInt(actMatch[1]);
      if (method === 'GET') {
        return {
          success: true,
          data: state.activities.filter(a => a.leadId === leadId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        };
      }
      if (method === 'POST') {
        const act = {
          id: this.allocId(state),
          leadId,
          userId: 1,
          type: body?.type || 'NOTE',
          description: body?.description || 'Activité',
          metadata: body?.metadata || null,
          origin: body?.origin || 'USER',
          createdAt: new Date().toISOString()
        };
        state.activities.push(act);
        await this.saveState(state);
        return { success: true, data: act };
      }
    }

    const tasksMatch = path.match(/^\/leads\/(\d+)\/tasks$/);
    if (tasksMatch) {
      const leadId = parseInt(tasksMatch[1]);
      if (method === 'GET') {
        return {
          success: true,
          data: state.tasks.filter(t => t.leadId === leadId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        };
      }
      if (method === 'POST') {
        const task = {
          id: this.allocId(state),
          leadId,
          userId: 1,
          title: body?.title || 'Suivi',
          completed: false,
          dueDate: body?.dueDate || null,
          createdAt: new Date().toISOString()
        };
        state.tasks.push(task);
        await this.saveState(state);
        return { success: true, data: task };
      }
    }

    const completeTaskMatch = path.match(/^\/tasks\/(\d+)\/complete$/);
    if (method === 'PATCH' && completeTaskMatch) {
      const taskId = parseInt(completeTaskMatch[1]);
      const task = state.tasks.find(t => t.id === taskId);
      if (task) {
        task.completed = !task.completed;
        await this.saveState(state);
      }
      return { success: true, data: task };
    }

    // 14. Data Quality & Database Clean
    if (method === 'GET' && path === '/admin/data-quality') {
      const active = state.leads.filter(l => !l.deletedAt);
      const bySource = new Map<string, { count: number; oppSum: number }>();
      for (const l of active) {
        const s = l.source || 'OpenStreetMap';
        const cur = bySource.get(s) || { count: 0, oppSum: 0 };
        cur.count++;
        cur.oppSum += l.opportunityScore || 0;
        bySource.set(s, cur);
      }

      return {
        success: true,
        data: {
          overall: {
            total: active.length,
            withWebsite: active.filter(l => Boolean(l.website)).length,
            verifiedWebsite: active.filter(l => l.websiteStatus === 'verified').length,
            unreachableWebsite: active.filter(l => l.websiteStatus === 'unreachable').length,
            notDetectedWebsite: active.filter(l => l.websiteStatus === 'not_detected').length,
            withPhone: active.filter(l => Boolean(l.phone)).length,
            withEmail: active.filter(l => Boolean(l.email)).length,
            audited: active.filter(l => l.auditScore !== null && l.auditScore !== undefined).length,
            analyzed: active.filter(l => l.leadStatus !== 'NEW').length
          },
          sources: Array.from(bySource.entries()).map(([source, v]) => ({
            source,
            count: v.count,
            avgOppScore: v.count > 0 ? Math.round(v.oppSum / v.count) : 0
          }))
        }
      };
    }

    if (method === 'POST' && path === '/leads/clean-database') {
      const active = state.leads.filter(l => !l.deletedAt);
      let updatedCount = 0;
      for (const l of active) {
        let score = 0;
        if (l.phone) score += 30;
        if (l.website) score += 25;
        if (l.email) score += 20;
        if (l.address) score += 15;
        if (l.notes) score += 10;
        const conf = score >= 70 ? 'HIGH' : score >= 40 ? 'MEDIUM' : 'LOW';
        if (l.dataConfidence !== conf || (l.opportunityScore || 0) < score) {
          l.dataConfidence = conf;
          l.opportunityScore = Math.max(l.opportunityScore || 0, score);
          updatedCount++;
        }
      }
      await this.saveState(state);
      return {
        success: true,
        message: `${updatedCount} prospects normalisés et qualifiés avec succès.`,
        totalScanned: active.length
      };
    }

    // 15. Quality Reviews & Saved Views
    if (method === 'POST' && path === '/quality-reviews') {
      const review = { id: this.allocId(state), userId: 1, ...body, createdAt: new Date().toISOString() };
      state.qualityReviews.push(review);
      await this.saveState(state);
      return { success: true, data: review };
    }

    if (method === 'GET' && path === '/saved-views') {
      return { success: true, data: state.savedViews };
    }
    if (method === 'POST' && path === '/saved-views') {
      const view = { id: this.allocId(state), userId: 1, name: body?.name, filters: body?.filters, createdAt: new Date().toISOString() };
      state.savedViews.push(view);
      await this.saveState(state);
      return { success: true, data: view };
    }

    return { success: false, error: `Unsupported local workspace route: ${method} ${path}` };
  }
}

export const LocalWorkspaceStore = new LocalWorkspaceStoreImpl();
