import React, { useState } from 'react';
import {
  DollarSign,
  FileText,
  Calculator,
  CheckCircle2,
  Clock,
  AlertCircle,
  Eye,
  Plus,
  Printer,
  Download,
  Users,
  Building,
  CreditCard,
  Send,
  Lock,
  FileSpreadsheet,
  Shield,
  RefreshCw,
  Edit3,
  XCircle,
  AlertTriangle,
  Filter,
  Calendar,
  Layers,
  Check,
  Sparkles,
} from 'lucide-react';
import {
  FactureMensuelle,
  FichePaieAgent,
  Client,
  Contract,
  AgentSecurite,
  EnterpriseSettings,
  StatutValidationPaie,
  UserSpace,
  StatutFichePaie,
  StatutFacture,
} from '../types';
import { DocumentsComptablesModule } from './DocumentsComptablesModule';
import { PayrollEditModal } from './PayrollEditModal';
import { PayrollPaymentModal } from './PayrollPaymentModal';
import { PayrollDirectionActionModal } from './PayrollDirectionActionModal';
import { InvoiceCreateEditModal } from './InvoiceCreateEditModal';
import { InvoicePaymentModal } from './InvoicePaymentModal';
import { PrepareMonthlyInvoicesModal, MOIS_FRANCAIS, ANNEES_DISPONIBLES } from './PrepareMonthlyInvoicesModal';

interface ComptabiliteSpaceProps {
  invoices: FactureMensuelle[];
  payslips: FichePaieAgent[];
  agents: AgentSecurite[];
  clients: Client[];
  contracts: Contract[];
  settings: EnterpriseSettings;
  statutPaie: StatutValidationPaie;
  currentSpace?: UserSpace;
  onTransmitPaieToDirection: () => void;
  onPayAllSalaries: () => void;
  onSyncPayrollFromAgents?: () => void;
  onViewInvoice: (inv: FactureMensuelle) => void;
  onViewPayslip: (slip: FichePaieAgent) => void;
  onMarkInvoicePaid: (id: string) => void;
  onMarkPayslipPaid: (id: string) => void;
  onSavePayslip: (slip: FichePaieAgent, submitForValidation: boolean) => void;
  onConfirmPayslipPayment: (
    id: string,
    paymentData: {
      datePaiement: string;
      montantPaye: number;
      modePaiement: any;
      referencePaiement: string;
    }
  ) => void;
  onValidatePayslip?: (id: string, note?: string) => void;
  onRejectPayslip?: (id: string, motif: string) => void;
  onSubmitPayslipForValidation?: (id: string) => void;
  onSaveInvoice: (invoice: FactureMensuelle, isEmit: boolean) => void;
  onSaveMultipleInvoices?: (newInvoices: FactureMensuelle[]) => void;
  onConfirmInvoicePayment: (
    invoiceId: string,
    payment: {
      montant: number;
      dateReglement: string;
      modePaiement: any;
      reference?: string;
      note?: string;
    }
  ) => void;
}

export const ComptabiliteSpace: React.FC<ComptabiliteSpaceProps> = ({
  invoices,
  payslips,
  agents,
  clients,
  contracts,
  settings,
  statutPaie,
  currentSpace = 'comptabilite',
  onTransmitPaieToDirection,
  onPayAllSalaries,
  onSyncPayrollFromAgents,
  onViewInvoice,
  onViewPayslip,
  onMarkInvoicePaid,
  onMarkPayslipPaid,
  onSavePayslip,
  onConfirmPayslipPayment,
  onValidatePayslip,
  onRejectPayslip,
  onSubmitPayslipForValidation,
  onSaveInvoice,
  onSaveMultipleInvoices,
  onConfirmInvoicePayment,
}) => {
  const [activeTab, setActiveTab] = useState<'facturation' | 'encaissement' | 'paie' | 'documents'>('facturation');
  const [isPrepareMonthlyModalOpen, setIsPrepareMonthlyModalOpen] = useState(false);
  const [batchNotification, setBatchNotification] = useState<string | null>(null);

  // Invoices Filters & Modals
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<string>('tous');
  const [invoiceMonthFilter, setInvoiceMonthFilter] = useState<string>('Tous');
  const [invoiceYearFilter, setInvoiceYearFilter] = useState<string>('Toutes');
  const [isInvoiceCreateModalOpen, setIsInvoiceCreateModalOpen] = useState(false);
  const [invoiceToEdit, setInvoiceToEdit] = useState<FactureMensuelle | null>(null);
  const [isInvoicePaymentModalOpen, setIsInvoicePaymentModalOpen] = useState(false);
  const [invoiceToPay, setInvoiceToPay] = useState<FactureMensuelle | null>(null);

  // Invoices with unpaid balance
  const unpaidInvoices = invoices.filter((inv) => {
    const solde = inv.resteADevoir !== undefined
      ? inv.resteADevoir
      : Math.max(0, inv.montantTTC - (inv.montantRegle || 0));
    return inv.statut !== 'Brouillon' && solde > 0;
  });

  // Flat list of all payment receipts recorded
  const allReglements = invoices.flatMap((inv) =>
    (inv.reglements || []).map((reg) => ({
      ...reg,
      factureId: inv.id,
      numeroFacture: inv.numeroFacture,
      clientNom: inv.clientNom,
      siteNom: inv.siteNom,
      montantTotalFacture: inv.montantTTC,
      soldeActuelFacture: inv.resteADevoir !== undefined ? inv.resteADevoir : Math.max(0, inv.montantTTC - (inv.montantRegle || 0)),
      statutFacture: inv.statut,
      originalInvoice: inv,
    }))
  ).sort((a, b) => b.dateReglement.localeCompare(a.dateReglement));

  // Payroll Filters & Search State
  const [payrollMonthFilter, setPayrollMonthFilter] = useState<string>('Tous');
  const [payrollStatusFilter, setPayrollStatusFilter] = useState<string>('Tous');

  // Payroll Modals State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [slipToEdit, setSlipToEdit] = useState<FichePaieAgent | null>(null);

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [slipToPay, setSlipToPay] = useState<FichePaieAgent | null>(null);

  const [isDirectionActionModalOpen, setIsDirectionActionModalOpen] = useState(false);
  const [slipForDirection, setSlipForDirection] = useState<FichePaieAgent | null>(null);

  const formatFCFA = (val: number) => new Intl.NumberFormat('fr-FR').format(val) + ' FCFA';

  // Invoices metrics
  const totalFactureTTC = invoices.reduce((acc, inv) => acc + inv.montantTTC, 0);
  const totalEncaisse = invoices.reduce((acc, inv) => acc + (inv.montantRegle || 0), 0);
  const totalEnAttente = invoices.reduce((acc, inv) => {
    const reste = inv.resteADevoir !== undefined ? inv.resteADevoir : Math.max(0, inv.montantTTC - (inv.montantRegle || 0));
    return acc + reste;
  }, 0);
  const totalTVACollectee = invoices.reduce((acc, inv) => acc + inv.montantTVA, 0);

  // Invoices Unique Months
  const availableInvoiceMonths = Array.from(new Set(invoices.map((inv) => inv.mois)));

  // Filtered Invoices
  const filteredInvoices = invoices.filter((inv) => {
    // Filtrage mois
    const matchMonth =
      invoiceMonthFilter === 'Tous' ||
      inv.mois.trim().toLowerCase().startsWith(invoiceMonthFilter.toLowerCase()) ||
      inv.mois.trim().toLowerCase().includes(invoiceMonthFilter.toLowerCase());

    // Filtrage année
    const matchYear =
      invoiceYearFilter === 'Toutes' ||
      inv.mois.includes(invoiceYearFilter) ||
      inv.dateEmission.startsWith(invoiceYearFilter);

    if (!matchMonth || !matchYear) return false;

    if (invoiceStatusFilter === 'tous') return true;
    if (invoiceStatusFilter === 'À payer' && (inv.statut === 'À payer' || inv.statut === 'En attente')) return true;
    if ((invoiceStatusFilter === 'Partielle' || invoiceStatusFilter === 'Partiellement payée') && (inv.statut === 'Partielle' || inv.statut === 'Partiellement payée')) return true;
    return inv.statut === invoiceStatusFilter;
  });

  // Invoice Status Counts
  const countInvBrouillon = invoices.filter((i) => i.statut === 'Brouillon').length;
  const countInvAPayer = invoices.filter((i) => i.statut === 'À payer' || i.statut === 'En attente').length;
  const countInvPartiel = invoices.filter((i) => i.statut === 'Partielle' || i.statut === 'Partiellement payée').length;
  const countInvPayee = invoices.filter((i) => i.statut === 'Payée').length;
  const countInvRetard = invoices.filter((i) => i.statut === 'En retard').length;

  // Payslips metrics
  const totalMasseSalarialeNette = payslips.reduce((acc, p) => acc + p.netAPayer, 0);
  const totalCNSSOuvriere = payslips.reduce((acc, p) => acc + p.retenueCNSS, 0);
  const totalPrimes = payslips.reduce((acc, p) => acc + (p.prime || ((p.primeDeNuit || 0) + (p.primeDePanier || 0) + (p.primeAssiduite || 0))), 0);
  const totalSalairesPayes = payslips
    .filter((p) => p.statut === 'Payée')
    .reduce((acc, p) => acc + p.netAPayer, 0);

  // Extract all unique months present in payslips
  const availableMonths = Array.from(new Set(payslips.map((p) => p.mois)));
  if (!availableMonths.includes('Octobre 2026')) availableMonths.unshift('Octobre 2026');
  if (!availableMonths.includes('Novembre 2026')) availableMonths.push('Novembre 2026');

  // Filtered payslips
  const filteredPayslips = payslips.filter((slip) => {
    const matchMonth = payrollMonthFilter === 'Tous' || slip.mois === payrollMonthFilter;
    const matchStatus = payrollStatusFilter === 'Tous' || slip.statut === payrollStatusFilter;
    return matchMonth && matchStatus;
  });

  // Counts by status
  const countBrouillon = payslips.filter((p) => p.statut === 'Brouillon').length;
  const countEnAttente = payslips.filter((p) => p.statut === 'En attente de validation').length;
  const countValidee = payslips.filter((p) => p.statut === 'Validée').length;
  const countPayee = payslips.filter((p) => p.statut === 'Payée').length;
  const countRejetee = payslips.filter((p) => p.statut === 'Rejetée').length;

  // Invoice Handlers
  const handleOpenNewInvoice = () => {
    setInvoiceToEdit(null);
    setIsInvoiceCreateModalOpen(true);
  };

  const handleOpenEditInvoice = (inv: FactureMensuelle) => {
    setInvoiceToEdit(inv);
    setIsInvoiceCreateModalOpen(true);
  };

  const handleOpenInvoicePayment = (inv: FactureMensuelle) => {
    setInvoiceToPay(inv);
    setIsInvoicePaymentModalOpen(true);
  };

  const handleOpenNewPayment = () => {
    setInvoiceToPay(null);
    setIsInvoicePaymentModalOpen(true);
  };

  const handleConfirmBatchInvoices = (newInvoices: FactureMensuelle[]) => {
    if (onSaveMultipleInvoices) {
      onSaveMultipleInvoices(newInvoices);
    } else {
      newInvoices.forEach((inv) => onSaveInvoice(inv, inv.statut === 'À payer'));
    }
    setBatchNotification(
      `${newInvoices.length} facture(s) préparée(s) et ajoutée(s) avec succès pour ${newInvoices[0]?.mois || 'le mois'} !`
    );
    setTimeout(() => setBatchNotification(null), 7000);
  };

  // Payroll Handlers
  const handleOpenNewPayslip = () => {
    setSlipToEdit(null);
    setIsEditModalOpen(true);
  };

  const handleOpenEditPayslip = (slip: FichePaieAgent) => {
    setSlipToEdit(slip);
    setIsEditModalOpen(true);
  };

  const handleOpenPaymentModal = (slip: FichePaieAgent) => {
    setSlipToPay(slip);
    setIsPaymentModalOpen(true);
  };

  const handleOpenDirectionActionModal = (slip: FichePaieAgent) => {
    setSlipForDirection(slip);
    setIsDirectionActionModalOpen(true);
  };

  const isDirection = currentSpace === 'direction';

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Simulation & Security Notice */}
      <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-200 text-xs flex items-start gap-2.5">
        <Shield className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-blue-300">
            {isDirection
              ? 'Supervision Direction Générale - Contrôle Financier & Décisions :'
              : 'Espace Comptabilité & Finances - Facturation Clients & Salaires :'}
          </p>
          <p className="mt-0.5 text-blue-200/90 leading-relaxed">
            {isDirection
              ? 'Vous disposez des droits de consultation des factures, de suivi des encaissements et du visa formel sur les états de paie. Le Contrôleur terrain n’a aucun accès aux données financières.'
              : 'Vous créez et gérez les factures mensuelles clients, enregistrez les règlements partiels ou totaux, préparez les fiches de salaires vigiles et transmettez les états à la Direction pour approbation.'}
          </p>
        </div>
      </div>

      {/* Top Banner & Sub-Tab Switcher */}
      <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/30">
                {isDirection ? 'Direction Générale' : 'Espace Comptabilité'}
              </span>
              <span className="text-xs text-slate-400">Niamey • Gestion Financière & Salaires</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white mt-1.5">
              {isDirection ? 'Contrôle Financier & Validation des Salaires' : 'Facturation Clients, Préparation de la Paie & Documents'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
              Émission de factures clients rattachées aux contrats, suivi des encaissements et gestion de paie à 5 statuts.
            </p>
          </div>

          {/* Sub-tab switcher */}
          <div className="flex items-center p-1 rounded-xl bg-slate-800 border border-slate-700 overflow-x-auto w-full md:w-auto">
            <button
              onClick={() => setActiveTab('facturation')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                activeTab === 'facturation'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Facturation Clients ({invoices.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('encaissement')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                activeTab === 'encaissement'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>Module Encaissement ({unpaidInvoices.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('paie')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                activeTab === 'paie'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <DollarSign className="w-4 h-4" />
              <span>Gestion Paie ({payslips.length})</span>
            </button>
            {!isDirection && (
              <button
                onClick={() => setActiveTab('documents')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                  activeTab === 'documents'
                    ? 'bg-amber-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Documents Comptables</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* FACTURATION TAB (Requirement 1, 7, 8, 9, 10) */}
      {activeTab === 'facturation' && (
        <div className="space-y-6">
          {/* Invoices KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                <span>Chiffre d’Affaires Facturé (TTC)</span>
                <span className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
                  <FileText className="w-4 h-4" />
                </span>
              </div>
              <p className="text-xl sm:text-2xl font-black text-white mt-2">
                {formatFCFA(totalFactureTTC)}
              </p>
              <p className="text-[11px] text-emerald-400 mt-1">Total des émissions clients</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                <span>Total Encaissé (Règlements)</span>
                <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                </span>
              </div>
              <p className="text-xl sm:text-2xl font-black text-emerald-400 mt-2">
                {formatFCFA(totalEncaisse)}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Règlements réellement perçus</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                <span>Créances Clients en Attente</span>
                <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                  <Clock className="w-4 h-4" />
                </span>
              </div>
              <p className="text-xl sm:text-2xl font-black text-amber-300 mt-2">
                {formatFCFA(totalEnAttente)}
              </p>
              <p className="text-[11px] text-amber-400/90 mt-1">Solde restant à recouvrer</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                <span>TVA 19% Collectée (DGI)</span>
                <span className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
                  <Calculator className="w-4 h-4" />
                </span>
              </div>
              <p className="text-xl sm:text-2xl font-black text-purple-300 mt-2">
                {formatFCFA(totalTVACollectee)}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">À reverser au fisc nigérien</p>
            </div>
          </div>

          {/* Invoices List Toolbar */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-white text-base">Factures Clients & Encaissements</h3>
                <p className="text-xs text-slate-400">
                  Émissions mensuelles rattachées aux contrats et suivi rigoureux des règlements
                </p>
              </div>

              {/* Boutons d'actions Facturation & Encaissement */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setIsPrepareMonthlyModalOpen(true)}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-purple-900/40 transition cursor-pointer"
                  title="Préparation assistée des factures du mois à partir des contrats existants"
                >
                  <Sparkles className="w-4 h-4 text-purple-200" />
                  <span>Préparer les factures du mois</span>
                </button>
                <button
                  onClick={handleOpenNewPayment}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-900/40 transition cursor-pointer"
                  title="Enregistrer un encaissement pour une facture client"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Enregistrer un encaissement</span>
                </button>
                <button
                  onClick={handleOpenNewInvoice}
                  className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-blue-900/40 transition cursor-pointer"
                  title="Créer manuellement une nouvelle facture client"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nouvelle facture</span>
                </button>
              </div>
            </div>

            {/* Notification banner after batch generation */}
            {batchNotification && (
              <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between gap-3 animate-in fade-in">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="font-semibold">{batchNotification}</span>
                </div>
                <button
                  onClick={() => setBatchNotification(null)}
                  className="text-emerald-400 hover:text-white text-xs cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Status pills and filters */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 pt-3 border-t border-slate-800">
              {/* Status Tabs */}
              <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                {[
                  { id: 'tous', label: `Toutes (${invoices.length})` },
                  { id: 'Brouillon', label: `Brouillons (${countInvBrouillon})` },
                  { id: 'À payer', label: `À payer (${countInvAPayer})` },
                  { id: 'Partiellement payée', label: `Partielles (${countInvPartiel})` },
                  { id: 'Payée', label: `Payées (${countInvPayee})` },
                  { id: 'En retard', label: `En retard (${countInvRetard})` },
                ].map((st) => (
                  <button
                    key={st.id}
                    onClick={() => setInvoiceStatusFilter(st.id)}
                    className={`px-3 py-1.5 rounded-xl font-semibold transition cursor-pointer ${
                      invoiceStatusFilter === st.id
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>

              {/* Filter Group: Mois civil et Année */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Sélecteur de Mois */}
                <div className="flex items-center gap-1.5 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700 text-xs shrink-0">
                  <Calendar className="w-3.5 h-3.5 text-purple-400" />
                  <span className="text-slate-400 font-medium">Mois :</span>
                  <select
                    value={invoiceMonthFilter}
                    onChange={(e) => setInvoiceMonthFilter(e.target.value)}
                    className="bg-transparent text-white font-semibold focus:outline-none cursor-pointer"
                  >
                    <option value="Tous">Tous les mois</option>
                    {MOIS_FRANCAIS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sélecteur d'Année */}
                <div className="flex items-center gap-1.5 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700 text-xs shrink-0">
                  <span className="text-slate-400 font-medium">Année :</span>
                  <select
                    value={invoiceYearFilter}
                    onChange={(e) => setInvoiceYearFilter(e.target.value)}
                    className="bg-transparent text-white font-semibold focus:outline-none cursor-pointer"
                  >
                    <option value="Toutes">Toutes les années</option>
                    {ANNEES_DISPONIBLES.map((y) => (
                      <option key={y} value={y.toString()}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Invoices Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-slate-800/40">
                    <th className="py-2.5 px-3">N° Facture</th>
                    <th className="py-2.5 px-3">Client & Contrat</th>
                    <th className="py-2.5 px-3">Mois</th>
                    <th className="py-2.5 px-3 text-right">Montant HT</th>
                    <th className="py-2.5 px-3 text-right">TVA</th>
                    <th className="py-2.5 px-3 text-right">Total TTC</th>
                    <th className="py-2.5 px-3 text-right">Encaissé</th>
                    <th className="py-2.5 px-3 text-right font-bold text-amber-300">Reste Dû</th>
                    <th className="py-2.5 px-3 text-center">Statut</th>
                    <th className="py-2.5 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {filteredInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-slate-500">
                        Aucune facture trouvée pour les filtres sélectionnés.
                      </td>
                    </tr>
                  ) : (
                    filteredInvoices.map((inv) => {
                      const montantRegle = inv.montantRegle || 0;
                      const resteADevoir = inv.resteADevoir !== undefined
                        ? inv.resteADevoir
                        : Math.max(0, inv.montantTTC - montantRegle);

                      return (
                        <tr key={inv.id} className="hover:bg-slate-800/40 transition">
                          <td className="py-3 px-3 font-mono font-bold text-blue-400 whitespace-nowrap">
                            {inv.numeroFacture}
                          </td>
                          <td className="py-3 px-3">
                            <p className="font-semibold text-white">{inv.clientNom}</p>
                            {inv.siteNom && (
                              <p className="text-[11px] text-slate-400">{inv.siteNom}</p>
                            )}
                          </td>
                          <td className="py-3 px-3 text-slate-300 whitespace-nowrap">{inv.mois}</td>
                          <td className="py-3 px-3 text-right font-medium whitespace-nowrap">{formatFCFA(inv.montantHT)}</td>
                          <td className="py-3 px-3 text-right text-purple-300 whitespace-nowrap">
                            {inv.tauxTVA === 0 ? 'Exonéré' : formatFCFA(inv.montantTVA)}
                          </td>
                          <td className="py-3 px-3 text-right font-black text-white whitespace-nowrap">
                            {formatFCFA(inv.montantTTC)}
                          </td>
                          <td className="py-3 px-3 text-right text-emerald-400 font-semibold whitespace-nowrap">
                            {montantRegle > 0 ? formatFCFA(montantRegle) : '-'}
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-amber-300 whitespace-nowrap">
                            {resteADevoir > 0 ? formatFCFA(resteADevoir) : '0 FCFA'}
                          </td>
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                inv.statut === 'Payée'
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                  : inv.statut === 'Partiellement payée'
                                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                                  : inv.statut === 'En retard'
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                  : inv.statut === 'Brouillon'
                                  ? 'bg-slate-700/60 text-slate-300 border border-slate-600'
                                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              }`}
                            >
                              {inv.statut}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* 1. Bouton Consulter Facture */}
                              <button
                                onClick={() => onViewInvoice(inv)}
                                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-white text-xs font-medium flex items-center gap-1 transition cursor-pointer border border-slate-700"
                                title="Consulter et imprimer la facture"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Facture</span>
                              </button>

                              {/* 2. Bouton Modifier Brouillon (Requirement 10) */}
                              {inv.statut === 'Brouillon' && (
                                <button
                                  onClick={() => handleOpenEditInvoice(inv)}
                                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-white text-xs font-medium flex items-center gap-1 transition cursor-pointer border border-slate-700"
                                  title="Modifier cette facture brouillon"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                  <span>Modifier</span>
                                </button>
                              )}

                              {/* 3. Bouton Encaisser (Requirement 7 & 9) */}
                              {inv.statut !== 'Payée' && resteADevoir > 0 && (
                                <button
                                  onClick={() => handleOpenInvoicePayment(inv)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600/30 hover:bg-emerald-600 text-emerald-300 hover:text-white text-xs font-medium flex items-center gap-1 transition cursor-pointer border border-emerald-500/40"
                                  title="Enregistrer un encaissement partiel ou total"
                                >
                                  <CreditCard className="w-3.5 h-3.5" />
                                  <span>Encaisser</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODULE ENCAISSEMENT TAB (Requirement 1 to 10) */}
      {activeTab === 'encaissement' && (
        <div className="space-y-6 animate-in fade-in">
          {/* Encaissement Banner */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <CreditCard className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-white">
                  Module Encaissement & Recouvrement
                </h2>
                <p className="text-xs text-slate-300 mt-0.5">
                  Enregistrement des paiements (partiels ou soldes), rapprochement et quittances.
                </p>
              </div>
            </div>

            <button
              onClick={handleOpenNewPayment}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-900/40 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Enregistrer un encaissement</span>
            </button>
          </div>

          {/* Test Scenario Helper Banner */}
          {invoices.find((i) => i.numeroFacture === 'FAC-2026-10-TEST-150K') && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/60 to-slate-900 border border-emerald-500/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0 mt-0.5">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold text-white text-sm">
                    Scénario de test : Facture de 150 000 FCFA ({invoices.find((i) => i.numeroFacture === 'FAC-2026-10-TEST-150K')?.numeroFacture})
                  </p>
                  <p className="text-slate-300 mt-1 leading-relaxed">
                    1. Cliquez sur le bouton ci-contre ou sur « Encaisser » sur la ligne.<br />
                    2. Choisissez l'option <strong>« 50 000 FCFA »</strong> et cliquez sur <strong>« Confirmer l'encaissement »</strong> ➔ Solde restant : <strong>100 000 FCFA</strong>, Statut : <strong>« Partielle »</strong>.<br />
                    3. Cliquez à nouveau sur « Encaisser », choisissez <strong>« Solde total / 100 % »</strong> (100 000 FCFA) et confirmez ➔ Solde : <strong>0 FCFA</strong>, Statut final : <strong>« Payée »</strong>.
                  </p>
                  <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px]">
                    <span className="text-slate-400">
                      Total : <strong className="text-white">150 000 FCFA</strong>
                    </span>
                    <span className="text-slate-400">
                      Déjà perçu : <strong className="text-emerald-400">{formatFCFA(invoices.find((i) => i.numeroFacture === 'FAC-2026-10-TEST-150K')?.montantRegle || 0)}</strong>
                    </span>
                    <span className="text-slate-400">
                      Solde : <strong className="text-amber-400">{formatFCFA(invoices.find((i) => i.numeroFacture === 'FAC-2026-10-TEST-150K')?.resteADevoir || 0)}</strong>
                    </span>
                    <span className="text-slate-400">
                      Statut : <strong className="text-blue-300">{invoices.find((i) => i.numeroFacture === 'FAC-2026-10-TEST-150K')?.statut}</strong>
                    </span>
                  </div>
                </div>
              </div>

              {invoices.find((i) => i.numeroFacture === 'FAC-2026-10-TEST-150K')?.statut !== 'Payée' && (
                <button
                  onClick={() => {
                    const testInv = invoices.find((i) => i.numeroFacture === 'FAC-2026-10-TEST-150K');
                    if (testInv) handleOpenInvoicePayment(testInv);
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shrink-0 shadow-md transition cursor-pointer"
                >
                  Tester sur cette facture (150 000 FCFA)
                </button>
              )}
            </div>
          )}

          {/* Encaissement KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                <span>Total Encaissé (Règlements)</span>
                <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                </span>
              </div>
              <p className="text-xl sm:text-2xl font-black text-emerald-400 mt-2">
                {formatFCFA(totalEncaisse)}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Sur {totalFactureTTC > 0 ? formatFCFA(totalFactureTTC) : '0 FCFA'} facturé</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                <span>Créances Restantes à Recouvrer</span>
                <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                  <Clock className="w-4 h-4" />
                </span>
              </div>
              <p className="text-xl sm:text-2xl font-black text-amber-400 mt-2">
                {formatFCFA(totalEnAttente)}
              </p>
              <p className="text-[11px] text-amber-300/80 mt-1">{unpaidInvoices.length} facture(s) avec solde à payer</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                <span>Taux de Recouvrement</span>
                <span className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
                  <Calculator className="w-4 h-4" />
                </span>
              </div>
              <p className="text-xl sm:text-2xl font-black text-blue-400 mt-2">
                {totalFactureTTC > 0 ? Math.round((totalEncaisse / totalFactureTTC) * 100) : 0} %
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Ratio encaissements / facturation</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                <span>Quittances Enregistrées</span>
                <span className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
                  <FileText className="w-4 h-4" />
                </span>
              </div>
              <p className="text-xl sm:text-2xl font-black text-purple-300 mt-2">
                {allReglements.length} reçus
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Historique des paiements conservé</p>
            </div>
          </div>

          {/* Section 1: Factures en attente d'encaissement */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="font-bold text-white text-base">Factures avec Solde Restant Dû</h3>
                <p className="text-xs text-slate-400">
                  Factures émises non soldées éligibles à un encaissement partiel ou total
                </p>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {unpaidInvoices.length} facture(s) à recouvrer
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-slate-800/40">
                    <th className="py-2.5 px-3">N° Facture</th>
                    <th className="py-2.5 px-3">Client & Site</th>
                    <th className="py-2.5 px-3">Mois</th>
                    <th className="py-2.5 px-3 text-right">Total TTC</th>
                    <th className="py-2.5 px-3 text-right">Déjà Encaissé</th>
                    <th className="py-2.5 px-3 text-right font-bold text-amber-300">Solde Restant Dû</th>
                    <th className="py-2.5 px-3 text-center">Statut</th>
                    <th className="py-2.5 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {unpaidInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-slate-500">
                        Toutes les factures émises ont été intégralement réglées.
                      </td>
                    </tr>
                  ) : (
                    unpaidInvoices.map((inv) => {
                      const solde = inv.resteADevoir !== undefined
                        ? inv.resteADevoir
                        : Math.max(0, inv.montantTTC - (inv.montantRegle || 0));
                      return (
                        <tr key={inv.id} className="hover:bg-slate-800/40 transition">
                          <td className="py-3 px-3 font-mono font-bold text-blue-400 whitespace-nowrap">
                            {inv.numeroFacture}
                          </td>
                          <td className="py-3 px-3">
                            <p className="font-semibold text-white">{inv.clientNom}</p>
                            {inv.siteNom && (
                              <p className="text-[11px] text-slate-400">{inv.siteNom}</p>
                            )}
                          </td>
                          <td className="py-3 px-3 text-slate-300 whitespace-nowrap">{inv.mois}</td>
                          <td className="py-3 px-3 text-right font-semibold text-white whitespace-nowrap">
                            {formatFCFA(inv.montantTTC)}
                          </td>
                          <td className="py-3 px-3 text-right text-emerald-400 font-medium whitespace-nowrap">
                            {(inv.montantRegle || 0) > 0 ? formatFCFA(inv.montantRegle || 0) : '-'}
                          </td>
                          <td className="py-3 px-3 text-right font-black text-amber-300 whitespace-nowrap">
                            {formatFCFA(solde)}
                          </td>
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
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
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleOpenInvoicePayment(inv)}
                                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-900/40 transition cursor-pointer"
                                title="Enregistrer un encaissement"
                              >
                                <CreditCard className="w-3.5 h-3.5" />
                                <span>Encaisser</span>
                              </button>
                              <button
                                onClick={() => onViewInvoice(inv)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer border border-slate-700"
                                title="Voir la facture"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 2: Journal & Historique des règlements enregistrés */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="font-bold text-white text-base">
                  Journal Chronologique des Encaissements Réalisés
                </h3>
                <p className="text-xs text-slate-400">
                  Historique détaillé de tous les règlements perçus (conservés sans écraser les paiements précédents)
                </p>
              </div>
              <span className="text-xs text-slate-400 font-medium">
                {allReglements.length} écriture(s) d'encaissement
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-slate-800/40">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Facture associée</th>
                    <th className="py-2.5 px-3">Client</th>
                    <th className="py-2.5 px-3 text-right">Montant Encaissé</th>
                    <th className="py-2.5 px-3">Mode de paiement</th>
                    <th className="py-2.5 px-3">Référence / Quittance</th>
                    <th className="py-2.5 px-3">Note / Motif</th>
                    <th className="py-2.5 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {allReglements.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-slate-500">
                        Aucun encaissement n'a encore été enregistré.
                      </td>
                    </tr>
                  ) : (
                    allReglements.map((reg) => (
                      <tr key={reg.id} className="hover:bg-slate-800/30 transition">
                        <td className="py-3 px-3 font-mono font-medium text-slate-300 whitespace-nowrap">
                          {reg.dateReglement}
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-blue-400 whitespace-nowrap">
                          {reg.numeroFacture}
                        </td>
                        <td className="py-3 px-3 font-semibold text-white whitespace-nowrap">
                          {reg.clientNom}
                        </td>
                        <td className="py-3 px-3 text-right font-black text-emerald-400 whitespace-nowrap">
                          +{formatFCFA(reg.montant)}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-xs border border-slate-700">
                            {reg.modePaiement}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono text-xs text-slate-400 whitespace-nowrap">
                          {reg.reference || '-'}
                        </td>
                        <td className="py-3 px-3 text-xs text-slate-300 max-w-xs truncate">
                          {reg.note || '-'}
                        </td>
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <button
                            onClick={() => onViewInvoice(reg.originalInvoice)}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-white text-xs font-medium inline-flex items-center gap-1 transition cursor-pointer border border-slate-700"
                            title="Voir la facture complète"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Facture</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* PAIE TAB */}
      {activeTab === 'paie' && (
        <div className="space-y-6">
          {/* Payroll Workflow Banner */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                    <Calculator className="w-4 h-4" />
                  </span>
                  <h3 className="font-bold text-white text-base">
                    Module de Rémunération & États de Paie
                  </h3>
                </div>
                <p className="text-xs text-slate-300 mt-1">
                  Workflow d'entreprise : <strong>Comptabilité prépare</strong> ➔ <strong>Direction valide</strong> ➔ <strong>Comptabilité enregistre le paiement</strong>.
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap items-center gap-2">
                {!isDirection && (
                  <button
                    onClick={handleOpenNewPayslip}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-lg shadow-emerald-900/40 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Préparer une paie agent</span>
                  </button>
                )}

                {countBrouillon > 0 && !isDirection && (
                  <button
                    onClick={onTransmitPaieToDirection}
                    className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-lg shadow-blue-900/40 cursor-pointer"
                    title="Soumettre l'ensemble des brouillons à la Direction pour visa"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Soumettre les brouillons ({countBrouillon})</span>
                  </button>
                )}

                {isDirection && countEnAttente > 0 && (
                  <button
                    onClick={onTransmitPaieToDirection}
                    className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-lg shadow-purple-900/40 cursor-pointer"
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span>{countEnAttente} fiche(s) en attente de visa</span>
                  </button>
                )}

                {onSyncPayrollFromAgents && !isDirection && (
                  <button
                    onClick={onSyncPayrollFromAgents}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                    title="Synchroniser tous les agents actifs avec le mois en cours"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="hidden sm:inline">Actualiser depuis les fiches agents</span>
                  </button>
                )}
              </div>
            </div>

            {/* Status breakdown pills */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2 border-t border-slate-800 text-xs">
              <div className="p-2 rounded-xl bg-slate-800/60 border border-slate-700 flex items-center justify-between">
                <span className="text-slate-400 font-medium">1. Brouillon :</span>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-700 text-slate-200">
                  {countBrouillon}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
                <span className="text-amber-300 font-medium">2. En attente :</span>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-300">
                  {countEnAttente}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-between">
                <span className="text-blue-300 font-medium">3. Validée :</span>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-500/20 text-blue-300">
                  {countValidee}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
                <span className="text-emerald-300 font-medium">4. Payée :</span>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-300">
                  {countPayee}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between col-span-2 sm:col-span-1">
                <span className="text-rose-300 font-medium">Rejetée :</span>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/20 text-rose-300">
                  {countRejetee}
                </span>
              </div>
            </div>

            {/* Separation of duties rule reminder */}
            <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/80 text-xs text-slate-300 flex items-start gap-2">
              <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p>
                <strong>Principe de conformité & contrôle interne :</strong> Une paie avec le statut « Validée » par la Direction Générale ne doit <strong>jamais être considérée automatiquement comme payée</strong>. C'est la Comptabilité qui doit enregistrer le décaissement réel avec la date, le mode et le numéro de reçu/quittance.
              </p>
            </div>
          </div>

          {/* Payroll KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                <span>Masse Salariale Nette Totale</span>
                <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                  <DollarSign className="w-4 h-4" />
                </span>
              </div>
              <p className="text-xl sm:text-2xl font-black text-white mt-2">
                {formatFCFA(totalMasseSalarialeNette)}
              </p>
              <p className="text-[11px] text-emerald-400 mt-1">Total des salaires nets calculés</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                <span>Cotisations CNSS Ouvrières (5.25%)</span>
                <span className="p-2 rounded-xl bg-rose-500/10 text-rose-400">
                  <Calculator className="w-4 h-4" />
                </span>
              </div>
              <p className="text-xl sm:text-2xl font-black text-rose-300 mt-2">{formatFCFA(totalCNSSOuvriere)}</p>
              <p className="text-[11px] text-slate-400 mt-1">À reverser à la CNSS Niger</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                <span>Primes & Indemnités Terrain</span>
                <span className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
                  <Clock className="w-4 h-4" />
                </span>
              </div>
              <p className="text-xl sm:text-2xl font-black text-white mt-2">{formatFCFA(totalPrimes)}</p>
              <p className="text-[11px] text-slate-400 mt-1">Nuit, panier, assiduité vigiles</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                <span>Montant Réellement Décaissé</span>
                <span className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
                  <CreditCard className="w-4 h-4" />
                </span>
              </div>
              <p className="text-xl sm:text-2xl font-black text-blue-300 mt-2">
                {formatFCFA(totalSalairesPayes)}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Sur les fiches avec statut « Payée »</p>
            </div>
          </div>

          {/* Payslips Table with Filters */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            {/* Filter toolbar */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <h3 className="font-bold text-white text-base">
                  Tableau Récapitulatif des Salaires
                </h3>
                <p className="text-xs text-slate-400">
                  Formule : Salaire base + Primes - CNSS - Acompte - Autres retenues
                </p>
              </div>

              {/* Month & Status Filters */}
              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                {/* Month selector */}
                <div className="flex items-center gap-1.5 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700 text-xs">
                  <Calendar className="w-3.5 h-3.5 text-purple-400" />
                  <span className="text-slate-400 font-medium">Mois :</span>
                  <select
                    value={payrollMonthFilter}
                    onChange={(e) => setPayrollMonthFilter(e.target.value)}
                    className="bg-transparent text-white font-semibold focus:outline-none cursor-pointer"
                  >
                    <option value="Tous">Tous les mois</option>
                    {availableMonths.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status selector */}
                <div className="flex items-center gap-1.5 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700 text-xs">
                  <Filter className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-slate-400 font-medium">Statut :</span>
                  <select
                    value={payrollStatusFilter}
                    onChange={(e) => setPayrollStatusFilter(e.target.value)}
                    className="bg-transparent text-white font-semibold focus:outline-none cursor-pointer"
                  >
                    <option value="Tous">Tous ({payslips.length})</option>
                    <option value="Brouillon">Brouillon ({countBrouillon})</option>
                    <option value="En attente de validation">En attente ({countEnAttente})</option>
                    <option value="Validée">Validée ({countValidee})</option>
                    <option value="Payée">Payée ({countPayee})</option>
                    <option value="Rejetée">Rejetée ({countRejetee})</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-slate-800/40">
                    <th className="py-2.5 px-3">Nom de l'agent</th>
                    <th className="py-2.5 px-3">Mois</th>
                    <th className="py-2.5 px-3 text-right">Salaire Base</th>
                    <th className="py-2.5 px-3 text-right">Prime</th>
                    <th className="py-2.5 px-3 text-right">CNSS</th>
                    <th className="py-2.5 px-3 text-right">Acompte</th>
                    <th className="py-2.5 px-3 text-right">Autres</th>
                    <th className="py-2.5 px-3 text-right font-black text-white">Net à Payer (FCFA)</th>
                    <th className="py-2.5 px-3 text-center">Statut</th>
                    <th className="py-2.5 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {filteredPayslips.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-slate-500">
                        Aucune fiche de paie trouvée pour les critères sélectionnés.
                      </td>
                    </tr>
                  ) : (
                    filteredPayslips.map((slip) => {
                      const totalPrimes = slip.prime !== undefined
                        ? slip.prime
                        : (slip.primeDeNuit || 0) + (slip.primeDePanier || 0) + (slip.primeAssiduite || 0);

                      return (
                        <tr key={slip.id} className="hover:bg-slate-800/40 transition">
                          <td className="py-3 px-3">
                            <p className="font-semibold text-white">{slip.agentNom}</p>
                            <p className="text-[11px] font-mono text-emerald-400">
                              {slip.agentMatricule} • <span className="text-slate-400">{slip.poste}</span>
                            </p>
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap text-slate-300">
                            <span className="font-medium">{slip.mois}</span>
                          </td>
                          <td className="py-3 px-3 text-right text-slate-200 whitespace-nowrap">
                            {formatFCFA(slip.salaireBase)}
                          </td>
                          <td className="py-3 px-3 text-right text-emerald-400 font-medium whitespace-nowrap">
                            +{formatFCFA(totalPrimes)}
                          </td>
                          <td className="py-3 px-3 text-right text-rose-400 font-medium whitespace-nowrap">
                            -{formatFCFA(slip.retenueCNSS)}
                          </td>
                          <td className="py-3 px-3 text-right text-amber-400 font-medium whitespace-nowrap">
                            {slip.acompteRetenu > 0 ? `-${formatFCFA(slip.acompteRetenu)}` : '-'}
                          </td>
                          <td className="py-3 px-3 text-right text-purple-400 font-medium whitespace-nowrap">
                            {(slip.autresRetenues || 0) > 0 ? `-${formatFCFA(slip.autresRetenues)}` : '-'}
                          </td>
                          <td className="py-3 px-3 text-right font-black text-emerald-400 whitespace-nowrap text-sm sm:text-base">
                            {formatFCFA(slip.netAPayer)}
                          </td>
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <div className="flex flex-col items-center gap-1">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                  slip.statut === 'Payée'
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                    : slip.statut === 'Validée'
                                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                                    : slip.statut === 'En attente de validation'
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                    : slip.statut === 'Rejetée'
                                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                    : 'bg-slate-700/60 text-slate-300 border border-slate-600'
                                }`}
                              >
                                {slip.statut}
                              </span>
                              {slip.statut === 'Rejetée' && slip.motifRejet && (
                                <span
                                  className="text-[10px] text-rose-400 hover:text-rose-300 cursor-help underline max-w-[140px] truncate"
                                  title={`Motif du rejet par la Direction : ${slip.motifRejet}`}
                                >
                                  {slip.motifRejet}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* 1. Bouton "Préparer / Modifier la paie" */}
                              {!isDirection && (
                                <button
                                  onClick={() => handleOpenEditPayslip(slip)}
                                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 hover:text-white text-xs font-medium flex items-center gap-1 transition cursor-pointer border border-slate-700"
                                  title="Préparer ou modifier les montants de cette paie"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                  <span>Modifier</span>
                                </button>
                              )}

                              {/* 2. Bouton Bulletin */}
                              <button
                                onClick={() => onViewPayslip(slip)}
                                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-white text-xs font-medium flex items-center gap-1 transition cursor-pointer border border-slate-700"
                                title="Consulter le bulletin de salaire imprimable"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Bulletin</span>
                              </button>

                              {/* 3. Action Direction: Valider ou Rejeter */}
                              {isDirection && slip.statut === 'En attente de validation' && (
                                <button
                                  onClick={() => handleOpenDirectionActionModal(slip)}
                                  className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1 transition cursor-pointer shadow-md"
                                  title="Valider ou rejeter cette paie avec commentaire"
                                >
                                  <Shield className="w-3.5 h-3.5" />
                                  <span>Visa / Décision</span>
                                </button>
                              )}

                              {/* 4. Action Comptabilité: Enregistrer le paiement réel après validation */}
                              {!isDirection && slip.statut === 'Validée' && (
                                <button
                                  onClick={() => handleOpenPaymentModal(slip)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 transition cursor-pointer shadow-md shadow-emerald-900/30"
                                  title="Enregistrer le paiement réellement effectué"
                                >
                                  <CreditCard className="w-3.5 h-3.5" />
                                  <span>Enregistrer paiement</span>
                                </button>
                              )}

                              {/* 5. Action Soumettre à la Direction si en Brouillon */}
                              {!isDirection && (slip.statut === 'Brouillon' || slip.statut === 'Rejetée') && onSubmitPayslipForValidation && (
                                <button
                                  onClick={() => onSubmitPayslipForValidation(slip.id)}
                                  className="p-1 rounded-lg bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white text-xs transition cursor-pointer"
                                  title="Soumettre directement à la Direction pour validation"
                                >
                                  <Send className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* DOCUMENTS COMPTABLES TAB */}
      {!isDirection && activeTab === 'documents' && (
        <DocumentsComptablesModule
          invoices={invoices}
          payslips={payslips}
          settings={settings}
        />
      )}

      {/* MODAL: NOUVELLE / MODIFIER FACTURE CLIENT (Requirement 1, 2, 3, 4, 5, 6) */}
      <InvoiceCreateEditModal
        isOpen={isInvoiceCreateModalOpen}
        onClose={() => setIsInvoiceCreateModalOpen(false)}
        invoiceToEdit={invoiceToEdit}
        clients={clients}
        contracts={contracts}
        existingInvoices={invoices}
        settings={settings}
        onSave={onSaveInvoice}
      />

      {/* MODAL: ENCAISSEMENT CLIENT */}
      <InvoicePaymentModal
        isOpen={isInvoicePaymentModalOpen}
        onClose={() => {
          setIsInvoicePaymentModalOpen(false);
          setInvoiceToPay(null);
        }}
        invoice={invoiceToPay}
        availableInvoices={invoices}
        onConfirmPayment={onConfirmInvoicePayment}
      />

      {/* MODAL: PRÉPARATION ASSISTÉE DES FACTURES MENSUELLES (CONTRATS) */}
      <PrepareMonthlyInvoicesModal
        isOpen={isPrepareMonthlyModalOpen}
        onClose={() => setIsPrepareMonthlyModalOpen(false)}
        contracts={contracts}
        clients={clients}
        existingInvoices={invoices}
        settings={settings}
        onConfirmBatch={handleConfirmBatchInvoices}
        initialMonth={invoiceMonthFilter !== 'Tous' ? invoiceMonthFilter : undefined}
        initialYear={invoiceYearFilter !== 'Toutes' ? parseInt(invoiceYearFilter, 10) : undefined}
      />

      {/* MODALS PAIE */}
      <PayrollEditModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        payslipToEdit={slipToEdit}
        agents={agents}
        existingPayslips={payslips}
        onSave={onSavePayslip}
      />

      <PayrollPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        payslip={slipToPay}
        onConfirmPayment={onConfirmPayslipPayment}
      />

      <PayrollDirectionActionModal
        isOpen={isDirectionActionModalOpen}
        onClose={() => setIsDirectionActionModalOpen(false)}
        payslip={slipForDirection}
        onValidate={(id, note) => onValidatePayslip && onValidatePayslip(id, note)}
        onReject={(id, motif) => onRejectPayslip && onRejectPayslip(id, motif)}
      />
    </div>
  );
};
