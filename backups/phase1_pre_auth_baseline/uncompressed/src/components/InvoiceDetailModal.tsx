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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[95vh] overflow-y-auto flex flex-col shadow-2xl text-slate-100 my-auto">
        {/* Actions bar at top */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70 sticky top-0 z-10">
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
        <div className="p-4 sm:p-6 bg-slate-900 space-y-6">
          {/* Header of Invoice */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-6 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-3">
                {settings.logoUrl ? (
                  <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 p-1 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                    <img
                      src={settings.logoUrl}
                      alt={settings.sigle || 'Logo'}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                ) : (
                  <Shield className="w-7 h-7 text-emerald-400 shrink-0" />
                )}
                <span className="text-xl font-black tracking-wide text-white">{settings.raisonSociale}</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">Gardiennage, Surveillance & Sécurité Privée</p>
              <p className="text-xs text-slate-400">Siège social : {settings.adresse} - {settings.ville}</p>
              <p className="text-xs text-slate-400">NIF : {settings.nif} | RCCM : {settings.rccm}</p>
              <p className="text-xs text-slate-400">Tél : {settings.telephonePrincipal} / {settings.telephoneUrgence247}</p>
            </div>

            <div className="sm:text-right">
              <span className="inline-block px-3 py-1 rounded text-xs font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/30">
                FACTURE MENSUELLE
              </span>
              <p className="text-lg font-bold text-white mt-1.5">{invoice.numeroFacture}</p>
              <p className="text-xs text-slate-400">Date émission : {invoice.dateEmission}</p>
              <p className="text-xs text-slate-400">Échéance : {invoice.dateEcheance}</p>
              <div className="mt-2">
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    invoice.statut === 'Payée'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : invoice.statut === 'Partielle' || invoice.statut === 'Partiellement payée'
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                      : invoice.statut === 'En retard'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      : invoice.statut === 'Brouillon'
                      ? 'bg-slate-700/60 text-slate-300 border border-slate-600'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  }`}
                >
                  Statut : {invoice.statut}
                </span>
              </div>
            </div>
          </div>

          {/* Client Bill To */}
          <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/80 flex flex-col sm:flex-row justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Facturé à l’attention de :</p>
              <h4 className="text-base font-bold text-white mt-1">{invoice.clientNom}</h4>
              <p className="text-xs text-slate-300 mt-0.5">Niamey, République du Niger</p>
              <p className="text-xs text-slate-400 mt-1">
                Période de prestation : <span className="text-emerald-400 font-semibold">{invoice.mois}</span>
              </p>
              {invoice.siteNom && (
                <p className="text-xs text-slate-400">Site sécurisé : <span className="text-white font-medium">{invoice.siteNom}</span></p>
              )}
            </div>
            <div className="sm:text-right text-xs text-slate-300 space-y-1">
              <p className="text-slate-400 font-semibold">Conditions de règlement :</p>
              <p>Paiement sous 30 jours à réception de facture</p>
              <p>Mode prévu : {invoice.modePaiement || 'Virement bancaire'}</p>
              {invoice.contratNumero && (
                <p className="text-slate-400">Réf contrat : {invoice.contratNumero}</p>
              )}
            </div>
          </div>

          {/* Line items */}
          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-left text-xs sm:text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400 font-semibold bg-slate-800/40">
                  <th className="py-2.5 px-3">Désignation de la prestation de gardiennage</th>
                  <th className="py-2.5 px-3 text-center">Période</th>
                  <th className="py-2.5 px-3 text-right">Montant HT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                <tr>
                  <td className="py-3 px-3">
                    <p className="font-semibold text-white">
                      {invoice.descriptionPrestation || 'Prestation globale de surveillance & sécurité physique'}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Dispositif de vigiles qualifiés, rondes inopinées de contrôle de jour et de nuit, tenue réglementaire complète, tenue de la main courante.
                    </p>
                  </td>
                  <td className="py-3 px-3 text-center text-slate-300 whitespace-nowrap">{invoice.mois}</td>
                  <td className="py-3 px-3 text-right font-medium text-white whitespace-nowrap">
                    {formatFCFA(invoice.montantHT)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Totals & Remaining balance */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pt-4 border-t border-slate-800">
            <div className="text-xs text-slate-400 max-w-sm space-y-1">
              <p className="font-semibold text-slate-300">Coordonnées bancaires pour virement :</p>
              <p>Banque : {settings.banquePrincipale}</p>
              <p>IBAN / RIB : {settings.ribBancaire}</p>
              <p>Ou par Mobile Money : Compte Entreprise Airtel Money / Moov</p>
            </div>

            <div className="w-full sm:w-72 space-y-2 text-xs sm:text-sm bg-slate-800/50 p-3.5 rounded-xl border border-slate-700/80">
              <div className="flex justify-between text-slate-300">
                <span>Sous-total HT :</span>
                <span className="font-medium text-white">{formatFCFA(invoice.montantHT)}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>TVA ({invoice.tauxTVA}%) :</span>
                <span className="font-medium text-white">
                  {invoice.tauxTVA === 0 ? 'Exonéré (Accords/ONG)' : formatFCFA(invoice.montantTVA)}
                </span>
              </div>
              <div className="flex justify-between text-base font-bold text-white pt-2 border-t border-slate-700">
                <span className="text-emerald-400">Total Net TTC :</span>
                <span className="text-emerald-400">{formatFCFA(invoice.montantTTC)}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-300 pt-1 border-t border-slate-700">
                <span>Total déjà encaissé :</span>
                <span className="font-bold text-emerald-400">-{formatFCFA(montantRegle)}</span>
              </div>
              <div className="flex justify-between text-sm font-extrabold text-amber-300 pt-1">
                <span>Reste à devoir :</span>
                <span>{formatFCFA(resteADevoir)}</span>
              </div>
            </div>
          </div>

          {/* History of Payments (Requirement 7 & 9) */}
          <div className="space-y-2 pt-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-emerald-400" />
              <span>Historique des encaissements enregistrés ({invoice.reglements?.length || 0})</span>
            </h4>

            {(!invoice.reglements || invoice.reglements.length === 0) ? (
              <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/80 text-xs text-slate-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Aucun encaissement n'a encore été enregistré pour cette facture.</span>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-800/80 text-slate-300 font-semibold border-b border-slate-700">
                    <tr>
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3">Mode</th>
                      <th className="py-2 px-3">Référence / Reçu</th>
                      <th className="py-2 px-3">Note</th>
                      <th className="py-2 px-3 text-right">Montant Encaissé</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {invoice.reglements.map((reg) => (
                      <tr key={reg.id} className="hover:bg-slate-800/30">
                        <td className="py-2 px-3 font-mono">{reg.dateReglement}</td>
                        <td className="py-2 px-3">{reg.modePaiement}</td>
                        <td className="py-2 px-3 font-mono text-emerald-300">{reg.reference || '-'}</td>
                        <td className="py-2 px-3 text-slate-400 italic">{reg.note || '-'}</td>
                        <td className="py-2 px-3 text-right font-bold text-emerald-400 whitespace-nowrap">
                          +{formatFCFA(reg.montant)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/70 flex flex-col sm:flex-row items-center justify-between gap-3 sticky bottom-0">
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
