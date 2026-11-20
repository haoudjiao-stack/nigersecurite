import React from 'react';
import {
  X,
  Printer,
  Download,
  CheckCircle,
  Shield,
  Building2,
  Calendar,
  FileText,
  CreditCard,
  Edit3,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { FactureMensuelle, EnterpriseSettings } from '../types';
import { DEFAULT_ENTERPRISE_SETTINGS } from '../mockData';

interface InvoiceDetailModalProps {
  invoice: FactureMensuelle | null;
  onClose: () => void;
  onRecordPayment?: (invoice: FactureMensuelle) => void;
  onEditDraft?: (invoice: FactureMensuelle) => void;
  settings?: EnterpriseSettings;
}

export const InvoiceDetailModal: React.FC<InvoiceDetailModalProps> = ({
  invoice,
  onClose,
  onRecordPayment,
  onEditDraft,
  settings = DEFAULT_ENTERPRISE_SETTINGS,
}) => {
  if (!invoice) return null;

  const formatFCFA = (val: number) => {
    return new Intl.NumberFormat('fr-FR').format(val) + ' FCFA';
  };

  const handlePrint = () => {
    window.print();
  };

  const montantRegle = invoice.montantRegle || 0;
  const resteADevoir = invoice.resteADevoir !== undefined
    ? invoice.resteADevoir
    : Math.max(0, invoice.montantTTC - montantRegle);

  return (
    <div className="print-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in overflow-y-auto">
      <div className="print-modal-card bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[95vh] overflow-y-auto flex flex-col shadow-2xl text-slate-100 my-auto">
        {/* Actions bar at top */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70 sticky top-0 z-10 print:hidden">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400">
              <FileText className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-bold text-white text-base">Aperçu Facture Mensuelle</h3>
              <p className="text-xs text-slate-400">{invoice.numeroFacture} • {invoice.clientNom}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {invoice.statut === 'Brouillon' && onEditDraft && (
              <button
                onClick={() => {
                  onEditDraft(invoice);
                  onClose();
                }}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border border-slate-700"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Modifier le brouillon</span>
              </button>
            )}
            <button
              onClick={handlePrint}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer border border-slate-700"
              title="Imprimer ou exporter en PDF"
            >
              <Printer className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline">Imprimer / PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Invoice Printable Sheet */}
        <div className="print-sheet p-4 sm:p-6 bg-slate-900 space-y-6 print:space-y-4">
          {/* Header of Invoice */}
          <div className="print-avoid-break print-keep-with-next flex flex-col sm:flex-row print:flex-row justify-between items-start gap-4 pb-6 print:pb-3 border-b border-slate-800 print:border-b-2 print:border-slate-800">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3">
                {settings.logoUrl ? (
                  <div className="w-12 h-12 rounded-xl bg-slate-800 print:bg-white border border-slate-700 print:border-slate-300 p-1 flex items-center justify-center overflow-hidden shrink-0 shadow-sm print:shadow-none">
                    <img
                      src={settings.logoUrl}
                      alt={settings.sigle || 'Logo'}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                ) : (
                  <Shield className="w-7 h-7 text-emerald-400 print:text-emerald-700 shrink-0" />
                )}
                <span className="text-xl print:text-lg font-black tracking-wide text-white print:text-slate-900">{settings.raisonSociale}</span>
              </div>
              <p className="text-xs text-slate-400 print:text-slate-600 mt-1">Gardiennage, Surveillance & Sécurité Privée</p>
              <p className="text-xs text-slate-400 print:text-slate-600">Siège social : {settings.adresse} - {settings.ville}</p>
              <p className="text-xs text-slate-400 print:text-slate-600">NIF : {settings.nif} | RCCM : {settings.rccm}</p>
              <p className="text-xs text-slate-400 print:text-slate-600">Tél : {settings.telephonePrincipal} / {settings.telephoneUrgence247}</p>
            </div>

            <div className="sm:text-right print:text-right shrink-0">
              <span className="inline-block px-3 py-1 rounded text-xs font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/30 print:bg-slate-200 print:text-slate-900 print:border-slate-300">
                FACTURE MENSUELLE
              </span>
              <p className="text-lg font-bold text-white print:text-slate-900 mt-1.5">{invoice.numeroFacture}</p>
              <p className="text-xs text-slate-400 print:text-slate-600">Date émission : {invoice.dateEmission}</p>
              <p className="text-xs text-slate-400 print:text-slate-600">Échéance : {invoice.dateEcheance}</p>
              <div className="mt-2">
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    invoice.statut === 'Payée'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 print:bg-emerald-100 print:text-emerald-800 print:border-emerald-300'
                      : invoice.statut === 'Partielle' || invoice.statut === 'Partiellement payée'
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 print:bg-blue-100 print:text-blue-800 print:border-blue-300'
                      : invoice.statut === 'En retard'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 print:bg-rose-100 print:text-rose-800 print:border-rose-300'
                      : invoice.statut === 'Brouillon'
                      ? 'bg-slate-700/60 text-slate-300 border border-slate-600 print:bg-slate-100 print:text-slate-700 print:border-slate-300'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/40 print:bg-amber-100 print:text-amber-800 print:border-amber-300'
                  }`}
                >
                  Statut : {invoice.statut}
                </span>
              </div>
            </div>
          </div>

          {/* Client Bill To */}
          <div className="print-avoid-break p-4 print:p-3 rounded-xl bg-slate-800/60 print:bg-slate-50 border border-slate-700/80 print:border-slate-300 flex flex-col sm:flex-row print:flex-row justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-slate-400 print:text-slate-600 uppercase tracking-wider">Facturé à l’attention de :</p>
              <h4 className="text-base font-bold text-white print:text-slate-900 mt-1">{invoice.clientNom}</h4>
              <p className="text-xs text-slate-300 print:text-slate-700 mt-0.5">Niamey, République du Niger</p>
              <p className="text-xs text-slate-400 print:text-slate-600 mt-1">
                Période de prestation : <span className="text-emerald-400 print:text-emerald-800 font-semibold">{invoice.mois}</span>
              </p>
              {invoice.siteNom && (
                <p className="text-xs text-slate-400 print:text-slate-600">Site sécurisé : <span className="text-white print:text-slate-900 font-medium">{invoice.siteNom}</span></p>
              )}
            </div>
            <div className="sm:text-right print:text-right text-xs text-slate-300 print:text-slate-700 space-y-1">
              <p className="text-slate-400 print:text-slate-600 font-semibold">Conditions de règlement :</p>
              <p>Paiement sous 30 jours à réception de facture</p>
              <p>Mode prévu : {invoice.modePaiement || 'Virement bancaire'}</p>
              {invoice.contratNumero && (
                <p className="text-slate-400 print:text-slate-600">Réf contrat : {invoice.contratNumero}</p>
              )}
            </div>
          </div>

          {/* Line items */}
          <div className="overflow-x-auto print:overflow-visible border border-slate-800 print:border-slate-300 rounded-xl print:rounded-lg">
            <table className="w-full text-left text-xs sm:text-sm print:text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-700 print:border-slate-300 text-slate-400 print:text-slate-800 font-semibold bg-slate-800/40 print:bg-slate-200">
                  <th className="py-2.5 px-3">Désignation de la prestation de gardiennage</th>
                  <th className="py-2.5 px-3 text-center">Période</th>
                  <th className="py-2.5 px-3 text-right">Montant HT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 print:divide-slate-200">
                <tr>
                  <td className="py-3 px-3">
                    <p className="font-semibold text-white print:text-slate-900">
                      {invoice.descriptionPrestation || 'Prestation globale de surveillance & sécurité physique'}
                    </p>
                    <p className="text-xs text-slate-400 print:text-slate-600 mt-0.5">
                      Dispositif de vigiles qualifiés, rondes inopinées de contrôle de jour et de nuit, tenue réglementaire complète, tenue de la main courante.
                    </p>
                  </td>
                  <td className="py-3 px-3 text-center text-slate-300 print:text-slate-700 whitespace-nowrap">{invoice.mois}</td>
                  <td className="py-3 px-3 text-right font-medium text-white print:text-slate-900 whitespace-nowrap">
                    {formatFCFA(invoice.montantHT)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Totals & Remaining balance */}
          <div className="print-avoid-break flex flex-col sm:flex-row print:flex-row justify-between items-start gap-4 pt-4 print:pt-3 border-t border-slate-800 print:border-slate-300">
            <div className="text-xs text-slate-400 print:text-slate-700 max-w-sm space-y-1">
              <p className="font-semibold text-slate-300 print:text-slate-900">Coordonnées bancaires pour virement :</p>
              <p>Banque : {settings.banquePrincipale}</p>
              <p>IBAN / RIB : {settings.ribBancaire}</p>
              <p>Ou par Mobile Money : Compte Entreprise Airtel Money / Moov</p>
            </div>

            <div className="w-full sm:w-72 print:w-72 space-y-2 text-xs sm:text-sm print:text-xs bg-slate-800/50 print:bg-slate-50 p-3.5 rounded-xl border border-slate-700/80 print:border-slate-300">
              <div className="flex justify-between text-slate-300 print:text-slate-700">
                <span>Sous-total HT :</span>
                <span className="font-medium text-white print:text-slate-900">{formatFCFA(invoice.montantHT)}</span>
              </div>
              <div className="flex justify-between text-slate-300 print:text-slate-700">
                <span>TVA ({invoice.tauxTVA}%) :</span>
                <span className="font-medium text-white print:text-slate-900">
                  {invoice.tauxTVA === 0 ? 'Exonéré (Accords/ONG)' : formatFCFA(invoice.montantTVA)}
                </span>
              </div>
              <div className="flex justify-between text-base print:text-sm font-bold text-white print:text-slate-900 pt-2 border-t border-slate-700 print:border-slate-300">
                <span className="text-emerald-400 print:text-emerald-800">Total Net TTC :</span>
                <span className="text-emerald-400 print:text-emerald-800">{formatFCFA(invoice.montantTTC)}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-300 print:text-slate-700 pt-1 border-t border-slate-700 print:border-slate-300">
                <span>Total déjà encaissé :</span>
                <span className="font-bold text-emerald-400 print:text-emerald-700">-{formatFCFA(montantRegle)}</span>
              </div>
              <div className="flex justify-between text-sm font-extrabold text-amber-300 print:text-amber-800 pt-1">
                <span>Reste à devoir :</span>
                <span>{formatFCFA(resteADevoir)}</span>
              </div>
            </div>
          </div>

          {/* History of Payments (Requirement 7 & 9) */}
          <div className="space-y-2 pt-2">
            <h4 className="print-keep-with-next text-xs font-bold uppercase tracking-wider text-slate-300 print:text-slate-800 flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-emerald-400 print:text-emerald-700" />
              <span>Historique des encaissements enregistrés ({invoice.reglements?.length || 0})</span>
            </h4>

            {(!invoice.reglements || invoice.reglements.length === 0) ? (
              <div className="p-3.5 rounded-xl bg-slate-800/40 print:bg-slate-50 border border-slate-700/80 print:border-slate-300 text-xs text-slate-400 print:text-slate-600 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 print:text-amber-700 shrink-0" />
                <span>Aucun encaissement n'a encore été enregistré pour cette facture.</span>
              </div>
            ) : (
              <div className="overflow-x-auto print:overflow-visible border border-slate-800 print:border-slate-300 rounded-xl print:rounded-lg">
                <table className="w-full text-left text-xs print:text-[10px]">
                  <thead className="bg-slate-800/80 print:bg-slate-200 text-slate-300 print:text-slate-800 font-semibold border-b border-slate-700 print:border-slate-300">
                    <tr>
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3">Mode</th>
                      <th className="py-2 px-3">Référence / Reçu</th>
                      <th className="py-2 px-3">Note</th>
                      <th className="py-2 px-3 text-right">Montant Encaissé</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 print:divide-slate-200 text-slate-300 print:text-slate-700">
                    {invoice.reglements.map((reg) => (
                      <tr key={reg.id} className="hover:bg-slate-800/30">
                        <td className="py-2 px-3 font-mono">{reg.dateReglement}</td>
                        <td className="py-2 px-3">{reg.modePaiement}</td>
                        <td className="py-2 px-3 font-mono text-emerald-300 print:text-slate-900">{reg.reference || '-'}</td>
                        <td className="py-2 px-3 text-slate-400 print:text-slate-600 italic">{reg.note || '-'}</td>
                        <td className="py-2 px-3 text-right font-bold text-emerald-400 print:text-emerald-800 whitespace-nowrap">
                          +{formatFCFA(reg.montant)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Cadre officiel cachet & signatures visible uniquement à l'impression */}
          <div className="hidden print:block print-avoid-break pt-4 space-y-3">
            <div className="pt-3 border-t border-slate-300 grid grid-cols-2 gap-5 text-[11px] text-slate-700">
              <div className="border border-slate-400 rounded-lg p-3 h-24 flex flex-col justify-between bg-white">
                <p className="font-bold text-slate-900 uppercase text-[10px]">Pour la Comptabilité & Finances :</p>
                <p className="text-[10px] text-slate-500 italic border-t border-dashed border-slate-300 pt-1">
                  Signature et mention « Arrêtée la présente facture »
                </p>
              </div>
              <div className="border border-slate-400 rounded-lg p-3 h-24 flex flex-col justify-between bg-white">
                <p className="font-bold text-slate-900 uppercase text-[10px]">Pour la Direction Générale :</p>
                <p className="text-[10px] text-slate-500 italic border-t border-dashed border-slate-300 pt-1">
                  Visa, cachet officiel et signature
                </p>
              </div>
            </div>
            <div className="pt-2 text-center text-[9px] text-slate-500 border-t border-slate-200">
              {settings.raisonSociale} • Siège social : {settings.adresse}, {settings.ville} (Niger) • NIF : {settings.nif} • RCCM : {settings.rccm}
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/70 flex flex-col sm:flex-row items-center justify-between gap-3 sticky bottom-0 print:hidden">
          <p className="text-xs text-slate-500 italic">
            Document généré en mode démonstration. Conforme à la présentation fiscale au Niger.
          </p>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {invoice.statut !== 'Payée' && resteADevoir > 0 && onRecordPayment && (
              <button
                onClick={() => {
                  onRecordPayment(invoice);
                  onClose();
                }}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-lg shadow-emerald-900/30"
              >
                <CreditCard className="w-4 h-4" />
                <span>Enregistrer un encaissement</span>
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
