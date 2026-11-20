import React, { useState, useEffect } from 'react';
import {
  X,
  FileText,
  Building,
  Calendar,
  DollarSign,
  AlertTriangle,
  AlertCircle,
  Save,
  Send,
  CheckCircle2,
  HelpCircle,
  Calculator,
  Shield,
  Clock,
  Sparkles,
} from 'lucide-react';
import { FactureMensuelle, Client, Contract, EnterpriseSettings, StatutFacture } from '../types';

interface InvoiceCreateEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceToEdit: FactureMensuelle | null;
  clients: Client[];
  contracts: Contract[];
  existingInvoices: FactureMensuelle[];
  settings: EnterpriseSettings;
  onSave: (invoice: FactureMensuelle, isEmit: boolean) => void;
}

const MONTHS_LIST = [
  'Octobre 2026',
  'Novembre 2026',
  'Décembre 2026',
  'Janvier 2027',
  'Février 2027',
  'Mars 2027',
];

export const InvoiceCreateEditModal: React.FC<InvoiceCreateEditModalProps> = ({
  isOpen,
  onClose,
  invoiceToEdit,
  clients,
  contracts,
  existingInvoices,
  settings,
  onSave,
}) => {
  if (!isOpen) return null;

  const isEditing = Boolean(invoiceToEdit);

  // Form States
  const [clientId, setClientId] = useState<string>(
    invoiceToEdit?.clientId || clients[0]?.id || ''
  );
  const [contratId, setContratId] = useState<string>(
    invoiceToEdit?.contratId || ''
  );
  const [numeroFacture, setNumeroFacture] = useState<string>(
    invoiceToEdit?.numeroFacture || ''
  );
  const [mois, setMois] = useState<string>(
    invoiceToEdit?.mois || 'Novembre 2026'
  );
  const [dateEmission, setDateEmission] = useState<string>(
    invoiceToEdit?.dateEmission || new Date().toISOString().substring(0, 10)
  );
  const [dateEcheance, setDateEcheance] = useState<string>(
    invoiceToEdit?.dateEcheance || ''
  );
  const [descriptionPrestation, setDescriptionPrestation] = useState<string>(
    invoiceToEdit?.descriptionPrestation || ''
  );
  const [montantHT, setMontantHT] = useState<number>(
    invoiceToEdit?.montantHT || 0
  );
  const [tauxTVA, setTauxTVA] = useState<number>(
    invoiceToEdit?.tauxTVA ?? 19
  );
  const [modePaiement, setModePaiement] = useState<FactureMensuelle['modePaiement']>(
    invoiceToEdit?.modePaiement || 'Virement bancaire'
  );
  const [notesInternes, setNotesInternes] = useState<string>(
    invoiceToEdit?.notesInternes || ''
  );

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filter contracts for chosen client
  const clientContracts = contracts.filter((c) => c.clientId === clientId);
  const selectedClient = clients.find((c) => c.id === clientId);
  const selectedContract = contracts.find((c) => c.id === contratId) || clientContracts[0];

  // Helper to generate invoice number
  const generateInvoiceNumber = (cId: string, m: string) => {
    const cli = clients.find((c) => c.id === cId);
    const shortCode = cli ? cli.nom.replace(/[^A-Za-z0-9]/g, '').substring(0, 5).toUpperCase() : 'CLI';
    const cleanMonth = m.replace(/[^A-Za-z0-9]/g, '').substring(0, 6).toUpperCase();
    return `FAC-${new Date().getFullYear()}-${cleanMonth}-${shortCode}`;
  };

  // Initialize or update fields when client or contract changes
  useEffect(() => {
    if (!invoiceToEdit) {
      if (clientContracts.length > 0 && (!contratId || !clientContracts.some(c => c.id === contratId))) {
        const firstContract = clientContracts[0];
        setContratId(firstContract.id);
        setMontantHT(firstContract.montantMensuelHT);
        setDescriptionPrestation(
          `Prestation de gardiennage et surveillance physique ${firstContract.typeGarde} du site ${firstContract.siteNom} (${firstContract.effectifVigiles} vigiles qualifiés, rondes inopinées, main courante)`
        );
      } else if (clientContracts.length === 0) {
        setContratId('');
        if (selectedClient) {
          setMontantHT(selectedClient.montantMensuelTotalFCFA || 1000000);
          setDescriptionPrestation(`Prestation globale de sécurité et gardiennage pour ${selectedClient.nom}`);
        }
      }

      // Check VAT exemption (ONG or Diplomatic)
      if (selectedClient?.secteur === 'ONG' || selectedClient?.secteur === 'Résidence VIP') {
        setTauxTVA(0);
      } else {
        setTauxTVA(19);
      }

      // Default due date to 30 days after emission
      if (!dateEcheance) {
        const d = new Date(dateEmission || Date.now());
        d.setDate(d.getDate() + 30);
        setDateEcheance(d.toISOString().substring(0, 10));
      }

      // Auto generate invoice number if empty
      if (!numeroFacture) {
        setNumeroFacture(generateInvoiceNumber(clientId, mois));
      }
    }
  }, [clientId]);

  // Handle client change
  const handleClientChange = (newClientId: string) => {
    setClientId(newClientId);
    const cli = clients.find((c) => c.id === newClientId);
    const matchedContracts = contracts.filter((c) => c.clientId === newClientId);
    
    if (matchedContracts.length > 0) {
      const first = matchedContracts[0];
      setContratId(first.id);
      const montant = first.montantFCFA || first.montantMensuelHT;
      setMontantHT(montant);
      const desc = first.descriptionPrestation
        ? `${first.typePrestation || 'Prestation de sécurité'} : ${first.descriptionPrestation} (Site : ${first.siteNom})`
        : `Prestation de gardiennage et surveillance physique ${first.typeGarde || ''} du site ${first.siteNom}`;
      setDescriptionPrestation(desc);
    } else {
      setContratId('');
      if (cli) {
        setMontantHT(cli.montantMensuelTotalFCFA);
        setDescriptionPrestation(`Prestation globale de sécurité et gardiennage pour ${cli.nom}`);
      }
    }

    if (cli?.secteur === 'ONG' || cli?.secteur === 'Diplomatique') {
      setTauxTVA(0);
    } else {
      setTauxTVA(19);
    }

    setNumeroFacture(generateInvoiceNumber(newClientId, mois));
  };

  // Handle contract change
  const handleContractChange = (newContractId: string) => {
    setContratId(newContractId);
    const ctr = contracts.find((c) => c.id === newContractId);
    if (ctr) {
      const montant = ctr.montantFCFA || ctr.montantMensuelHT;
      setMontantHT(montant);
      const desc = ctr.descriptionPrestation
        ? `${ctr.typePrestation || 'Prestation de sécurité'} : ${ctr.descriptionPrestation} (Site : ${ctr.siteNom})`
        : `Prestation de sécurité et gardiennage ${ctr.typeGarde || ''} du site ${ctr.siteNom}`;
      setDescriptionPrestation(desc);
    }
  };

  // Quick Preparation Date Helpers (Requirement 5: par exemple le 25 ou le 30 du mois)
  const applyPreparationDate = (day: 25 | 30) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const emission = new Date(year, month, day);
    const echeance = new Date(year, month + 1, day);
    setDateEmission(emission.toISOString().substring(0, 10));
    setDateEcheance(echeance.toISOString().substring(0, 10));
  };

  // Calculations
  const montantTVA = Math.round((Number(montantHT) || 0) * (tauxTVA / 100));
  const montantTTC = (Number(montantHT) || 0) + montantTVA;

  // Duplicate Check (Requirement 5)
  const duplicateInvoice = existingInvoices.find(
    (inv) =>
      inv.clientId === clientId &&
      inv.mois.trim().toLowerCase() === mois.trim().toLowerCase() &&
      (!isEditing || inv.id !== invoiceToEdit?.id)
  );

  const formatFCFA = (val: number) => new Intl.NumberFormat('fr-FR').format(val) + ' FCFA';

  const handleSubmit = (isEmit: boolean) => {
    setErrorMsg(null);

    if (!clientId) {
      setErrorMsg("Veuillez sélectionner un client.");
      return;
    }

    if (!numeroFacture.trim()) {
      setErrorMsg("Veuillez renseigner un numéro de facture.");
      return;
    }

    if (!mois.trim()) {
      setErrorMsg("Veuillez renseigner la période facturée.");
      return;
    }

    if (!dateEmission || !dateEcheance) {
      setErrorMsg("Veuillez indiquer la date d'émission et la date d'échéance.");
      return;
    }

    if (montantHT <= 0) {
      setErrorMsg("Le montant HT doit être supérieur à 0 FCFA.");
      return;
    }

    const initialStatut: StatutFacture = isEmit ? 'À payer' : 'Brouillon';

    const savedInvoice: FactureMensuelle = {
      id: invoiceToEdit ? invoiceToEdit.id : `fac-${Date.now()}`,
      numeroFacture: numeroFacture.trim(),
      clientId,
      clientNom: selectedClient?.nom || 'Client inconnu',
      contratId: contratId || undefined,
      contratNumero: selectedContract?.numeroContrat || undefined,
      siteNom: selectedContract?.siteNom || undefined,
      mois: mois.trim(),
      dateEmission,
      dateEcheance,
      descriptionPrestation: descriptionPrestation.trim() || undefined,
      montantHT: Number(montantHT),
      tauxTVA: Number(tauxTVA),
      montantTVA,
      montantTTC,
      montantRegle: invoiceToEdit?.montantRegle || 0,
      resteADevoir: invoiceToEdit
        ? Math.max(0, montantTTC - (invoiceToEdit.montantRegle || 0))
        : montantTTC,
      statut: invoiceToEdit?.statut && invoiceToEdit.statut !== 'Brouillon'
        ? invoiceToEdit.statut
        : initialStatut,
      reglements: invoiceToEdit?.reglements || [],
      modePaiement: modePaiement || 'Virement bancaire',
      notesInternes: notesInternes.trim() || undefined,
    };

    onSave(savedInvoice, isEmit);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[94vh] overflow-y-auto flex flex-col shadow-2xl text-slate-100 my-auto">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/70 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base sm:text-lg">
                {isEditing ? 'Modifier la facture' : 'Créer une nouvelle facture client'}
              </h3>
              <p className="text-xs text-slate-400">
                Facturation mensuelle de gardiennage • {settings.raisonSociale}
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

        {/* Content Body */}
        <div className="p-4 sm:p-6 space-y-5">
          {/* Duplicate Alert (Requirement 5) */}
          {duplicateInvoice && (
            <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-200 text-xs flex items-start gap-2.5 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-300">
                  Avertissement : Facture existante sur cette période
                </p>
                <p className="mt-0.5 text-amber-200/90 leading-relaxed">
                  Une facture existe déjà pour <strong>{selectedClient?.nom}</strong> sur la période de <strong>{mois}</strong> (N° <em>{duplicateInvoice.numeroFacture}</em>, Statut : <em>{duplicateInvoice.statut}</em>).
                  Vérifiez le numéro et la période pour éviter toute double facturation du client.
                </p>
              </div>
            </div>
          )}

          {/* Quick Monthly Preparation Toolbar (Requirement 5) */}
          <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <span className="font-bold text-white">Assistant de facturation mensuelle :</span>
                <span className="text-slate-400 block sm:inline sm:ml-1">
                  Définir rapidement la date d'émission et d'échéance selon le cycle contractuel
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => applyPreparationDate(25)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium transition cursor-pointer"
                title="Émission au 25 du mois, échéance à 30 jours"
              >
                Préparer au 25 du mois
              </button>
              <button
                type="button"
                onClick={() => applyPreparationDate(30)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium transition cursor-pointer"
                title="Émission au 30 du mois, échéance à 30 jours"
              >
                Préparer au 30 du mois
              </button>
            </div>
          </div>

          {/* 1. Client & Contract Selection (Requirement 2 & 3) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-blue-400" />
                <span>Client bénéficiaire *</span>
              </label>
              <select
                value={clientId}
                onChange={(e) => handleClientChange(e.target.value)}
                disabled={Boolean(isEditing && invoiceToEdit?.statut !== 'Brouillon')}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs sm:text-sm focus:border-blue-500 focus:outline-none"
              >
                {clients.map((cli) => (
                  <option key={cli.id} value={cli.id}>
                    {cli.nom} ({cli.secteur}) - {cli.ville}
                  </option>
                ))}
              </select>
              {selectedClient && (
                <p className="text-[11px] text-slate-400 mt-1">
                  Contact : {selectedClient.contactNom} ({selectedClient.contactTelephone})
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Contrat de gardiennage associé</span>
                </span>
                <span className="text-[10px] text-slate-400">
                  {clientContracts.length} contrat(s) actif(s)
                </span>
              </label>
              <select
                value={contratId}
                onChange={(e) => handleContractChange(e.target.value)}
                disabled={clientContracts.length === 0}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs sm:text-sm focus:border-emerald-500 focus:outline-none"
              >
                {clientContracts.length === 0 ? (
                  <option value="">Aucun contrat spécifique (Facturation libre)</option>
                ) : (
                  clientContracts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.numeroContrat} - {c.siteNom} [{c.modeFacturation || 'Mensuel'}] ({formatFCFA(c.montantFCFA || c.montantMensuelHT)})
                    </option>
                  ))
                )}
              </select>
              {selectedContract && (
                <p className="text-[11px] text-emerald-400 mt-1">
                  Prestation : {selectedContract.typePrestation || selectedContract.typeGarde} • {selectedContract.nombreAgents || selectedContract.effectifVigiles || 4} agent(s) • Mode : {selectedContract.modeFacturation || 'Mensuel'}
                </p>
              )}
            </div>
          </div>

          {/* 2. Facture Number & Period (Requirement 4) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Numéro de facture *
              </label>
              <input
                type="text"
                value={numeroFacture}
                onChange={(e) => setNumeroFacture(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-blue-300 font-mono font-bold text-xs sm:text-sm focus:border-blue-500 focus:outline-none"
                placeholder="Ex : FAC-2026-11-BSIC"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Généré automatiquement selon la nomenclature légale
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-purple-400" />
                <span>Période facturée *</span>
              </label>
              <div className="flex gap-2">
                <select
                  value={mois}
                  onChange={(e) => {
                    setMois(e.target.value);
                    setNumeroFacture(generateInvoiceNumber(clientId, e.target.value));
                  }}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs sm:text-sm focus:border-purple-500 focus:outline-none"
                >
                  {MONTHS_LIST.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 3. Dates (Emission & Echéance) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Date d'émission *
              </label>
              <input
                type="date"
                value={dateEmission}
                onChange={(e) => setDateEmission(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs sm:text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                <span>Date d'échéance de paiement *</span>
                <span className="text-[10px] text-amber-400">Règle des 30 jours</span>
              </label>
              <input
                type="date"
                value={dateEcheance}
                onChange={(e) => setDateEcheance(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs sm:text-sm focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          {/* 4. Prestation Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
              <span>Désignation de la prestation de gardiennage *</span>
              <span className="text-[10px] text-slate-400">Mention portée sur la facture officielle</span>
            </label>
            <textarea
              value={descriptionPrestation}
              onChange={(e) => setDescriptionPrestation(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs sm:text-sm focus:border-emerald-500 focus:outline-none"
              placeholder="Ex : Prestation globale de gardiennage et surveillance 24h/24..."
            />
          </div>

          {/* 5. Montant, TVA et Calculs Financiers (Requirement 4 & 5) */}
          <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Calculator className="w-4 h-4 text-emerald-400" />
              <span>Calcul des montants & Régime Fiscal Niger</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Montant HT (FCFA) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="10000"
                  value={montantHT}
                  onChange={(e) => setMontantHT(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-bold text-sm sm:text-base focus:border-emerald-500 focus:outline-none"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Montant mensuel convenu au contrat
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                  <span>Taux TVA</span>
                  <span className="text-[10px] text-purple-400">Régime DGI</span>
                </label>
                <select
                  value={tauxTVA}
                  onChange={(e) => setTauxTVA(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-semibold text-sm focus:border-purple-500 focus:outline-none"
                >
                  <option value={19}>19% (TVA Standard Niger)</option>
                  <option value={0}>0% (Exonéré Accord de Siège / ONG / Diplomatique)</option>
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  {tauxTVA === 0 ? 'Exonération diplomatique ou ONG' : 'Taux normal en vigueur au Niger'}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Montant TVA (FCFA)
                </label>
                <div className="w-full px-3 py-2 rounded-xl bg-slate-900/60 border border-slate-800 text-purple-300 font-bold text-sm sm:text-base">
                  {tauxTVA === 0 ? 'Exonéré (0 FCFA)' : formatFCFA(montantTVA)}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Reversé au fisc à la déclaration mensuelle
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Mode de règlement prévu
              </label>
              <select
                value={modePaiement}
                onChange={(e) => setModePaiement(e.target.value as any)}
                className="w-full sm:w-1/2 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs sm:text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="Virement bancaire">Virement bancaire ({settings.banquePrincipale})</option>
                <option value="Chèque">Chèque bancaire</option>
                <option value="Espèces">Espèces contre reçu de caisse</option>
                <option value="Airtel Money / Mobile Money">Airtel Money / Mobile Money</option>
              </select>
            </div>
          </div>

          {/* 6. Summary Preview Box (Requirement 6) */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border-2 border-blue-500/40 space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-300 border-b border-slate-800 pb-2">
              <span className="flex items-center gap-1.5 text-blue-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>Récapitulatif avant émission de la facture :</span>
              </span>
              <span className="font-mono text-emerald-400 font-bold">{numeroFacture || 'FAC-XXXX'}</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="p-2 rounded-lg bg-slate-800/60">
                <p className="text-slate-400 text-[10px]">Client</p>
                <p className="font-bold text-white truncate mt-0.5">{selectedClient?.nom || 'N/A'}</p>
              </div>
              <div className="p-2 rounded-lg bg-slate-800/60">
                <p className="text-slate-400 text-[10px]">Période</p>
                <p className="font-bold text-slate-200 mt-0.5">{mois}</p>
              </div>
              <div className="p-2 rounded-lg bg-slate-800/60">
                <p className="text-slate-400 text-[10px]">Sous-total HT</p>
                <p className="font-bold text-slate-200 mt-0.5">{formatFCFA(montantHT)}</p>
              </div>
              <div className="p-2 rounded-lg bg-slate-800/60">
                <p className="text-slate-400 text-[10px]">TVA ({tauxTVA}%)</p>
                <p className="font-bold text-purple-300 mt-0.5">{tauxTVA === 0 ? 'Exonéré' : formatFCFA(montantTVA)}</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-2 border-t border-slate-800">
              <div>
                <p className="text-xs uppercase tracking-wider font-extrabold text-white">
                  Total Facturé TTC à l'attention du Client :
                </p>
                <p className="text-[11px] text-slate-400">
                  Règlement attendu avant le {dateEcheance || 'terme fixé'} ({settings.ribBancaire})
                </p>
              </div>
              <div className="text-right">
                <span className="text-2xl sm:text-3xl font-black text-emerald-400">
                  {formatFCFA(montantTTC)}
                </span>
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Footer Actions (Requirement 6) */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex flex-col sm:flex-row items-center justify-between gap-3 sticky bottom-0 z-10">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
          >
            Annuler
          </button>

          <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
            {/* Save as Draft (Requirement 6 & 8) */}
            <button
              type="button"
              onClick={() => handleSubmit(false)}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 hover:border-slate-500 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-sm"
            >
              <Save className="w-4 h-4 text-slate-400" />
              <span>Enregistrer comme Brouillon</span>
            </button>

            {/* Validate and Emit Invoice */}
            <button
              type="button"
              onClick={() => handleSubmit(true)}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-900/40 transition cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>Valider & Émettre la facture (Statut : À payer)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
