import React from 'react';
import { ShieldAlert, Sparkles, ArrowRight, Lock } from 'lucide-react';

interface DisclaimerBannerProps {
  onOpenRoadmap: () => void;
}

export const DisclaimerBanner: React.FC<DisclaimerBannerProps> = ({ onOpenRoadmap }) => {
  return (
    <div className="bg-gradient-to-r from-amber-950/90 via-slate-900 to-amber-950/90 border-b border-amber-500/30 text-amber-100 px-4 py-2.5 text-xs sm:text-sm print:hidden">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-center sm:text-left">
          <span className="p-1 rounded bg-amber-500/20 text-amber-400 shrink-0">
            <Lock className="w-4 h-4" />
          </span>
          <p className="leading-snug">
            <span className="font-semibold text-amber-300">Démonstration & Séparation des Rôles Simulée :</span>{' '}
            Le cloisonnement entre Direction, Comptabilité et Contrôleur terrain est simulé côté interface. La sécurité réelle nécessitera une authentification et un contrôle des autorisations (RBAC) verrouillés côté serveur et base de données.
          </p>
        </div>

        <button
          onClick={onOpenRoadmap}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-xs font-medium transition cursor-pointer shrink-0 whitespace-nowrap"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Étapes vers la production réelle</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
