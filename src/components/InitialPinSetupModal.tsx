import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  ShieldAlert,
} from 'lucide-react';
import { updateUserPinStatus } from '../services/authService';
import { auth } from '../firebase';
import { UserProfile } from '../types';

interface InitialPinSetupModalProps {
  currentUser: UserProfile;
  onSuccess: () => void;
}

export const InitialPinSetupModal: React.FC<InitialPinSetupModalProps> = ({
  currentUser,
  onSuccess,
}) => {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanPin = pin.trim();
    const cleanConfirm = confirmPin.trim();

    // 1. Validation de format : 4 à 8 chiffres
    if (!/^\d{4,8}$/.test(cleanPin)) {
      setErrorMessage('Le code PIN doit comporter exclusivement entre 4 et 8 chiffres.');
      return;
    }

    // 2. Vérification de correspondance
    if (cleanPin !== cleanConfirm) {
      setErrorMessage('Les deux codes PIN saisis ne sont pas identiques.');
      return;
    }

    // 3. Avertissement sur les codes trop prévisibles
    if (['0000', '1234', '1111', '123456', '000000'].includes(cleanPin)) {
      setErrorMessage('Ce code PIN est trop simple et prévisible. Veuillez choisir une combinaison plus sécurisée.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Étape A : Récupération du jeton Firebase ID certifié
      const idToken = (await auth.currentUser?.getIdToken()) || '';

      // Étape B : Validation et calcul cryptographique strict côté serveur
      const response = await fetch('/api/auth/setup-initial-pin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          uid: currentUser.uid,
          pin: cleanPin,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        setErrorMessage(data.error || 'Erreur lors de la validation du code PIN par le serveur.');
        setIsSubmitting(false);
        return;
      }

      // Nettoyage de tout vestige éventuel de stockage local sensible
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem('niger_securite_direction_pin_v1');
      }

      // Étape C : Mise à jour du statut dans la session utilisateur locale
      updateUserPinStatus(currentUser.uid, false);

      // Étape D : Déverrouillage immédiat du tableau de bord Direction
      onSuccess();
    } catch (err: any) {
      console.error('[NIGER SÉCURITÉ] Erreur lors du changement de PIN initial:', err);
      setErrorMessage('Une erreur est survenue lors de la communication avec le serveur de sécurité.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pin-modal-title"
      className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 selection:bg-emerald-500 selection:text-white"
    >
      <div className="w-full max-w-md bg-slate-900 border-2 border-emerald-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden space-y-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Glow effect */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="text-center space-y-2 relative z-10">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-emerald-400 p-3 mx-auto flex items-center justify-center text-white shadow-xl shadow-emerald-950/60 border border-emerald-400/30">
            <KeyRound className="w-8 h-8 text-white" />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Sécurisation Obligatoire • Première Connexion</span>
          </div>
          <h2 id="pin-modal-title" className="text-xl sm:text-2xl font-black text-white tracking-tight uppercase">
            Définir votre Code PIN
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed max-w-xs mx-auto">
            Conformément à la politique de sécurité de <strong>NIGER SÉCURITÉ</strong>, l'accès Direction requiert la configuration d'un code PIN personnel (4 à 8 chiffres).
          </p>
        </div>

        {/* Security Notice Box */}
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-3.5 flex items-start gap-3 text-xs text-slate-300 relative z-10">
          <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-slate-200">Protection renforcée</p>
            <p className="text-[11px] text-slate-400">
              Ce code protège les opérations sensibles (paie des vigiles, facturation clients, contrats). Il sera chiffré localement avec un sel cryptographique SHA-256.
            </p>
          </div>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs flex items-start gap-2.5 animate-in fade-in">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">{errorMessage}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
              Nouveau Code PIN (4 à 8 chiffres)
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type={showPin ? 'text' : 'password'}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="Ex: 5824"
                required
                autoFocus
                autoComplete="new-password"
                className="w-full pl-10 pr-10 py-3 rounded-xl bg-slate-800/90 border border-slate-700 text-white placeholder-slate-500 text-center tracking-[0.3em] font-mono text-base focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1"
                title={showPin ? 'Masquer' : 'Afficher'}
              >
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
              Confirmer le Code PIN
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type={showPin ? 'text' : 'password'}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                placeholder="Ressaisir le code"
                required
                autoComplete="new-password"
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-800/90 border border-slate-700 text-white placeholder-slate-500 text-center tracking-[0.3em] font-mono text-base focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || pin.length < 4 || pin !== confirmPin}
            className="w-full py-3.5 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white shadow-lg shadow-emerald-950/60 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <span className="inline-flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Sécurisation en cours...</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>Enregistrer mon Code PIN & Accéder</span>
              </span>
            )}
          </button>
        </form>

        <p className="text-[11px] text-center text-slate-500">
          Ce code reste strictement confidentiel. Il ne vous sera jamais demandé par e-mail.
        </p>
      </div>
    </div>
  );
};
