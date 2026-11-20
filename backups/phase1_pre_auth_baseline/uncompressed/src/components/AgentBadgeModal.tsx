import React, { useEffect } from 'react';
import { X, Shield, Phone, MapPin, QrCode, CheckCircle2, AlertTriangle, User, ArrowLeft } from 'lucide-react';
import { AgentSecurite } from '../types';

interface AgentBadgeModalProps {
  agent: AgentSecurite | null;
  onClose: () => void;
}

export const AgentBadgeModal: React.FC<AgentBadgeModalProps> = ({ agent, onClose }) => {
  // Fermeture automatique à la touche Échap
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!agent) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Badge d'identification de l'agent"
    >
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md max-h-[92vh] flex flex-col shadow-2xl text-slate-100 overflow-hidden relative my-auto">
        {/* Top bar sticky avec bouton Fermer bien visible */}
        <div className="p-3 sm:p-3.5 bg-slate-950/95 backdrop-blur-sm flex items-center justify-between border-b border-slate-800 sticky top-0 z-20">
          <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5 truncate mr-2">
            <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="truncate">Badge d’Identification</span>
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={onClose}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border border-slate-700 shadow-sm"
              title="Fermer le badge (Échap)"
              aria-label="Fermer le badge"
            >
              <X className="w-4 h-4 text-emerald-400" />
              <span>Fermer</span>
            </button>
          </div>
        </div>

        {/* Badge Card - Corps défilant pour s'adapter à toutes les résolutions */}
        <div className="p-5 sm:p-6 bg-gradient-to-b from-slate-900 via-slate-850 to-slate-900 text-center space-y-4 overflow-y-auto flex-1">
          <div className="inline-flex items-center justify-center p-3 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30">
            <Shield className="w-10 h-10 text-emerald-400" />
          </div>

          <div>
            <h4 className="text-xs uppercase font-extrabold tracking-widest text-emerald-400">RÉPUBLIQUE DU NIGER</h4>
            <h3 className="text-base font-black text-white">NIGER SÉCURITÉ PRIVÉE</h3>
            <p className="text-[11px] text-slate-400">Agrément Ministère de l'Intérieur & Sécurité Publique</p>
          </div>

          {/* Profile Photo Mock */}
          <div className="w-24 h-24 mx-auto rounded-full bg-slate-800 border-2 border-emerald-500/50 flex items-center justify-center shadow-lg overflow-hidden">
            <User className="w-14 h-14 text-slate-400" />
          </div>

          <div>
            <h2 className="text-lg font-black text-white">{agent.prenom} {agent.nom}</h2>
            <p className="text-xs font-mono font-bold text-emerald-400 tracking-wider mt-0.5">
              {agent.matricule}
            </p>
            <p className="text-xs text-slate-300 mt-1">{agent.horaire}</p>
          </div>

          {/* Site & Details */}
          <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/80 text-left text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Site d’affectation :</span>
              <span className="font-semibold text-white">{agent.siteActuel}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Téléphone urgence :</span>
              <span className="font-semibold text-emerald-300">{agent.telephone}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Groupe sanguin :</span>
              <span className="font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                {agent.groupeSanguin}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">N° Sécurité Sociale CNSS :</span>
              <span className="font-mono text-slate-300">{agent.numeroCNSS}</span>
            </div>
          </div>

          {/* Equipment verification mini tags */}
          <div className="text-left">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Dotation équipement :</p>
            <div className="grid grid-cols-3 gap-1.5 text-[11px]">
              <span className={`p-1 rounded text-center border ${agent.equipement.tenueComplete ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/15 border-rose-500/30 text-rose-300'}`}>
                Uniforme
              </span>
              <span className={`p-1 rounded text-center border ${agent.equipement.rangers ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/15 border-rose-500/30 text-rose-300'}`}>
                Rangers
              </span>
              <span className={`p-1 rounded text-center border ${agent.equipement.tonfaOuMatraque ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/15 border-rose-500/30 text-rose-300'}`}>
                Tonfa
              </span>
              <span className={`p-1 rounded text-center border ${agent.equipement.torche ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/15 border-rose-500/30 text-rose-300'}`}>
                Lampe Torche
              </span>
              <span className={`p-1 rounded text-center border ${agent.equipement.sifflet ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/15 border-rose-500/30 text-rose-300'}`}>
                Sifflet
              </span>
              <span className={`p-1 rounded text-center border ${agent.equipement.badge ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/15 border-rose-500/30 text-rose-300'}`}>
                Badge porté
              </span>
            </div>
          </div>

          {/* QR code simulation */}
          <div className="pt-2 flex items-center justify-center gap-3 text-xs text-slate-400">
            <div className="p-2 bg-white rounded-lg inline-block">
              <QrCode className="w-12 h-12 text-slate-900" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-slate-200">Scan de vérification ronde</p>
              <p className="text-[10px] text-slate-400">Puce NFC / QR-Code pour pointage contrôleur</p>
            </div>
          </div>
        </div>

        {/* Footer sticky avec bouton Retour visible */}
        <div className="p-3 bg-slate-950/95 backdrop-blur-sm border-t border-slate-800 flex items-center justify-between gap-3 sticky bottom-0 z-20">
          <button
            onClick={onClose}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer border border-slate-700 shadow-md"
          >
            <ArrowLeft className="w-4 h-4 text-emerald-400" />
            <span>Retour à l’écran précédent</span>
          </button>
        </div>
      </div>
    </div>
  );
};
