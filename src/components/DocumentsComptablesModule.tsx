import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Printer,
  Download,
  Landmark,
  FileText,
  CheckCircle2,
  Shield,
  Calendar,
  X,
  AlertTriangle,
  Building2,
  Eye,
} from 'lucide-react';
import { FactureMensuelle, FichePaieAgent, EnterpriseSettings } from '../types';

interface DocumentsComptablesModuleProps {
  invoices: FactureMensuelle[];
  payslips: FichePaieAgent[];
  settings: EnterpriseSettings;
}

export type DocumentType = 'virement' | 'tva' | 'cnss' | 'recettes';

export const DocumentsComptablesModule: React.FC<DocumentsComptablesModuleProps> = ({
  invoices,
  payslips,
  settings,
}) => {
  const [activeDoc, setActiveDoc] = useState<DocumentType | null>('recettes');
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  const formatFCFA = (val: number) => new Intl.NumberFormat('fr-FR').format(val) + ' FCFA';

  // Initiales dynamiques pour le cartouche officiel du document imprimable
  const initialsLogo = React.useMemo(() => {
    if (settings.sigle) {
      const words = settings.sigle.trim().split(/\s+/);
      if (words.length > 1) {
        return words.map((w) => w[0]).join('').substring(0, 3).toUpperCase();
      }
      return settings.sigle.substring(0, 3).toUpperCase();
    }
    if (settings.raisonSociale) {
      const words = settings.raisonSociale.trim().split(/\s+/);
      return words.slice(0, 2).map((w) => w[0]).join('').toUpperCase();
    }
    return 'NS';
  }, [settings.sigle, settings.raisonSociale]);

  // Métriques financières
  const totalNetSalaires = payslips.reduce((acc, p) => acc + p.netAPayer, 0);
  const totalCNSSOuvrier = payslips.reduce((acc, p) => acc + p.retenueCNSS, 0);
  const totalCNSSPatronal = Math.round(payslips.reduce((acc, p) => acc + p.totalBrut * 0.154, 0));
  const totalTVACollectee = invoices.reduce((acc, inv) => acc + inv.montantTVA, 0);
  const totalFactureTTC = invoices.reduce((acc, i) => acc + i.montantTTC, 0);
  const totalEncaisseReel = invoices.reduce((acc, i) => acc + (i.montantRegle || 0), 0);
  const totalResteADevoir = invoices.reduce((acc, inv) => {
    const reste = inv.resteADevoir !== undefined ? inv.resteADevoir : Math.max(0, inv.montantTTC - (inv.montantRegle || 0));
    return acc + reste;
  }, 0);

  // Titres des documents
  const getDocumentTitle = (type: DocumentType | null) => {
    switch (type) {
      case 'recettes':
        return 'Journal des Règlements Clients Encaissés';
      case 'virement':
        return 'Ordre de virement collectif des salaires des vigiles';
      case 'tva':
        return 'État récapitulatif de TVA 19% (DGI Niger)';
      case 'cnss':
        return 'Bordereau récapitulatif des cotisations sociales CNSS';
      default:
        return 'Document Comptable';
    }
  };

  // Gestionnaire d'impression
  const handleOpenPrintPreview = () => {
    if (!activeDoc) {
      setWarningMessage(
        "Aucun document n'est sélectionné. Veuillez sélectionner un document comptable (Journal des encaissements, Bordereau de virement, Déclaration TVA ou Bordereau CNSS) pour ouvrir l'aperçu avant impression."
      );
      return;
    }
    setWarningMessage(null);
    setIsPrintPreviewOpen(true);
  };

  const handleLaunchBrowserPrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-in fade-in print:space-y-0">
      <div className={isPrintPreviewOpen ? 'space-y-6 print:hidden' : 'space-y-6'}>
      {/* Top Header Bar */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400">
              <FileSpreadsheet className="w-5 h-5" />
            </span>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white">Documents & Bordereaux Comptables</h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                Espace Comptabilité
              </span>
            </div>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Édition et impression des bordereaux officiels : journal des encaissements, virements bancaires BSIC, TVA Niger et CNSS.
          </p>
        </div>

        {/* Bouton Imprimer le document sélectionné */}
        <button
          onClick={handleOpenPrintPreview}
          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-blue-900/40"
          title="Ouvrir l'aperçu avant impression du document actuellement sélectionné"
        >
          <Printer className="w-4 h-4 text-white" />
          <span>Imprimer le document sélectionné</span>
        </button>
      </div>

      {/* Message d'avertissement explicite si aucun document n'est sélectionné */}
      {warningMessage && (
        <div className="p-4 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-200 text-xs flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{warningMessage}</span>
          </div>
          <button
            onClick={() => setWarningMessage(null)}
            className="text-amber-400 hover:text-white px-2.5 py-1 rounded bg-amber-500/20 text-xs font-semibold cursor-pointer"
          >
            Fermer
          </button>
        </div>
      )}

      {/* Onglets de sélection des documents comptables */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => {
            setActiveDoc('recettes');
            setWarningMessage(null);
          }}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            activeDoc === 'recettes'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Journal des Encaissements Clients</span>
        </button>
        <button
          onClick={() => {
            setActiveDoc('virement');
            setWarningMessage(null);
          }}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            activeDoc === 'virement'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <Landmark className="w-3.5 h-3.5" />
          <span>Bordereau Virement Salaires (BSIC)</span>
        </button>
        <button
          onClick={() => {
            setActiveDoc('tva');
            setWarningMessage(null);
          }}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            activeDoc === 'tva'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Déclaration TVA 19% (DGI Niger)</span>
        </button>
        <button
          onClick={() => {
            setActiveDoc('cnss');
            setWarningMessage(null);
          }}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            activeDoc === 'cnss'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          <span>Bordereau Cotisations CNSS</span>
        </button>
      </div>

      {/* Document View Sheet */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-5 text-slate-200">
        {/* Document Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-3 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            {settings.logoUrl ? (
              <div className="w-11 h-11 rounded-xl bg-slate-800 border border-slate-700 p-1 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                <img
                  src={settings.logoUrl}
                  alt={settings.sigle || 'Logo'}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            ) : null}
            <div>
              <h3 className="text-base font-black text-white">{settings.raisonSociale}</h3>
              <p className="text-xs text-slate-400">NIF : {settings.nif} | RCCM : {settings.rccm}</p>
              <p className="text-xs text-slate-400">{settings.adresse} - {settings.ville}, République du Niger</p>
            </div>
          </div>
          <div className="sm:text-right">
            <span className="text-[11px] font-bold px-2.5 py-1 rounded bg-blue-500/10 text-blue-300 border border-blue-500/30 uppercase">
              Document Comptable Démo
            </span>
            <p className="text-xs text-slate-400 mt-1">
              Document sélectionné : <strong className="text-white">{getDocumentTitle(activeDoc)}</strong>
            </p>
          </div>
        </div>

        {/* 1. Journal des Encaissements Clients */}
        {activeDoc === 'recettes' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                  Journal des Règlements Clients Encaissés
                </h4>
                <p className="text-xs text-slate-400">
                  État chronologique des paiements partiels et totaux perçus au titre des prestations de gardiennage.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-300">Total facturé : {formatFCFA(totalFactureTTC)}</span>
                <span className="text-xs font-bold text-emerald-400">Total perçu : {formatFCFA(totalEncaisseReel)}</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-800/60 text-slate-300 border-b border-slate-700">
                  <tr>
                    <th className="py-2.5 px-3">N° Facture</th>
                    <th className="py-2.5 px-3">Client & Contrat</th>
                    <th className="py-2.5 px-3">Période</th>
                    <th className="py-2.5 px-3 text-right">Total TTC</th>
                    <th className="py-2.5 px-3 text-right text-emerald-400 font-bold">Encaissé</th>
                    <th className="py-2.5 px-3 text-right font-bold text-amber-300">Solde Dû</th>
                    <th className="py-2.5 px-3">Mode & Règlement</th>
                    <th className="py-2.5 px-3 text-center">État</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {invoices.map((inv) => {
                    const regle = inv.montantRegle || 0;
                    const solde = inv.resteADevoir !== undefined ? inv.resteADevoir : Math.max(0, inv.montantTTC - regle);
                    return (
                      <tr key={inv.id} className="hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 font-mono text-emerald-400 font-bold">{inv.numeroFacture}</td>
                        <td className="py-2.5 px-3">
                          <p className="font-semibold text-white">{inv.clientNom}</p>
                          {inv.contratNumero && (
                            <p className="text-[10px] text-slate-400">{inv.contratNumero}</p>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-300 whitespace-nowrap">{inv.mois}</td>
                        <td className="py-2.5 px-3 text-right font-semibold text-white whitespace-nowrap">{formatFCFA(inv.montantTTC)}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-400 whitespace-nowrap">{formatFCFA(regle)}</td>
                        <td className="py-2.5 px-3 text-right font-black text-amber-300 whitespace-nowrap">{formatFCFA(solde)}</td>
                        <td className="py-2.5 px-3 text-slate-400">
                          <p className="text-slate-200">{inv.modePaiement || 'Virement bancaire'}</p>
                          {inv.reglements && inv.reglements.length > 0 && (
                            <p className="text-[10px] text-emerald-400">{inv.reglements.length} versement(s)</p>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              inv.statut === 'Payée'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : inv.statut === 'Partielle' || inv.statut === 'Partiellement payée'
                                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                                : inv.statut === 'En retard'
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            }`}
                          >
                            {inv.statut}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 2. Bordereau Virement Salaires */}
        {activeDoc === 'virement' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                Ordre de virement collectif des salaires des vigiles
              </h4>
              <span className="text-xs text-emerald-400 font-bold">Total : {formatFCFA(totalNetSalaires)}</span>
            </div>

            <p className="text-xs text-slate-400">
              Banque domiciliataire : <strong className="text-slate-200">{settings.banquePrincipale}</strong> • Compte N° <strong className="font-mono text-emerald-400">{settings.ribBancaire}</strong>
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-800/60 text-slate-300 border-b border-slate-700">
                  <tr>
                    <th className="py-2 px-3">Matricule</th>
                    <th className="py-2 px-3">Bénéficiaire (Agent)</th>
                    <th className="py-2 px-3">Affectation</th>
                    <th className="py-2 px-3 text-right">Net à virer (FCFA)</th>
                    <th className="py-2 px-3 text-center">Émargement / Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {payslips.map((p) => (
                    <tr key={p.id}>
                      <td className="py-2.5 px-3 font-mono text-emerald-400">{p.agentMatricule}</td>
                      <td className="py-2.5 px-3 font-semibold text-white">{p.agentNom}</td>
                      <td className="py-2.5 px-3 text-slate-400">{p.poste}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-white">{formatFCFA(p.netAPayer)}</td>
                      <td className="py-2.5 px-3 text-center text-slate-400">{p.statut}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3. TVA DGI */}
        {activeDoc === 'tva' && (
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">
              État récapitulatif de la Taxe sur la Valeur Ajoutée (TVA 19% Niger)
            </h4>

            <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/80 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <p className="text-slate-400">Base Imposable (Prestations HT taxables) :</p>
                <p className="text-base font-bold text-white mt-1">
                  {formatFCFA(invoices.filter((i) => i.tauxTVA > 0).reduce((acc, i) => acc + i.montantHT, 0))}
                </p>
              </div>
              <div>
                <p className="text-slate-400">Chiffre d’affaires exonéré (Accords ONGs) :</p>
                <p className="text-base font-bold text-emerald-400 mt-1">
                  {formatFCFA(invoices.filter((i) => i.tauxTVA === 0).reduce((acc, i) => acc + i.montantHT, 0))}
                </p>
              </div>
              <div>
                <p className="text-slate-400">TVA Nette due à la DGI (19%) :</p>
                <p className="text-base font-black text-amber-400 mt-1">{formatFCFA(totalTVACollectee)}</p>
              </div>
            </div>

            <p className="text-xs text-slate-400 italic">
              Conforme à l'article 30 du Code Général des Impôts de la République du Niger. Déclaration mensuelle déposée avant le 15 du mois suivant.
            </p>
          </div>
        )}

        {/* 4. CNSS */}
        {activeDoc === 'cnss' && (
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">
              Bordereau récapitulatif des Cotisations Sociales CNSS Niger
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700">
                <span className="text-slate-400 block">Part Ouvrière (5.25% retenue vigiles) :</span>
                <span className="text-base font-bold text-white mt-1 block">{formatFCFA(totalCNSSOuvrier)}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700">
                <span className="text-slate-400 block">Part Patronale estimée (~15.4%) :</span>
                <span className="text-base font-bold text-purple-300 mt-1 block">{formatFCFA(totalCNSSPatronal)}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700">
                <span className="text-slate-400 block">Total Cotisation Globale CNSS :</span>
                <span className="text-base font-black text-emerald-400 mt-1 block">{formatFCFA(totalCNSSOuvrier + totalCNSSPatronal)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
      </div>

      {/* ========================================================================= */}
      {/* MODALE D'APERÇU AVANT IMPRESSION OFFICIELLE (PRINT PREVIEW MODAL)         */}
      {/* ========================================================================= */}
      {isPrintPreviewOpen && activeDoc && (
        <div className="print-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md overflow-y-auto animate-in fade-in">
          <div className="print-modal-card bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-5xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden my-auto">
            {/* Action Toolbar Header */}
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3 sticky top-0 z-10 print:hidden">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-white">
                    Aperçu avant impression — {getDocumentTitle(activeDoc)}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Mise en page officielle certifiée conforme • {settings.raisonSociale}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleLaunchBrowserPrint}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-lg shadow-emerald-900/40 cursor-pointer"
                  title="Lancer l'impression sur imprimante ou générer un PDF"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimer</span>
                </button>
                <button
                  onClick={() => setIsPrintPreviewOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                  title="Fermer l'aperçu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Document Sheet (Style A4 Professionnel) */}
            <div className="print-modal-scroll p-5 sm:p-8 overflow-y-auto flex-1 bg-slate-950/60 flex justify-center">
              <div className="print-sheet bg-white text-slate-900 rounded-xl p-6 sm:p-10 shadow-2xl max-w-4xl w-full border border-slate-200 font-sans text-xs space-y-6 print:space-y-4 print:border-none print:shadow-none print:p-0 print:rounded-none">
                {/* Entête d'Entreprise Officiel */}
                <div className="print-avoid-break print-keep-with-next flex flex-col sm:flex-row print:flex-row justify-between items-start gap-4 pb-4 print:pb-3 border-b-2 border-slate-800">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      {settings.logoUrl ? (
                        <div className="w-12 h-12 rounded-lg border border-slate-300 p-1 bg-white flex items-center justify-center overflow-hidden shrink-0 shadow-sm print:shadow-none">
                          <img
                            src={settings.logoUrl}
                            alt={settings.sigle || 'Logo'}
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-emerald-700 text-white flex items-center justify-center font-black text-xs px-1 text-center shrink-0">
                          {initialsLogo}
                        </div>
                      )}
                      <h2 className="text-lg print:text-base font-black tracking-wide text-slate-900 uppercase">
                        {settings.raisonSociale}
                      </h2>
                    </div>
                    <p className="text-[11px] text-slate-600 font-medium">
                      Société de Gardiennage, Surveillance & Sécurité Privée ({settings.sigle})
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {settings.adresse} • {settings.ville}, République du Niger
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Tél : {settings.telephonePrincipal} | Email : {settings.email}
                    </p>
                  </div>

                  <div className="sm:text-right print:text-right shrink-0 space-y-0.5 text-[11px] text-slate-600 border sm:border-0 print:border-0 p-2 sm:p-0 print:p-0 rounded bg-slate-50 sm:bg-transparent print:bg-transparent">
                    <p className="font-bold text-slate-900 uppercase tracking-wider text-[10px] bg-slate-200 px-2 py-0.5 rounded inline-block">
                      DOCUMENT COMPTABLE OFFICIEL
                    </p>
                    <p className="font-mono pt-1">NIF : <strong>{settings.nif}</strong></p>
                    <p className="font-mono">RCCM : <strong>{settings.rccm}</strong></p>
                    <p className="text-slate-500 italic">Agrément Ministère de l'Intérieur</p>
                    <p className="text-slate-500">Date d'édition : <strong>{new Date().toLocaleDateString('fr-FR')}</strong></p>
                  </div>
                </div>

                {/* Titre du document imprimable */}
                <div className="print-avoid-break print-keep-with-next text-center py-2 bg-slate-100 rounded-lg border border-slate-300">
                  <h1 className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-wider">
                    {getDocumentTitle(activeDoc)}
                  </h1>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Exercice Comptable 2026 • Gestion Financière {settings.sigle || settings.raisonSociale}
                  </p>
                </div>

                {/* CONTENU SPÉCIFIQUE DU DOCUMENT SÉLECTIONNÉ */}

                {/* 1. DOCUMENT: RECETTES & ENCAISSEMENTS */}
                {activeDoc === 'recettes' && (
                  <div className="space-y-4 print:space-y-3">
                    <div className="print-avoid-break print-keep-with-next grid grid-cols-3 gap-3 print:gap-2 p-3 print:p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-center">
                      <div>
                        <span className="text-[10px] uppercase text-slate-500 font-bold block">Total Émis (TTC)</span>
                        <span className="text-sm font-black text-slate-900">{formatFCFA(totalFactureTTC)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase text-emerald-700 font-bold block">Total Encaissé</span>
                        <span className="text-sm font-black text-emerald-700">{formatFCFA(totalEncaisseReel)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase text-amber-700 font-bold block">Solde Restant Dû</span>
                        <span className="text-sm font-black text-amber-700">{formatFCFA(totalResteADevoir)}</span>
                      </div>
                    </div>

                    <table className="w-full text-[11px] print:text-[9.5px] border-collapse border border-slate-300">
                      <thead>
                        <tr className="bg-slate-200 text-slate-800 font-bold border-b border-slate-300 text-left">
                          <th className="py-2 px-2.5 print:py-1.5 print:px-1.5 border-r border-slate-300">N° Facture</th>
                          <th className="py-2 px-2.5 print:py-1.5 print:px-1.5 border-r border-slate-300">Client</th>
                          <th className="py-2 px-2.5 print:py-1.5 print:px-1.5 border-r border-slate-300">Période</th>
                          <th className="py-2 px-2.5 print:py-1.5 print:px-1.5 border-r border-slate-300 text-right">Montant TTC</th>
                          <th className="py-2 px-2.5 print:py-1.5 print:px-1.5 border-r border-slate-300 text-right">Règlement</th>
                          <th className="py-2 px-2.5 print:py-1.5 print:px-1.5 border-r border-slate-300 text-right">Reste Dû</th>
                          <th className="py-2 px-2.5 print:py-1.5 print:px-1.5 border-r border-slate-300">Mode</th>
                          <th className="py-2 px-2.5 print:py-1.5 print:px-1.5 text-center">Statut</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {invoices.map((inv) => {
                          const regle = inv.montantRegle || 0;
                          const solde = inv.resteADevoir !== undefined ? inv.resteADevoir : Math.max(0, inv.montantTTC - regle);
                          return (
                            <tr key={inv.id} className="hover:bg-slate-50">
                              <td className="py-2 px-2.5 print:py-1.5 print:px-1.5 font-mono font-bold text-slate-900 border-r border-slate-200 whitespace-nowrap">
                                {inv.numeroFacture}
                              </td>
                              <td className="py-2 px-2.5 print:py-1.5 print:px-1.5 border-r border-slate-200 font-medium text-slate-800 break-words">
                                {inv.clientNom}
                              </td>
                              <td className="py-2 px-2.5 print:py-1.5 print:px-1.5 border-r border-slate-200 text-slate-600 whitespace-nowrap">
                                {inv.mois}
                              </td>
                              <td className="py-2 px-2.5 print:py-1.5 print:px-1.5 border-r border-slate-200 text-right font-semibold text-slate-900 whitespace-nowrap">
                                {formatFCFA(inv.montantTTC)}
                              </td>
                              <td className="py-2 px-2.5 print:py-1.5 print:px-1.5 border-r border-slate-200 text-right font-bold text-emerald-700 whitespace-nowrap">
                                {formatFCFA(regle)}
                              </td>
                              <td className="py-2 px-2.5 print:py-1.5 print:px-1.5 border-r border-slate-200 text-right font-bold text-amber-700 whitespace-nowrap">
                                {formatFCFA(solde)}
                              </td>
                              <td className="py-2 px-2.5 print:py-1.5 print:px-1.5 border-r border-slate-200 text-slate-600 break-words">
                                {inv.modePaiement || 'Virement bancaire'}
                              </td>
                              <td className="py-2 px-2.5 print:py-1.5 print:px-1.5 text-center font-bold whitespace-nowrap">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] print:text-[9px] ${inv.statut === 'Payée' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                                  {inv.statut}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-100 font-bold border-t-2 border-slate-400 text-slate-900">
                          <td colSpan={3} className="py-2.5 px-2.5 print:py-1.5 print:px-1.5 border-r border-slate-300 text-right uppercase">
                            Totaux Généraux :
                          </td>
                          <td className="py-2.5 px-2.5 print:py-1.5 print:px-1.5 border-r border-slate-300 text-right whitespace-nowrap">
                            {formatFCFA(totalFactureTTC)}
                          </td>
                          <td className="py-2.5 px-2.5 print:py-1.5 print:px-1.5 border-r border-slate-300 text-right text-emerald-800 whitespace-nowrap">
                            {formatFCFA(totalEncaisseReel)}
                          </td>
                          <td className="py-2.5 px-2.5 print:py-1.5 print:px-1.5 border-r border-slate-300 text-right text-amber-800 whitespace-nowrap">
                            {formatFCFA(totalResteADevoir)}
                          </td>
                          <td colSpan={2} className="py-2.5 px-2.5 print:py-1.5 print:px-1.5 text-center text-slate-600 text-[10px] print:text-[9px]">
                            {invoices.length} écriture(s)
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}

                {/* 2. DOCUMENT: BORDEREAU VIREMENT SALAIRES */}
                {activeDoc === 'virement' && (
                  <div className="space-y-4 print:space-y-3">
                    <div className="print-avoid-break print-keep-with-next p-3 print:p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-slate-700 text-xs">
                      <p>
                        Banque donneur d'ordre : <strong>{settings.banquePrincipale}</strong> • Compte N° <strong className="font-mono">{settings.ribBancaire}</strong>
                      </p>
                      <p className="mt-1 text-slate-600">
                        Objet : Virement groupé des salaires du personnel de surveillance et gardiennage.
                      </p>
                    </div>

                    <table className="w-full text-[11px] print:text-[10px] border-collapse border border-slate-300">
                      <thead>
                        <tr className="bg-slate-200 text-slate-800 font-bold border-b border-slate-300 text-left">
                          <th className="py-2 px-2.5 print:py-1.5 print:px-2 border-r border-slate-300">Matricule</th>
                          <th className="py-2 px-2.5 print:py-1.5 print:px-2 border-r border-slate-300">Nom & Prénom de l'Agent</th>
                          <th className="py-2 px-2.5 print:py-1.5 print:px-2 border-r border-slate-300">Poste & Affectation</th>
                          <th className="py-2 px-2.5 print:py-1.5 print:px-2 border-r border-slate-300 text-right">Net à Payer (FCFA)</th>
                          <th className="py-2 px-2.5 print:py-1.5 print:px-2 text-center">Statut</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {payslips.map((p) => (
                          <tr key={p.id}>
                            <td className="py-2 px-2.5 print:py-1.5 print:px-2 font-mono font-bold text-slate-900 border-r border-slate-200 whitespace-nowrap">
                              {p.agentMatricule}
                            </td>
                            <td className="py-2 px-2.5 print:py-1.5 print:px-2 font-semibold text-slate-800 border-r border-slate-200">
                              {p.agentNom}
                            </td>
                            <td className="py-2 px-2.5 print:py-1.5 print:px-2 text-slate-600 border-r border-slate-200">
                              {p.poste}
                            </td>
                            <td className="py-2 px-2.5 print:py-1.5 print:px-2 text-right font-bold text-slate-900 border-r border-slate-200 whitespace-nowrap">
                              {formatFCFA(p.netAPayer)}
                            </td>
                            <td className="py-2 px-2.5 print:py-1.5 print:px-2 text-center text-slate-600 whitespace-nowrap">
                              {p.statut}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-100 font-bold border-t-2 border-slate-400 text-slate-900">
                          <td colSpan={3} className="py-2.5 px-2.5 print:py-1.5 print:px-2 border-r border-slate-300 text-right uppercase">
                            Masse Salariale Nette Totale :
                          </td>
                          <td className="py-2.5 px-2.5 print:py-1.5 print:px-2 text-right text-emerald-800 border-r border-slate-300 whitespace-nowrap font-black">
                            {formatFCFA(totalNetSalaires)}
                          </td>
                          <td className="py-2.5 px-2.5 print:py-1.5 print:px-2 text-center text-slate-600">
                            {payslips.length} vigile(s)
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}

                {/* 3. DOCUMENT: DÉCLARATION TVA */}
                {activeDoc === 'tva' && (
                  <div className="print-avoid-break space-y-4 print:space-y-3">
                    <p className="text-xs text-slate-600">
                      Déclaration établie conformément au Code Général des Impôts (CGI) du Niger pour les prestations de sécurité privée.
                    </p>

                    <table className="w-full text-[11px] border border-slate-300">
                      <thead className="bg-slate-200 text-slate-800 font-bold">
                        <tr>
                          <th className="py-2 px-3 border-r border-slate-300 text-left">Rubrique Fiscale</th>
                          <th className="py-2 px-3 text-right">Montant en FCFA</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        <tr>
                          <td className="py-2.5 px-3 border-r border-slate-200">Prestations HT assujetties au taux normal de 19%</td>
                          <td className="py-2.5 px-3 text-right font-bold">
                            {formatFCFA(invoices.filter((i) => i.tauxTVA > 0).reduce((acc, i) => acc + i.montantHT, 0))}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-2.5 px-3 border-r border-slate-200">Prestations exonérées (Accords de siège ONGs / Diplomatie)</td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-600">
                            {formatFCFA(invoices.filter((i) => i.tauxTVA === 0).reduce((acc, i) => acc + i.montantHT, 0))}
                          </td>
                        </tr>
                        <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-400">
                          <td className="py-3 px-3 border-r border-slate-300 uppercase">
                            TVA Nette Collectée (19%) due à la DGI :
                          </td>
                          <td className="py-3 px-3 text-right text-emerald-800 text-sm">
                            {formatFCFA(totalTVACollectee)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                {/* 4. DOCUMENT: BORDEREAU CNSS */}
                {activeDoc === 'cnss' && (
                  <div className="print-avoid-break space-y-4 print:space-y-3">
                    <p className="text-xs text-slate-600">
                      Bordereau mensuel des cotisations sociales obligatoires des salariés auprès de la Caisse Nationale de Sécurité Sociale (CNSS Niger).
                    </p>

                    <table className="w-full text-[11px] border border-slate-300">
                      <thead className="bg-slate-200 text-slate-800 font-bold">
                        <tr>
                          <th className="py-2 px-3 border-r border-slate-300 text-left">Type de Cotisation</th>
                          <th className="py-2 px-3 border-r border-slate-300 text-center">Taux Applicable</th>
                          <th className="py-2 px-3 text-right">Montant (FCFA)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        <tr>
                          <td className="py-2.5 px-3 border-r border-slate-200 font-medium">Part Ouvrière (prélevée sur salaires vigiles)</td>
                          <td className="py-2.5 px-3 border-r border-slate-200 text-center font-mono">5.25 %</td>
                          <td className="py-2.5 px-3 text-right font-bold">{formatFCFA(totalCNSSOuvrier)}</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 px-3 border-r border-slate-200 font-medium">Part Patronale (charges employeur)</td>
                          <td className="py-2.5 px-3 border-r border-slate-200 text-center font-mono">~15.40 %</td>
                          <td className="py-2.5 px-3 text-right font-bold">{formatFCFA(totalCNSSPatronal)}</td>
                        </tr>
                        <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-400">
                          <td className="py-3 px-3 border-r border-slate-300 uppercase" colSpan={2}>
                            Total des cotisations dues à la CNSS Niger :
                          </td>
                          <td className="py-3 px-3 text-right text-emerald-800 text-sm">
                            {formatFCFA(totalCNSSOuvrier + totalCNSSPatronal)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Cadre de Signature, Cachet et Attestation Officielle (protégé contre la coupure de page) */}
                <div className="print-avoid-break pt-4 print:pt-3 space-y-3">
                  <div className="pt-4 print:pt-3 border-t border-slate-300 grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-6 sm:gap-8 print:gap-5 text-[11px] text-slate-700">
                    <div className="border border-slate-400 rounded-lg p-3 min-h-[112px] print:h-28 flex flex-col justify-between bg-white">
                      <div>
                        <p className="font-bold text-slate-900 uppercase text-[10px]">
                          Pour la Comptabilité & Finances :
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          Nom, date & signature
                        </p>
                      </div>
                      <p className="text-[10px] text-slate-500 italic border-t border-dashed border-slate-300 pt-1.5">
                        Signature et mention « Vu et certifié conforme »
                      </p>
                    </div>
                    <div className="border border-slate-400 rounded-lg p-3 min-h-[112px] print:h-28 flex flex-col justify-between bg-white">
                      <div>
                        <p className="font-bold text-slate-900 uppercase text-[10px]">
                          Pour la Direction Générale :
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          Cachet officiel & signature du responsable
                        </p>
                      </div>
                      <p className="text-[10px] text-slate-500 italic border-t border-dashed border-slate-300 pt-1.5">
                        Visa, cachet officiel et approbation
                      </p>
                    </div>
                  </div>

                  {/* Mention légale de bas de page */}
                  <div className="pt-2 text-center text-[9px] text-slate-500 border-t border-slate-200">
                    {settings.raisonSociale} • Siège social : {settings.adresse}, {settings.ville} (Niger) • NIF : {settings.nif} • RCCM : {settings.rccm}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
