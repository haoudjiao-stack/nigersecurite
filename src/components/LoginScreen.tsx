import React, { useState } from 'react';
import {
  Shield,
  Lock,
  Mail,
  ArrowRight,
  Eye,
  EyeOff,
  AlertCircle,
  Wifi,
  WifiOff,
  KeyRound,
  Briefcase,
  UserCheck,
} from 'lucide-react';
import { loginWithIdentifierOrEmail } from '../services/authService';
import { UserProfile } from '../types';

interface LoginScreenProps {
  onLoginSuccess: (profile: UserProfile) => void;
  externalNotice?: string | null;
}

type LoginMode = 'direction' | 'staff';

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLoginSuccess,
  externalNotice,
}) => {
  const [loginMode, setLoginMode] = useState<LoginMode>('direction');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  const handleModeSwitch = (mode: LoginMode) => {
    setLoginMode(mode);
    setIdentifier('');
    setPassword('');
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanIdentifier = identifier.trim();
    if (!cleanIdentifier || !password) {
      setErrorMessage(
        loginMode === 'direction'
          ? 'Veuillez renseigner votre adresse e-mail et votre mot de passe.'
          : 'Veuillez renseigner votre identifiant unique (CPT-2026-XXX ou CTR-2026-XXX) et votre code secret personnel.'
      );
      return;
    }

    setIsLoading(true);
    try {
      const res = await loginWithIdentifierOrEmail(cleanIdentifier, password);
      if (res.success && res.user) {
        onLoginSuccess(res.user);
      } else {
        setErrorMessage(
          res.error ||
            'La connexion n’a pas pu aboutir après la vérification. Consultez les journaux de diagnostic.'
        );
      }
    } catch (err: any) {
      console.error('[NIGER SÉCURITÉ LoginScreen] Erreur imprévue lors du traitement du formulaire:', {
        code: err?.code || err?.name || 'unknown',
      });
      setErrorMessage('Une erreur technique imprévue est survenue lors de la tentative de connexion.');
    } finally {
      setIsLoading(false);
    }
  };

  const displayedError = errorMessage || externalNotice;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 font-sans selection:bg-emerald-500 selection:text-white relative overflow-hidden">
      {/* Background aesthetic glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-md relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-emerald-400 p-3 mx-auto flex items-center justify-center text-white shadow-xl shadow-emerald-950/60 border border-emerald-400/30">
            <Shield className="w-9 h-9" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight uppercase">
            NIGER SÉCURITÉ
          </h1>
          <p className="text-xs text-slate-400">
            Plateforme de Gestion Opérationnelle & Financière • Niamey
          </p>

          {/* Network indicator badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold border mt-2">
            {isOnline ? (
              <span className="flex items-center gap-1.5 text-emerald-300 bg-emerald-500/10 border-emerald-500/30 px-2 py-0.5 rounded-full">
                <Wifi className="w-3 h-3 text-emerald-400" />
                <span>Serveur en ligne</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-amber-300 bg-amber-500/10 border-amber-500/30 px-2 py-0.5 rounded-full">
                <WifiOff className="w-3 h-3 text-amber-400" />
                <span>Mode hors ligne (Session requise)</span>
              </span>
            )}
          </div>
        </div>

        {/* Profile Mode Switcher */}
        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-slate-950 border border-slate-800">
          <button
            type="button"
            onClick={() => handleModeSwitch('direction')}
            className={`py-2 px-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              loginMode === 'direction'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/50'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5 shrink-0" />
            <span>Direction</span>
          </button>

          <button
            type="button"
            onClick={() => handleModeSwitch('staff')}
            className={`py-2 px-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              loginMode === 'staff'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/50'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5 shrink-0" />
            <span>Comptable / Contrôleur</span>
          </button>
        </div>

        {/* Error Alert */}
        {displayedError && (
          <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs flex items-start gap-2.5 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed select-text break-words">{displayedError}</p>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
              {loginMode === 'direction'
                ? 'Adresse e-mail professionnelle (Direction)'
                : 'Identifiant unique attribué (CPT / CTR)'}
            </label>
            <div className="relative">
              {loginMode === 'direction' ? (
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              ) : (
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              )}
              <input
                type={loginMode === 'direction' ? 'email' : 'text'}
                value={identifier}
                onChange={(e) =>
                  setIdentifier(
                    loginMode === 'staff' ? e.target.value.toUpperCase() : e.target.value
                  )
                }
                placeholder={
                  loginMode === 'direction'
                    ? 'ex: direction@nigersecurite.ne'
                    : 'ex: CPT-2026-001 ou CTR-2026-001'
                }
                required
                autoComplete="username"
                className={`w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700 text-white placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition ${
                  loginMode === 'staff' ? 'font-mono uppercase' : ''
                }`}
              />
            </div>
            {loginMode === 'staff' && (
              <p className="text-[11px] text-slate-400">
                Comptabilité : <span className="font-mono text-blue-300">CPT-2026-XXX</span> • Contrôleur : <span className="font-mono text-emerald-300">CTR-2026-XXX</span>
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
              {loginMode === 'direction'
                ? 'Mot de passe personnel'
                : 'Code secret personnel'}
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={
                  loginMode === 'direction'
                    ? '••••••••••••'
                    : 'Code secret (min. 6 caractères)'
                }
                required
                autoComplete="current-password"
                className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700 text-white placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition p-1 cursor-pointer"
                title={showPassword ? 'Masquer' : 'Afficher'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-black transition cursor-pointer shadow-lg shadow-emerald-950/60 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed border border-emerald-400/30"
          >
            {isLoading ? (
              <span>Authentification en cours...</span>
            ) : (
              <>
                <span>Se connecter</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Security Notice */}
        <div className="text-[11px] text-slate-500 text-center pt-2">
          <p>Authentification sécurisée • Accès cloisonnés par profil officiel</p>
          <p className="text-[10px] mt-0.5">Société NIGER SÉCURITÉ SARL • Niamey</p>
        </div>
      </div>
    </div>
  );
};
