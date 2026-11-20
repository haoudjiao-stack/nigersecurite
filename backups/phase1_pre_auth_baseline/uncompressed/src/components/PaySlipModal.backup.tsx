import React from 'react';
import { X, Printer, Shield, UserCheck, Calendar, DollarSign, CheckCircle2 } from 'lucide-react';
import { FichePaieAgent, EnterpriseSettings } from '../types';
import { DEFAULT_ENTERPRISE_SETTINGS } from '../mockData';

interface PaySlipModalProps {
  payslip: FichePaieAgent | null;
  onClose: () => void;
  onMarkAsPaid: (id: string) => void;
  settings?: EnterpriseSettings;
  canPay?: boolean;
}

export const PaySlipModal: React.FC<PaySlipModalProps> = ({
  payslip,
  onClose,
  onMarkAsPaid,
  settings = DEFAULT_ENTERPRISE_SETTINGS,
  canPay = true,
}) => {
  if (!payslip) return null;

  const formatFCFA = (val: number) => {
    return new Intl.NumberFormat('fr-FR').format(val) + ' FCFA';
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[95vh] overflow-y-auto flex flex-col shadow-2xl text-slate-100">
        {/* Header toolbar */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400">
              <DollarSign className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-bold text-white text-base">Bulletin de Paie Mensuel</h3>
              <p className="text-xs text-slate-400">{payslip.agentNom} • {payslip.agentMatricule}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Imprimer</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Payslip body */}
        <div className="p-6 bg-slate-900 space-y-5">
          {/* Company and Slip Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-4 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <Shield className="w-6 h-6 text-emerald-400" />
                <span className="text-lg font-black text-white">{settings.raisonSociale}</span>
              </div>
              <p className="text-xs text-slate-400">{settings.adresse} - {settings.ville}</p>
              <p className="text-xs text-slate-400">Affiliation CNSS Employeur : {settings.numeroCNSS}</p>
            </div>

            <div className="sm:text-right">
              <span className="inline-block px-3 py-1 rounded text-xs font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/30">
                BULLETIN DE SALAIRE
              </span>
              <p className="text-sm font-bold text-white mt-1">Mois : {payslip.mois}</p>
              <p className="text-xs text-slate-400">Convention Collective de la Sécurité Privée (Niger)</p>
            </div>
          </div>

          {/* Agent info */}
          <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/80 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
            <div>
              <p className="text-slate-400 font-medium">Nom & Prénoms :</p>
              <p className="font-bold text-white">{payslip.agentNom}</p>
            </div>
            <div>
              <p className="text-slate-400 font-medium">Matricule Employé :</p>
              <p className="font-bold text-emerald-400">{payslip.agentMatricule}</p>
            </div>
            <div>
              <p className="text-slate-400 font-medium">Fonction / Affectation :</p>
              <p className="font-medium text-slate-200">{payslip.poste}</p>
            </div>
            <div>
              <p className="text-slate-400 font-medium">Statut de la paie :</p>
              <span className={`inline-flex items-center gap-1 font-bold ${payslip.statut === 'Payée' ? 'text-emerald-400' : payslip.statut === 'Validée' ? 'text-blue-400' : payslip.statut === 'Rejetée' ? 'text-rose-400' : 'text-amber-400'}`}>
                {payslip.statut}
              </span>
            </div>
          </div>

          {/* Breakdown table */}
          <div className="border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-xs sm:text-sm">
              <thead className="bg-slate-800/80 text-slate-300 font-semibold border-b border-slate-700">
                <tr>
                  <th className="py-2.5 px-3 text-left">Rubriques du salaire</th>
                  <th className="py-2.5 px-3 text-right">Gains (+)</th>
                  <th className="py-2.5 px-3 text-right">Retenues (-)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-200">
                <tr>
                  <td className="py-2.5 px-3">Salaire de base conventionnel (Gardiennage)</td>
                  <td className="py-2.5 px-3 text-right font-medium">{formatFCFA(payslip.salaireBase)}</td>
                  <td className="py-2.5 px-3 text-right text-slate-500">-</td>
                </tr>
                {((payslip.prime || 0) > 0 || (payslip.primeDeNuit || 0) > 0 || (payslip.primeDePanier || 0) > 0 || (payslip.primeAssiduite || 0) > 0) && (
                  <tr>
                    <td className="py-2.5 px-3">
                      Primes & indemnités d'exploitation (Nuit, Panier, Assiduité)
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium text-emerald-400">
                      +{formatFCFA(payslip.prime || ((payslip.primeDeNuit || 0) + (payslip.primeDePanier || 0) + (payslip.primeAssiduite || 0)))}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-500">-</td>
                  </tr>
                )}
                <tr className="bg-slate-800/30 font-semibold text-slate-300">
                  <td className="py-2.5 px-3">Total Salaire Brut Imposable</td>
                  <td className="py-2.5 px-3 text-right text-emerald-400">{formatFCFA(payslip.totalBrut)}</td>
                  <td className="py-2.5 px-3 text-right text-slate-500">-</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 text-rose-300">Cotisation CNSS (Part Ouvrière 5.25% Niger)</td>
                  <td className="py-2.5 px-3 text-right text-slate-500">-</td>
                  <td className="py-2.5 px-3 text-right text-rose-400 font-medium">{formatFCFA(payslip.retenueCNSS)}</td>
                </tr>
                {payslip.acompteRetenu > 0 && (
                  <tr>
                    <td className="py-2.5 px-3 text-amber-300">Acompte sur salaire perçu en milieu de mois</td>
                    <td className="py-2.5 px-3 text-right text-slate-500">-</td>
                    <td className="py-2.5 px-3 text-right text-amber-400 font-medium">{formatFCFA(payslip.acompteRetenu)}</td>
                  </tr>
                )}
                {(payslip.autresRetenues || 0) > 0 && (
                  <tr>
                    <td className="py-2.5 px-3 text-purple-300">Autres retenues (Pénalités, absences, trousseau)</td>
                    <td className="py-2.5 px-3 text-right text-slate-500">-</td>
                    <td className="py-2.5 px-3 text-right text-purple-400 font-medium">-{formatFCFA(payslip.autresRetenues)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Commentaire note if present */}
          {payslip.commentaire && (
            <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700 text-xs text-slate-300">
              <span className="font-semibold text-slate-400">Note comptable : </span>
              <span className="italic">{payslip.commentaire}</span>
            </div>
          )}

          {/* Rejection notice if rejected */}
          {payslip.statut === 'Rejetée' && payslip.motifRejet && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
              <span className="font-bold">Motif du rejet par la Direction : </span>
              <span className="italic">« {payslip.motifRejet} »</span>
            </div>
          )}

          {/* Payment receipt details if paid */}
          {payslip.statut === 'Payée' && (
            <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-xs space-y-1.5 text-emerald-200">
              <div className="flex items-center justify-between font-bold text-emerald-300 border-b border-emerald-500/30 pb-1.5">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Paiement effectif enregistré (Comptabilité)</span>
                </span>
                <span>{payslip.datePaiement || 'Date non renseignée'}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
                <div>
                  <span className="text-slate-400">Mode : </span>
                  <span className="font-semibold text-white">{payslip.modePaiement || 'Espèces / Virement'}</span>
                </div>
                <div>
                  <span className="text-slate-400">Référence / Reçu : </span>
                  <span className="font-mono font-semibold text-emerald-300">{payslip.referencePaiement || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400">Montant décaissé : </span>
                  <span className="font-black text-white">{formatFCFA(payslip.montantPaye || payslip.netAPayer)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Net summary */}
          <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30 flex flex-col sm:flex-row justify-between items-center gap-2">
            <div>
              <p className="text-xs uppercase tracking-wider text-emerald-300 font-bold">NET À PAYER À L’AGENT :</p>
              <p className="text-xs text-slate-400">
                Formule : Base + Prime - CNSS - Acompte - Autres retenues
              </p>
            </div>
            <div className="text-2xl font-black text-emerald-400">
              {formatFCFA(payslip.netAPayer)}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/70 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-slate-500 italic">
            Émargement obligatoire de l’agent de sécurité à la remise de la paie.
          </p>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {canPay && payslip.statut !== 'Payée' && (
              <button
                onClick={() => {
                  onMarkAsPaid(payslip.id);
                  onClose();
                }}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirmer le versement (Statut : Payée)</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition cursor-pointer"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
