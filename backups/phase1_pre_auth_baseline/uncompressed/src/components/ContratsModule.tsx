import React, { useState, useMemo } from 'react';
import {
  FileText,
  Shield,
  Calendar,
  Users,
  Plus,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Clock,
  DollarSign,
  Building,
  Briefcase,
  Layers,
  ArrowRight,
  Send,
  CreditCard,
  UserCheck,
  Check,
  X,
  Info,
  Car,
  BellRing,
} from 'lucide-react';
import {
  ContratCommercial,
  ContratTravailAgent,
  Client,
  AgentSecurite,
  TypePrestationCommerciale,
  ModeFacturationCommercial,
  StatutContratCommercial,
  TypeContratTravail,
  StatutContratTravail,
} from '../types';
import { calculateContractDuration, checkAgentContractExpiration } from '../utils/contractUtils';

interface ContratsModuleProps {
  contracts: ContratCommercial[];
  agentContracts: ContratTravailAgent[];
  clients: Client[];
  agents: AgentSecurite[];
  onAddContract: (contract: ContratCommercial) => void;
  onAddAgentContract: (agentContract: ContratTravailAgent) => void;
  onOpenInvoiceForContract?: (contract: ContratCommercial) => void;
}

export const ContratsModule: React.FC<ContratsModuleProps> = ({
  contracts,
  agentContracts,
  clients,
  agents,
  onAddContract,
  onAddAgentContract,
  onOpenInvoiceForContract,
}) => {
  // Main separation of the 2 contract categories
  const [activeTab, setActiveTab] = useState<'commerciaux' | 'travail'>('commerciaux');

  // Commercial Contracts Filter & Modal state
  const [commercialFilterPrestation, setCommercialFilterPrestation] = useState<string>('tous');
  const [commercialFilterStatut, setCommercialFilterStatut] = useState<string>('tous');
  const [isCommercialModalOpen, setIsCommercialModalOpen] = useState(false);

  // Commercial Form State
  const [cClientId, setCClientId] = useState(clients[0]?.id || '');
  const [cSiteNom, setCSiteNom] = useState('');
  const [cTypePrestation, setCTypePrestation] = useState<TypePrestationCommerciale>(
    'Prestation de gardiennage poste fixe 24/7'
  );
  const [cDescription, setCDescription] = useState('');
  const [cDateDebut, setCDateDebut] = useState('2026-11-01');
  const [cDateFin, setCDateFin] = useState('2027-10-31');
  const [cNombreAgents, setCNombreAgents] = useState(4);
  const [cHorairesService, setCHorairesService] = useState('24h/24 (Jour & Nuit)');
  const [cMontantFCFA, setCMontantFCFA] = useState(900000);
  const [cModeFacturation, setCModeFacturation] = useState<ModeFacturationCommercial>('Mensuel');
  const [cConditionsPaiement, setCConditionsPaiement] = useState(
    'Règlement à 30 jours date de facture par virement'
  );
  const [cEstRenouvelable, setCEstRenouvelable] = useState(true);
  const [cDateRenouvellement, setCDateRenouvellement] = useState('2027-09-30');
  const [cStatut, setCStatut] = useState<StatutContratCommercial>('Actif');
  const [cSuperviseur, setCSuperviseur] = useState('Lt. Ibrahim Dan-Inna');

  // Calculated duration live in commercial form
  const cLiveDuration = useMemo(
    () => calculateContractDuration(cDateDebut, cDateFin),
    [cDateDebut, cDateFin]
  );

  // Agent Employment Contracts Filter & Modal state
  const [agentContractFilterType, setAgentContractFilterType] = useState<string>('tous');
  const [agentContractFilterAlerte, setAgentContractFilterAlerte] = useState<boolean>(false);
  const [isAgentContractModalOpen, setIsAgentContractModalOpen] = useState(false);

  // Agent Employment Contract Form State
  const [wAgentId, setWAgentId] = useState(agents[0]?.id || '');
  const [wTypeContrat, setWTypeContrat] = useState<TypeContratTravail>('CDD');
  const [wDateDebut, setWDateDebut] = useState('2026-11-01');
  const [wDateFin, setWDateFin] = useState<string>('2027-04-30'); // 6 mois par défaut si CDD
  const [wSalaireBase, setWSalaireBase] = useState(agents[0]?.salaireBase || 85000);
  const [wPrimeAssiduite, setWPrimeAssiduite] = useState(15000);
  const [wPrimeNuit, setWPrimeNuit] = useState(0);
  const [wIndemnitePanier, setWIndemnitePanier] = useState(15000);
  const [wModePaiement, setWModePaiement] = useState<ContratTravailAgent['modePaiement']>(
    'Virement bancaire'
  );
  const [wReferencePaiement, setWReferencePaiement] = useState('');
  const [wSiteAffectation, setWSiteAffectation] = useState('Siège Principal BSIC Plateau');
  const [wStatut, setWStatut] = useState<StatutContratTravail>('Actif');
  const [wNotes, setWNotes] = useState('');

  // Calculated duration live in employment form
  const wLiveDuration = useMemo(() => {
    if (wTypeContrat === 'CDI' && !wDateFin) {
      return 'Durée indéterminée (CDI)';
    }
    return calculateContractDuration(wDateDebut, wDateFin);
  }, [wTypeContrat, wDateDebut, wDateFin]);

  const formatFCFA = (val: number) => new Intl.NumberFormat('fr-FR').format(val) + ' FCFA';

  // Handle selecting an agent in employment modal: auto fill salary and info
  const handleSelectAgentForContract = (agentId: string) => {
    setWAgentId(agentId);
    const ag = agents.find((a) => a.id === agentId);
    if (ag) {
      setWSalaireBase(ag.salaireBase);
      setWPrimeAssiduite(ag.primeAssiduite);
      setWPrimeNuit(ag.primeNuit);
      setWIndemnitePanier(ag.indemnitePanier);
      setWModePaiement(ag.modePaiement);
      setWReferencePaiement(ag.referencePaiement || '');
      setWSiteAffectation(ag.siteActuel);
    }
  };

  // Submit Commercial Contract
  const handleCreateCommercialContract = (e: React.FormEvent) => {
    e.preventDefault();
    const selClient = clients.find((c) => c.id === cClientId) || clients[0];

    const newCtr: ContratCommercial = {
      id: `ct-${Date.now()}`,
      numeroContrat: `CTR-2026-${cTypePrestation.includes('Escorte') ? 'ESC' : 'COM'}-${Math.floor(
        100 + Math.random() * 900
      )}`,
      clientId: selClient.id,
      clientNom: selClient.nom,
      siteNom: cSiteNom || `Site ${selClient.nom}`,
      typePrestation: cTypePrestation,
      descriptionPrestation:
        cDescription ||
        `${cTypePrestation} pour ${selClient.nom} sur le site de ${cSiteNom || 'Niamey'}.`,
      dateDebut: cDateDebut || '2026-11-01',
      dateFin: cDateFin || undefined,
      dureeCalculee: cLiveDuration,
      nombreAgents: Number(cNombreAgents) || 4,
      horairesService: cHorairesService,
      montantFCFA: Number(cMontantFCFA) || 900000,
      montantMensuelHT: Number(cMontantFCFA) || 900000,
      modeFacturation: cModeFacturation,
      conditionsPaiement: cConditionsPaiement,
      estRenouvelable: cEstRenouvelable,
      dateRenouvellement: cEstRenouvelable ? cDateRenouvellement : undefined,
      statut: cStatut,
      superviseurZone: cSuperviseur,
      typeGarde: '24h/24 (Jour & Nuit)',
      effectifVigiles: Number(cNombreAgents) || 4,
      frequenceFacturation: cModeFacturation === 'Mensuel' ? 'Mensuelle' : undefined,
    };

    onAddContract(newCtr);
    setIsCommercialModalOpen(false);
    setCSiteNom('');
    setCDescription('');
  };

  // Submit Agent Employment Contract
  const handleCreateAgentContract = (e: React.FormEvent) => {
    e.preventDefault();
    const selAgent = agents.find((a) => a.id === wAgentId) || agents[0];

    // Evaluate expiration info
    const expirationInfo = checkAgentContractExpiration(wTypeContrat === 'CDD' ? wDateFin : undefined);

    const newWContract: ContratTravailAgent = {
      id: `cta-${Date.now()}`,
      numeroContrat: `CT-${wTypeContrat}-2026-${Math.floor(100 + Math.random() * 900)}`,
      agentId: selAgent.id,
      agentMatricule: selAgent.matricule,
      agentNom: selAgent.nom,
      agentPrenom: selAgent.prenom,
      poste: selAgent.poste,
      typeContrat: wTypeContrat,
      dateDebut: wDateDebut,
      dateFin: wTypeContrat === 'CDD' ? wDateFin : undefined,
      dureeCalculee: wLiveDuration,
      salaireBase: Number(wSalaireBase) || 85000,
      primeAssiduite: Number(wPrimeAssiduite) || 0,
      primeNuit: Number(wPrimeNuit) || 0,
      indemnitePanier: Number(wIndemnitePanier) || 0,
      modePaiement: wModePaiement,
      referencePaiement: wReferencePaiement,
      siteAffectation: wSiteAffectation || selAgent.siteActuel,
      statut: wStatut,
      alerteExpiration: {
        estExpire: expirationInfo.estExpire,
        joursRestants: expirationInfo.joursRestants,
        message: expirationInfo.message,
      },
      notes: wNotes || (wTypeContrat === 'CDI' ? 'Contrat à durée indéterminée.' : 'Contrat CDD sans renouvellement tacite.'),
    };

    onAddAgentContract(newWContract);
    setIsAgentContractModalOpen(false);
    setWNotes('');
  };

  // Filtered Commercial Contracts
  const filteredCommercialContracts = contracts.filter((c) => {
    if (commercialFilterPrestation !== 'tous' && !c.typePrestation.toLowerCase().includes(commercialFilterPrestation.toLowerCase())) {
      return false;
    }
    if (commercialFilterStatut !== 'tous') {
      if (commercialFilterStatut === 'Actif' && (c.statut === 'Actif' || c.statut === 'En cours')) return true;
      if (commercialFilterStatut === 'En attente' && (c.statut === 'En attente de signature' || c.statut === 'À renouveler')) return true;
      return c.statut === commercialFilterStatut;
    }
    return true;
  });

  // Filtered Agent Contracts
  const filteredAgentContracts = agentContracts.filter((ac) => {
    if (agentContractFilterType !== 'tous' && ac.typeContrat !== agentContractFilterType) {
      return false;
    }
    if (agentContractFilterAlerte) {
      const exp = checkAgentContractExpiration(ac.dateFin);
      return exp.estEnAlerte;
    }
    return true;
  });

  // Expiring Agent Contracts Count
  const expiringAgentContracts = agentContracts.filter((ac) => {
    if (ac.typeContrat !== 'CDD' || !ac.dateFin) return false;
    const exp = checkAgentContractExpiration(ac.dateFin);
    return exp.estEnAlerte && ac.statut === 'Actif';
  });

  // KPIs
  const totalCommercialMonthlyCA = contracts
    .filter((c) => (c.statut === 'Actif' || c.statut === 'En cours') && (!c.modeFacturation || c.modeFacturation === 'Mensuel'))
    .reduce((acc, c) => acc + (c.montantFCFA || c.montantMensuelHT), 0);

  const totalPonctuelForfaits = contracts
    .filter((c) => c.modeFacturation === 'Forfait unique' || c.typePrestation.includes('Escorte') || c.typePrestation.includes('Événementiel'))
    .reduce((acc, c) => acc + (c.montantFCFA || c.montantMensuelHT), 0);

  const totalCDICount = agentContracts.filter((a) => a.typeContrat === 'CDI').length;
  const totalCDDCount = agentContracts.filter((a) => a.typeContrat === 'CDD').length;

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Top Banner & Category Switcher (Requirement 1) */}
      <div className="p-5 sm:p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Direction Juridique & RH
              </span>
              <span className="text-xs text-slate-400">Niamey • Gestion Intégrale des Contrats</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white mt-1.5 flex items-center gap-2.5">
              <span>Gestion Distincte des Contrats</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-3xl">
              Séparation stricte entre les <strong className="text-white">contrats commerciaux clients</strong> (gardiennage, escortes, forfaits) et les <strong className="text-white">contrats de travail des agents</strong> (CDI sans fin ou CDD avec alertes d'échéance).
            </p>
          </div>

          {/* Sub-tab Switcher: Commercial vs Agent Employment */}
          <div className="flex items-center p-1.5 rounded-2xl bg-slate-800 border border-slate-700 shrink-0">
            <button
              onClick={() => setActiveTab('commerciaux')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === 'commerciaux'
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Briefcase className="w-4 h-4" />
              <span>1. Contrats Commerciaux Clients ({contracts.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('travail')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer relative ${
                activeTab === 'travail'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Shield className="w-4 h-4" />
              <span>2. Contrats de Travail Agents ({agentContracts.length})</span>
              {expiringAgentContracts.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping absolute -top-1 -right-1" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================================= */}
      {/* CATEGORY 1: CONTRATS COMMERCIAUX AVEC LES CLIENTS (Requirement 1 & 2)                      */}
      {/* ========================================================================================= */}
      {activeTab === 'commerciaux' && (
        <div className="space-y-6">
          {/* Commercial KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-slate-400 text-xs font-semibold">Total Contrats Commerciaux</span>
              <p className="text-2xl font-black text-white mt-1.5">{contracts.length}</p>
              <p className="text-[11px] text-slate-400 mt-1">Prestations actives, forfaits et escortes</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-slate-400 text-xs font-semibold">Facturation Mensuelle Récurrente</span>
              <p className="text-xl sm:text-2xl font-black text-emerald-400 mt-1.5">
                {formatFCFA(totalCommercialMonthlyCA)}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Éligible à la facturation assistée par lot</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-slate-400 text-xs font-semibold">Escortes & Prestations Forfaitaires</span>
              <p className="text-xl sm:text-2xl font-black text-blue-400 mt-1.5">
                {formatFCFA(totalPonctuelForfaits)}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Facturation ponctuelle à l'acte</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-slate-400 text-xs font-semibold">Postes Vigiles Contractualisés</span>
              <p className="text-2xl font-black text-purple-400 mt-1.5">
                {contracts.reduce((acc, c) => acc + (c.nombreAgents || c.effectifVigiles || 4), 0)} vigiles
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Mobilisés sur sites et convois</p>
            </div>
          </div>

          {/* Action bar & Filters */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-emerald-400" />
                  <span>Contrats Commerciaux Clients</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Gardiennage fixe 24/7, escortes sécurisées, surveillance ponctuelle et cortèges d'intervention
                </p>
              </div>

              <button
                onClick={() => setIsCommercialModalOpen(true)}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-emerald-900/30"
              >
                <Plus className="w-4 h-4" />
                <span>Nouveau Contrat Commercial</span>
              </button>
            </div>

            {/* Filter pills */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                {[
                  { id: 'tous', label: 'Toutes les prestations' },
                  { id: 'gardiennage', label: 'Gardiennage fixe 24/7' },
                  { id: 'escorte', label: 'Escortes & Cortèges' },
                  { id: 'surveillance', label: 'Surveillance ponctuelle' },
                  { id: 'événementiel', label: 'Événementiel' },
                  { id: 'rapprochée', label: 'Sécurité VIP' },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setCommercialFilterPrestation(f.id)}
                    className={`px-3 py-1.5 rounded-xl font-semibold transition cursor-pointer whitespace-nowrap ${
                      commercialFilterPrestation === f.id
                        ? 'bg-slate-700 text-white border border-slate-600'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="ml-auto flex items-center gap-2 text-xs">
                <span className="text-slate-400 font-medium">Statut :</span>
                <select
                  value={commercialFilterStatut}
                  onChange={(e) => setCommercialFilterStatut(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1 text-white text-xs focus:outline-none"
                >
                  <option value="tous">Tous les statuts</option>
                  <option value="Actif">Actif</option>
                  <option value="En attente">En attente de signature</option>
                  <option value="Suspendu">Suspendu</option>
                  <option value="Terminé">Terminé</option>
                  <option value="Résilié">Résilié</option>
                </select>
              </div>
            </div>

            {/* Commercial Contracts Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-slate-800/40">
                    <th className="py-2.5 px-3">Réf & Prestation</th>
                    <th className="py-2.5 px-3">Client & Site</th>
                    <th className="py-2.5 px-3">Durée & Période</th>
                    <th className="py-2.5 px-3 text-center">Agents & Horaires</th>
                    <th className="py-2.5 px-3 text-right">Montant FCFA</th>
                    <th className="py-2.5 px-3">Mode Facturation</th>
                    <th className="py-2.5 px-3">Paiement</th>
                    <th className="py-2.5 px-3 text-center">Renouvelable</th>
                    <th className="py-2.5 px-3 text-center">Statut</th>
                    <th className="py-2.5 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {filteredCommercialContracts.map((c) => {
                    const isForfait = c.modeFacturation === 'Forfait unique';
                    const isEscorte = c.typePrestation.includes('Escorte');

                    return (
                      <tr key={c.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-3 px-3">
                          <span className="font-mono font-bold text-emerald-400 block">
                            {c.numeroContrat}
                          </span>
                          <span className="font-semibold text-white block mt-0.5">
                            {c.typePrestation}
                          </span>
                          <span className="text-[11px] text-slate-400 line-clamp-1">
                            {c.descriptionPrestation}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <strong className="text-white block">{c.clientNom}</strong>
                          <span className="text-slate-400 text-[11px] flex items-center gap-1 mt-0.5">
                            <span>Site :</span> {c.siteNom}
                          </span>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded font-mono font-bold text-[11px] bg-slate-800 text-slate-200 border border-slate-700 block w-max">
                            {c.dureeCalculee || calculateContractDuration(c.dateDebut, c.dateFin)}
                          </span>
                          <span className="text-[11px] text-slate-400 block mt-1">
                            {c.dateDebut} → {c.dateFin || 'Indéterminée'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <span className="font-bold text-white block">
                            {c.nombreAgents || c.effectifVigiles || 4} agent(s)
                          </span>
                          <span className="text-[11px] text-slate-400 block mt-0.5">
                            {c.horairesService}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-black text-white whitespace-nowrap">
                          {formatFCFA(c.montantFCFA || c.montantMensuelHT)}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              isForfait
                                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            }`}
                          >
                            {c.modeFacturation || 'Mensuel'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-[11px] text-slate-300 max-w-[150px]">
                          {c.conditionsPaiement}
                        </td>
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          {c.estRenouvelable ? (
                            <span className="text-emerald-400 font-semibold text-[11px] flex items-center justify-center gap-1">
                              <Check className="w-3.5 h-3.5" />
                              <span>Oui ({c.dateRenouvellement || 'Reconduction'})</span>
                            </span>
                          ) : (
                            <span className="text-slate-500 text-[11px]">Non</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                              c.statut === 'Actif' || c.statut === 'En cours'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : c.statut === 'En attente de signature' || c.statut === 'À renouveler'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : c.statut === 'Suspendu'
                                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            }`}
                          >
                            {c.statut}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          {onOpenInvoiceForContract && (
                            <button
                              onClick={() => onOpenInvoiceForContract(c)}
                              className="px-2.5 py-1 rounded-lg bg-blue-600/30 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/40 text-[11px] font-bold transition cursor-pointer"
                              title="Émettre directement une facture pour cette prestation"
                            >
                              Facturer
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================================= */}
      {/* CATEGORY 2: CONTRATS DE TRAVAIL DES AGENTS (RH & EMPLOI) (Requirement 1 & 3)               */}
      {/* ========================================================================================= */}
      {activeTab === 'travail' && (
        <div className="space-y-6">
          {/* Expiration Alert Banner (Requirement 3: Alerte avant expiration sans renouvellement automatique) */}
          {expiringAgentContracts.length > 0 && (
            <div className="p-4 sm:p-5 rounded-2xl bg-amber-950/40 border border-amber-500/50 shadow-lg text-amber-200 text-xs sm:text-sm space-y-2 animate-in fade-in">
              <div className="flex items-center gap-2.5 font-bold text-amber-300 text-base">
                <BellRing className="w-5 h-5 text-amber-400 animate-pulse" />
                <span>
                  Alerte Échéance RH : {expiringAgentContracts.length} contrat(s) de travail arrivent à expiration
                </span>
              </div>
              <p className="leading-relaxed">
                <strong className="text-white">Principe légal impératif :</strong> Aucun contrat de travail (CDD) ne fait l'objet d'un renouvellement automatique. Une décision formelle de la Direction Générale et un avenant écrit ou passage en CDI sont obligatoires avant le terme contractuel.
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {expiringAgentContracts.map((ac) => (
                  <span
                    key={ac.id}
                    className="px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 font-mono text-xs text-amber-100 font-bold"
                  >
                    {ac.agentNom} {ac.agentPrenom} ({ac.numeroContrat}) - Échéance : {ac.dateFin}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Agent Contracts KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-slate-400 text-xs font-semibold">Total Agents sous Contrat</span>
              <p className="text-2xl font-black text-white mt-1.5">{agentContracts.length}</p>
              <p className="text-[11px] text-slate-400 mt-1">Effectif sécuritaire enregistré</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-slate-400 text-xs font-semibold">Contrats CDI (Durée Indéterminée)</span>
              <p className="text-2xl font-black text-emerald-400 mt-1.5">{totalCDICount}</p>
              <p className="text-[11px] text-slate-400 mt-1">Sans date de fin (Permanents)</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-slate-400 text-xs font-semibold">Contrats CDD en cours</span>
              <p className="text-2xl font-black text-blue-400 mt-1.5">{totalCDDCount}</p>
              <p className="text-[11px] text-slate-400 mt-1">À terme fixe avec durée calculée</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-slate-400 text-xs font-semibold">Alertes Expiration (&lt; 45j)</span>
              <p className="text-2xl font-black text-amber-400 mt-1.5">
                {expiringAgentContracts.length}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Action RH requise sans reconduction tacite</p>
            </div>
          </div>

          {/* Action bar & Filters */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <Shield className="w-5 h-5 text-blue-400" />
                  <span>Contrats de Travail des Agents de Sécurité</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Gestion des contrats d'embauche, calculs de durée, conformité salariale liée à la paie et suivi rigoureux des termes
                </p>
              </div>

              <button
                onClick={() => setIsAgentContractModalOpen(true)}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-blue-900/30"
              >
                <Plus className="w-4 h-4" />
                <span>Nouveau Contrat de Travail</span>
              </button>
            </div>

            {/* Filter pills */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                {[
                  { id: 'tous', label: `Tous les contrats (${agentContracts.length})` },
                  { id: 'CDI', label: `CDI Permanents (${totalCDICount})` },
                  { id: 'CDD', label: `CDD à terme (${totalCDDCount})` },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => {
                      setAgentContractFilterType(f.id);
                      setAgentContractFilterAlerte(false);
                    }}
                    className={`px-3 py-1.5 rounded-xl font-semibold transition cursor-pointer whitespace-nowrap ${
                      agentContractFilterType === f.id && !agentContractFilterAlerte
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}

                <button
                  onClick={() => setAgentContractFilterAlerte(!agentContractFilterAlerte)}
                  className={`px-3 py-1.5 rounded-xl font-semibold transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                    agentContractFilterAlerte
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'bg-slate-800 text-amber-300 hover:text-white'
                  }`}
                >
                  <BellRing className="w-3.5 h-3.5" />
                  <span>Alertes Expiration ({expiringAgentContracts.length})</span>
                </button>
              </div>
            </div>

            {/* Agent Employment Contracts Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-slate-800/40">
                    <th className="py-2.5 px-3">Réf Contrat & Matricule</th>
                    <th className="py-2.5 px-3">Agent & Poste</th>
                    <th className="py-2.5 px-3 text-center">Type Contrat</th>
                    <th className="py-2.5 px-3">Date Embauche</th>
                    <th className="py-2.5 px-3">Échéance & Durée</th>
                    <th className="py-2.5 px-3">Alerte Échéance RH</th>
                    <th className="py-2.5 px-3 text-right">Salaire Base (FCFA)</th>
                    <th className="py-2.5 px-3">Primes Liées</th>
                    <th className="py-2.5 px-3">Paiement</th>
                    <th className="py-2.5 px-3 text-center">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {filteredAgentContracts.map((ac) => {
                    const isCDI = ac.typeContrat === 'CDI';
                    const expInfo = checkAgentContractExpiration(ac.dateFin);

                    return (
                      <tr key={ac.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-3 px-3">
                          <span className="font-mono font-bold text-blue-400 block">
                            {ac.numeroContrat}
                          </span>
                          <span className="font-mono text-[11px] text-slate-400 block mt-0.5">
                            Matricule : {ac.agentMatricule}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <strong className="text-white block font-bold">
                            {ac.agentNom} {ac.agentPrenom}
                          </strong>
                          <span className="text-[11px] text-slate-400 block mt-0.5">
                            {ac.poste} • {ac.siteAffectation}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider ${
                              isCDI
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            }`}
                          >
                            {ac.typeContrat}
                          </span>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap font-mono text-slate-300">
                          {ac.dateDebut}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          {isCDI && !ac.dateFin ? (
                            <span className="text-emerald-300 font-semibold text-[11px]">
                              Sans date de fin (CDI Permanent)
                            </span>
                          ) : (
                            <div>
                              <span className="font-mono text-white block">{ac.dateFin}</span>
                              <span className="text-[10px] text-slate-400 block">
                                {ac.dureeCalculee || calculateContractDuration(ac.dateDebut, ac.dateFin)}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-[11px]">
                          {isCDI ? (
                            <span className="text-slate-400">CDI sans échéance</span>
                          ) : expInfo.estExpire ? (
                            <span className="px-2 py-0.5 rounded font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1 w-max">
                              <AlertCircle className="w-3.5 h-3.5" />
                              <span>Expiré ({expInfo.joursRestants}j)</span>
                            </span>
                          ) : expInfo.estEnAlerte ? (
                            <span className="px-2 py-0.5 rounded font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1 w-max">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              <span>{expInfo.joursRestants} jours restants</span>
                            </span>
                          ) : (
                            <span className="text-emerald-400">
                              Valide ({expInfo.joursRestants}j)
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-black text-white whitespace-nowrap">
                          {formatFCFA(ac.salaireBase)}
                        </td>
                        <td className="py-3 px-3 text-[11px] text-slate-300 whitespace-nowrap">
                          <span>+ {formatFCFA((ac.primeAssiduite || 0) + (ac.primeNuit || 0) + (ac.indemnitePanier || 0))}</span>
                        </td>
                        <td className="py-3 px-3 text-[11px] text-slate-400 whitespace-nowrap">
                          {ac.modePaiement}
                        </td>
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                              ac.statut === 'Actif'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : ac.statut === 'En attente de signature'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : ac.statut === 'Terminé'
                                ? 'bg-slate-700 text-slate-300'
                                : 'bg-rose-500/20 text-rose-300'
                            }`}
                          >
                            {ac.statut}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================================= */}
      {/* MODAL 1: NOUVEAU CONTRAT COMMERCIAL CLIENT (Requirement 2)                                 */}
      {/* ========================================================================================= */}
      {isCommercialModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-2xl my-6 flex flex-col max-h-[92vh] shadow-2xl overflow-hidden animate-in fade-in">
            {/* Modal Header */}
            <div className="p-5 bg-slate-850 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">
                    Nouveau Contrat Commercial Client
                  </h3>
                  <p className="text-xs text-slate-400">
                    Gardiennage récurrent, escorte, sécurité événementielle ou forfait ponctuel
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCommercialModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateCommercialContract} className="p-5 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Client Bénéficiaire *</label>
                  <select
                    value={cClientId}
                    onChange={(e) => setCClientId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  >
                    {clients.map((cli) => (
                      <option key={cli.id} value={cli.id}>
                        {cli.nom} ({cli.secteur})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Site ou Itinéraire concerné *</label>
                  <input
                    type="text"
                    required
                    value={cSiteNom}
                    onChange={(e) => setCSiteNom(e.target.value)}
                    placeholder="Ex: Siège Social, Convoi Niamey-Dosso..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Type de Prestation de Sécurité *</label>
                <select
                  value={cTypePrestation}
                  onChange={(e) => {
                    const val = e.target.value as TypePrestationCommerciale;
                    setCTypePrestation(val);
                    if (val.includes('Escorte') || val.includes('Événementiel')) {
                      setCModeFacturation('Forfait unique');
                      setCEstRenouvelable(false);
                    } else {
                      setCModeFacturation('Mensuel');
                      setCEstRenouvelable(true);
                    }
                  }}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium"
                >
                  <option value="Prestation de gardiennage poste fixe 24/7">
                    Prestation de gardiennage poste fixe 24/7
                  </option>
                  <option value="Escorte & Cortège sécurisé">
                    Escorte & Cortège sécurisé (Transport / Convoi)
                  </option>
                  <option value="Gardiennage événementiel & renfort">
                    Gardiennage événementiel & renfort (Festival, Foire, Assemblée)
                  </option>
                  <option value="Surveillance ponctuelle">
                    Surveillance ponctuelle (Missions de courte durée)
                  </option>
                  <option value="Sécurité rapprochée / VIP">
                    Sécurité rapprochée / VIP (Protection de personnalités)
                  </option>
                  <option value="Mise à disposition d’agents de sécurité">
                    Mise à disposition d’agents de sécurité
                  </option>
                  <option value="Autre prestation de sécurité">Autre prestation de sécurité</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Description détaillée de la prestation</label>
                <textarea
                  rows={2}
                  value={cDescription}
                  onChange={(e) => setCDescription(e.target.value)}
                  placeholder="Préciser les consignes, armement, liaison radio ou véhicules..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Date de début *</label>
                  <input
                    type="date"
                    required
                    value={cDateDebut}
                    onChange={(e) => setCDateDebut(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Date de fin (laisser vide si indéterminé)
                  </label>
                  <input
                    type="date"
                    value={cDateFin}
                    onChange={(e) => setCDateFin(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              {/* Automatic duration calculation box */}
              <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-between">
                <span className="text-slate-400 font-medium">Durée calculée automatiquement :</span>
                <span className="font-mono font-bold text-emerald-400 text-xs">
                  {cLiveDuration}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Effectif Vigiles / Agents *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={cNombreAgents}
                    onChange={(e) => setCNombreAgents(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Horaires de service</label>
                  <input
                    type="text"
                    value={cHorairesService}
                    onChange={(e) => setCHorairesService(e.target.value)}
                    placeholder="Ex: 24h/24, 08h-18h, Nuit..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Montant en FCFA *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={cMontantFCFA}
                    onChange={(e) => setCMontantFCFA(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Mode de facturation *</label>
                  <select
                    value={cModeFacturation}
                    onChange={(e) => setCModeFacturation(e.target.value as ModeFacturationCommercial)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium"
                  >
                    <option value="Mensuel">Mensuel (Standard mensuel)</option>
                    <option value="Forfait unique">Forfait unique (Escortes & Cortèges)</option>
                    <option value="Hebdomadaire">Hebdomadaire</option>
                    <option value="Journalier">Journalier</option>
                    <option value="Personnalisé">Personnalisé</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Conditions et délai de paiement</label>
                <input
                  type="text"
                  value={cConditionsPaiement}
                  onChange={(e) => setCConditionsPaiement(e.target.value)}
                  placeholder="Ex: 30 jours date de facture, 50% commande / 50% livraison..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Contrat Renouvelable</label>
                  <select
                    value={cEstRenouvelable ? 'oui' : 'non'}
                    onChange={(e) => setCEstRenouvelable(e.target.value === 'oui')}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="oui">Oui (Reconduction)</option>
                    <option value="non">Non (Terme ferme)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Date Révision / Renouvellement</label>
                  <input
                    type="date"
                    disabled={!cEstRenouvelable}
                    value={cDateRenouvellement}
                    onChange={(e) => setCDateRenouvellement(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white disabled:opacity-40"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Statut du contrat</label>
                  <select
                    value={cStatut}
                    onChange={(e) => setCStatut(e.target.value as StatutContratCommercial)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium"
                  >
                    <option value="Actif">Actif</option>
                    <option value="En attente de signature">En attente de signature</option>
                    <option value="Brouillon">Brouillon</option>
                    <option value="Suspendu">Suspendu</option>
                    <option value="Terminé">Terminé</option>
                    <option value="Résilié">Résilié</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCommercialModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                >
                  Enregistrer le Contrat Commercial
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================================= */}
      {/* MODAL 2: NOUVEAU CONTRAT DE TRAVAIL AGENT (Requirement 3)                                  */}
      {/* ========================================================================================= */}
      {isAgentContractModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-2xl my-6 flex flex-col max-h-[92vh] shadow-2xl overflow-hidden animate-in fade-in">
            {/* Modal Header */}
            <div className="p-5 bg-slate-850 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">
                    Nouveau Contrat de Travail (Agent de Sécurité)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Contrat d'embauche CDD ou CDI, salaires et durée
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAgentContractModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateAgentContract} className="p-5 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Agent concerné *</label>
                  <select
                    value={wAgentId}
                    onChange={(e) => handleSelectAgentForContract(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium"
                  >
                    {agents.map((ag) => (
                      <option key={ag.id} value={ag.id}>
                        {ag.matricule} - {ag.prenom} {ag.nom} ({ag.poste})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Type de Contrat de Travail *</label>
                  <select
                    value={wTypeContrat}
                    onChange={(e) => {
                      const t = e.target.value as TypeContratTravail;
                      setWTypeContrat(t);
                      if (t === 'CDI') {
                        setWDateFin(''); // Permettre l'absence de date de fin pour un CDI
                      } else {
                        setWDateFin('2027-04-30'); // Prévoir une date de fin pour CDD
                      }
                    }}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold"
                  >
                    <option value="CDI">CDI (Contrat à Durée Indéterminée - Sans date de fin)</option>
                    <option value="CDD">CDD (Contrat à Durée Déterminée - Date de fin obligatoire)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Date d'embauche / début *</label>
                  <input
                    type="date"
                    required
                    value={wDateDebut}
                    onChange={(e) => setWDateDebut(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    {wTypeContrat === 'CDI'
                      ? 'Date de fin (facultatif / absent pour CDI)'
                      : 'Date de fin obligatoire (CDD) *'}
                  </label>
                  <input
                    type="date"
                    required={wTypeContrat === 'CDD'}
                    value={wDateFin}
                    onChange={(e) => setWDateFin(e.target.value)}
                    placeholder={wTypeContrat === 'CDI' ? 'Aucune date de fin (CDI)' : ''}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              {/* Automatic duration calculation box */}
              <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-between">
                <span className="text-slate-400 font-medium">Durée calculée :</span>
                <span className="font-mono font-bold text-blue-400 text-xs">
                  {wLiveDuration}
                </span>
              </div>

              {/* Alerte réglementaire Niger */}
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200 flex items-start gap-2">
                <Info className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                <div>
                  <strong className="text-amber-300 block">Règle légale du travail au Niger :</strong>
                  <span>
                    Pour les CDD, le système affichera automatiquement une alerte avant échéance. Conformément à la loi, aucun contrat ne sera reconduit tacitement sans accord écrit formel.
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Salaire de base mensuel (FCFA) *
                  </label>
                  <input
                    type="number"
                    min="42000"
                    required
                    value={wSalaireBase}
                    onChange={(e) => setWSalaireBase(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">SMIG Niger : 42 000 FCFA</p>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Site d'affectation</label>
                  <input
                    type="text"
                    value={wSiteAffectation}
                    onChange={(e) => setWSiteAffectation(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Prime Assiduité</label>
                  <input
                    type="number"
                    min="0"
                    value={wPrimeAssiduite}
                    onChange={(e) => setWPrimeAssiduite(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Prime de Nuit</label>
                  <input
                    type="number"
                    min="0"
                    value={wPrimeNuit}
                    onChange={(e) => setWPrimeNuit(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Indemnité Panier</label>
                  <input
                    type="number"
                    min="0"
                    value={wIndemnitePanier}
                    onChange={(e) => setWIndemnitePanier(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Mode de Paiement</label>
                  <select
                    value={wModePaiement}
                    onChange={(e) => setWModePaiement(e.target.value as any)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="Virement bancaire">Virement bancaire</option>
                    <option value="Airtel Money / Mobile Money">Airtel Money / Mobile Money</option>
                    <option value="Espèces contre émargement">Espèces contre émargement</option>
                    <option value="Chèque">Chèque</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Statut du contrat</label>
                  <select
                    value={wStatut}
                    onChange={(e) => setWStatut(e.target.value as StatutContratTravail)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium"
                  >
                    <option value="Actif">Actif</option>
                    <option value="En attente de signature">En attente de signature</option>
                    <option value="Brouillon">Brouillon</option>
                    <option value="Terminé">Terminé</option>
                    <option value="Résilié">Résilié</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Observations & Conditions particulières</label>
                <textarea
                  rows={2}
                  value={wNotes}
                  onChange={(e) => setWNotes(e.target.value)}
                  placeholder="Ex: Période d'essai satisfaisante, port tenue obligatoire..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAgentContractModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold"
                >
                  Enregistrer le Contrat de Travail
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
