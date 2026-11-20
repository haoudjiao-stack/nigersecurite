import React, { useState } from 'react';
import {
  X,
  CreditCard,
  CheckCircle2,
  DollarSign,
  Calendar,
  AlertCircle,
  FileCheck,
  Shield,
  Smartphone,
  Banknote,
  Landmark,
} from 'lucide-react';
import { FichePaieAgent } from '../types';

interface PayrollPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  payslip: FichePaieAgent | null;
  onConfirmPayment: (
    payslipId: string,
    paymentData: {
      datePaiement: string;
      montantPaye: number;
      modePaiement: 'Virement bancaire' | 'Airtel Money' | 'Moov Money' | 'Al Izza' | 'Espèces contre émargement' | 'Chèque';
      referencePaiement: string;
    }
  ) => void;
}

export const PayrollPaymentModal: React.FC<PayrollPaymentModalProps> = ({
  isOpen,
  onClose,
  payslip,
  onConfirmPayment,
}) => {
  if (!isOpen || !payslip) return null;

  const todayStr = new Date().toISOString().split('T')[0];

  const [datePaiement, setDatePaiement] = useState<string>(todayStr);
  const [montantPaye, setMontantPaye] = useState<number>(payslip.netAPayer);
  const [modePaiement, setModePaiement] = useState<
    'Virement bancaire' | 'Airtel Money' | 'Moov Money' | 'Al Izza' | 'Espèces contre émargement' | 'Chèque'
  >('Virement bancaire');
  const [referencePaiement, setReferencePaiement] = useState<string>(
    payslip.referencePaiement || `VIR-BSIC-${Date.now().toString().slice(-6)}`
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const formatFCFA = (val: number) => new Intl.NumberFormat('fr-FR').format(val) + ' FCFA';

  const handleConfirm = () => {
    setErrorMsg(null);

    if (!datePaiement) {
      setErrorMsg("Veuillez renseigner la date effective du paiement.");
      return;
    }

    if (montantPaye <= 0) {
      setErrorMsg("Le montant payé doit être supérieur à 0 FCFA.");
      return;
    }

    if (!referencePaiement.trim()) {
      setErrorMsg("Veuillez renseigner la référence de paiement ou le numéro de quittance.");
      return;
    }

    onConfirmPayment(payslip.id, {
      datePaiement,
      montantPaye: Number(montantPaye),
      modePaiement,
      referencePaiement: referencePaiement.trim(),
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg overflow-y-auto shadow-2xl text-slate-100 my-auto">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base sm:text-lg">
                Enregistrer le paiement réel
              </h3>
              <p className="text-xs text-slate-400">
                Confirmation de décaissement effectif après validation hiérarchique
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
          {/* Summary Box */}
          <div className="p-4 rounded-xl bg-slate-800/70 border border-slate-700 text-xs space-y-2">
            <div className="flex justify-between items-center pb-2 border-b border-slate-700/80">
              <span className="text-slate-400">Agent concerné :</span>
              <span className="font-bold text-white text-sm">{payslip.agentNom}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Matricule :</span>
              <span className="font-mono text-emerald-400">{payslip.agentMatricule}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Mois de paie :</span>
              <span className="font-semibold text-slate-200">{payslip.mois}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Statut actuel :</span>
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                {payslip.statut}
              </span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-slate-700/80">
              <span className="text-xs uppercase font-extrabold text-emerald-300">Net validé par Direction :</span>
              <span className="text-base font-black text-emerald-400">{formatFCFA(payslip.netAPayer)}</span>
            </div>
          </div>

          {/* Payment Form Fields */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-400" />
                <span>Date effective du versement *</span>
              </label>
              <input
                type="date"
                value={datePaiement}
                onChange={(e) => setDatePaiement(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs sm:text-sm focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Montant réellement décaissé (FCFA) *</span>
                </span>
                <span className="text-[10px] text-slate-400">Net ordonnancé</span>
              </label>
              <input
                type="number"
                min="0"
                step="500"
                value={montantPaye}
                onChange={(e) => setMontantPaye(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-emerald-300 font-bold text-sm sm:text-base focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Mode de paiement utilisé *
              </label>
              <select
                value={modePaiement}
                onChange={(e) => setModePaiement(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs sm:text-sm focus:border-emerald-500 focus:outline-none"
              >
                <option value="Virement bancaire">Virement bancaire (BSIC, BOA, Ecobank Niger)</option>
                <option value="Airtel Money">Airtel Money Niger</option>
                <option value="Moov Money">Moov Money Niger</option>
                <option value="Al Izza">Al Izza / Transfert express</option>
                <option value="Espèces contre émargement">Espèces en main propre contre émargement (Caisse)</option>
                <option value="Chèque">Chèque bancaire certifié</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                <span>Référence / Quittance / N° de transaction *</span>
                <span className="text-[10px] text-slate-400">Traçabilité comptable</span>
              </label>
              <input
                type="text"
                value={referencePaiement}
                onChange={(e) => setReferencePaiement(e.target.value)}
                placeholder="Ex : VIR-BSIC-2026-9042 ou TX-AIRTEL-4819"
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs sm:text-sm focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
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
            onClick={handleConfirm}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-900/40 transition cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Valider le décaissement (Statut : Payée)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
