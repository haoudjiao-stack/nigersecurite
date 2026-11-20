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
    <div className="print-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in overflow-y-auto">
      <div className="print-modal-card bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[95vh] overflow-y-auto flex flex-col shadow-2xl text-slate-100 my-auto">
        {/* Header toolbar */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 sticky top-0 z-10 print:hidden">
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
        <div className="print-sheet p-6 bg-slate-900 space-y-5 print:space-y-4">
          {/* Company and Slip Header */}
          <div className="print-avoid-break print-keep-with-next flex flex-col sm:flex-row print:flex-row justify-between items-start gap-4 pb-4 print:pb-3 border-b border-slate-800 print:border-b-2 print:border-slate-800">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3">
                {settings.logoUrl ? (
                  <div className="w-10 h-10 rounded-xl bg-slate-800 print:bg-white border border-slate-700 print:border-slate-300 p-1 flex items-center justify-center overflow-hidden shrink-0 shadow-sm print:shadow-none">
                    <img
                      src={settings.logoUrl}
                      alt={settings.sigle || 'Logo'}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                ) : (
                  <Shield className="w-6 h-6 text-emerald-400 print:text-emerald-700 shrink-0" />
                )}
                <span className="text-lg font-black text-white print:text-slate-900">{settings.raisonSociale}</span>
              </div>
              <p className="text-xs text-slate-400 print:text-slate-600 mt-1">{settings.adresse} - {settings.ville}</p>
              <p className="text-xs text-slate-400 print:text-slate-600">Affiliation CNSS Employeur : {settings.numeroCNSS}</p>
            </div>

            <div className="sm:text-right print:text-right shrink-0">
              <span className="inline-block px-3 py-1 rounded text-xs font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/30 print:bg-slate-200 print:text-slate-900 print:border-slate-300">
                BULLETIN DE SALAIRE
              </span>
              <p className="text-sm font-bold text-white print:text-slate-900 mt-1">Mois : {payslip.mois}</p>
              <p className="text-xs text-slate-400 print:text-slate-600">Convention Collective de la Sécurité Privée (Niger)</p>
            </div>
          </div>

          {/* Agent info */}
          <div className="print-avoid-break p-4 print:p-3 rounded-xl bg-slate-800/60 print:bg-slate-50 border border-slate-700/80 print:border-slate-300 grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-3 text-xs sm:text-sm print:text-xs">
            <div>
              <p className="text-slate-400 print:text-slate-600 font-medium">Nom & Prénoms :</p>
              <p className="font-bold text-white print:text-slate-900">{payslip.agentNom}</p>
            </div>
            <div>
              <p className="text-slate-400 print:text-slate-600 font-medium">Matricule Employé :</p>
              <p className="font-bold text-emerald-400 print:text-emerald-800">{payslip.agentMatricule}</p>
            </div>
            <div>
              <p className="text-slate-400 print:text-slate-600 font-medium">Fonction / Affectation :</p>
              <p className="font-medium text-slate-200 print:text-slate-800">{payslip.poste}</p>
            </div>
            <div>
              <p className="text-slate-400 print:text-slate-600 font-medium">Statut de la paie :</p>
              <span className={`inline-flex items-center gap-1 font-bold ${payslip.statut === 'Payée' ? 'text-emerald-400 print:text-emerald-800' : payslip.statut === 'Validée' ? 'text-blue-400 print:text-blue-800' : payslip.statut === 'Rejetée' ? 'text-rose-400 print:text-rose-700' : 'text-amber-400 print:text-amber-700'}`}>
                {payslip.statut}
              </span>
            </div>
          </div>

          {/* Breakdown table */}
          <div className="print-avoid-break border border-slate-800 print:border-slate-300 rounded-xl print:rounded-lg overflow-hidden print:overflow-visible">
            <table className="w-full text-xs sm:text-sm print:text-xs">
              <thead className="bg-slate-800/80 print:bg-slate-200 text-slate-300 print:text-slate-800 font-semibold border-b border-slate-700 print:border-slate-300">
                <tr>
                  <th className="py-2.5 px-3 text-left">Rubriques du salaire</th>
                  <th className="py-2.5 px-3 text-right">Gains (+)</th>
                  <th className="py-2.5 px-3 text-right">Retenues (-)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 print:divide-slate-200 text-slate-200 print:text-slate-800">
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
                    <td className="py-2.5 px-3 text-right font-medium text-emerald-400 print:text-emerald-800">
                      +{formatFCFA(payslip.prime || ((payslip.primeDeNuit || 0) + (payslip.primeDePanier || 0) + (payslip.primeAssiduite || 0)))}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-500">-</td>
                  </tr>
                )}
                <tr className="bg-slate-800/30 print:bg-slate-100 font-semibold text-slate-300 print:text-slate-900">
                  <td className="py-2.5 px-3">Total Salaire Brut Imposable</td>
                  <td className="py-2.5 px-3 text-right text-emerald-400 print:text-emerald-800">{formatFCFA(payslip.totalBrut)}</td>
                  <td className="py-2.5 px-3 text-right text-slate-500">-</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 text-rose-300 print:text-slate-800">Cotisation CNSS (Part Ouvrière 5.25% Niger)</td>
                  <td className="py-2.5 px-3 text-right text-slate-500">-</td>
                  <td className="py-2.5 px-3 text-right text-rose-400 print:text-rose-700 font-medium">{formatFCFA(payslip.retenueCNSS)}</td>
                </tr>
                {payslip.acompteRetenu > 0 && (
                  <tr>
                    <td className="py-2.5 px-3 text-amber-300 print:text-slate-800">Acompte sur salaire perçu en milieu de mois</td>
                    <td className="py-2.5 px-3 text-right text-slate-500">-</td>
                    <td className="py-2.5 px-3 text-right text-amber-400 print:text-amber-800 font-medium">{formatFCFA(payslip.acompteRetenu)}</td>
                  </tr>
                )}
                {(payslip.autresRetenues || 0) > 0 && (
                  <tr>
                    <td className="py-2.5 px-3 text-purple-300 print:text-slate-800">Autres retenues (Pénalités, absences, trousseau)</td>
                    <td className="py-2.5 px-3 text-right text-slate-500">-</td>
                    <td className="py-2.5 px-3 text-right text-purple-400 print:text-purple-800 font-medium">-{formatFCFA(payslip.autresRetenues)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Commentaire note if present */}
          {payslip.commentaire && (
            <div className="print-avoid-break p-3 rounded-xl bg-slate-800/60 print:bg-slate-50 border border-slate-700 print:border-slate-300 text-xs text-slate-300 print:text-slate-700">
              <span className="font-semibold text-slate-400 print:text-slate-800">Note comptable : </span>
              <span className="italic">{payslip.commentaire}</span>
            </div>
          )}

          {/* Rejection notice if rejected */}
          {payslip.statut === 'Rejetée' && payslip.motifRejet && (
            <div className="print-avoid-break p-3 rounded-xl bg-rose-500/10 print:bg-rose-50 border border-rose-500/30 print:border-rose-300 text-xs text-rose-300 print:text-rose-800">
              <span className="font-bold">Motif du rejet par la Direction : </span>
              <span className="italic">« {payslip.motifRejet} »</span>
            </div>
          )}

          {/* Payment receipt details if paid */}
          {payslip.statut === 'Payée' && (
            <div className="print-avoid-break p-3.5 rounded-xl bg-emerald-950/40 print:bg-emerald-50 border border-emerald-500/40 print:border-emerald-300 text-xs space-y-1.5 text-emerald-200 print:text-slate-800">
              <div className="flex items-center justify-between font-bold text-emerald-300 print:text-emerald-800 border-b border-emerald-500/30 print:border-emerald-300 pb-1.5">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 print:text-emerald-700" />
                  <span>Paiement effectif enregistré (Comptabilité)</span>
                </span>
                <span>{payslip.datePaiement || 'Date non renseignée'}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 print:grid-cols-3 gap-2 pt-1 text-[11px]">
                <div>
                  <span className="text-slate-400 print:text-slate-600">Mode : </span>
                  <span className="font-semibold text-white print:text-slate-900">{payslip.modePaiement || 'Espèces / Virement'}</span>
                </div>
                <div>
                  <span className="text-slate-400 print:text-slate-600">Référence / Reçu : </span>
                  <span className="font-mono font-semibold text-emerald-300 print:text-emerald-800">{payslip.referencePaiement || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 print:text-slate-600">Montant décaissé : </span>
                  <span className="font-black text-white print:text-slate-900">{formatFCFA(payslip.montantPaye || payslip.netAPayer)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Net summary */}
          <div className="print-avoid-break p-4 print:p-3 rounded-xl bg-emerald-950/30 print:bg-slate-100 border border-emerald-500/30 print:border-slate-400 flex flex-col sm:flex-row print:flex-row justify-between items-center gap-2">
            <div>
              <p className="text-xs uppercase tracking-wider text-emerald-300 print:text-slate-900 font-bold">NET À PAYER À L’AGENT :</p>
              <p className="text-xs text-slate-400 print:text-slate-600">
                Formule : Base + Prime - CNSS - Acompte - Autres retenues
              </p>
            </div>
            <div className="text-2xl print:text-xl font-black text-emerald-400 print:text-emerald-800">
              {formatFCFA(payslip.netAPayer)}
            </div>
          </div>

          {/* Cadre officiel signatures & émargement visible uniquement à l'impression */}
          <div className="hidden print:block print-avoid-break pt-3 space-y-3">
            <div className="pt-3 border-t border-slate-300 grid grid-cols-2 gap-5 text-[11px] text-slate-700">
              <div className="border border-slate-400 rounded-lg p-3 h-24 flex flex-col justify-between bg-white">
                <p className="font-bold text-slate-900 uppercase text-[10px]">Signature de l'Agent (Émargement) :</p>
                <p className="text-[10px] text-slate-500 italic border-t border-dashed border-slate-300 pt-1">
                  Date et mention « Lu et approuvé, reçu pour solde »
                </p>
              </div>
              <div className="border border-slate-400 rounded-lg p-3 h-24 flex flex-col justify-between bg-white">
                <p className="font-bold text-slate-900 uppercase text-[10px]">Pour la Direction & Comptabilité :</p>
                <p className="text-[10px] text-slate-500 italic border-t border-dashed border-slate-300 pt-1">
                  Cachet officiel, visa et approbation
                </p>
              </div>
            </div>
            <div className="pt-2 text-center text-[9px] text-slate-500 border-t border-slate-200">
              {settings.raisonSociale} • Siège social : {settings.adresse}, {settings.ville} (Niger) • NIF : {settings.nif} • RCCM : {settings.rccm}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/70 flex flex-col sm:flex-row items-center justify-between gap-3 print:hidden">
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
