import React, { useState, useEffect } from 'react';
import { safeLoadFromStorage, safeSaveToStorage, STORAGE_KEYS } from './utils/storageUtils';
import {
  UserSpace,
  MainNavModule,
  Client,
  Contract,
  SiteGardiennage,
  AgentSecurite,
  FactureMensuelle,
  FichePaieAgent,
  RapportControle,
  EnterpriseSettings,
  ControleurProfile,
  StatutValidationPaie,
  ReglementFacture,
  StatutFacture,
  ContratCommercial,
  ContratTravailAgent,
} from './types';
import {
  INITIAL_CLIENTS,
  INITIAL_CONTRACTS,
  INITIAL_AGENT_CONTRACTS,
  INITIAL_SITES,
  INITIAL_AGENTS,
  INITIAL_INVOICES,
  INITIAL_PAYSLIPS,
  INITIAL_REPORTS,
  DEFAULT_ENTERPRISE_SETTINGS,
  CONTROLEURS_LIST,
} from './mockData';
import { DisclaimerBanner } from './components/DisclaimerBanner';
import { Header } from './components/Header';
import { RoadmapModal } from './components/RoadmapModal';
import { InvoiceDetailModal } from './components/InvoiceDetailModal';
import { InvoiceCreateEditModal } from './components/InvoiceCreateEditModal';
import { InvoicePaymentModal } from './components/InvoicePaymentModal';
import { PaySlipModal } from './components/PaySlipModal';
import { AgentBadgeModal } from './components/AgentBadgeModal';
import { NewReportModal } from './components/NewReportModal';
import { DirectionSpace } from './components/DirectionSpace';
import { ComptabiliteSpace } from './components/ComptabiliteSpace';
import { ControleurSpace } from './components/ControleurSpace';
import { ClientsModule } from './components/ClientsModule';
import { ContratsModule } from './components/ContratsModule';
import { SitesModule } from './components/SitesModule';
import { AgentsModule } from './components/AgentsModule';
import { RapportsModule } from './components/RapportsModule';
import { ParametresModule } from './components/ParametresModule';
import { DocumentsComptablesModule } from './components/DocumentsComptablesModule';
import { Shield, Sparkles, Smartphone, CheckCircle, Info, Lock, AlertTriangle } from 'lucide-react';

export default function App() {
  // Navigation & Role State
  const [currentSpace, setCurrentSpace] = useState<UserSpace>('direction');
  const [currentModule, setCurrentModule] = useState<MainNavModule>('tableau_de_bord');
  const [isMobilePreview, setIsMobilePreview] = useState(false);

  // Active Controller on patrol (Defaults to Lt. Ibrahim Dan-Inna)
  const [activeController, setActiveController] = useState<ControleurProfile>(CONTROLEURS_LIST[0]);

  // Enterprise Settings
  const [settings, setSettings] = useState<EnterpriseSettings>(DEFAULT_ENTERPRISE_SETTINGS);

  // Payroll Validation Workflow State
  // 'En préparation par Comptabilité' -> 'Transmis à la Direction pour validation' -> 'Validé par la Direction' -> 'Salaires payés'
  const [statutPaie, setStatutPaie] = useState<StatutValidationPaie>('Transmis à la Direction pour validation');

  // Storage non-destructive warning state
  const [storageWarning, setStorageWarning] = useState<string | null>(null);

  // Data Store State with LocalStorage Persistence
  const [clients, setClients] = useState<Client[]>(INITIAL_CLIENTS);

  const [contracts, setContracts] = useState<ContratCommercial[]>(() => {
    const res = safeLoadFromStorage<ContratCommercial[]>(STORAGE_KEYS.CONTRACTS, INITIAL_CONTRACTS);
    if (res.error) setStorageWarning(res.error);
    return res.data;
  });

  const [agentContracts, setAgentContracts] = useState<ContratTravailAgent[]>(() => {
    const res = safeLoadFromStorage<ContratTravailAgent[]>(STORAGE_KEYS.AGENT_CONTRACTS, INITIAL_AGENT_CONTRACTS);
    if (res.error) setStorageWarning(res.error);
    return res.data;
  });

  const [sites, setSites] = useState<SiteGardiennage[]>(INITIAL_SITES);
  const [agents, setAgents] = useState<AgentSecurite[]>(INITIAL_AGENTS);

  const [invoices, setInvoices] = useState<FactureMensuelle[]>(() => {
    const res = safeLoadFromStorage<FactureMensuelle[]>(STORAGE_KEYS.INVOICES, INITIAL_INVOICES);
    if (res.error) {
      setStorageWarning(res.error);
      return res.data;
    }
    // Si des données existaient déjà dans le navigateur, vérifier si la facture reconstituée BSIC (FAC-2026-11-BSIC-02)
    // est déjà présente. Si absente, l'ajouter sans doublon.
    if (res.source === 'storage' && Array.isArray(res.data)) {
      const alreadyHasBsic = res.data.some(
        (inv) =>
          inv.numeroFacture === 'FAC-2026-11-BSIC-02' ||
          (inv.contratNumero === 'CTR-2026-BSIC-02' && inv.mois === 'Novembre 2026')
      );
      if (!alreadyHasBsic) {
        const bsicMock = INITIAL_INVOICES.find((i) => i.numeroFacture === 'FAC-2026-11-BSIC-02');
        if (bsicMock) {
          return [bsicMock, ...res.data];
        }
      }
    }
    return res.data;
  });

  const [payslips, setPayslips] = useState<FichePaieAgent[]>(() => {
    const res = safeLoadFromStorage<FichePaieAgent[]>(STORAGE_KEYS.PAYSLIPS, INITIAL_PAYSLIPS);
    if (res.error) setStorageWarning(res.error);
    return res.data;
  });

  const [reports, setReports] = useState<RapportControle[]>(INITIAL_REPORTS);

  // Synchronisation automatique et non destructive dans localStorage
  useEffect(() => {
    safeSaveToStorage(STORAGE_KEYS.INVOICES, invoices);
  }, [invoices]);

  useEffect(() => {
    safeSaveToStorage(STORAGE_KEYS.CONTRACTS, contracts);
  }, [contracts]);

  useEffect(() => {
    safeSaveToStorage(STORAGE_KEYS.AGENT_CONTRACTS, agentContracts);
  }, [agentContracts]);

  useEffect(() => {
    safeSaveToStorage(STORAGE_KEYS.PAYSLIPS, payslips);
  }, [payslips]);

  // Modals
  const [isRoadmapOpen, setIsRoadmapOpen] = useState(false);
  const [isNewReportOpen, setIsNewReportOpen] = useState(false);
  const [reportDefaultSiteId, setReportDefaultSiteId] = useState<string | undefined>(undefined);
  const [selectedInvoice, setSelectedInvoice] = useState<FactureMensuelle | null>(null);
  const [selectedPayslip, setSelectedPayslip] = useState<FichePaieAgent | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<AgentSecurite | null>(null);

  // Invoice creation & payment modal states
  const [isInvoicePaymentModalOpen, setIsInvoicePaymentModalOpen] = useState(false);
  const [invoiceToPay, setInvoiceToPay] = useState<FactureMensuelle | null>(null);
  const [isInvoiceCreateModalOpen, setIsInvoiceCreateModalOpen] = useState(false);
  const [invoiceToEdit, setInvoiceToEdit] = useState<FactureMensuelle | null>(null);

  // Space switcher handler: strictly defaults to allowed primary page
  const handleSelectSpace = (space: UserSpace) => {
    setCurrentSpace(space);
    if (space === 'direction') {
      setCurrentModule('tableau_de_bord');
    } else if (space === 'comptabilite') {
      setCurrentModule('factures');
    } else if (space === 'controleur') {
      setCurrentModule('mes_sites');
    }
  };

  // Payroll workflow handlers
  const handleSavePayslip = (savedSlip: FichePaieAgent, submitForValidation: boolean) => {
    setPayslips((prev) => {
      const existingIdx = prev.findIndex(
        (p) =>
          p.id === savedSlip.id ||
          (p.agentId === savedSlip.agentId && p.mois.trim().toLowerCase() === savedSlip.mois.trim().toLowerCase())
      );
      if (existingIdx >= 0) {
        const next = [...prev];
        next[existingIdx] = savedSlip;
        return next;
      } else {
        return [savedSlip, ...prev];
      }
    });
  };

  const handleConfirmPayslipPayment = (
    id: string,
    paymentData: {
      datePaiement: string;
      montantPaye: number;
      modePaiement: any;
      referencePaiement: string;
    }
  ) => {
    setPayslips((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              statut: 'Payée',
              datePaiement: paymentData.datePaiement,
              montantPaye: paymentData.montantPaye,
              modePaiement: paymentData.modePaiement,
              referencePaiement: paymentData.referencePaiement,
            }
          : p
      )
    );
  };

  const handleValidatePayslip = (id: string, note?: string) => {
    const today = new Date().toISOString().split('T')[0];
    setPayslips((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              statut: 'Validée',
              dateValidation: today,
              commentaireValidation: note || 'Validé sans réserve par la Direction Générale',
              motifRejet: undefined,
            }
          : p
      )
    );
  };

  const handleRejectPayslip = (id: string, motif: string) => {
    setPayslips((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              statut: 'Rejetée',
              motifRejet: motif,
            }
          : p
      )
    );
  };

  const handleSubmitPayslipForValidation = (id: string) => {
    setPayslips((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              statut: 'En attente de validation',
              motifRejet: undefined,
            }
          : p
      )
    );
  };

  const handleTransmitPaieToDirection = () => {
    setStatutPaie('Transmis à la Direction pour validation');
    setPayslips((prev) =>
      prev.map((p) =>
        p.statut === 'Brouillon' || p.statut === 'Rejetée'
          ? { ...p, statut: 'En attente de validation', motifRejet: undefined }
          : p
      )
    );
  };

  const handleValidatePaieByDirection = () => {
    const today = new Date().toISOString().split('T')[0];
    setStatutPaie('Validé par la Direction');
    setPayslips((prev) =>
      prev.map((p) =>
        p.statut === 'En attente de validation'
          ? {
              ...p,
              statut: 'Validée',
              dateValidation: today,
              commentaireValidation: 'Validation globale de l’état de paie par la Direction Générale',
            }
          : p
      )
    );
  };

  const handlePayAllSalaries = () => {
    const today = new Date().toISOString().split('T')[0];
    setStatutPaie('Salaires payés');
    setPayslips((prev) =>
      prev.map((p) =>
        p.statut === 'Validée'
          ? {
              ...p,
              statut: 'Payée',
              datePaiement: today,
              montantPaye: p.netAPayer,
              modePaiement: 'Virement bancaire',
              referencePaiement: `VIR-BSIC-LOT-${Date.now().toString().slice(-4)}`,
            }
          : p
      )
    );
  };

  // Add report handler
  const handleAddReport = (newReport: RapportControle) => {
    setReports((prev) => [newReport, ...prev]);

    // Update corresponding site status
    setSites((prevSites) =>
      prevSites.map((s) => {
        if (s.id === newReport.siteId) {
          return {
            ...s,
            derniereVisiteControle: "À l'instant",
            statutConformite: newReport.incidentSignale ? 'Anomalie signalée' : 'Conforme',
          };
        }
        return s;
      })
    );

    // If agents marked absent, update agent records
    if (newReport.agentsAbsents.length > 0) {
      setAgents((prevAgents) =>
        prevAgents.map((ag) => {
          const isAbsent = newReport.agentsAbsents.some((name) =>
            `${ag.prenom} ${ag.nom}`.toLowerCase().includes(name.toLowerCase())
          );
          if (isAbsent) {
            return { ...ag, statut: 'Absent' };
          }
          return ag;
        })
      );
    }
  };

  // Add client
  const handleAddClient = (newCli: Client) => {
    setClients((prev) => [newCli, ...prev]);
  };

  // Add commercial contract
  const handleAddContract = (newCtr: ContratCommercial) => {
    setContracts((prev) => [newCtr, ...prev]);
  };

  // Add agent employment contract
  const handleAddAgentContract = (newWContract: ContratTravailAgent) => {
    setAgentContracts((prev) => [newWContract, ...prev]);
  };

  // Add site
  const handleAddSite = (newSite: SiteGardiennage) => {
    setSites((prev) => [newSite, ...prev]);
  };

  // Add or Edit agent with AUTOMATIC SYNCHRONIZATION with monthly payroll
  const handleSaveAgent = (savedAgent: AgentSecurite, isEdit: boolean) => {
    if (isEdit) {
      setAgents((prev) =>
        prev.map((ag) => (ag.id === savedAgent.id ? savedAgent : ag))
      );
    } else {
      setAgents((prev) => [savedAgent, ...prev]);
    }

    // Direct synchronization with the monthly payroll (FichePaieAgent) to avoid double entry
    const totalPrimes = savedAgent.primeNuit + savedAgent.indemnitePanier + savedAgent.primeAssiduite;
    const totalBrut = savedAgent.salaireBase + totalPrimes;
    const retenueCNSS = Math.round(totalBrut * 0.0525);
    const netAPayer = Math.max(0, totalBrut - retenueCNSS - savedAgent.retenuesOuAvances);

    setPayslips((prev) => {
      // If agent is marked as "Sorti", remove from current active payroll
      if (savedAgent.statut.includes('Sorti')) {
        return prev.filter(
          (p) => p.agentId !== savedAgent.id && p.agentMatricule !== savedAgent.matricule
        );
      }

      const existingIndex = prev.findIndex(
        (p) => p.agentId === savedAgent.id || p.agentMatricule === savedAgent.matricule
      );

      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          agentMatricule: savedAgent.matricule,
          agentNom: `${savedAgent.prenom} ${savedAgent.nom}`,
          poste: savedAgent.poste,
          salaireBase: savedAgent.salaireBase,
          prime: totalPrimes,
          primeDeNuit: savedAgent.primeNuit,
          primeDePanier: savedAgent.indemnitePanier,
          primeAssiduite: savedAgent.primeAssiduite,
          totalBrut,
          retenueCNSS,
          acompteRetenu: savedAgent.retenuesOuAvances,
          autresRetenues: updated[existingIndex].autresRetenues || 0,
          netAPayer,
        };
        return updated;
      } else {
        const newSlip: FichePaieAgent = {
          id: `pay-2026-10-${savedAgent.id}`,
          agentId: savedAgent.id,
          agentMatricule: savedAgent.matricule,
          agentNom: `${savedAgent.prenom} ${savedAgent.nom}`,
          poste: savedAgent.poste,
          mois: 'Octobre 2026',
          salaireBase: savedAgent.salaireBase,
          prime: totalPrimes,
          primeDeNuit: savedAgent.primeNuit,
          primeDePanier: savedAgent.indemnitePanier,
          primeAssiduite: savedAgent.primeAssiduite,
          totalBrut,
          retenueCNSS,
          acompteRetenu: savedAgent.retenuesOuAvances,
          autresRetenues: 0,
          netAPayer,
          statut: 'Brouillon',
        };
        return [...prev, newSlip];
      }
    });
  };

  // Full synchronization of all active agents into payroll
  const handleSyncAllPayroll = () => {
    setPayslips((prev) => {
      const activeAgents = agents.filter((ag) => !ag.statut.includes('Sorti'));
      return activeAgents.map((ag) => {
        const totalPrimes = ag.primeNuit + ag.indemnitePanier + ag.primeAssiduite;
        const totalBrut = ag.salaireBase + totalPrimes;
        const retenueCNSS = Math.round(totalBrut * 0.0525);
        const netAPayer = Math.max(0, totalBrut - retenueCNSS - ag.retenuesOuAvances);
        const prevSlip = prev.find((p) => p.agentId === ag.id || p.agentMatricule === ag.matricule);
        return {
          id: prevSlip ? prevSlip.id : `pay-2026-10-${ag.id}`,
          agentId: ag.id,
          agentMatricule: ag.matricule,
          agentNom: `${ag.prenom} ${ag.nom}`,
          poste: ag.poste,
          mois: prevSlip ? prevSlip.mois : 'Octobre 2026',
          salaireBase: ag.salaireBase,
          prime: totalPrimes,
          primeDeNuit: ag.primeNuit,
          primeDePanier: ag.indemnitePanier,
          primeAssiduite: ag.primeAssiduite,
          totalBrut,
          retenueCNSS,
          acompteRetenu: ag.retenuesOuAvances,
          autresRetenues: prevSlip?.autresRetenues || 0,
          netAPayer,
          statut: prevSlip ? prevSlip.statut : 'Brouillon',
          datePaiement: prevSlip?.datePaiement,
          montantPaye: prevSlip?.montantPaye,
          modePaiement: prevSlip?.modePaiement,
          referencePaiement: prevSlip?.referencePaiement,
          motifRejet: prevSlip?.motifRejet,
          commentaireValidation: prevSlip?.commentaireValidation,
          dateValidation: prevSlip?.dateValidation,
        };
      });
    });
  };

  // Save or update an invoice (Comptabilité / Direction)
  const handleSaveInvoice = (savedInvoice: FactureMensuelle, isEmit: boolean) => {
    setInvoices((prev) => {
      const existingIdx = prev.findIndex(
        (i) => i.id === savedInvoice.id || i.numeroFacture.trim().toLowerCase() === savedInvoice.numeroFacture.trim().toLowerCase()
      );
      if (existingIdx >= 0) {
        const next = [...prev];
        next[existingIdx] = savedInvoice;
        return next;
      } else {
        return [savedInvoice, ...prev];
      }
    });
  };

  // Save multiple invoices from assisted batch preparation
  const handleSaveMultipleInvoices = (newInvoices: FactureMensuelle[]) => {
    setInvoices((prev) => [...newInvoices, ...prev]);
  };

  // Record an actual total or partial payment on an invoice (Requirement 4, 5, 6, 7, 8)
  const handleConfirmInvoicePayment = (
    invoiceId: string,
    payment: {
      montant: number;
      dateReglement: string;
      modePaiement: any;
      reference?: string;
      note?: string;
    }
  ) => {
    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.id !== invoiceId) return inv;

        const newReglement: ReglementFacture = {
          id: `reg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          dateReglement: payment.dateReglement,
          montant: payment.montant,
          modePaiement: payment.modePaiement,
          reference: payment.reference,
          note: payment.note,
        };

        const existingReglements = inv.reglements || [];
        const updatedReglements = [newReglement, ...existingReglements];

        // Requirement 6: solde restant dû = montant total de la facture - total des encaissements enregistrés
        const totalEncaissements = updatedReglements.reduce((sum, r) => sum + r.montant, 0);
        const nouveauReste = Math.max(0, inv.montantTTC - totalEncaissements);

        // Requirement 7: Si le solde est supérieur à zéro et inférieur au montant total, le statut devient « Partielle »
        // Si le solde est égal à zéro, le statut devient « Payée »
        let newStatus: StatutFacture;
        if (nouveauReste === 0) {
          newStatus = 'Payée';
        } else if (totalEncaissements > 0 && totalEncaissements < inv.montantTTC) {
          newStatus = 'Partielle';
        } else {
          const isOverdue = inv.dateEcheance ? new Date().toISOString().substring(0, 10) > inv.dateEcheance : false;
          newStatus = isOverdue ? 'En retard' : 'À payer';
        }

        return {
          ...inv,
          montantRegle: totalEncaissements,
          resteADevoir: nouveauReste,
          statut: newStatus,
          modePaiement: payment.modePaiement,
          reglements: updatedReglements,
        };
      })
    );
  };

  // Mark invoice as paid: records full remaining payment with receipt
  const handleMarkInvoicePaid = (id: string) => {
    const target = invoices.find((i) => i.id === id);
    if (!target) return;
    const reste = target.resteADevoir !== undefined ? target.resteADevoir : Math.max(0, target.montantTTC - (target.montantRegle || 0));
    handleConfirmInvoicePayment(id, {
      montant: reste > 0 ? reste : target.montantTTC,
      dateReglement: new Date().toISOString().substring(0, 10),
      modePaiement: target.modePaiement || 'Virement bancaire',
      reference: `REG-SOLDE-${Date.now().toString().slice(-4)}`,
      note: 'Règlement total du solde enregistré',
    });
  };

  // Mark payslip as paid individually
  const handleMarkPayslipPaid = (id: string) => {
    const today = new Date().toISOString().split('T')[0];
    setPayslips((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              statut: 'Payée',
              datePaiement: today,
              montantPaye: p.netAPayer,
              modePaiement: p.modePaiement || 'Virement bancaire',
              referencePaiement: p.referencePaiement || `VIR-BSIC-${Date.now().toString().slice(-5)}`,
            }
          : p
      )
    );
  };

  // Save settings
  const handleSaveSettings = (newSettings: EnterpriseSettings) => {
    setSettings(newSettings);
  };

  // Sites assigned to the active controller
  const assignedSites = sites.filter((s) =>
    activeController.sitesAssignesIds.includes(s.id)
  );

  // ACCESS CONTROL GUARD & VIEW ROUTER
  const renderContent = () => {
    // 1. DIRECTION SPACE
    if (currentSpace === 'direction') {
      if (currentModule === 'clients') {
        return <ClientsModule clients={clients} onAddClient={handleAddClient} />;
      }
      if (currentModule === 'contrats') {
        return (
          <ContratsModule
            contracts={contracts}
            agentContracts={agentContracts}
            clients={clients}
            agents={agents}
            onAddContract={handleAddContract}
            onAddAgentContract={handleAddAgentContract}
            onOpenInvoiceForContract={(ctr) => {
              setCurrentModule('factures');
            }}
          />
        );
      }
      if (currentModule === 'sites') {
        return (
          <SitesModule
            sites={sites}
            clients={clients}
            onAddSite={handleAddSite}
            onSelectSiteToInspect={() => {
              setReportDefaultSiteId(undefined);
              setIsNewReportOpen(true);
            }}
          />
        );
      }
      if (currentModule === 'agents') {
        return (
          <AgentsModule
            agents={agents}
            sites={sites}
            onSaveAgent={handleSaveAgent}
            onViewBadge={(ag) => setSelectedAgent(ag)}
            currentSpace={currentSpace}
          />
        );
      }
      if (currentModule === 'factures' || currentModule === 'paie') {
        return (
          <ComptabiliteSpace
            invoices={invoices}
            payslips={payslips}
            agents={agents}
            clients={clients}
            contracts={contracts}
            settings={settings}
            statutPaie={statutPaie}
            currentSpace={currentSpace}
            onTransmitPaieToDirection={handleTransmitPaieToDirection}
            onPayAllSalaries={handlePayAllSalaries}
            onSyncPayrollFromAgents={handleSyncAllPayroll}
            onViewInvoice={(inv) => setSelectedInvoice(inv)}
            onViewPayslip={(slip) => setSelectedPayslip(slip)}
            onMarkInvoicePaid={handleMarkInvoicePaid}
            onMarkPayslipPaid={handleMarkPayslipPaid}
            onSavePayslip={handleSavePayslip}
            onConfirmPayslipPayment={handleConfirmPayslipPayment}
            onValidatePayslip={handleValidatePayslip}
            onRejectPayslip={handleRejectPayslip}
            onSubmitPayslipForValidation={handleSubmitPayslipForValidation}
            onSaveInvoice={handleSaveInvoice}
            onSaveMultipleInvoices={handleSaveMultipleInvoices}
            onConfirmInvoicePayment={handleConfirmInvoicePayment}
          />
        );
      }
      if (currentModule === 'rapports') {
        return (
          <RapportsModule
            reports={reports}
            onOpenNewReport={() => {
              setReportDefaultSiteId(undefined);
              setIsNewReportOpen(true);
            }}
          />
        );
      }
      if (currentModule === 'parametres') {
        return (
          <ParametresModule
            settings={settings}
            onSaveSettings={handleSaveSettings}
          />
        );
      }

      // Default Direction view: Executive dashboard
      return (
        <DirectionSpace
          clients={clients}
          contracts={contracts}
          sites={sites}
          agents={agents}
          invoices={invoices}
          payslips={payslips}
          reports={reports}
          statutPaie={statutPaie}
          onValidatePaieByDirection={handleValidatePaieByDirection}
          onNavigateModule={(mod) => setCurrentModule(mod)}
          onViewInvoice={(inv) => setSelectedInvoice(inv)}
          onViewAgentBadge={(ag) => setSelectedAgent(ag)}
        />
      );
    }

    // 2. COMPTABILITÉ SPACE (Restricted: No clients creation, no contracts, no sites/agents, no company settings)
    if (currentSpace === 'comptabilite') {
      if (
        currentModule === 'clients' ||
        currentModule === 'contrats' ||
        currentModule === 'sites' ||
        currentModule === 'agents' ||
        currentModule === 'parametres'
      ) {
        return (
          <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-4 max-w-lg mx-auto">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Accès Réservé à la Direction</h3>
            <p className="text-xs text-slate-300">
              L'espace Comptabilité ne dispose pas des droits de modification pour les contrats de gardiennage ou les paramètres légaux d'entreprise.
            </p>
            <button
              onClick={() => setCurrentModule('factures')}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold cursor-pointer"
            >
              Retourner à la Facturation
            </button>
          </div>
        );
      }

      if (currentModule === 'documents_comptables') {
        return (
          <DocumentsComptablesModule
            invoices={invoices}
            payslips={payslips}
            settings={settings}
          />
        );
      }

      // Default Comptabilité view
      return (
        <ComptabiliteSpace
          invoices={invoices}
          payslips={payslips}
          agents={agents}
          clients={clients}
          contracts={contracts}
          settings={settings}
          statutPaie={statutPaie}
          currentSpace={currentSpace}
          onTransmitPaieToDirection={handleTransmitPaieToDirection}
          onPayAllSalaries={handlePayAllSalaries}
          onSyncPayrollFromAgents={handleSyncAllPayroll}
          onViewInvoice={(inv) => setSelectedInvoice(inv)}
          onViewPayslip={(slip) => setSelectedPayslip(slip)}
          onMarkInvoicePaid={handleMarkInvoicePaid}
          onMarkPayslipPaid={handleMarkPayslipPaid}
          onSavePayslip={handleSavePayslip}
          onConfirmPayslipPayment={handleConfirmPayslipPayment}
          onValidatePayslip={handleValidatePayslip}
          onRejectPayslip={handleRejectPayslip}
          onSubmitPayslipForValidation={handleSubmitPayslipForValidation}
          onSaveInvoice={handleSaveInvoice}
          onSaveMultipleInvoices={handleSaveMultipleInvoices}
          onConfirmInvoicePayment={handleConfirmInvoicePayment}
        />
      );
    }

    // 3. CONTRÔLEUR TERRAIN SPACE (Strictly isolated: only assigned sites and reports)
    if (currentSpace === 'controleur') {
      if (
        currentModule === 'factures' ||
        currentModule === 'paie' ||
        currentModule === 'clients' ||
        currentModule === 'contrats' ||
        currentModule === 'parametres' ||
        currentModule === 'documents_comptables'
      ) {
        return (
          <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-4 max-w-lg mx-auto">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Accès Confidentiel Verrouillé</h3>
            <p className="text-xs text-slate-300">
              Le profil Contrôleur terrain ne dispose d'aucun accès aux salaires, factures ou finances. Cet espace est dédié exclusivement à vos rondes de contrôle.
            </p>
            <button
              onClick={() => setCurrentModule('mes_sites')}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold cursor-pointer"
            >
              Retourner à Mes Sites Attribués
            </button>
          </div>
        );
      }

      return (
        <ControleurSpace
          sites={sites}
          agents={agents}
          reports={reports}
          activeController={activeController}
          onChangeController={(ctrl) => setActiveController(ctrl)}
          onOpenNewReport={(siteId) => {
            setReportDefaultSiteId(siteId);
            setIsNewReportOpen(true);
          }}
        />
      );
    }

    return null;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
      {/* Top Demo Disclaimer Banner */}
      <DisclaimerBanner onOpenRoadmap={() => setIsRoadmapOpen(true)} />

      {/* Main Header with Strict Role Switcher & Role-Based Navigation */}
      <Header
        currentSpace={currentSpace}
        onSelectSpace={handleSelectSpace}
        currentModule={currentModule}
        onSelectModule={(mod) => setCurrentModule(mod)}
        onOpenRoadmap={() => setIsRoadmapOpen(true)}
        isMobilePreview={isMobilePreview}
        onToggleMobilePreview={() => setIsMobilePreview(!isMobilePreview)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {storageWarning && (
          <div className="mb-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start justify-between gap-3 animate-in fade-in">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-300">Avertissement de persistance locale :</p>
                <p className="mt-0.5 text-amber-200/90 leading-relaxed">{storageWarning}</p>
                <p className="mt-1 text-[11px] text-amber-400/80">
                  Vos données existantes ont été protégées et n'ont pas été effacées.
                </p>
              </div>
            </div>
            <button
              onClick={() => setStorageWarning(null)}
              className="text-amber-400 hover:text-white px-2 py-1 rounded bg-amber-500/20 text-xs font-semibold shrink-0 cursor-pointer"
            >
              Fermer
            </button>
          </div>
        )}
        {isMobilePreview ? (
          <div className="flex flex-col items-center justify-center py-4">
            <div className="mb-3 text-xs text-slate-400 flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-emerald-400" />
              <span>
                Simulateur smartphone Android (Largeur 400px) • Idéal pour tester la vue Contrôleur terrain
              </span>
            </div>
            <div className="w-full max-w-[420px] bg-slate-900 border-4 border-slate-700 rounded-[38px] p-3 shadow-2xl shadow-emerald-950/40 overflow-hidden min-h-[750px]">
              <div className="w-24 h-4 bg-slate-800 mx-auto rounded-full mb-3"></div>
              <div className="overflow-y-auto max-h-[700px] scrollbar-thin pr-1">
                {renderContent()}
              </div>
            </div>
          </div>
        ) : (
          renderContent()
        )}
      </main>

      {/* Corporate & Legal Footer */}
      <footer className="bg-slate-900/90 border-t border-slate-800 text-xs text-slate-400 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-slate-200">
                {settings.raisonSociale} • Niamey, République du Niger
              </p>
              <p className="text-[11px] text-slate-500">
                Agrément Ministère de l'Intérieur • NIF: {settings.nif} • RCCM: {settings.rccm}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 text-[11px]">
            <span className="text-slate-400">Cloisonnement des 3 rôles simulé</span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-400">0 service payant actif</span>
            <span className="text-slate-600">•</span>
            <button
              onClick={() => setIsRoadmapOpen(true)}
              className="text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer underline underline-offset-2"
            >
              Prochaines étapes vers la production
            </button>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <RoadmapModal
        isOpen={isRoadmapOpen}
        onClose={() => setIsRoadmapOpen(false)}
      />

      <InvoiceDetailModal
        invoice={selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
        onRecordPayment={(inv) => {
          setInvoiceToPay(inv);
          setIsInvoicePaymentModalOpen(true);
        }}
        onEditDraft={(inv) => {
          setInvoiceToEdit(inv);
          setIsInvoiceCreateModalOpen(true);
        }}
        settings={settings}
      />

      <InvoiceCreateEditModal
        isOpen={isInvoiceCreateModalOpen}
        onClose={() => {
          setIsInvoiceCreateModalOpen(false);
          setInvoiceToEdit(null);
        }}
        invoiceToEdit={invoiceToEdit}
        clients={clients}
        contracts={contracts}
        existingInvoices={invoices}
        settings={settings}
        onSave={handleSaveInvoice}
      />

      <InvoicePaymentModal
        isOpen={isInvoicePaymentModalOpen}
        onClose={() => {
          setIsInvoicePaymentModalOpen(false);
          setInvoiceToPay(null);
        }}
        invoice={invoiceToPay}
        availableInvoices={invoices}
        onConfirmPayment={handleConfirmInvoicePayment}
      />

      <PaySlipModal
        payslip={selectedPayslip}
        onClose={() => setSelectedPayslip(null)}
        onMarkAsPaid={handleMarkPayslipPaid}
        settings={settings}
        canPay={currentSpace === 'comptabilite' && selectedPayslip?.statut === 'Validée'}
      />

      <AgentBadgeModal
        agent={selectedAgent}
        onClose={() => setSelectedAgent(null)}
      />

      <NewReportModal
        isOpen={isNewReportOpen}
        onClose={() => {
          setIsNewReportOpen(false);
          setReportDefaultSiteId(undefined);
        }}
        sites={currentSpace === 'controleur' ? assignedSites : sites}
        agents={agents}
        onSubmitReport={handleAddReport}
        currentControllerName={currentSpace === 'controleur' ? activeController.nom : 'Superviseur Général (Direction)'}
        defaultSiteId={reportDefaultSiteId}
      />
    </div>
  );
}
