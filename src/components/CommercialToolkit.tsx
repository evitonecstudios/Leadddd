import React, { useState } from 'react';
import { 
  Phone, MessageSquare, Mail, Copy, Check, ExternalLink, Calendar, 
  Sparkles, CheckCircle2, XCircle, Clock, Send, MessageCircle, 
  Flame, HelpCircle, ArrowRight, ShieldCheck, UserCheck, AlertTriangle, X
} from 'lucide-react';
import { cn } from '../lib/utils.ts';

// Helper for formatting international WhatsApp numbers
export function formatWhatsAppNumber(phone?: string | null, country?: string | null): string {
  if (!phone) return '';
  let cleaned = phone.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  } else if (cleaned.startsWith('00')) {
    cleaned = cleaned.substring(2);
  } else if (cleaned.startsWith('0')) {
    const c = (country || '').toLowerCase();
    if (c.includes('switz') || c.includes('suisse') || c.includes('ch')) {
      cleaned = '41' + cleaned.substring(1);
    } else if (c.includes('belg') || c.includes('be')) {
      cleaned = '32' + cleaned.substring(1);
    } else if (c.includes('can') || c.includes('quebec')) {
      cleaned = '1' + cleaned.substring(1);
    } else {
      // Default to France (+33)
      cleaned = '33' + cleaned.substring(1);
    }
  }
  return cleaned;
}

interface CommercialToolkitProps {
  lead: any;
  token: string;
  onStatusChange?: () => void;
  onClose?: () => void;
  isModal?: boolean;
}

export function CommercialToolkit({
  lead,
  token,
  onStatusChange,
  onClose,
  isModal = false
}: CommercialToolkitProps) {
  const [activeSubTab, setActiveSubTab] = useState<'script' | 'whatsapp' | 'email' | 'objections'>('script');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [loggingStatus, setLoggingStatus] = useState(false);
  const [customNote, setCustomNote] = useState('');
  const [selectedObjection, setSelectedObjection] = useState<number | null>(null);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const logCommercialAction = async (status: string, activityType: string, description: string) => {
    try {
      setLoggingStatus(true);
      // 1. Update lead status
      await fetch(`/api/leads/${lead.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });

      // 2. Log activity
      await fetch(`/api/leads/${lead.id}/activities`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          type: activityType,
          description: customNote ? `${description} — Note: ${customNote}` : description,
          origin: 'USER'
        })
      });

      setCustomNote('');
      if (onStatusChange) onStatusChange();
    } catch (e) {
      console.error('Failed to log action:', e);
    } finally {
      setLoggingStatus(false);
    }
  };

  const waNumber = formatWhatsAppNumber(lead.phone, lead.country);
  const hasWebsite = Boolean(lead.website);
  const company = lead.companyName || 'votre établissement';
  const city = lead.city || 'votre secteur';
  const category = lead.category || 'commerce local';

  // Dynamic audit finding
  let auditFindingText = '';
  if (!hasWebsite) {
    auditFindingText = `vous n'avez pas encore de site vitrine officiel vérifié. Aujourd'hui, 85% des clients locaux à ${city} recherchent sur leur mobile avant de venir : ils tombent directement sur vos concurrents.`;
  } else if ((lead.auditScore || 0) < 60) {
    auditFindingText = `votre site internet actuel présente des lenteurs et des failles d'affichage sur smartphone qui font fuir les visiteurs avant qu'ils ne vous appellent.`;
  } else if (lead.googleRating && lead.googleRating < 4.2) {
    auditFindingText = `votre fiche Google Maps est à ${lead.googleRating}★ avec ${lead.googleReviews || 0} avis, ce qui limite vos appels entrants face à des confrères mieux positionnés.`;
  } else {
    auditFindingText = `votre présence digitale locale présente une opportunité immédiate de capter 15 à 30 demandes supplémentaires chaque mois sans publicité payante.`;
  }

  // Pre-formatted Outreach Messages
  const waMessageShort = `Bonjour, je me permets de vous contacter au sujet de ${company} à ${city}. J'ai identifié un point clé sur votre visibilité locale qui vous fait perdre des clients au profit de confrères. Auriez-vous 2 minutes cette semaine pour en discuter ?`;
  const waMessageAudit = `Bonjour, j'ai préparé un mini-audit digital gratuit pour ${company} (${category} à ${city}). Constat : ${auditFindingText} Je peux vous transmettre les 3 actions prioritaires sans aucun engagement. Souhaitez-vous que je vous l'envoie par message ?`;
  const waMessageFollowup = `Bonjour, j'ai tenté de vous joindre par téléphone chez ${company} sans succès. Je vous laisse ce message au sujet de votre présence sur ${city}. N'hésitez pas à me dire quand vous seriez disponible pour un échange rapide de 2 minutes. Belle journée !`;

  const emailSubject = `Opportunité de visibilité locale pour ${company} (${city})`;
  const emailBody = `Bonjour,

Je vous contacte car j'ai analysé la présence en ligne des ${category}s sur le secteur de ${city}.

En consultant la présence de ${company}, j'ai relevé un constat prioritaire :
👉 ${auditFindingText}

Nous accompagnons les commerçants et professionnels indépendants pour :
• Capter les clients locaux qui cherchent vos services sur Google et mobile
• Garantir une prise de contact immédiate (appel direct & WhatsApp)
• Sécuriser votre image professionnelle face à la concurrence locale

Je ne cherche rien à vous vendre par email. Seriez-vous disponible pour un court échange de 5 à 10 minutes (mardi à 10h ou jeudi à 14h) pour que je vous présente les 3 correctifs concrets ?

Bien cordialement,
Votre Conseiller Prospection Locale`;

  const objectionsList = [
    {
      title: "« On a déjà un site / on a déjà quelqu'un »",
      response: `« C'est une très bonne chose ! Justement, l'audit que nous avons réalisé montre que votre site actuel a des failles techniques qui bloquent la conversion sur mobile. Gardez votre prestataire actuel : je vous montre en 5 minutes les 3 correctifs prioritaires à lui demander de corriger gratuitement. Quand seriez-vous disponible ? »`
    },
    {
      title: "« Envoyez-moi un email d'abord »",
      response: `« Avec grand plaisir ! Pour que je vous transmette uniquement les chiffres qui vous intéressent et pas un document générique, avez-vous 30 secondes pour me dire si votre priorité ce mois-ci c'est d'avoir plus d'appels entrants ou d'améliorer votre réputation Google ? »`
    },
    {
      title: "« Pas le temps / Pas le budget »",
      response: `« Je comprends tout à fait, vous êtes en plein rush / sur le terrain. C'est exactement pour cela que notre approche est 100% clé en main et s'autofinance dès le 1er ou 2ème client supplémentaire capté. Quel est le meilleur moment où vous êtes plus au calme cette semaine ? »`
    },
    {
      title: "« Comment avez-vous eu mon numéro ? »",
      response: `« Votre numéro est publiquement référencé sur les registres professionnels et votre fiche d'établissement à ${city}. Je contacte personnellement et de façon ciblée les meilleurs indépendants de la commune. »`
    },
    {
      title: "« Ça ne m'intéresse pas »",
      response: `« Aucun problème, je comprends ! Est-ce parce que votre carnet de commandes est déjà plein pour les 6 prochains mois, ou parce que vous avez déjà été déçu par une agence ? »`
    }
  ];

  return (
    <div className={cn("space-y-6", isModal ? "p-6" : "")}>
      {/* Top Banner / Lead Context */}
      <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-xl space-y-4">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 text-[10px] font-bold uppercase tracking-wider rounded border border-blue-500/30">
                Fiche Commerciale
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                ID #{lead.id}
              </span>
            </div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              {lead.companyName}
            </h3>
            <p className="text-xs text-slate-300 font-medium">
              📍 {lead.city || 'Territoire'}, {lead.country || ''} • <span className="text-blue-400 font-semibold">{lead.category || 'Activité locale'}</span>
            </p>
          </div>

          {/* Quick Action Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            {lead.phone ? (
              <>
                <a
                  href={`tel:${lead.phone}`}
                  className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-emerald-950/20"
                  title="Lancer l'appel téléphonique"
                >
                  <Phone className="w-3.5 h-3.5" />
                  Appeler ({lead.phone})
                </a>
                {waNumber && (
                  <a
                    href={`https://wa.me/${waNumber}?text=${encodeURIComponent(waMessageShort)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-emerald-950/20"
                    title="Ouvrir WhatsApp Web / App"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    WhatsApp Direct
                  </a>
                )}
              </>
            ) : (
              <span className="px-3 py-1.5 bg-slate-800 text-slate-400 rounded-lg text-xs font-medium border border-slate-700">
                Pas de téléphone
              </span>
            )}

            {lead.email && (
              <a
                href={`mailto:${lead.email}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`}
                className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all"
                title="Envoyer un email"
              >
                <Mail className="w-3.5 h-3.5" />
                Email
              </a>
            )}

            {isModal && onClose && (
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-white rounded-lg bg-slate-800 border border-slate-700 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* 1-Click Fast Status & Call Logger Bar */}
        <div className="border-t border-slate-800 pt-4 space-y-2">
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-bold uppercase tracking-wider">
            <span>Enregistrement rapide du résultat de l'échange :</span>
            <span className="font-mono text-blue-400">Statut actuel: {lead.leadStatus}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <button
              disabled={loggingStatus}
              onClick={() => logCommercialAction('MEETING', 'MEETING_SET', '📅 RDV commercial pris avec le prospect !')}
              className="px-2.5 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm"
            >
              <Calendar className="w-3 h-3" />
              RDV Fixé 🎯
            </button>
            <button
              disabled={loggingStatus}
              onClick={() => logCommercialAction('QUALIFIED', 'CALL', '🗣️ Prospect très intéressé - Rappel convenu.')}
              className="px-2.5 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm"
            >
              <UserCheck className="w-3 h-3" />
              Intéressé (Rappel)
            </button>
            <button
              disabled={loggingStatus}
              onClick={() => logCommercialAction('CONTACTED', 'CALL_NO_ANSWER', '📞 Tentative d\'appel : Pas de réponse / Répondeur')}
              className="px-2.5 py-2 bg-amber-700 hover:bg-amber-600 text-white rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm"
            >
              <Clock className="w-3 h-3" />
              Ne répond pas
            </button>
            <button
              disabled={loggingStatus}
              onClick={() => logCommercialAction('CONTACTED', 'EMAIL_SENT', '📧 Email de prospection & audit envoyé')}
              className="px-2.5 py-2 bg-purple-700 hover:bg-purple-600 text-white rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm"
            >
              <Send className="w-3 h-3" />
              Email envoyé
            </button>
            <button
              disabled={loggingStatus}
              onClick={() => logCommercialAction('DISMISSED', 'STATUS_CHANGE', '❌ Prospect non intéressé pour le moment')}
              className="px-2.5 py-2 bg-rose-900/80 hover:bg-rose-800 text-rose-100 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm"
            >
              <XCircle className="w-3 h-3" />
              Refus / Pas dispo
            </button>
          </div>
        </div>
      </div>

      {/* Toolkit Navigation Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        {[
          { id: 'script', label: "📞 Script d'Appel (Cold Call)", icon: Phone },
          { id: 'whatsapp', label: "💬 Messages WhatsApp & SMS", icon: MessageCircle },
          { id: 'email', label: "✉️ Email de Prospection B2B", icon: Mail },
          { id: 'objections', label: "🛡️ Réponses aux Objections", icon: ShieldCheck }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id as any)}
            className={cn(
              "px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap",
              activeSubTab === tab.id
                ? "bg-slate-900 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            )}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: COLD CALL SCRIPT */}
      {activeSubTab === 'script' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Flame className="w-4 h-4 text-orange-500" />
                Script Téléphonique Recommandé (Cadence 2 Minutes)
              </h4>
              <button
                onClick={() => copyToClipboard(`1. ACCROCHE :
Bonjour, je cherche à joindre le responsable de ${company}. Bonjour, je vous appelle très rapidement au sujet de ${company} à ${city}. Je ne vous dérange que 2 minutes chrono.

2. LE CONSTAT AUDIT :
${auditFindingText}

3. LA PROPOSITION DE VALEUR :
Nous aidons justement les ${category}s de ${city} à capter entre 15 et 30 nouveaux clients chaque mois avec un dispositif clé en main sans engagement.

4. CLOSING DU RDV :
L'idée n'est rien de vous vendre aujourd'hui : est-ce que mardi à 10h ou jeudi à 14h vous conviendrait pour un diagnostic visuel de 10 minutes en visio ou par téléphone ?`, 'full-script')}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
              >
                {copiedKey === 'full-script' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedKey === 'full-script' ? 'Copié !' : 'Copier tout le script'}
              </button>
            </div>

            <div className="space-y-3 text-xs leading-relaxed">
              {/* Step 1 */}
              <div className="p-3.5 bg-blue-50/70 border border-blue-100 rounded-lg space-y-1">
                <div className="font-bold text-blue-900 uppercase tracking-wide text-[10px] flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">1</span>
                  L'Accroche (15 premières secondes)
                </div>
                <p className="text-blue-950 font-medium">
                  « Bonjour, je cherche à joindre le gérant ou le responsable de <strong>{company}</strong> ? ... Bonjour, je suis [Votre Prénom], je vous contacte très rapidement au sujet de votre présence sur <strong>{city}</strong>. Je ne vous dérange que 2 minutes chrono. »
                </p>
                <p className="text-[11px] text-blue-700 italic">
                  💡 Conseil : Ton chaleureux et direct, sourire dans la voix, ne parlez pas de produit.
                </p>
              </div>

              {/* Step 2 */}
              <div className="p-3.5 bg-amber-50/70 border border-amber-100 rounded-lg space-y-1">
                <div className="font-bold text-amber-900 uppercase tracking-wide text-[10px] flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-amber-600 text-white flex items-center justify-center text-[10px]">2</span>
                  Le Constat Choc (L'argument issu de l'audit)
                </div>
                <p className="text-amber-950 font-medium">
                  « J'ai fait une étude rapide des commerces locaux sur votre commune, et j'ai relevé un point majeur pour vous : <strong>{auditFindingText}</strong> »
                </p>
              </div>

              {/* Step 3 */}
              <div className="p-3.5 bg-emerald-50/70 border border-emerald-100 rounded-lg space-y-1">
                <div className="font-bold text-emerald-900 uppercase tracking-wide text-[10px] flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">3</span>
                  La Proposition de Valeur
                </div>
                <p className="text-emerald-950 font-medium">
                  « C'est précisément pour cela qu'on a mis en place une solution clé en main pour les professionnels de <strong>{city}</strong>, afin de vous positionner en tête des recherches locales et de doubler vos demandes de contact. »
                </p>
              </div>

              {/* Step 4 */}
              <div className="p-3.5 bg-slate-100 border border-slate-200 rounded-lg space-y-1">
                <div className="font-bold text-slate-800 uppercase tracking-wide text-[10px] flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px]">4</span>
                  Le Closing du Rendez-vous (L'Alternative binaire)
                </div>
                <p className="text-slate-900 font-semibold">
                  « L'idée n'est rien de vous vendre au téléphone aujourd'hui : est-ce que <strong>mardi à 10h</strong> ou <strong>jeudi à 14h</strong> vous conviendrait pour que je vous montre les 3 correctifs en 10 minutes par visio ou téléphone ? »
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: WHATSAPP MESSAGES */}
      {activeSubTab === 'whatsapp' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                <MessageCircle className="w-4 h-4 text-emerald-600" />
                Numéro WhatsApp détecté : {waNumber ? `+${waNumber}` : 'Aucun numéro mobile'}
              </span>
              <p className="text-[11px] text-emerald-700">
                Formate automatiquement l'indicatif international (France +33, Suisse +41, Belgique +32).
              </p>
            </div>
            {waNumber && (
              <a
                href={`https://wa.me/${waNumber}?text=${encodeURIComponent(waMessageShort)}`}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-sm"
              >
                Ouvrir WhatsApp Web <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Template 1 */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 flex flex-col justify-between shadow-2xs">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-bold uppercase">
                    1. Accroche Courte
                  </span>
                  <span className="text-[10px] text-slate-400">Taux de réponse max</span>
                </div>
                <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-100 font-sans whitespace-pre-wrap leading-relaxed">
                  {waMessageShort}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => copyToClipboard(waMessageShort, 'wa1')}
                  className="flex-1 py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center justify-center gap-1"
                >
                  {copiedKey === 'wa1' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  Copier
                </button>
                {waNumber && (
                  <a
                    href={`https://wa.me/${waNumber}?text=${encodeURIComponent(waMessageShort)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center justify-center"
                  >
                    Envoyer
                  </a>
                )}
              </div>
            </div>

            {/* Template 2 */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 flex flex-col justify-between shadow-2xs">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[10px] font-bold uppercase">
                    2. Pitch Mini-Audit
                  </span>
                  <span className="text-[10px] text-slate-400">Curiosité</span>
                </div>
                <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-100 font-sans whitespace-pre-wrap leading-relaxed">
                  {waMessageAudit}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => copyToClipboard(waMessageAudit, 'wa2')}
                  className="flex-1 py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center justify-center gap-1"
                >
                  {copiedKey === 'wa2' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  Copier
                </button>
                {waNumber && (
                  <a
                    href={`https://wa.me/${waNumber}?text=${encodeURIComponent(waMessageAudit)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center justify-center"
                  >
                    Envoyer
                  </a>
                )}
              </div>
            </div>

            {/* Template 3 */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 flex flex-col justify-between shadow-2xs">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-[10px] font-bold uppercase">
                    3. Relance Post-Appel
                  </span>
                  <span className="text-[10px] text-slate-400">Après répondeur</span>
                </div>
                <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-100 font-sans whitespace-pre-wrap leading-relaxed">
                  {waMessageFollowup}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => copyToClipboard(waMessageFollowup, 'wa3')}
                  className="flex-1 py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center justify-center gap-1"
                >
                  {copiedKey === 'wa3' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  Copier
                </button>
                {waNumber && (
                  <a
                    href={`https://wa.me/${waNumber}?text=${encodeURIComponent(waMessageFollowup)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center justify-center"
                  >
                    Envoyer
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: COLD EMAIL */}
      {activeSubTab === 'email' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="space-y-0.5">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-indigo-600" />
                  Modèle d'Email B2B Personnalisé avec l'Audit
                </h4>
                <p className="text-xs text-slate-500">
                  Destinataire : {lead.email || <span className="text-amber-600 font-medium">Non renseigné (à envoyer via formulaire web ou LinkedIn)</span>}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => copyToClipboard(`Objet : ${emailSubject}\n\n${emailBody}`, 'email-body')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors"
                >
                  {copiedKey === 'email-body' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedKey === 'email-body' ? 'Copié !' : 'Copier Tout'}
                </button>
                {lead.email && (
                  <a
                    href={`mailto:${lead.email}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Ouvrir dans Messagerie
                  </a>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Objet de l'email :</label>
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900">
                  {emailSubject}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Corps du message :</label>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 whitespace-pre-wrap leading-relaxed font-sans">
                  {emailBody}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: OBJECTION HANDLING MATRIX */}
      {activeSubTab === 'objections' && (
        <div className="space-y-3 animate-in fade-in duration-200">
          <p className="text-xs text-slate-500 font-medium">
            Cliquez sur l'objection du prospect pour afficher la réponse immédiate formulée par notre méthodologie de vente :
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {objectionsList.map((obj, idx) => (
              <div
                key={idx}
                className={cn(
                  "p-4 rounded-xl border transition-all cursor-pointer space-y-2",
                  selectedObjection === idx
                    ? "bg-slate-900 text-white border-slate-900 shadow-lg"
                    : "bg-white text-slate-800 border-slate-200 hover:border-slate-300 shadow-2xs"
                )}
                onClick={() => setSelectedObjection(selectedObjection === idx ? null : idx)}
              >
                <div className="flex items-center justify-between font-bold text-xs">
                  <span>{obj.title}</span>
                  <span className={cn("text-[10px] font-mono px-2 py-0.5 rounded", selectedObjection === idx ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600")}>
                    {selectedObjection === idx ? 'Fermer' : 'Afficher réponse'}
                  </span>
                </div>
                {selectedObjection === idx && (
                  <div className="pt-2 border-t border-white/20 text-xs leading-relaxed text-slate-200 font-sans italic animate-in fade-in">
                    {obj.response}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
