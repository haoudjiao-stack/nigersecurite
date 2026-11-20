import React, { useState, useEffect } from 'react';
import {
  X,
  CreditCard,
  DollarSign,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Building,
  Landmark,
  FileText,
  Clock,
  Sparkles,
  Check,
} from 'lucide-react';
import { FactureMensuelle } from '../types';

interface InvoicePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: FactureMensuelle | null;
  availableInvoices?: FactureMensuelle[];
  onConfirmPayment: (
    invoiceId: string,
    payment: {
      montant: number;
      dateReglement: string;
      modePaiement: 'Virement bancaire' | 'Chèque' | 'Espèces' | 'Airtel Money / Mobile Money';
      reference?: string;
      note?: string;
    }
  ) => void;
}

export const InvoicePaymentModal: React.FC<InvoicePaymentModalProps> = ({
  isOpen,
  onClose,
  invoice,
  availableInvoices = [],
  onConfirmPayment,
}) => {
  if (!isOpen) return null;

  const todayStr = new Date().toISOString().split('T')[0];

  // Invoices pool: merge passed invoice with availableInvoices to guarantee existence
  const allInvoicesPool = React.useMemo(() => {
    const map = new Map<string, FactureMensuelle>();
    if (invoice) map.set(invoice.id, invoice);
    availableInvoices.forEach((inv) => {
      if (!map.has(inv.id)) {
        map.set(inv.id, inv);
      } else if (invoice && inv.id === invoice.id) {
        // Keep freshest reference
        map.set(inv.id, inv);
      }
    });
    return Array.from(map.values());
  }, [invoice, availableInvoices]);

  // Invoices eligible for payment (non-brouillon with remaining balance > 0)
  const payableInvoices = React.useMemo(() => {
    return allInvoicesPool.filter((inv) => {
      const solde = inv.resteADevoir !== undefined
        ? inv.resteADevoir
        : Math.max(0, inv.montantTTC - (inv.montantRegle || 0));
      return inv.statut !== 'Brouillon' && solde > 0;
    });
  }, [allInvoicesPool]);

  // Determine initial selected invoice ID
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>(() => {
    if (invoice && invoice.id) return invoice.id;
    if (payableInvoices.length > 0) return payableInvoices[0].id;
    return '';
  });

  // Active invoice resolution
  const activeInvoice = React.useMemo(() => {
    const found = allInvoicesPool.find((inv) => inv.id === selectedInvoiceId);
    if (found) return found;
    if (invoice) return invoice;
    if (payableInvoices.length > 0) return payableInvoices[0];
    return null;
  }, [allInvoicesPool, selectedInvoiceId, invoice, payableInvoices]);

  // Outstanding balance of the currently selected invoice
  const resteADevoirActuel = activeInvoice
    ? (activeInvoice.resteADevoir !== undefined
        ? activeInvoice.resteADevoir
        : Math.max(0, activeInvoice.montantTTC - (activeInvoice.montantRegle || 0)))
    : 0;

  // Form fields state
  const [montantInput, setMontantInput] = useState<string>(resteADevoirActuel.toString());
  const [dateReglement, setDateReglement] = useState<string>(todayStr);
  const [modePaiement, setModePaiement] = useState<
    'Virement bancaire' | 'Chèque' | 'Espèces' | 'Airtel Money / Mobile Money'
  >(activeInvoice?.modePaiement || 'Virement bancaire');
  const [reference, setReference] = useState<string>('');
  const [note, setNote] = useState<string>('');

  // Selected quick choice tracking ('total' | '50%' | '50k' | '100k' | null)
  const [activeChoice, setActiveChoice] = useState<'total' | '50%' | '50k' | '100k' | null>('total');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const formatFCFA = (val: number) => new Intl.NumberFormat('fr-FR').format(val) + ' FCFA';

  // Synchronize when the active invoice changes or when modal is opened
  useEffect(() => {
    if (invoice?.id && invoice.id !== selectedInvoiceId) {
      setSelectedInvoiceId(invoice.id);
    } else if (!selectedInvoiceId && payableInvoices.length > 0) {
      setSelectedInvoiceId(payableInvoices[0].id);
    }
  }, [invoice?.id, payableInvoices]);

  // When active invoice changes or its balance changes, update amount input and default mode
  useEffect(() => {
    if (activeInvoice) {
      const solde = activeInvoice.resteADevoir !== undefined
        ? activeInvoice.resteADevoir
        : Math.max(0, activeInvoice.montantTTC - (activeInvoice.montantRegle || 0));
      setMontantInput(solde.toString());
      setActiveChoice('total');
      if (activeInvoice.modePaiement) {
        setModePaiement(activeInvoice.modePaiement);
      }
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [activeInvoice?.id, activeInvoice?.resteADevoir]);

  // Calculations for live preview
  const montantSaisi = parseFloat(montantInput) || 0;
  const montantRegleActuel = activeInvoice?.montantRegle || 0;
  const montantTotalTTC = activeInvoice?.montantTTC || 0;

  // Requirement 6: solde restant dû = montant total de la facture - total des encaissements enregistrés
  const nouveauTotalEncaissements = montantRegleActuel + montantSaisi;
  const nouveauResteDû = Math.max(0, montantTotalTTC - nouveauTotalEncaissements);

  // Requirement 7: Si le solde est supérieur à zéro et inférieur au montant total, le statut devient « Partielle ». Si le solde est égal à zéro, le statut devient « Payée »
  const getPrevisionStatut = (): 'Payée' | 'Partielle' => {
    return nouveauResteDû === 0 ? 'Payée' : 'Partielle';
  };

  const isSurpaiement = montantSaisi > resteADevoirActuel;
  const isZeroOrNegative = montantSaisi <= 0;

  // Requirement 1, 2, 3, 4, 5: Quick choice handlers
  const handleSelectTotal = () => {
    const val = resteADevoirActuel;
    setMontantInput(val.toString());
    setActiveChoice('total');
    setErrorMsg(null);
  };

  const handleSelectHalf = () => {
    // 50% du solde restant dû et non du montant initial
    const val = Math.round(resteADevoirActuel * 0.5);
    setMontantInput(val.toString());
    setActiveChoice('50%');
    setErrorMsg(null);
  };

  const handleSelectFixed = (val: number, choiceKey: '50k' | '100k') => {
    // Fixes ne peuvent être sélectionnés que s'ils sont positifs et <= resteADevoir
    if (val > 0 && val <= resteADevoirActuel) {
      setMontantInput(val.toString());
      setActiveChoice(choiceKey);
      setErrorMsg(null);
    }
  };

  // Requirement 6: Saisie manuelle
  const handleManualAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    setMontantInput(rawVal);
    setActiveChoice(null);
    setErrorMsg(null);
  };

  // Requirement 7: Confirmer l'encaissement
  const handleConfirm = () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!activeInvoice) {
      setErrorMsg("Veuillez sélectionner une facture valide à encaisser.");
      return;
    }

    if (!dateReglement) {
      setErrorMsg("Veuillez renseigner la date de l'encaissement.");
      return;
    }

    // Refuse un montant nul, négatif ou supérieur au solde restant dû
    if (isZeroOrNegative) {
      setErrorMsg("Le montant de l'encaissement doit être strictement supérieur à 0 FCFA.");
      return;
    }

    if (isSurpaiement) {
      setErrorMsg(
        `Montant invalide : ${formatFCFA(montantSaisi)} dépasse le solde restant dû (${formatFCFA(
          resteADevoirActuel
        )}). Aucun trop-perçu n'est autorisé.`
      );
      return;
    }

    // Execute payment confirmation
    onConfirmPayment(activeInvoice.id, {
      montant: montantSaisi,
      dateReglement,
      modePaiement,
      reference: reference.trim() || undefined,
      note: note.trim() || undefined,
    });

    const statutObtenu = getPrevisionStatut();
    setSuccessMsg(
      `Encaissement de ${formatFCFA(montantSaisi)} validé avec succès ! Nouveau solde restant : ${formatFCFA(
        nouveauResteDû
      )} • Statut : ${statutObtenu}`
    );

    // Close after short display
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl max-h-[95vh] overflow-y-auto flex flex-col shadow-2xl text-slate-100 my-auto">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/70 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base sm:text-lg">
                Enregistrer un encaissement client
              </h3>
              <p className="text-xs text-slate-400">
                Paiement total ou partiel • Actualisation directe du solde restant dû
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
          {/* Success Banner */}
          {successMsg && (
            <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs sm:text-sm flex items-center gap-2.5 animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <p className="font-bold">Opération réussie</p>
                <p className="text-xs text-emerald-200 mt-0.5">{successMsg}</p>
              </div>
            </div>
          )}

          {/* 1. Sélection de la facture */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-blue-400" />
              <span>Facture client à encaisser *</span>
            </label>
            {payableInvoices.length === 0 && !activeInvoice ? (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Aucune facture ouverte avec un solde restant à payer.</span>
              </div>
            ) : (
              <select
                value={selectedInvoiceId}
                onChange={(e) => {
                  setSelectedInvoiceId(e.target.value);
                  setErrorMsg(null);
                }}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs sm:text-sm focus:border-emerald-500 focus:outline-none cursor-pointer"
              >
                {payableInvoices.map((inv) => {
                  const solde = inv.resteADevoir !== undefined
                    ? inv.resteADevoir
                    : Math.max(0, inv.montantTTC - (inv.montantRegle || 0));
                  return (
                    <option key={inv.id} value={inv.id}>
                      {inv.numeroFacture} — {inv.clientNom} (Reste : {formatFCFA(solde)} / Total : {formatFCFA(inv.montantTTC)}) • {inv.statut}
                    </option>
                  );
                })}
              </select>
            )}
          </div>

          {/* 2. Affichage automatique des informations clés de la facture */}
          {activeInvoice && (
            <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700 text-xs space-y-2">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1 pb-2 border-b border-slate-700">
                <span className="text-slate-400 font-medium">Bénéficiaire :</span>
                <span className="font-bold text-white text-sm">
                  <span className="font-mono text-blue-400 mr-2">{activeInvoice.numeroFacture}</span>
                  {activeInvoice.clientNom}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                <div className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800">
                  <p className="text-[10px] text-slate-400 uppercase font-semibold">Montant total TTC</p>
                  <p className="font-bold text-white text-xs sm:text-sm mt-0.5">
                    {formatFCFA(activeInvoice.montantTTC)}
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800">
                  <p className="text-[10px] text-slate-400 uppercase font-semibold">Déjà encaissé</p>
                  <p className="font-bold text-emerald-400 text-xs sm:text-sm mt-0.5">
                    {formatFCFA(activeInvoice.montantRegle || 0)}
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 col-span-2 sm:col-span-1">
                  <p className="text-[10px] text-amber-300 uppercase font-bold">Solde restant dû</p>
                  <p className="font-black text-amber-400 text-xs sm:text-sm mt-0.5">
                    {formatFCFA(resteADevoirActuel)}
                  </p>
                </div>
              </div>
              {activeInvoice.reglements && activeInvoice.reglements.length > 0 && (
                <p className="text-[11px] text-slate-400 pt-1 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-400" />
                  <span>
                    {activeInvoice.reglements.length} règlement(s) enregistré(s) dans l'historique de cette facture.
                  </span>
                </p>
              )}
            </div>
          )}

          {/* 3. Choix du montant & saisie manuelle */}
          <div className="space-y-3 pt-1">
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Montant réellement reçu (FCFA) *</span>
                </label>
                
                {/* Boutons d'options rapides de sélection du montant */}
                <div className="flex flex-wrap items-center gap-1 text-[11px]">
                  {/* Option: Solde total / 100% */}
                  <button
                    type="button"
                    onClick={handleSelectTotal}
                    className={`px-2.5 py-1 rounded-lg border font-bold transition cursor-pointer ${
                      activeChoice === 'total'
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-sm shadow-emerald-500/40'
                        : 'bg-slate-800 hover:bg-slate-700 text-emerald-300 border-emerald-500/40'
                    }`}
                    title={`Régler l'intégralité du solde (${formatFCFA(resteADevoirActuel)})`}
                  >
                    Solde total / 100 %
                  </button>

                  {/* Option: 50% du solde restant dû */}
                  <button
                    type="button"
                    onClick={handleSelectHalf}
                    className={`px-2.5 py-1 rounded-lg border font-bold transition cursor-pointer ${
                      activeChoice === '50%'
                        ? 'bg-blue-500 text-white border-blue-400 shadow-sm shadow-blue-500/40'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                    }`}
                    title={`Régler 50% du solde restant dû (${formatFCFA(Math.round(resteADevoirActuel * 0.5))})`}
                  >
                    50 %
                  </button>

                  {/* Option: Montant fixe 50 000 FCFA (actif seulement si <= solde restant dû) */}
                  <button
                    type="button"
                    disabled={resteADevoirActuel < 50000}
                    onClick={() => handleSelectFixed(50000, '50k')}
                    className={`px-2.5 py-1 rounded-lg border font-bold transition ${
                      resteADevoirActuel < 50000
                        ? 'bg-slate-900/60 text-slate-600 border-slate-800 cursor-not-allowed opacity-50'
                        : activeChoice === '50k'
                        ? 'bg-purple-600 text-white border-purple-400 shadow-sm'
                        : 'bg-slate-800 hover:bg-slate-700 text-purple-300 border-purple-500/30 cursor-pointer'
                    }`}
                    title={resteADevoirActuel < 50000 ? "Dépasse le solde restant dû" : "Régler 50 000 FCFA"}
                  >
                    50 000 FCFA
                  </button>

                  {/* Option: Montant fixe 100 000 FCFA (actif seulement si <= solde restant dû) */}
                  <button
                    type="button"
                    disabled={resteADevoirActuel < 100000}
                    onClick={() => handleSelectFixed(100000, '100k')}
                    className={`px-2.5 py-1 rounded-lg border font-bold transition ${
                      resteADevoirActuel < 100000
                        ? 'bg-slate-900/60 text-slate-600 border-slate-800 cursor-not-allowed opacity-50'
                        : activeChoice === '100k'
                        ? 'bg-purple-600 text-white border-purple-400 shadow-sm'
                        : 'bg-slate-800 hover:bg-slate-700 text-purple-300 border-purple-500/30 cursor-pointer'
                    }`}
                    title={resteADevoirActuel < 100000 ? "Dépasse le solde restant dû" : "Régler 100 000 FCFA"}
                  >
                    100 000 FCFA
                  </button>
                </div>
              </div>

              {/* Champ de saisie manuelle ou affichage immédiat de l'option choisie */}
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max={resteADevoirActuel}
                  step="1000"
                  value={montantInput}
                  onChange={handleManualAmountChange}
                  className={`w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border text-emerald-300 font-black text-lg focus:outline-none transition ${
                    isSurpaiement || isZeroOrNegative
                      ? 'border-rose-500 text-rose-300'
                      : 'border-slate-700 focus:border-emerald-500'
                  }`}
                  placeholder="Saisissez ou choisissez un montant"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                  FCFA
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Vous pouvez cliquer sur une option ou taper manuellement le montant exact reçu.
              </p>
            </div>

            {/* Date & Mode de paiement */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-400" />
                  <span>Date du paiement *</span>
                </label>
                <input
                  type="date"
                  value={dateReglement}
                  onChange={(e) => setDateReglement(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs sm:text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                  <Landmark className="w-3.5 h-3.5 text-purple-400" />
                  <span>Mode de paiement *</span>
                </label>
                <select
                  value={modePaiement}
                  onChange={(e) => setModePaiement(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs sm:text-sm focus:border-emerald-500 focus:outline-none cursor-pointer"
                >
                  <option value="Virement bancaire">Virement bancaire (BSIC, BOA, Ecobank Niger)</option>
                  <option value="Chèque">Chèque certifié / chèque de banque</option>
                  <option value="Espèces">Espèces (Reçu de caisse NigerSécurité)</option>
                  <option value="Airtel Money / Mobile Money">Airtel Money / Moov Flooz Niger</option>
                </select>
              </div>
            </div>

            {/* Référence et observation facultatives */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Référence facultative (N° virement / chèque)
                </label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Ex : VIR-BSIC-9901 ou CHQ-BOA-4520"
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs sm:text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Note / Observation comptable
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Ex : Premier acompte partiel de 50 000 FCFA"
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs sm:text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* 4. Calcul automatique & projection en temps réel */}
          <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700 text-xs space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-slate-200">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>Calcul prévisionnel après confirmation :</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-slate-300 pt-0.5">
              <div className="flex justify-between">
                <span className="text-slate-400">Total déjà perçu :</span>
                <span className="font-semibold text-emerald-400">{formatFCFA(montantRegleActuel)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">+ Montant à encaisser :</span>
                <span className="font-semibold text-emerald-300">{formatFCFA(montantSaisi)}</span>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-slate-700/80">
              <span className="font-semibold text-slate-300">Nouveau solde restant dû :</span>
              <span
                className={`font-black text-sm ${
                  nouveauResteDû === 0 ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {formatFCFA(nouveauResteDû)}
              </span>
            </div>

            <div className="flex justify-between items-center text-[11px] pt-1">
              <span className="text-slate-400">Nouveau statut de la facture :</span>
              <span
                className={`font-bold px-2.5 py-0.5 rounded-full ${
                  nouveauResteDû === 0
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                }`}
              >
                {getPrevisionStatut()}
              </span>
            </div>
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between gap-3 sticky bottom-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
          >
            Annuler
          </button>

          {/* Requirement 7: Bouton final « Confirmer l'encaissement » */}
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!activeInvoice || isSurpaiement || isZeroOrNegative}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-900/40 transition cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Confirmer l'encaissement</span>
          </button>
        </div>
      </div>
    </div>
  );
};
