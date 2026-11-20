import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  FileText,
  Building,
  Shield,
  HelpCircle,
  Check,
  X,
  FileSpreadsheet,
  ChevronDown,
  ChevronUp,
  Info,
  DollarSign,
  Layers,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { Contract, Client, FactureMensuelle, EnterpriseSettings, StatutFacture } from '../types';

interface PrepareMonthlyInvoicesModalProps {
  isOpen: boolean;
  onClose: () => void;
  contracts: Contract[];
  clients: Client[];
  existingInvoices: FactureMensuelle[];
  settings: EnterpriseSettings;
  onConfirmBatch: (newInvoices: FactureMensuelle[]) => void;
}

interface ContractCandidate {
  contract: Contract;
  client: Client;
  status: 'eligible' | 'prorata' | 'already_billed' | 'expired' | 'future' | 'terminated';
  exclusionReason?: string;
  existingInvoiceNum?: string;
  activeDays: number;
  totalDaysInMonth: number;
  periodLabel: string;
  originalMontantHT: number;
  proposedMontantHT: number;
  customMontantHT: number;
  tauxTVA: number;
  montantTVA: number;
  montantTTC: number;
  selected: boolean;
  allowDuplicateOverride?: boolean;
  duplicateOverrideReason?: string;
}

export const PrepareMonthlyInvoicesModal: React.FC<PrepareMonthlyInvoicesModalProps> = ({
  isOpen,
  onClose,
  contracts,
  clients,
  existingInvoices,
  settings,
  onConfirmBatch,
}) => {
  // Preset months
  const availableMonths = [
    'Novembre 2026',
    'Décembre 2026',
    'Octobre 2026',
    'Septembre 2026',
    'Janvier 2027',
    'Février 2027',
  ];

  const [selectedMonth, setSelectedMonth] = useState<string>('Novembre 2026');
  const [preparationDate, setPreparationDate] = useState<string>('2026-11-25');
  const [dateEcheance, setDateEcheance] = useState<string>('2026-12-15');
  const [initialStatus, setInitialStatus] = useState<StatutFacture>('Brouillon');
  const [showExcludedDetails, setShowExcludedDetails] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Map of candidate adjustments: contractId -> { selected: boolean, customMontantHT: number, allowOverride: boolean, overrideReason: string }
  const [adjustments, setAdjustments] = useState<
    Record<
      string,
      {
        selected: boolean;
        customMontantHT?: number;
        allowOverride?: boolean;
        overrideReason?: string;
      }
    >
  >({});

  const formatFCFA = (val: number) => new Intl.NumberFormat('fr-FR').format(val) + ' FCFA';

  // Helper to parse French month string to start/end dates
  const monthBoundaries = useMemo(() => {
    const monthMap: Record<string, number> = {
      janvier: 0,
      février: 1,
      fevrier: 1,
      mars: 2,
      avril: 3,
      mai: 4,
      juin: 5,
      juillet: 6,
      août: 7,
      aout: 7,
      septembre: 8,
      octobre: 9,
      novembre: 10,
      décembre: 11,
      decembre: 11,
    };

    const parts = selectedMonth.trim().toLowerCase().split(' ');
    const monthName = parts[0];
    const year = parseInt(parts[1], 10) || 2026;
    const monthIndex = monthMap[monthName] ?? 10; // Default November

    const firstDate = new Date(year, monthIndex, 1);
    const lastDate = new Date(year, monthIndex + 1, 0); // Last day of month

    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    const firstStr = `${year}-${pad(monthIndex + 1)}-01`;
    const lastStr = `${year}-${pad(monthIndex + 1)}-${pad(lastDate.getDate())}`;

    return {
      year,
      monthIndex,
      daysInMonth: lastDate.getDate(),
      firstDate,
      lastDate,
      firstStr,
      lastStr,
    };
  }, [selectedMonth]);

  // Quick preparation date setters
  const handleSetQuickDate = (type: '25' | '30' | 'today') => {
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    const { year, monthIndex, daysInMonth } = monthBoundaries;

    if (type === '25') {
      const d = Math.min(25, daysInMonth);
      setPreparationDate(`${year}-${pad(monthIndex + 1)}-${pad(d)}`);
    } else if (type === '30') {
      setPreparationDate(`${year}-${pad(monthIndex + 1)}-${pad(daysInMonth)}`);
    } else {
      const now = new Date();
      setPreparationDate(
        `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
      );
    }
  };

  // Evaluate all contracts for the selected month
  const candidates: ContractCandidate[] = useMemo(() => {
    const { firstStr, lastStr, daysInMonth } = monthBoundaries;

    return contracts.map((c) => {
      const client: Client = clients.find((cli) => cli.id === c.clientId) || {
        id: c.clientId,
        nom: c.clientNom,
        secteur: 'Commerce',
        ville: 'Niamey',
        adresse: 'Niamey',
        contactNom: '',
        contactTelephone: '',
        email: '',
        statut: 'Actif',
        nbSites: 1,
        montantMensuelTotalFCFA: c.montantMensuelHT,
      };

      // Check if already billed in this exact month
      const existingInv = existingInvoices.find(
        (inv) =>
          inv.mois.trim().toLowerCase() === selectedMonth.trim().toLowerCase() &&
          (inv.contratId === c.id ||
            inv.contratNumero === c.numeroContrat ||
            (inv.clientId === c.clientId && inv.siteNom === c.siteNom))
      );

      const contractStart = c.dateDebut || '2026-01-01';
      const contractEnd = c.dateFin || '2026-12-31';

      // TVA logic: 0% if ONG or Diplomatique (exonéré convention État du Niger), 19% normal
      const isExonere = client.secteur === 'ONG' || client.secteur === 'Diplomatique';
      const tauxTVA = isExonere ? 0 : 19;

      let status: ContractCandidate['status'] = 'eligible';
      let exclusionReason: string | undefined = undefined;
      let existingInvoiceNum: string | undefined = undefined;

      // 1. Terminé ou Résilié
      if (c.statut === 'Résilié') {
        status = 'terminated';
        exclusionReason = 'Contrat clôturé ou résilié.';
      } else if (c.statut === 'Terminé') {
        status = 'terminated';
        exclusionReason = 'Prestation terminée et clôturée.';
      }
      // 2. Suspendu
      else if (c.statut === 'Suspendu') {
        status = 'terminated';
        exclusionReason = 'Contrat de gardiennage temporairement suspendu.';
      }
      // 3. Brouillon ou En attente de signature
      else if (c.statut === 'Brouillon' || c.statut === 'En attente de signature') {
        status = 'terminated';
        exclusionReason = `Contrat au statut « ${c.statut} » (validation et signature requises avant facturation).`;
      }
      // 4. Mode de facturation non mensuel (Escortes, forfaits uniques, ponctuels)
      else if (c.modeFacturation && c.modeFacturation !== 'Mensuel') {
        status = 'terminated';
        exclusionReason = `Mode de facturation : « ${c.modeFacturation} » (Prestation ponctuelle / forfaitaire à facturer à l'acte, exclue du lot mensuel).`;
      }
      // 5. Already billed
      else if (existingInv) {
        status = 'already_billed';
        existingInvoiceNum = existingInv.numeroFacture;
        exclusionReason = `Déjà facturé sous la référence ${existingInv.numeroFacture} (${existingInv.statut}). Doublon prévenu.`;
      }
      // 6. Expired before month start
      else if (contractEnd < firstStr) {
        status = 'expired';
        exclusionReason = `Contrat arrivé à échéance le ${contractEnd} (avant le 1er du mois).`;
      }
      // 7. Future contract starting after month end
      else if (contractStart > lastStr) {
        status = 'future';
        exclusionReason = `Prestation programmée pour débuter le ${contractStart} (après la fin du mois).`;
      }

      // Check for partial month (prorata temporis)
      let activeDays = daysInMonth;
      let isPartial = false;

      if (status === 'eligible') {
        const effStart = contractStart > firstStr ? contractStart : firstStr;
        const effEnd = contractEnd < lastStr ? contractEnd : lastStr;

        if (effStart !== firstStr || effEnd !== lastStr) {
          isPartial = true;
          status = 'prorata';

          // Calculate active days inclusive
          const startDate = new Date(effStart);
          const endDate = new Date(effEnd);
          const diffTime = Math.max(0, endDate.getTime() - startDate.getTime());
          activeDays = Math.min(daysInMonth, Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1);
          exclusionReason = `Prorata temporis : contrat actif ${activeDays} jour(s) sur ${daysInMonth} (du ${effStart} au ${effEnd}).`;
        }
      }

      const periodLabel = isPartial
        ? `Du ${contractStart > firstStr ? contractStart : firstStr} au ${contractEnd < lastStr ? contractEnd : lastStr}`
        : `Du ${firstStr} au ${lastStr} (Mois entier)`;

      const originalMontantHT = c.montantMensuelHT;
      const proposedMontantHT = isPartial
        ? Math.round((c.montantMensuelHT * activeDays) / daysInMonth)
        : originalMontantHT;

      // User adjustment override state
      const adj = adjustments[c.id];
      const customMontantHT =
        adj?.customMontantHT !== undefined ? adj.customMontantHT : proposedMontantHT;
      const allowOverride = adj?.allowOverride || false;
      const duplicateOverrideReason = adj?.overrideReason || '';

      // Determine initial checked state: eligible or prorata checked by default, excluded unchecked
      const isEligibleToSelect =
        status === 'eligible' || status === 'prorata' || (status === 'already_billed' && allowOverride);

      const selected = adj?.selected !== undefined ? adj.selected : (status === 'eligible' || status === 'prorata');

      const montantTVA = Math.round((customMontantHT * tauxTVA) / 100);
      const montantTTC = customMontantHT + montantTVA;

      return {
        contract: c,
        client,
        status,
        exclusionReason,
        existingInvoiceNum,
        activeDays,
        totalDaysInMonth: daysInMonth,
        periodLabel,
        originalMontantHT,
        proposedMontantHT,
        customMontantHT,
        tauxTVA,
        montantTVA,
        montantTTC,
        selected: isEligibleToSelect && selected,
        allowDuplicateOverride: allowOverride,
        duplicateOverrideReason,
      };
    });
  }, [contracts, clients, existingInvoices, selectedMonth, monthBoundaries, adjustments]);

  // Partition candidates
  const eligibleCandidates = candidates.filter(
    (c) => c.status === 'eligible' || c.status === 'prorata' || (c.status === 'already_billed' && c.allowDuplicateOverride)
  );

  const excludedCandidates = candidates.filter(
    (c) => !(c.status === 'eligible' || c.status === 'prorata' || (c.status === 'already_billed' && c.allowDuplicateOverride))
  );

  const selectedCandidates = eligibleCandidates.filter((c) => c.selected);

  // Metrics
  const totalEligibleCount = eligibleCandidates.length;
  const totalSelectedCount = selectedCandidates.length;
  const totalHTSelected = selectedCandidates.reduce((acc, c) => acc + c.customMontantHT, 0);
  const totalTVASelected = selectedCandidates.reduce((acc, c) => acc + c.montantTVA, 0);
  const totalTTCSelected = selectedCandidates.reduce((acc, c) => acc + c.montantTTC, 0);

  // Handlers for adjustments
  const handleToggleSelect = (contractId: string) => {
    setAdjustments((prev) => {
      const current = prev[contractId];
      const candidate = candidates.find((c) => c.contract.id === contractId);
      const curSelected = current?.selected !== undefined ? current.selected : (candidate?.status === 'eligible' || candidate?.status === 'prorata');
      return {
        ...prev,
        [contractId]: {
          ...current,
          selected: !curSelected,
        },
      };
    });
  };

  const handleSelectAll = (select: boolean) => {
    setAdjustments((prev) => {
      const next = { ...prev };
      eligibleCandidates.forEach((c) => {
        next[c.contract.id] = {
          ...next[c.contract.id],
          selected: select,
        };
      });
      return next;
    });
  };

  const handleChangeAmount = (contractId: string, amount: number) => {
    setAdjustments((prev) => ({
      ...prev,
      [contractId]: {
        ...prev[contractId],
        customMontantHT: Math.max(0, amount),
      },
    }));
  };

  const handleToggleDuplicateOverride = (contractId: string) => {
    setAdjustments((prev) => {
      const current = prev[contractId];
      const nextOverride = !current?.allowOverride;
      return {
        ...prev,
        [contractId]: {
          ...current,
          allowOverride: nextOverride,
          selected: nextOverride,
          overrideReason: current?.overrideReason || 'Facture rectificative / avenant exceptionnel autorisé',
        },
      };
    });
  };

  const handleOverrideReasonChange = (contractId: string, reason: string) => {
    setAdjustments((prev) => ({
      ...prev,
      [contractId]: {
        ...prev[contractId],
        overrideReason: reason,
      },
    }));
  };

  // Generate batch invoices
  const handleConfirmGeneration = () => {
    if (selectedCandidates.length === 0) return;

    setIsSubmitting(true);

    const generatedInvoices: FactureMensuelle[] = selectedCandidates.map((cand, idx) => {
      // Build unique reference e.g. FAC-2026-11-BSIC-01
      const shortCode = cand.client.nom
        .replace(/[^A-Za-z0-9]/g, '')
        .slice(0, 4)
        .toUpperCase();
      const monthPart = selectedMonth.split(' ')[0].slice(0, 3).toUpperCase();
      const yearPart = monthBoundaries.year;
      const seq = String(idx + 1).padStart(2, '0');
      const invoiceNumber = `FAC-${yearPart}-${monthPart}-${shortCode}-${seq}`;

      let description = `Prestation de gardiennage et sécurité surveillance [${cand.contract.typeGarde}] sur le site ${cand.contract.siteNom} pour la période du mois de ${selectedMonth}.`;
      if (cand.status === 'prorata') {
        description += ` Facturation prorata temporis (${cand.activeDays}/${cand.totalDaysInMonth} jours d’activité active).`;
      }
      if (cand.allowDuplicateOverride) {
        description += ` [Facture complémentaire/rectificative : ${cand.duplicateOverrideReason}]`;
      }

      const notesInternes = [
        `Généré via la préparation assistée des factures mensuelles le ${new Date().toLocaleDateString('fr-FR')}.`,
        `Réf Contrat : ${cand.contract.numeroContrat} (${cand.contract.frequenceFacturation || 'Mensuelle'}).`,
        cand.status === 'prorata' ? `Ajustement au prorata : ${cand.exclusionReason}` : null,
        cand.allowDuplicateOverride ? `Dérogation doublon autorisée : ${cand.duplicateOverrideReason}` : null,
      ]
        .filter(Boolean)
        .join(' ');

      const isDraft = initialStatus === 'Brouillon';

      const newInv: FactureMensuelle = {
        id: `fac-batch-${Date.now()}-${cand.contract.id}`,
        numeroFacture: invoiceNumber,
        clientId: cand.client.id,
        clientNom: cand.client.nom,
        contratId: cand.contract.id,
        contratNumero: cand.contract.numeroContrat,
        siteNom: cand.contract.siteNom,
        mois: selectedMonth,
        dateEmission: preparationDate,
        dateEcheance: dateEcheance,
        descriptionPrestation: description,
        montantHT: cand.customMontantHT,
        tauxTVA: cand.tauxTVA,
        montantTVA: cand.montantTVA,
        montantTTC: cand.montantTTC,
        montantRegle: 0,
        resteADevoir: isDraft ? cand.montantTTC : cand.montantTTC,
        statut: initialStatus,
        reglements: [],
        modePaiement: 'Virement bancaire',
        notesInternes,
      };

      return newInv;
    });

    onConfirmBatch(generatedInvoices);
    setIsSubmitting(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-5xl my-6 flex flex-col max-h-[92vh] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-slate-900 via-blue-950/40 to-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  Comptabilité Assistée
                </span>
                <span className="text-xs text-slate-400">Contrats → Factures Clients</span>
              </div>
              <h2 className="text-lg sm:text-xl font-black text-white mt-0.5">
                Préparation Assistée des Factures Mensuelles
              </h2>
              <p className="text-xs text-slate-400">
                Génération en lot assistée par contrat, contrôle de cohérence, prorata et prévention des doublons.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            title="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body - Scrollable */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 text-xs sm:text-sm">
          {/* Settings & Controls Row */}
          <div className="p-4 rounded-2xl bg-slate-850 border border-slate-700/80 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-400" />
              <span>Paramètres de la préparation mensuelle</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* 1. Mois à facturer */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1 text-xs">
                  Mois à facturer <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <select
                    value={selectedMonth}
                    onChange={(e) => {
                      setSelectedMonth(e.target.value);
                      // Reset adjustments on month change
                      setAdjustments({});
                    }}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium focus:border-blue-500 focus:outline-none cursor-pointer"
                  >
                    {availableMonths.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Période analysée : {monthBoundaries.firstStr} au {monthBoundaries.lastStr}
                </p>
              </div>

              {/* 2. Date de préparation */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1 text-xs">
                  Date de préparation / émission
                </label>
                <input
                  type="date"
                  value={preparationDate}
                  onChange={(e) => setPreparationDate(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium focus:border-blue-500 focus:outline-none"
                />
                <div className="flex items-center gap-1.5 mt-1.5">
                  <button
                    type="button"
                    onClick={() => handleSetQuickDate('25')}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-blue-300 border border-slate-700 cursor-pointer"
                  >
                    25 du mois
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetQuickDate('30')}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-blue-300 border border-slate-700 cursor-pointer"
                  >
                    Fin de mois
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetQuickDate('today')}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 border border-slate-700 cursor-pointer"
                  >
                    Aujourd’hui
                  </button>
                </div>
              </div>

              {/* 3. Date d'échéance */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1 text-xs">
                  Date d’échéance de paiement
                </label>
                <input
                  type="date"
                  value={dateEcheance}
                  onChange={(e) => setDateEcheance(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium focus:border-blue-500 focus:outline-none"
                />
                <p className="text-[11px] text-slate-400 mt-1">Délai accordé aux clients</p>
              </div>

              {/* 4. Statut initial des factures */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1 text-xs">
                  Statut après génération
                </label>
                <select
                  value={initialStatus}
                  onChange={(e) => setInitialStatus(e.target.value as StatutFacture)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium focus:border-blue-500 focus:outline-none cursor-pointer"
                >
                  <option value="Brouillon">Brouillon (Contrôle avant envoi)</option>
                  <option value="À payer">À payer (Émission définitive)</option>
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  {initialStatus === 'Brouillon'
                    ? 'Permet au comptable d’affiner chaque facture'
                    : 'Prêtes pour transmission immédiate'}
                </p>
              </div>
            </div>
          </div>

          {/* Metric Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400">Factures à préparer</span>
              <p className="text-xl sm:text-2xl font-black text-blue-400 mt-1">
                {totalSelectedCount} <span className="text-xs text-slate-500 font-normal">/ {totalEligibleCount}</span>
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">Contrats éligibles sélectionnés</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400">Total Hors Taxes (HT)</span>
              <p className="text-lg sm:text-xl font-black text-white mt-1">
                {formatFCFA(totalHTSelected)}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">Base facturable de garde</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400">TVA (19% / Exonérée ONG)</span>
              <p className="text-lg sm:text-xl font-black text-amber-400 mt-1">
                {formatFCFA(totalTVASelected)}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">TVA collectée Niger</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-900 border border-blue-900/50 bg-blue-950/20">
              <span className="text-[11px] font-semibold text-blue-300">Total Prévisionnel TTC</span>
              <p className="text-lg sm:text-xl font-black text-emerald-400 mt-1">
                {formatFCFA(totalTTCSelected)}
              </p>
              <p className="text-[10px] text-blue-300/80 mt-0.5">Montant net à encaisser</p>
            </div>
          </div>

          {/* Section 1: Eligible Contracts to Bill */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                  </span>
                  <h3 className="font-bold text-white text-sm">
                    Contrats actifs éligibles pour {selectedMonth} ({eligibleCandidates.length})
                  </h3>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Vérifiez les montants et cochez les factures que vous souhaitez préparer pour ce cycle.
                </p>
              </div>

              {/* Bulk select buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectAll(true)}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 border border-slate-700 cursor-pointer"
                >
                  Tout cocher ({eligibleCandidates.length})
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectAll(false)}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-400 border border-slate-700 cursor-pointer"
                >
                  Tout décocher
                </button>
              </div>
            </div>

            {eligibleCandidates.length === 0 ? (
              <div className="p-6 text-center text-slate-400 bg-slate-850/50 rounded-xl border border-slate-800">
                <AlertCircle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                <p className="font-semibold text-white">Aucun contrat éligible pour ce mois.</p>
                <p className="text-xs text-slate-400 mt-1">
                  Tous les contrats ont déjà été facturés pour {selectedMonth}, ou sont expirés / non débutés.
                  Consultez la section « Contrats exclus » ci-dessous.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {eligibleCandidates.map((cand) => {
                  const isProrata = cand.status === 'prorata';
                  const isOverride = cand.allowDuplicateOverride;

                  return (
                    <div
                      key={cand.contract.id}
                      className={`p-3.5 rounded-xl border transition ${
                        cand.selected
                          ? isProrata
                            ? 'bg-amber-950/20 border-amber-500/40'
                            : 'bg-slate-850 border-slate-700'
                          : 'bg-slate-900/60 border-slate-800/80 opacity-60'
                      }`}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                        {/* Checkbox & Client / Site info */}
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={cand.selected}
                            onChange={() => handleToggleSelect(cand.contract.id)}
                            className="mt-1 w-4 h-4 rounded text-blue-600 bg-slate-800 border-slate-600 focus:ring-0 cursor-pointer"
                          />
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono font-bold text-emerald-400 text-xs">
                                {cand.contract.numeroContrat}
                              </span>
                              <span className="font-bold text-white text-sm">
                                {cand.client.nom}
                              </span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                                {cand.client.secteur}
                              </span>
                              {cand.tauxTVA === 0 ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-300 border border-purple-500/20">
                                  Exonéré TVA (ONG / Ambassade)
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-400">
                                  TVA 19%
                                </span>
                              )}
                              {isProrata && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" />
                                  <span>Prorata temporis ({cand.activeDays}/{cand.totalDaysInMonth}j)</span>
                                </span>
                              )}
                              {isOverride && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                  Dérogation doublon autorisée
                                </span>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                              <span>
                                <strong className="text-slate-300">Site :</strong> {cand.contract.siteNom}
                              </span>
                              <span>
                                <strong className="text-slate-300">Garde :</strong> {cand.contract.typeGarde} ({cand.contract.effectifVigiles} vigiles)
                              </span>
                              <span>
                                <strong className="text-slate-300">Période :</strong> {cand.periodLabel}
                              </span>
                            </div>

                            {/* Prorata alert banner */}
                            {isProrata && (
                              <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200 flex items-center gap-2 mt-1">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                                <span>
                                  Contrat actif du {cand.contract.dateDebut} au {cand.contract.dateFin}. Montant calculé au prorata ({cand.activeDays} jours / {cand.totalDaysInMonth} jours). Vous pouvez modifier ce montant ci-contre si besoin.
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Amount inputs & Calculated TTC */}
                        <div className="flex items-center gap-3 self-end lg:self-center shrink-0">
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">
                              Montant HT (FCFA)
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={cand.customMontantHT}
                              onChange={(e) =>
                                handleChangeAmount(cand.contract.id, Number(e.target.value))
                              }
                              disabled={!cand.selected}
                              className="w-32 bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white font-mono font-bold text-xs focus:border-blue-500 focus:outline-none disabled:opacity-50"
                            />
                            {cand.customMontantHT !== cand.originalMontantHT && (
                              <p className="text-[10px] text-slate-500 line-through">
                                Prévu : {formatFCFA(cand.originalMontantHT)}
                              </p>
                            )}
                          </div>

                          <div className="text-right pl-2 border-l border-slate-800">
                            <span className="block text-[10px] text-slate-400">Total TTC</span>
                            <span className="text-sm font-black text-emerald-400">
                              {formatFCFA(cand.montantTTC)}
                            </span>
                            <span className="block text-[10px] text-slate-500">
                              dont {formatFCFA(cand.montantTVA)} TVA
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 2: Excluded Contracts (Summary Box Requirement 10) */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <button
              type="button"
              onClick={() => setShowExcludedDetails(!showExcludedDetails)}
              className="w-full flex items-center justify-between text-left cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-slate-800 text-slate-400">
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                </span>
                <div>
                  <h3 className="font-bold text-white text-sm">
                    Contrats non facturés pour ce cycle ({excludedCandidates.length})
                  </h3>
                  <p className="text-xs text-slate-400">
                    Contrats exclus automatiquement avec motif transparent (déjà facturés, expirés, hors période, résiliés)
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-slate-400">
                <span className="text-xs font-semibold">
                  {showExcludedDetails ? 'Masquer' : 'Afficher'}
                </span>
                {showExcludedDetails ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </div>
            </button>

            {showExcludedDetails && (
              <div className="space-y-2 pt-2 border-t border-slate-800">
                {excludedCandidates.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">
                    Aucun contrat exclu. Tous les contrats de la société sont éligibles.
                  </p>
                ) : (
                  excludedCandidates.map((cand) => (
                    <div
                      key={cand.contract.id}
                      className="p-3 rounded-xl bg-slate-850/60 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-400">
                            {cand.contract.numeroContrat}
                          </span>
                          <span className="font-semibold text-slate-200">
                            {cand.client.nom}
                          </span>
                          <span className="text-slate-400">• {cand.contract.siteNom}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                          <span>
                            Dates contrat : {cand.contract.dateDebut} au {cand.contract.dateFin}
                          </span>
                          <span>• Tarif mensuel : {formatFCFA(cand.contract.montantMensuelHT)}</span>
                        </div>
                        {cand.exclusionReason && (
                          <p className="text-[11px] text-amber-300 font-medium flex items-center gap-1.5">
                            <Info className="w-3.5 h-3.5 shrink-0" />
                            <span>{cand.exclusionReason}</span>
                          </p>
                        )}
                      </div>

                      {/* Explicit override toggle for already_billed if accountant wants to do a rectificative invoice */}
                      {cand.status === 'already_billed' && (
                        <div className="sm:text-right shrink-0">
                          <button
                            type="button"
                            onClick={() => handleToggleDuplicateOverride(cand.contract.id)}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-300 border border-blue-500/30 text-xs font-semibold transition cursor-pointer"
                          >
                            + Autoriser facture rectificative
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 bg-slate-900 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>
              <strong>{totalSelectedCount}</strong> facture(s) vérifiée(s) pour un total de{' '}
              <strong className="text-white">{formatFCFA(totalTTCSelected)}</strong>
            </span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleConfirmGeneration}
              disabled={selectedCandidates.length === 0 || isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-blue-900/40 transition cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>
                {initialStatus === 'Brouillon'
                  ? `Créer les ${selectedCandidates.length} brouillons de facture`
                  : `Émettre les ${selectedCandidates.length} factures vérifiées`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
