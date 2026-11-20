import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Lock,
  Mail,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  X,
  User,
  Eye,
  EyeOff,
  Copy,
  Check,
  Info,
} from 'lucide-react';
import { UserProfile } from '../types';
import {
  changeUserEmail,
  changeUserPassword,
  changePersonalSecretCode,
  changeDirectionPin,
} from '../services/authService';
import { validateSecretCode } from '../services/loginIdentifierUtils';

interface AccountSettingsModalProps {
  currentUser: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  onProfileUpdated?: (updated: UserProfile) => void;
  initialTab?: 'profil' | 'email' | 'password' | 'pin';
}

type SettingsTab = 'profil' | 'email' | 'password' | 'pin';

export const AccountSettingsModal: React.FC<AccountSettingsModalProps> = ({
  currentUser,
  isOpen,
  onClose,
  onProfileUpdated,
  initialTab = 'profil',
}) => {
  const isStaff = currentUser.role === 'comptabilite' || currentUser.role === 'controleur';
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (isStaff && (initialTab === 'email' || initialTab === 'pin')) {
        setActiveTab('profil');
      } else {
        setActiveTab(initialTab);
      }
    }
  }, [isOpen, initialTab, isStaff]);

  // Email form state
  const [newEmail, setNewEmail] = useState('');
  const [emailCurrentPassword, setEmailCurrentPassword] = useState('');
  const [showEmailPass, setShowEmailPass] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  // Password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passLoading, setPassLoading] = useState(false);
  const [passSuccess, setPassSuccess] = useState<string | null>(null);
  const [passError, setPassError] = useState<string | null>(null);

  // PIN form state
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [pinLoading, setPinLoading] = useState(false);
  const [pinSuccess, setPinSuccess] = useState<string | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);

  if (!isOpen) return null;

  const copyToClipboard = (value: string, key: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(value).catch(() => {});
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((prev) => (prev === key ? null : prev)), 2500);
    }
  };

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);
    setEmailSuccess(null);

    if (!newEmail || !emailCurrentPassword) {
      setEmailError('Veuillez renseigner votre nouvelle adresse e-mail et votre mot de passe actuel.');
      return;
    }

    setEmailLoading(true);
    try {
      const res = await changeUserEmail(emailCurrentPassword, newEmail);
      if (res.success) {
        setEmailSuccess('Votre adresse e-mail a été mise à jour avec succès. Vos données et accès restent pleinement préservés.');
        if (onProfileUpdated) {
          onProfileUpdated({ ...currentUser, email: newEmail.trim().toLowerCase() });
        }
        setNewEmail('');
        setEmailCurrentPassword('');
      } else {
        setEmailError(res.error || 'Impossible de mettre à jour votre adresse e-mail.');
      }
    } catch {
      setEmailError('Une erreur inattendue est survenue.');
    } finally {
      setEmailLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError(null);
    setPassSuccess(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPassError('Tous les champs sont obligatoires.');
      return;
    }

    if (isStaff) {
      const check = validateSecretCode(newPassword);
      if (!check.valid) {
        setPassError(check.error || 'Code secret invalide.');
        return;
      }
    } else if (newPassword.length < 6) {
      setPassError('Le nouveau mot de passe doit comporter au moins 6 caractères.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPassError(
        isStaff
          ? 'Les deux nouveaux codes secrets ne correspondent pas.'
          : 'Les deux nouveaux mots de passe ne correspondent pas.'
      );
      return;
    }

    setPassLoading(true);
    try {
      const res = isStaff
        ? await changePersonalSecretCode(currentPassword, newPassword)
        : await changeUserPassword(currentPassword, newPassword);

      if (res.success) {
        setPassSuccess(
          isStaff
            ? 'Votre code secret personnel a été mis à jour avec succès. Utilisez ce nouveau code lors de votre prochaine connexion.'
            : 'Votre mot de passe de connexion a été modifié avec succès.'
        );
        if (isStaff && onProfileUpdated && currentUser.doitChangerCodeSecret) {
          onProfileUpdated({ ...currentUser, doitChangerCodeSecret: false });
        }
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPassError(
          res.error ||
            (isStaff
              ? 'Échec de la modification du code secret personnel.'
              : 'Échec de la modification du mot de passe.')
        );
      }
    } catch {
      setPassError('Une erreur inattendue est survenue.');
    } finally {
      setPassLoading(false);
    }
  };

  const handleUpdatePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);
    setPinSuccess(null);

    const cleanCurrent = currentPin.trim();
    const cleanNew = newPin.trim();
    const cleanConfirm = confirmPin.trim();

    if (!/^\d{4,8}$/.test(cleanCurrent)) {
      setPinError('Le code PIN actuel doit comporter entre 4 et 8 chiffres.');
      return;
    }

    if (!/^\d{4,8}$/.test(cleanNew)) {
      setPinError('Le nouveau code PIN doit comporter exclusivement entre 4 et 8 chiffres.');
      return;
    }

    if (cleanNew !== cleanConfirm) {
      setPinError('Les deux nouveaux codes PIN ne correspondent pas.');
      return;
    }

    if (['0000', '1234', '1111', '123456', '000000'].includes(cleanNew)) {
      setPinError('Ce nouveau code PIN est trop prévisible. Choisissez une combinaison plus sécurisée.');
      return;
    }

    setPinLoading(true);
    try {
      const res = await changeDirectionPin(cleanCurrent, cleanNew);
      if (res.success) {
        setPinSuccess(res.message || 'Votre Code PIN Direction a été modifié avec succès côté serveur.');
        setCurrentPin('');
        setNewPin('');
        setConfirmPin('');
      } else {
        setPinError(res.error || 'Échec de la modification du code PIN.');
      }
    } catch {
      setPinError('Une erreur inattendue est survenue.');
    } finally {
      setPinLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 selection:bg-emerald-500 selection:text-white"
    >
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden space-y-6">
        {/* Glow */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-start justify-between relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-white uppercase tracking-tight">
                {isStaff ? 'Mon Compte & Code Secret' : 'Sécurité & Identifiants du Compte'}
              </h2>
              <p className="text-xs text-slate-400">
                {currentUser.role === 'direction'
                  ? 'Gestion sécurisée • Accès Direction • Société NIGER SÉCURITÉ SARL'
                  : currentUser.role === 'comptabilite'
                  ? 'Espace Comptabilité • Identifiant personnel & Code secret'
                  : 'Espace Contrôleur terrain • Identifiant personnel & Code secret'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
            title="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto relative z-10 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('profil')}
            className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'profil'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Mon Profil</span>
          </button>

          {currentUser.role === 'direction' && (
            <button
              type="button"
              onClick={() => setActiveTab('email')}
              className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'email'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Adresse E-mail</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveTab('password')}
            className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'password'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>{isStaff ? 'Code secret personnel' : 'Mot de passe'}</span>
          </button>

          {currentUser.role === 'direction' && (
            <button
              type="button"
              onClick={() => setActiveTab('pin')}
              className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'pin'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Code PIN Direction</span>
            </button>
          )}
        </div>

        {/* Tab 1 : Profil */}
        {activeTab === 'profil' && (
          <div className="space-y-4 relative z-10 text-xs">
            <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Collaborateur :</span>
                <span className="font-bold text-white text-sm">
                  {currentUser.prenom ? `${currentUser.prenom} ${currentUser.nom}` : currentUser.nom}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Rôle officiel :</span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase">
                  {currentUser.role}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Statut du compte :</span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {currentUser.statut === 'actif' ? 'Actif & Opérationnel' : 'Désactivé'}
                </span>
              </div>
              {currentUser.loginId ? (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Identifiant unique attribué :</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-black text-emerald-300 bg-slate-900 px-2.5 py-1 rounded-lg border border-emerald-500/30">
                      {currentUser.loginId}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(currentUser.loginId!, 'loginId')}
                      className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition cursor-pointer"
                      title="Copier l'identifiant"
                    >
                      {copiedKey === 'loginId' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">E-mail de connexion :</span>
                  <span className="font-mono text-slate-200">{currentUser.email}</span>
                </div>
              )}
              <div className="flex items-center justify-between pt-2 border-t border-slate-700/50">
                <div>
                  <span className="text-slate-400 block">Identifiant technique permanent (UID) :</span>
                  <span className="text-[10px] text-slate-500">Géré automatiquement par Firebase, immuable</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[11px] text-slate-300 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-700">
                    {currentUser.uid}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(currentUser.uid, 'uid')}
                    className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition cursor-pointer"
                    title="Copier l'UID"
                  >
                    {copiedKey === 'uid' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-200 text-xs flex items-start gap-2.5">
              <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <p className="leading-relaxed text-[11px]">
                {isStaff ? (
                  <>
                    <strong>Profil verrouillé par la Direction :</strong> Votre identifiant unique (<code>{currentUser.loginId || currentUser.email}</code>) et votre rôle sont immuables. Vous pouvez modifier votre code secret personnel à tout moment dans l’onglet « Code secret personnel ».
                  </>
                ) : (
                  <>
                    <strong>Gestion automatisée sans saisie d'UID :</strong> L'application associe automatiquement votre compte Firebase Authentication à votre document <code>users/{currentUser.uid}</code>.
                  </>
                )}
              </p>
            </div>
          </div>
        )}

        {/* Tab 2 : E-mail (Direction uniquement) */}
        {activeTab === 'email' && currentUser.role === 'direction' && (
          <form onSubmit={handleUpdateEmail} className="space-y-4 relative z-10 text-xs">
            <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300 space-y-1">
              <p className="font-bold text-white text-[12px]">Préservation de vos données :</p>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Le changement d'adresse e-mail ne supprime aucune donnée. Vos scans de pointage, vos contrats, vos factures et votre profil restent 100% rattachés à votre compte.
              </p>
            </div>

            {emailSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <p>{emailSuccess}</p>
              </div>
            )}

            {emailError && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-200 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <p>{emailError}</p>
              </div>
            )}

            <div className="space-y-1">
              <label className="block font-bold text-slate-300 uppercase">
                Nouvelle adresse e-mail
              </label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="ex: direction.generale@nigersecurite.ne"
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <label className="block font-bold text-slate-300 uppercase">
                Mot de passe actuel (Vérification de sécurité)
              </label>
              <div className="relative">
                <input
                  type={showEmailPass ? 'text' : 'password'}
                  value={emailCurrentPassword}
                  onChange={(e) => setEmailCurrentPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => setShowEmailPass(!showEmailPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                >
                  {showEmailPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={emailLoading || !newEmail || !emailCurrentPassword}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer transition disabled:opacity-50"
            >
              {emailLoading ? 'Mise à jour en cours...' : 'Enregistrer la nouvelle adresse e-mail'}
            </button>
          </form>
        )}

        {/* Tab 3 : Mot de passe / Code secret personnel */}
        {activeTab === 'password' && (
          <form onSubmit={handleUpdatePassword} className="space-y-4 relative z-10 text-xs">
            <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300 space-y-1">
              <p className="font-bold text-white text-[12px]">
                {isStaff ? 'Personnalisation de votre code secret :' : 'Code initial vs Mot de passe personnel :'}
              </p>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                {isStaff
                  ? 'Votre code secret (minimum 6 caractères) protège votre accès personnel. Il est chiffré par Firebase Authentication et n’est jamais enregistré dans Firestore ni visible par la Direction.'
                  : 'Le mot de passe protège votre connexion initiale. Il est chiffré par Firebase et n’est jamais stocké en clair.'}
              </p>
            </div>

            {passSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <p>{passSuccess}</p>
              </div>
            )}

            {passError && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-200 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <p>{passError}</p>
              </div>
            )}

            <div className="space-y-1">
              <label className="block font-bold text-slate-300 uppercase">
                {isStaff ? 'Code secret actuel (ou code initial remis)' : 'Mot de passe actuel (ou code initial)'}
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <label className="block font-bold text-slate-300 uppercase">
                {isStaff ? 'Nouveau code secret personnel (min. 6 caractères)' : 'Nouveau mot de passe (min. 6 caractères)'}
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                minLength={6}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <label className="block font-bold text-slate-300 uppercase">
                {isStaff ? 'Confirmer le nouveau code secret' : 'Confirmer le nouveau mot de passe'}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  minLength={6}
                  className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={passLoading || !currentPassword || newPassword.length < 6 || newPassword !== confirmPassword}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer transition disabled:opacity-50"
            >
              {passLoading
                ? 'Mise à jour en cours...'
                : isStaff
                ? 'Enregistrer mon nouveau code secret'
                : 'Changer mon mot de passe'}
            </button>
          </form>
        )}

        {/* Tab 4 : PIN Direction */}
        {activeTab === 'pin' && currentUser.role === 'direction' && (
          <form onSubmit={handleUpdatePin} className="space-y-4 relative z-10 text-xs">
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 space-y-1">
              <p className="font-bold text-amber-300 text-[12px]">Rôle du Code PIN Direction :</p>
              <p className="text-[11px] text-amber-200/90 leading-relaxed">
                Le Code PIN (4 à 8 chiffres) est distinct du mot de passe de connexion. Il valide et signe les opérations hautement sensibles (validation et clôture de la paie des vigiles, modifications financières). Il est stocké exclusivement sur le serveur avec 220 000 itérations OWASP.
              </p>
            </div>

            {pinSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <p>{pinSuccess}</p>
              </div>
            )}

            {pinError && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-200 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <p>{pinError}</p>
              </div>
            )}

            <div className="space-y-1">
              <label className="block font-bold text-slate-300 uppercase">
                Code PIN actuel
              </label>
              <input
                type={showPin ? 'text' : 'password'}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-center tracking-[0.2em] font-mono focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="space-y-1">
              <label className="block font-bold text-slate-300 uppercase">
                Nouveau Code PIN (4 à 8 chiffres)
              </label>
              <input
                type={showPin ? 'text' : 'password'}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                placeholder="Ex: 6942"
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-center tracking-[0.2em] font-mono focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="space-y-1">
              <label className="block font-bold text-slate-300 uppercase">
                Confirmer le nouveau Code PIN
              </label>
              <div className="relative">
                <input
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={8}
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="Ressaisir"
                  required
                  className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-center tracking-[0.2em] font-mono focus:outline-none focus:border-amber-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={pinLoading || currentPin.length < 4 || newPin.length < 4 || newPin !== confirmPin}
              className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold cursor-pointer transition disabled:opacity-50"
            >
              {pinLoading ? 'Validation en cours...' : 'Mettre à jour mon Code PIN Direction'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
