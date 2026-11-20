import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users,
  UserPlus,
  ShieldCheck,
  Calculator,
  Compass,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Eye,
  EyeOff,
  Copy,
  Check,
  Search,
  Lock,
  Unlock,
  KeyRound,
  MapPin,
  Sparkles,
  Info,
  X,
} from 'lucide-react';
import { SiteGardiennage, StaffAccountRole, UserProfile } from '../types';
import {
  createStaffAccountByDirection,
  listStaffAccountsAndIdentifiers,
  updateStaffAccountStatus,
  updateStaffAssignedSites,
} from '../services/staffAccountsService';
import {
  generateStrongSecretCode,
  normalizeLoginIdentifier,
  suggestNextLoginIdentifier,
  validateLoginIdentifierForRole,
  validateSecretCode,
} from '../services/loginIdentifierUtils';
import { resolveEffectiveEntrepriseId } from '../utils/enterpriseContext';

interface UserAccountsManagementPanelProps {
  currentUser: UserProfile;
  sites: SiteGardiennage[];
}

export const UserAccountsManagementPanel: React.FC<UserAccountsManagementPanelProps> = ({
  currentUser,
  sites,
}) => {
  const [accounts, setAccounts] = useState<UserProfile[]>([]);
  const [existingLoginIds, setExistingLoginIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filters
  const [roleFilter, setRoleFilter] = useState<'all' | StaffAccountRole>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'actif' | 'desactive'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Create form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newRole, setNewRole] = useState<StaffAccountRole>('comptabilite');
  const [newLoginId, setNewLoginId] = useState('');
  const [isLoginIdManual, setIsLoginIdManual] = useState(false);
  const [newNom, setNewNom] = useState('');
  const [newPrenom, setNewPrenom] = useState('');
  const [newGrade, setNewGrade] = useState('');
  const [newTelephone, setNewTelephone] = useState('');
  const [newSitesIds, setNewSitesIds] = useState<string[]>([]);
  const [newSecretCode, setNewSecretCode] = useState('');
  const [confirmSecretCode, setConfirmSecretCode] = useState('');
  const [showSecretCode, setShowSecretCode] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // One-time confirmation card after creation (never persisted)
  const [justCreatedSummary, setJustCreatedSummary] = useState<{
    loginId: string;
    nom: string;
    role: StaffAccountRole;
  } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Action feedback (status toggle / sites edit)
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [confirmToggleUid, setConfirmToggleUid] = useState<string | null>(null);
  const [togglingUid, setTogglingUid] = useState<string | null>(null);

  // Inline sites editor for a Contrôleur
  const [editingSitesAccount, setEditingSitesAccount] = useState<UserProfile | null>(null);
  const [editingSitesSelection, setEditingSitesSelection] = useState<string[]>([]);
  const [isSavingSites, setIsSavingSites] = useState(false);

  const directionEntrepriseId = useMemo(
    () => resolveEffectiveEntrepriseId(currentUser.entrepriseId),
    [currentUser.entrepriseId]
  );

  const loadAccounts = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    const res = await listStaffAccountsAndIdentifiers(directionEntrepriseId);
    if (res.success) {
      setAccounts(res.accounts);
      setExistingLoginIds(res.existingLoginIds);
    } else {
      setLoadError(res.error || 'Impossible de charger les comptes utilisateurs.');
    }
    setIsLoading(false);
  }, [directionEntrepriseId]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  // Auto-suggest next sequential CPT-YYYY-XXX / CTR-YYYY-XXX when role or existing IDs change
  const suggestedLoginId = useMemo(
    () => suggestNextLoginIdentifier(newRole, existingLoginIds),
    [newRole, existingLoginIds]
  );

  useEffect(() => {
    if (!isLoginIdManual) {
      setNewLoginId(suggestedLoginId);
    }
  }, [suggestedLoginId, isLoginIdManual]);

  const staffAccounts = useMemo(
    () => accounts.filter((a) => a.role === 'comptabilite' || a.role === 'controleur'),
    [accounts]
  );

  const directionAccounts = useMemo(
    () => accounts.filter((a) => a.role === 'direction'),
    [accounts]
  );

  const filteredStaffAccounts = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return staffAccounts.filter((acc) => {
      if (roleFilter !== 'all' && acc.role !== roleFilter) return false;
      if (statusFilter !== 'all' && acc.statut !== statusFilter) return false;
      if (q) {
        const hay = `${acc.loginId || ''} ${acc.nom} ${acc.prenom || ''} ${acc.grade || ''} ${acc.telephone || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [staffAccounts, roleFilter, statusFilter, searchTerm]);

  const stats = useMemo(() => {
    const comptables = staffAccounts.filter((a) => a.role === 'comptabilite').length;
    const controleurs = staffAccounts.filter((a) => a.role === 'controleur').length;
    const actifs = staffAccounts.filter((a) => a.statut === 'actif').length;
    const desactives = staffAccounts.filter((a) => a.statut === 'desactive').length;
    return { total: staffAccounts.length, comptables, controleurs, actifs, desactives };
  }, [staffAccounts]);

  const normalizedInputLoginId = normalizeLoginIdentifier(newLoginId);
  const isDuplicateLocal = Boolean(
    normalizedInputLoginId && existingLoginIds.includes(normalizedInputLoginId)
  );

  const copyText = (text: string, key: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
      setCopiedId(key);
      setTimeout(() => setCopiedId((prev) => (prev === key ? null : prev)), 2500);
    }
  };

  const handleRoleSwitchInForm = (role: StaffAccountRole) => {
    setNewRole(role);
    setIsLoginIdManual(false);
    setCreateError(null);
  };

  const handleGenerateSecret = () => {
    const generated = generateStrongSecretCode(8);
    setNewSecretCode(generated);
    setConfirmSecretCode(generated);
    setShowSecretCode(true);
    setCreateError(null);
  };

  const toggleNewSiteSelection = (siteId: string) => {
    setNewSitesIds((prev) =>
      prev.includes(siteId) ? prev.filter((id) => id !== siteId) : [...prev, siteId]
    );
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setActionNotice(null);

    const idCheck = validateLoginIdentifierForRole(newLoginId, newRole);
    if (!idCheck.valid) {
      setCreateError(idCheck.error || 'Identifiant invalide.');
      return;
    }

    if (isDuplicateLocal) {
      setCreateError(
        `L’identifiant ${idCheck.normalized} est déjà attribué. Utilisez l’identifiant suggéré (${suggestedLoginId}) ou choisissez un numéro libre.`
      );
      return;
    }

    if (newNom.trim().length < 2) {
      setCreateError('Veuillez saisir le nom complet du collaborateur (minimum 2 caractères).');
      return;
    }

    const secretCheck = validateSecretCode(newSecretCode);
    if (!secretCheck.valid) {
      setCreateError(secretCheck.error || 'Code secret invalide.');
      return;
    }

    if (newSecretCode !== confirmSecretCode) {
      setCreateError('La confirmation du code secret ne correspond pas.');
      return;
    }

    setIsCreating(true);
    try {
      const res = await createStaffAccountByDirection({
        role: newRole,
        loginId: idCheck.normalized,
        entrepriseId: directionEntrepriseId,
        nom: newNom.trim(),
        prenom: newPrenom.trim() || undefined,
        grade: newGrade.trim() || undefined,
        telephone: newTelephone.trim() || undefined,
        sitesAssignesIds: newRole === 'controleur' ? newSitesIds : [],
        secretCode: newSecretCode,
      });

      if (res.success && res.account) {
        const created = res.account;
        setAccounts((prev) => [created, ...prev]);
        setExistingLoginIds((prev) =>
          created.loginId && !prev.includes(created.loginId) ? [...prev, created.loginId] : prev
        );
        setJustCreatedSummary({
          loginId: created.loginId || idCheck.normalized,
          nom: created.prenom ? `${created.prenom} ${created.nom}` : created.nom,
          role: newRole,
        });

        // Purge immédiate des champs sensibles en mémoire React
        setNewNom('');
        setNewPrenom('');
        setNewGrade('');
        setNewTelephone('');
        setNewSitesIds([]);
        setNewSecretCode('');
        setConfirmSecretCode('');
        setShowSecretCode(false);
        setIsLoginIdManual(false);
        setShowCreateForm(false);
      } else {
        setCreateError(res.error || 'Impossible de créer ce compte.');
      }
    } catch {
      setCreateError('Erreur technique imprévue lors de la création du compte.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleConfirmToggleStatus = async (account: UserProfile) => {
    const nextStatus = account.statut === 'actif' ? 'desactive' : 'actif';
    setTogglingUid(account.uid);
    setActionNotice(null);

    try {
      const res = await updateStaffAccountStatus(account.uid, account.loginId, nextStatus);
      if (res.success) {
        setAccounts((prev) =>
          prev.map((a) => (a.uid === account.uid ? { ...a, statut: nextStatus } : a))
        );
        setConfirmToggleUid(null);
        setActionNotice({
          type: 'success',
          message:
            nextStatus === 'desactive'
              ? `Compte ${account.loginId || account.nom} désactivé. L’accès à l’application et aux données Firestore est immédiatement bloqué.`
              : `Compte ${account.loginId || account.nom} réactivé avec succès.`,
        });
      } else {
        setActionNotice({
          type: 'error',
          message: res.error || 'Échec de la mise à jour du statut.',
        });
      }
    } finally {
      setTogglingUid(null);
    }
  };

  const openSitesEditor = (account: UserProfile) => {
    setEditingSitesAccount(account);
    setEditingSitesSelection(Array.isArray(account.sitesAssignesIds) ? [...account.sitesAssignesIds] : []);
  };

  const handleSaveAssignedSites = async () => {
    if (!editingSitesAccount) return;
    setIsSavingSites(true);
    setActionNotice(null);
    try {
      const res = await updateStaffAssignedSites(editingSitesAccount.uid, editingSitesSelection);
      if (res.success) {
        setAccounts((prev) =>
          prev.map((a) =>
            a.uid === editingSitesAccount.uid
              ? { ...a, sitesAssignesIds: [...editingSitesSelection] }
              : a
          )
        );
        setActionNotice({
          type: 'success',
          message: `Sites de ronde mis à jour pour ${editingSitesAccount.loginId || editingSitesAccount.nom} (${editingSitesSelection.length} site(s)).`,
        });
        setEditingSitesAccount(null);
      } else {
        setActionNotice({
          type: 'error',
          message: res.error || 'Impossible de mettre à jour les sites assignés.',
        });
      }
    } finally {
      setIsSavingSites(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Header card */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
              <Users className="w-5 h-5" />
            </span>
            <h3 className="text-lg font-bold text-white">
              Gestion des Comptes de Connexion (Comptable & Contrôleur)
            </h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              Exclusif Direction
            </span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed max-w-3xl">
            Créez des accès individuels durables avec identifiant unique (<span className="font-mono text-blue-300">CPT-2026-XXX</span> pour la Comptabilité, <span className="font-mono text-emerald-300">CTR-2026-XXX</span> pour les Contrôleurs) et code secret personnel. La création d’un compte ne déconnecte jamais votre session Direction.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={loadAccounts}
            disabled={isLoading}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Actualiser</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setShowCreateForm((v) => !v);
              setCreateError(null);
            }}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-lg shadow-emerald-950/50"
          >
            {showCreateForm ? <X className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
            <span>{showCreateForm ? 'Fermer le formulaire' : 'Nouveau compte d’accès'}</span>
          </button>
        </div>
      </div>

      {/* Separation notice: Login accounts vs HR Agent matricules */}
      <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 text-xs text-slate-300 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed text-[11px] text-slate-300">
          <strong className="text-white">Séparation stricte RH / Connexions :</strong> Les identifiants de connexion (<span className="font-mono text-blue-300">CPT-2026-XXX</span> / <span className="font-mono text-emerald-300">CTR-2026-XXX</span>) gérés ici sont totalement distincts des matricules RH des vigiles (<span className="font-mono text-slate-200">NS-2026-XXXX</span>) utilisés dans le module Agents, les badges et la paie. Aucun code secret n’est enregistré dans Firestore.
        </p>
      </div>

      {/* KPI counters */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Total Comptes</p>
          <p className="text-2xl font-black text-white mt-1">{stats.total}</p>
        </div>
        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
          <p className="text-[10px] uppercase tracking-wider text-blue-300 font-bold">Comptables (CPT)</p>
          <p className="text-2xl font-black text-blue-400 mt-1">{stats.comptables}</p>
        </div>
        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
          <p className="text-[10px] uppercase tracking-wider text-emerald-300 font-bold">Contrôleurs (CTR)</p>
          <p className="text-2xl font-black text-emerald-400 mt-1">{stats.controleurs}</p>
        </div>
        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
          <p className="text-[10px] uppercase tracking-wider text-emerald-400 font-bold">Actifs</p>
          <p className="text-2xl font-black text-white mt-1">{stats.actifs}</p>
        </div>
        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
          <p className="text-[10px] uppercase tracking-wider text-rose-300 font-bold">Désactivés</p>
          <p className="text-2xl font-black text-rose-400 mt-1">{stats.desactives}</p>
        </div>
      </div>

      {/* One-time creation confirmation card */}
      {justCreatedSummary && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/40 text-xs space-y-3 animate-in fade-in">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-emerald-200 text-sm">
                  Compte {justCreatedSummary.role === 'comptabilite' ? 'Comptable' : 'Contrôleur'} créé et enregistré durablement
                </p>
                <p className="text-emerald-100/90 leading-relaxed">
                  Collaborateur : <strong className="text-white">{justCreatedSummary.nom}</strong> • Session Direction conservée sans interruption.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setJustCreatedSummary(null)}
              className="p-1 rounded-lg bg-slate-900/60 hover:bg-slate-800 text-slate-300 cursor-pointer"
              title="Fermer la confirmation"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/70 border border-emerald-500/30 flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                Identifiant unique à remettre au collaborateur
              </span>
              <span className="font-mono text-base font-black text-emerald-300 select-all">
                {justCreatedSummary.loginId}
              </span>
            </div>
            <button
              type="button"
              onClick={() => copyText(justCreatedSummary.loginId, 'created-id')}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
            >
              {copiedId === 'created-id' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedId === 'created-id' ? 'Identifiant copié' : 'Copier l’identifiant'}</span>
            </button>
          </div>

          <p className="text-[11px] text-amber-200/90 flex items-center gap-1.5">
            <KeyRound className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>
              Remettez le code secret initial choisi séparément au collaborateur. Par sécurité, ce code n’est stocké nulle part en clair et le collaborateur sera invité à le personnaliser après sa première connexion.
            </span>
          </p>
        </div>
      )}

      {/* Action notice */}
      {actionNotice && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-3 animate-in fade-in ${
            actionNotice.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-200'
              : 'bg-rose-500/15 border-rose-500/30 text-rose-200'
          }`}
        >
          <div className="flex items-start gap-2">
            {actionNotice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            )}
            <span>{actionNotice.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionNotice(null)}
            className="text-slate-300 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Create account form */}
      {showCreateForm && (
        <form
          onSubmit={handleCreateAccount}
          className="p-5 rounded-2xl bg-slate-900 border border-emerald-500/30 shadow-xl space-y-5 animate-in fade-in"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h4 className="font-bold text-white text-base flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-emerald-400" />
                <span>Créer un nouveau compte Comptable ou Contrôleur</span>
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                L’identifiant est verrouillé de manière atomique dans Firestore pour interdire tout doublon.
              </p>
            </div>
          </div>

          {createError && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <p className="leading-relaxed">{createError}</p>
            </div>
          )}

          {/* Role selector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleRoleSwitchInForm('comptabilite')}
              className={`p-3.5 rounded-xl border text-left transition cursor-pointer flex items-center gap-3 ${
                newRole === 'comptabilite'
                  ? 'bg-blue-500/15 border-blue-500/60 text-white'
                  : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
                <Calculator className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-xs">Compte Comptable</p>
                <p className="text-[11px] text-slate-400">
                  Identifiant <span className="font-mono text-blue-300">CPT-2026-XXX</span> • Factures & Paie
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleRoleSwitchInForm('controleur')}
              className={`p-3.5 rounded-xl border text-left transition cursor-pointer flex items-center gap-3 ${
                newRole === 'controleur'
                  ? 'bg-emerald-500/15 border-emerald-500/60 text-white'
                  : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
                <Compass className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-xs">Compte Contrôleur Terrain</p>
                <p className="text-[11px] text-slate-400">
                  Identifiant <span className="font-mono text-emerald-300">CTR-2026-XXX</span> • Rondes & Scans QR
                </p>
              </div>
            </button>
          </div>

          {/* Core fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-bold text-slate-300 mb-1">
                Identifiant unique attribué <span className="text-rose-400">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newLoginId}
                  onChange={(e) => {
                    setIsLoginIdManual(true);
                    setNewLoginId(e.target.value.toUpperCase());
                  }}
                  placeholder={newRole === 'comptabilite' ? 'CPT-2026-001' : 'CTR-2026-001'}
                  required
                  className={`flex-1 bg-slate-800 border rounded-xl px-3 py-2 text-white font-mono uppercase focus:outline-none ${
                    isDuplicateLocal
                      ? 'border-rose-500 focus:border-rose-500'
                      : 'border-slate-700 focus:border-emerald-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => {
                    setIsLoginIdManual(false);
                    setNewLoginId(suggestedLoginId);
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-semibold whitespace-nowrap cursor-pointer"
                  title="Utiliser le prochain numéro libre"
                >
                  Auto ({suggestedLoginId})
                </button>
              </div>
              {isDuplicateLocal ? (
                <p className="text-[11px] text-rose-400 mt-1">
                  Cet identifiant est déjà utilisé. Choisissez un autre numéro.
                </p>
              ) : (
                <p className="text-[10px] text-slate-500 mt-1">
                  Format strict : {newRole === 'comptabilite' ? 'CPT-AAAA-XXX' : 'CTR-AAAA-XXX'} (immuable après création).
                </p>
              )}
            </div>

            <div>
              <label className="block font-bold text-slate-300 mb-1">
                Nom de famille <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={newNom}
                onChange={(e) => setNewNom(e.target.value)}
                placeholder="Ex: MOUSSA"
                required
                minLength={2}
                maxLength={120}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-300 mb-1">Prénom(s)</label>
              <input
                type="text"
                value={newPrenom}
                onChange={(e) => setNewPrenom(e.target.value)}
                placeholder="Ex: Abdoulaye"
                maxLength={100}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-300 mb-1">Fonction / Grade</label>
              <input
                type="text"
                value={newGrade}
                onChange={(e) => setNewGrade(e.target.value)}
                placeholder={
                  newRole === 'comptabilite'
                    ? 'Ex: Chef Comptable'
                    : 'Ex: Contrôleur Zone Plateau'
                }
                maxLength={100}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-300 mb-1">Téléphone professionnel</label>
              <input
                type="text"
                value={newTelephone}
                onChange={(e) => setNewTelephone(e.target.value)}
                placeholder="+227 9X XX XX XX"
                maxLength={40}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Assigned sites for Controleur */}
          {newRole === 'controleur' && (
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <p className="font-bold text-slate-200 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Sites de ronde assignés au Contrôleur ({newSitesIds.length} sélectionné(s))</span>
                </p>
                <span className="text-[10px] text-slate-400">Modifiable à tout moment</span>
              </div>
              {sites.length === 0 ? (
                <p className="text-[11px] text-slate-500">Aucun site enregistré pour le moment.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {sites.map((site) => {
                    const checked = newSitesIds.includes(site.id);
                    return (
                      <label
                        key={site.id}
                        className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition ${
                          checked
                            ? 'bg-emerald-500/15 border-emerald-500/50 text-white'
                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleNewSiteSelection(site.id)}
                          className="accent-emerald-500"
                        />
                        <span className="truncate text-[11px] font-medium">{site.nom}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Initial secret code */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-bold text-white flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                  <span>Code secret initial (minimum 6 caractères)</span>
                </p>
                <p className="text-[11px] text-slate-400">
                  Transmis uniquement à Firebase Authentication (jamais enregistré dans Firestore).
                </p>
              </div>
              <button
                type="button"
                onClick={handleGenerateSecret}
                className="px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Générer un code robuste</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Code secret initial <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showSecretCode ? 'text' : 'password'}
                    value={newSecretCode}
                    onChange={(e) => setNewSecretCode(e.target.value)}
                    placeholder="Minimum 6 caractères"
                    required
                    minLength={6}
                    maxLength={64}
                    autoComplete="new-password"
                    className="w-full pl-3 pr-10 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecretCode(!showSecretCode)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                    title={showSecretCode ? 'Masquer' : 'Afficher'}
                  >
                    {showSecretCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Confirmer le code secret <span className="text-rose-400">*</span>
                </label>
                <input
                  type={showSecretCode ? 'text' : 'password'}
                  value={confirmSecretCode}
                  onChange={(e) => setConfirmSecretCode(e.target.value)}
                  placeholder="Ressaisir le code secret"
                  required
                  minLength={6}
                  maxLength={64}
                  autoComplete="new-password"
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isCreating || isDuplicateLocal}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-lg shadow-emerald-950/40"
            >
              <UserPlus className="w-4 h-4" />
              <span>{isCreating ? 'Création sécurisée en cours...' : 'Créer le compte'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Search & Filters */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Rechercher par identifiant (CPT / CTR), nom, téléphone..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as any)}
            className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">Tous les profils</option>
            <option value="comptabilite">Comptables (CPT)</option>
            <option value="controleur">Contrôleurs (CTR)</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">Tous les statuts</option>
            <option value="actif">Actifs uniquement</option>
            <option value="desactive">Désactivés uniquement</option>
          </select>
        </div>
      </div>

      {/* Load error */}
      {loadError && (
        <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Erreur de chargement de l’annuaire Firestore</p>
            <p className="mt-0.5 leading-relaxed">{loadError}</p>
          </div>
        </div>
      )}

      {/* Staff Accounts Table / List */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
          <h4 className="font-bold text-white text-sm">
            Comptes Comptables & Contrôleurs ({filteredStaffAccounts.length})
          </h4>
          <span className="text-[11px] text-slate-400">
            Rôles et identifiants scellés par les règles Firestore
          </span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-xs text-slate-400">
            Chargement des comptes depuis Firestore...
          </div>
        ) : filteredStaffAccounts.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <Users className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-sm font-bold text-slate-300">
              Aucun compte Comptable ou Contrôleur trouvé
            </p>
            <p className="text-xs text-slate-500">
              Cliquez sur « Nouveau compte d’accès » pour attribuer un identifiant CPT-2026-XXX ou CTR-2026-XXX.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {filteredStaffAccounts.map((acc) => {
              const isCompta = acc.role === 'comptabilite';
              const isActive = acc.statut === 'actif';
              const fullName = acc.prenom ? `${acc.prenom} ${acc.nom}` : acc.nom;
              const isConfirming = confirmToggleUid === acc.uid;
              const isBusy = togglingUid === acc.uid;

              return (
                <div
                  key={acc.uid}
                  className={`p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition ${
                    isActive ? 'hover:bg-slate-800/30' : 'bg-slate-950/60 opacity-80'
                  }`}
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {acc.loginId ? (
                        <button
                          type="button"
                          onClick={() => copyText(acc.loginId!, acc.uid)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-700 font-mono text-xs font-black text-white hover:border-emerald-500/60 cursor-pointer"
                          title="Copier l'identifiant"
                        >
                          <span>{acc.loginId}</span>
                          {copiedId === acc.uid ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3 text-slate-400" />
                          )}
                        </button>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[11px] font-mono">
                          {acc.email}
                        </span>
                      )}

                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                          isCompta
                            ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                            : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                        }`}
                      >
                        {isCompta ? 'Comptabilité' : 'Contrôleur terrain'}
                      </span>

                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          isActive
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                        }`}
                      >
                        {isActive ? 'Actif' : 'Désactivé'}
                      </span>

                      {acc.doitChangerCodeSecret && isActive && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                          Code initial non personnalisé
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      <span className="font-bold text-white">{fullName}</span>
                      {acc.grade && <span className="text-slate-400">• {acc.grade}</span>}
                      {acc.telephone && <span className="text-slate-400">• {acc.telephone}</span>}
                    </div>

                    {!isCompta && (
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                        <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>
                          Sites assignés :{' '}
                          <strong className="text-slate-200">
                            {acc.sitesAssignesIds && acc.sitesAssignesIds.length > 0
                              ? `${acc.sitesAssignesIds.length} site(s)`
                              : 'Aucun site assigné'}
                          </strong>
                        </span>
                        <button
                          type="button"
                          onClick={() => openSitesEditor(acc)}
                          className="text-emerald-400 hover:text-emerald-300 font-semibold underline underline-offset-2 cursor-pointer"
                        >
                          Modifier les sites
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {!isConfirming ? (
                      <button
                        type="button"
                        onClick={() => setConfirmToggleUid(acc.uid)}
                        disabled={isBusy}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50 ${
                          isActive
                            ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border-rose-500/30'
                            : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/30'
                        }`}
                      >
                        {isActive ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                        <span>{isActive ? 'Désactiver le compte' : 'Réactiver le compte'}</span>
                      </button>
                    ) : (
                      <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-700 flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-slate-200 font-semibold">
                          {isActive ? 'Bloquer immédiatement cet accès ?' : 'Réactiver cet accès ?'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleConfirmToggleStatus(acc)}
                          disabled={isBusy}
                          className={`px-3 py-1 rounded-lg text-white font-bold cursor-pointer disabled:opacity-50 ${
                            isActive
                              ? 'bg-rose-600 hover:bg-rose-500'
                              : 'bg-emerald-600 hover:bg-emerald-500'
                          }`}
                        >
                          {isBusy ? 'En cours...' : 'Confirmer'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmToggleUid(null)}
                          disabled={isBusy}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                        >
                          Annuler
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Protected Direction accounts (read-only) */}
      {directionAccounts.length > 0 && (
        <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span>Comptes Direction protégés (Lecture seule)</span>
            </h4>
            <span className="text-[10px] text-slate-500">
              Connexion par e-mail & mot de passe • Non modifiables ici
            </span>
          </div>

          <div className="space-y-2">
            {directionAccounts.map((dir) => (
              <div
                key={dir.uid}
                className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold text-[10px] uppercase">
                    Direction
                  </span>
                  <span className="font-bold text-white">{dir.nom}</span>
                  <span className="font-mono text-[11px] text-slate-400">{dir.email}</span>
                  {dir.uid === currentUser.uid && (
                    <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 text-[10px] font-semibold">
                      Session actuelle
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-slate-500">Protégé par règles Firestore</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sites assignment modal for Controleur */}
      {editingSitesAccount && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4 text-xs">
            <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h4 className="font-bold text-white text-sm">
                  Sites assignés — {editingSitesAccount.loginId || editingSitesAccount.nom}
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Ce contrôleur ne voit et ne peut scanner que les sites cochés ci-dessous.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingSitesAccount(null)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
              {sites.map((site) => {
                const checked = editingSitesSelection.includes(site.id);
                return (
                  <label
                    key={site.id}
                    className={`flex items-center justify-between gap-2 p-2.5 rounded-xl border cursor-pointer transition ${
                      checked
                        ? 'bg-emerald-500/15 border-emerald-500/50 text-white'
                        : 'bg-slate-800/50 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setEditingSitesSelection((prev) =>
                            prev.includes(site.id)
                              ? prev.filter((id) => id !== site.id)
                              : [...prev, site.id]
                          )
                        }
                        className="accent-emerald-500"
                      />
                      <span className="font-semibold truncate">{site.nom}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0">{site.quartier}</span>
                  </label>
                );
              })}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setEditingSitesAccount(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSaveAssignedSites}
                disabled={isSavingSites}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer disabled:opacity-50"
              >
                {isSavingSites ? 'Enregistrement...' : 'Enregistrer les sites'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
