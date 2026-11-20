import React, { useState } from 'react';
import {
  X,
  Shield,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  DollarSign,
} from 'lucide-react';
import { FichePaieAgent } from '../types';

interface PayrollDirectionActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  payslip: FichePaieAgent | null;
  onValidate: (payslipId: string, commentaireValidation?: string) => void;
  onReject: (payslipId: string, motifRejet: string) => void;
}

export const PayrollDirectionActionModal: React.FC<PayrollDirectionActionModalProps> = ({
  isOpen,
  onClose,
  payslip,
  onValidate,
  onReject,
}) => {
  if (!isOpen || !payslip) return null;

  const [actionType, setActionType] = useState<'validate' | 'reject'>('validate');
  const [comment, setComment] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const formatFCFA = (val: number) => new Intl.NumberFormat('fr-FR').format(val) + ' FCFA';

  const handleExecute = () => {
    setErrorMsg(null);

    if (actionType === 'reject') {
      if (!comment.trim()) {
        setErrorMsg('Veuillez obligatoirement indiquer un motif de rejet pour la Comptabilité.');
        return;
      }
      onReject(payslip.id, comment.trim());
    } else {
      onValidate(payslip.id, comment.trim() || undefined);
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg overflow-y-auto shadow-2xl text-slate-100 my-auto">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base sm:text-lg">
                Visa Hiérarchique de la Paie
              </h3>
              <p className="text-xs text-slate-400">
                Direction Générale • Contrôle et approbation préalable
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-4">
          {/* Slip Recap */}
          <div className="p-4 rounded-xl bg-slate-800/70 border border-slate-700 text-xs space-y-2">
            <div className="flex justify-between items-center pb-2 border-b border-slate-700">
              <span className="text-slate-400">Agent :</span>
              <span className="font-bold text-white text-sm">{payslip.agentNom}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Matricule & Poste :</span>
              <span className="text-slate-300 font-mono">{payslip.agentMatricule} • {payslip.poste}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Mois :</span>
              <span className="font-semibold text-slate-200">{payslip.mois}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-700/80">
              <div>
                <span className="text-slate-400 text-[10px]">Salaire de Base</span>
                <p className="font-semibold text-slate-200">{formatFCFA(payslip.salaireBase)}</p>
              </div>
              <div>
                <span className="text-slate-400 text-[10px]">Primes Saisies</span>
                <p className="font-semibold text-emerald-400">+{formatFCFA(payslip.prime)}</p>
              </div>
              <div>
                <span className="text-slate-400 text-[10px]">CNSS (5.25%)</span>
                <p className="font-semibold text-rose-400">-{formatFCFA(payslip.retenueCNSS)}</p>
              </div>
              <div>
                <span className="text-slate-400 text-[10px]">Acompte & Autres Retenues</span>
                <p className="font-semibold text-amber-400">
                  -{formatFCFA(payslip.acompteRetenu + (payslip.autresRetenues || 0))}
                </p>
              </div>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-slate-700">
              <span className="text-xs uppercase font-extrabold text-emerald-300">Net calculé :</span>
              <span className="text-lg font-black text-emerald-400">{formatFCFA(payslip.netAPayer)}</span>
            </div>
            {payslip.commentaire && (
              <div className="p-2 rounded bg-slate-900/60 text-[11px] text-slate-300 italic">
                Note Comptabilité : « {payslip.commentaire} »
              </div>
            )}
          </div>

          {/* Action Choice: Validate or Reject */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setActionType('validate');
                setErrorMsg(null);
              }}
              className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition cursor-pointer ${
                actionType === 'validate'
                  ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300 shadow-md ring-2 ring-emerald-500/40'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span>Valider la paie</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActionType('reject');
                setErrorMsg(null);
              }}
              className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition cursor-pointer ${
                actionType === 'reject'
                  ? 'bg-rose-600/20 border-rose-500 text-rose-300 shadow-md ring-2 ring-rose-500/40'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              <XCircle className="w-5 h-5 text-rose-400" />
              <span>Rejeter la paie</span>
            </button>
          </div>

          {/* Comment / Motif field */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
              <span>
                {actionType === 'reject' ? 'Motif obligatoire du rejet *' : 'Commentaire de visa (Facultatif)'}
              </span>
              <span className="text-[10px] text-slate-400">
                {actionType === 'reject' ? 'Transmis à la Comptabilité' : 'Archivé avec le visa'}
              </span>
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder={
                actionType === 'reject'
                  ? 'Ex : Retenue d’absence injustifiée manquante pour le poste du 14 octobre ; primes à recalculer...'
                  : 'Ex : Conforme au tableau de service et aux rapports de rondes de surveillance.'
              }
              className={`w-full px-3 py-2 rounded-xl bg-slate-800 border text-xs sm:text-sm focus:outline-none ${
                actionType === 'reject'
                  ? 'border-rose-500/60 text-rose-100 placeholder-rose-300/40 focus:border-rose-500'
                  : 'border-slate-700 text-slate-200 focus:border-emerald-500'
              }`}
            />
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700 text-[11px] text-slate-400 flex items-start gap-2">
            <Shield className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
            <span>
              {actionType === 'validate'
                ? 'La paie passera au statut « Validée ». Elle sera alors mise à disposition de la Comptabilité pour enregistrement du paiement réel.'
                : 'La paie passera au statut « Rejetée ». La Comptabilité sera notifiée de votre motif et pourra modifier les montants avant nouvelle soumission.'}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleExecute}
            className={`px-5 py-2.5 rounded-xl text-white text-xs font-bold flex items-center gap-2 shadow-lg transition cursor-pointer ${
              actionType === 'validate'
                ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/40'
                : 'bg-rose-600 hover:bg-rose-500 shadow-rose-900/40'
            }`}
          >
            {actionType === 'validate' ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirmer la validation (Statut : Validée)</span>
              </>
            ) : (
              <>
                <XCircle className="w-4 h-4" />
                <span>Confirmer le rejet (Statut : Rejetée)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
