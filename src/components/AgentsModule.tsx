import React, { useState } from 'react';
import {
  Shield,
  Search,
  UserCheck,
  Phone,
  Plus,
  MapPin,
  CheckCircle2,
  XCircle,
  Award,
  AlertCircle,
  Edit3,
  Calendar,
  DollarSign,
  Briefcase,
  Lock,
  User,
  HeartPulse,
  CreditCard,
  Building,
  Check,
  X,
  RefreshCw,
  Printer,
} from 'lucide-react';
import { AgentSecurite, SiteGardiennage, UserSpace } from '../types';
import { AgentPhotoField } from './AgentPhotoField';

interface AgentsModuleProps {
  agents: AgentSecurite[];
  sites: SiteGardiennage[];
  onSaveAgent: (agent: AgentSecurite, isEdit: boolean) => void;
  onViewBadge: (agent: AgentSecurite) => void;
  currentSpace: UserSpace;
  agentToEditFromBadge?: AgentSecurite | null;
  onClearAgentToEditFromBadge?: () => void;
}

export const AgentsModule: React.FC<AgentsModuleProps> = ({
  agents,
  sites,
  onSaveAgent,
  onViewBadge,
  currentSpace,
  agentToEditFromBadge,
  onClearAgentToEditFromBadge,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('tous');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<AgentSecurite | null>(null);

  // Active sub-tab in enrollment modal (Section 1, 2, 3)
  const [formSection, setFormSection] = useState<'identite' | 'professionnel' | 'salaire'>('identite');

  // Form Fields State
  // Section 1: Identité
  const [matricule, setMatricule] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(undefined);
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [dateNaissance, setDateNaissance] = useState('1995-01-01');
  const [telephone, setTelephone] = useState('+227 ');
  const [quartier, setQuartier] = useState('Lazaret, Niamey');
  const [contactUrgenceNom, setContactUrgenceNom] = useState('');
  const [contactUrgenceTelephone, setContactUrgenceTelephone] = useState('+227 ');
  const [groupeSanguin, setGroupeSanguin] = useState('O+');
  const [numeroCNSS, setNumeroCNSS] = useState('');

  // Section 2: Professionnel
  const [dateEmbauche, setDateEmbauche] = useState(new Date().toISOString().substring(0, 10));
  const [poste, setPoste] = useState('Agent de Sécurité Diurne');
  const [typeContrat, setTypeContrat] = useState<AgentSecurite['typeContrat']>('CDI');
  const [siteId, setSiteId] = useState(sites[0]?.id || '');
  const [horaire, setHoraire] = useState<AgentSecurite['horaire']>('Poste Jour (06h-18h)');
  const [statut, setStatut] = useState<AgentSecurite['statut']>('En poste');
  const [equipement, setEquipement] = useState({
    tenueComplete: true,
    rangers: true,
    badge: true,
    tonfaOuMatraque: true,
    torche: true,
    sifflet: true,
  });

  // Section 3: Informations salariales (Direction & Comptabilité uniquement)
  const [salaireBase, setSalaireBase] = useState(85000);
  const [primeNuit, setPrimeNuit] = useState(0);
  const [primeAssiduite, setPrimeAssiduite] = useState(10000);
  const [indemnitePanier, setIndemnitePanier] = useState(15000);
  const [retenuesOuAvances, setRetenuesOuAvances] = useState(0);
  const [modePaiement, setModePaiement] = useState<AgentSecurite['modePaiement']>('Airtel Money / Mobile Money');
  const [referencePaiement, setReferencePaiement] = useState('');

  // Form Validation errors
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const formatFCFA = (val: number) => new Intl.NumberFormat('fr-FR').format(val) + ' FCFA';

  // Live salary calculations
  const totalBrutCalcule = (Number(salaireBase) || 0) + (Number(primeNuit) || 0) + (Number(primeAssiduite) || 0) + (Number(indemnitePanier) || 0);
  const retenueCNSSCalculee = Math.round(totalBrutCalcule * 0.0525);
  const netPrevisionnel = Math.max(0, totalBrutCalcule - retenueCNSSCalculee - (Number(retenuesOuAvances) || 0));

  // Role permissions: Can this user view/edit salaries?
  const canAccessSalaries = currentSpace === 'direction' || currentSpace === 'comptabilite';

  // Open modal for NEW enrollment
  const handleOpenNewEnrollment = () => {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const autoMatricule = `NS-2026-${randomNum}`;
    const autoCNSS = `NE-CNSS-${Math.floor(1000000 + Math.random() * 9000000)}`;

    setEditingAgent(null);
    setMatricule(autoMatricule);
    setPhotoUrl(undefined);
    setNumeroCNSS(autoCNSS);
    setNom('');
    setPrenom('');
    setDateNaissance('1994-06-15');
    setTelephone('+227 ');
    setQuartier('Plateau, Niamey');
    setContactUrgenceNom('');
    setContactUrgenceTelephone('+227 ');
    setGroupeSanguin('O+');

    setDateEmbauche(new Date().toISOString().substring(0, 10));
    setPoste('Agent de Sécurité Diurne');
    setTypeContrat('CDI');
    setSiteId(sites[0]?.id || '');
    setHoraire('Poste Jour (06h-18h)');
    setStatut('En poste');
    setEquipement({
      tenueComplete: true,
      rangers: true,
      badge: true,
      tonfaOuMatraque: true,
      torche: true,
      sifflet: true,
    });

    setSalaireBase(85000);
    setPrimeNuit(0);
    setPrimeAssiduite(10000);
    setIndemnitePanier(15000);
    setRetenuesOuAvances(0);
    setModePaiement('Airtel Money / Mobile Money');
    setReferencePaiement('');

    setFormErrors({});
    setFormSection('identite');
    setIsModalOpen(true);
  };

  // Open modal for EDITING existing agent
  const handleOpenEditAgent = (agent: AgentSecurite) => {
    setEditingAgent(agent);
    setMatricule(agent.matricule);
    setPhotoUrl(agent.photoUrl);
    setNumeroCNSS(agent.numeroCNSS || `NE-CNSS-${Math.floor(1000000 + Math.random() * 9000000)}`);
    setNom(agent.nom);
    setPrenom(agent.prenom);
    setDateNaissance(agent.dateNaissance || '1992-01-01');
    setTelephone(agent.telephone);
    setQuartier(agent.quartier);
    setContactUrgenceNom(agent.contactUrgenceNom || '');
    setContactUrgenceTelephone(agent.contactUrgenceTelephone || '+227 ');
    setGroupeSanguin(agent.groupeSanguin);

    setDateEmbauche(agent.dateEmbauche);
    setPoste(agent.poste || 'Agent de Sécurité');
    setTypeContrat(agent.typeContrat || 'CDI');
    setSiteId(agent.siteId);
    setHoraire(agent.horaire);
    setStatut(agent.statut);
    setEquipement(agent.equipement || {
      tenueComplete: true,
      rangers: true,
      badge: true,
      tonfaOuMatraque: true,
      torche: true,
      sifflet: true,
    });

    setSalaireBase(agent.salaireBase || 85000);
    setPrimeNuit(agent.primeNuit || 0);
    setPrimeAssiduite(agent.primeAssiduite || 10000);
    setIndemnitePanier(agent.indemnitePanier || 15000);
    setRetenuesOuAvances(agent.retenuesOuAvances || 0);
    setModePaiement(agent.modePaiement || 'Virement bancaire');
    setReferencePaiement(agent.referencePaiement || '');

    setFormErrors({});
    setFormSection('identite');
    setIsModalOpen(true);
  };

  // Ouverture automatique de la fiche agent si demandée depuis le modal badge (ajout/modification photo)
  React.useEffect(() => {
    if (agentToEditFromBadge) {
      handleOpenEditAgent(agentToEditFromBadge);
      onClearAgentToEditFromBadge?.();
    }
  }, [agentToEditFromBadge]);

  // Validate form and return errors map directly
  const computeValidationErrors = () => {
    const errors: Record<string, string> = {};

    if (!nom.trim()) {
      errors.nom = 'Le nom de famille est obligatoire.';
    }
    if (!prenom.trim()) {
      errors.prenom = 'Le prénom est obligatoire.';
    }
    if (!dateNaissance) {
      errors.dateNaissance = 'La date de naissance est obligatoire.';
    }
    if (!telephone.trim() || telephone.trim() === '+227') {
      errors.telephone = 'Le numéro de téléphone nigérien (+227) est obligatoire.';
    }
    if (!quartier.trim()) {
      errors.quartier = 'L’adresse ou le quartier de résidence à Niamey est obligatoire.';
    }
    if (!dateEmbauche) {
      errors.dateEmbauche = 'La date d’embauche est obligatoire.';
    }
    if (!poste.trim()) {
      errors.poste = 'Le poste / fonction est obligatoire.';
    }
    if (canAccessSalaries) {
      if (!salaireBase || Number(salaireBase) <= 0) {
        errors.salaireBase = 'Le salaire de base mensuel en FCFA doit être supérieur à zéro.';
      }
    }

    setFormErrors(errors);
    return errors;
  };

  const buildValidatedAgentData = (): AgentSecurite | null => {
    const errors = computeValidationErrors();
    if (Object.keys(errors).length > 0) {
      if (errors.nom || errors.prenom || errors.dateNaissance || errors.telephone || errors.quartier) {
        setFormSection('identite');
      } else if (errors.dateEmbauche || errors.poste) {
        setFormSection('professionnel');
      } else if (errors.salaireBase) {
        setFormSection('salaire');
      }
      return null;
    }

    const selSite = sites.find((s) => s.id === siteId) || sites[0];

    return {
      id: editingAgent ? editingAgent.id : `ag-${Date.now()}`,
      matricule,
      photoUrl: photoUrl || undefined,
      nom: nom.trim().toUpperCase(),
      prenom: prenom.trim(),
      dateNaissance,
      telephone: telephone.trim(),
      quartier: quartier.trim(),
      contactUrgenceNom: contactUrgenceNom.trim() || undefined,
      contactUrgenceTelephone: contactUrgenceTelephone.trim() || undefined,
      groupeSanguin,
      numeroCNSS: numeroCNSS || `NE-CNSS-${Math.floor(1000000 + Math.random() * 9000000)}`,

      dateEmbauche,
      poste: poste.trim(),
      typeContrat,
      siteActuel: selSite.nom,
      siteId: selSite.id,
      horaire,
      statut,
      equipement,

      salaireBase: Number(salaireBase) || 85000,
      primeNuit: Number(primeNuit) || 0,
      primeAssiduite: Number(primeAssiduite) || 0,
      indemnitePanier: Number(indemnitePanier) || 0,
      retenuesOuAvances: Number(retenuesOuAvances) || 0,
      modePaiement,
      referencePaiement: referencePaiement.trim() || undefined,
    };
  };

  // Submit form
  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    const agentData = buildValidatedAgentData();
    if (!agentData) return;

    onSaveAgent(agentData, !!editingAgent);
    setIsModalOpen(false);
  };

  // Enregistre les dernières modifications (dont la photo) puis ouvre directement le créateur/imprimante de badge PVC
  const handleSaveAndOpenBadge = () => {
    const agentData = buildValidatedAgentData();
    if (!agentData) return;

    onSaveAgent(agentData, !!editingAgent);
    setIsModalOpen(false);
    onViewBadge(agentData);
  };

  const filteredAgents = agents.filter((ag) => {
    const matchesSearch =
      ag.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ag.prenom.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ag.matricule.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ag.siteActuel.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ag.quartier.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'tous' || ag.statut === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Top Banner */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
              <Shield className="w-5 h-5" />
            </span>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white">Registre des Agents de Sécurité</h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-emerald-300 border border-slate-700">
                {agents.length} vigiles enregistrés
              </span>
            </div>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Fiches complètes structurées en 3 volets : Identité & coordonnées, Informations professionnelles et Paramètres salariaux reliés à la paie.
          </p>
        </div>

        {/* Enrollment button: available for Direction and Comptabilité */}
        <button
          onClick={handleOpenNewEnrollment}
          className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-lg shadow-emerald-900/30 whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span>Enrôler un Agent</span>
        </button>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Matricule, nom, quartier, site..."
            className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {['tous', 'En poste', 'De repos', 'En congé', 'Absent', 'Sorti (Démission / Fin de contrat)'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                statusFilter === st
                  ? 'bg-slate-700 text-white border border-slate-600'
                  : 'bg-slate-800/60 text-slate-400 hover:text-white'
              }`}
            >
              {st === 'tous' ? 'Tous les statuts' : st}
            </button>
          ))}
        </div>
      </div>

      {/* Agents Table */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-slate-800/40">
                <th className="py-2.5 px-3">Matricule</th>
                <th className="py-2.5 px-3">Agent de Sécurité</th>
                <th className="py-2.5 px-3">Poste & Contrat</th>
                <th className="py-2.5 px-3">Site Actuel</th>
                <th className="py-2.5 px-3">Contact (+227)</th>
                {canAccessSalaries && (
                  <th className="py-2.5 px-3 text-right">Salaire Base (FCFA)</th>
                )}
                <th className="py-2.5 px-3 text-center">Statut</th>
                <th className="py-2.5 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {filteredAgents.map((ag) => (
                <tr key={ag.id} className="hover:bg-slate-800/40 transition">
                  <td className="py-3 px-3 font-mono font-bold text-emerald-400 whitespace-nowrap">
                    {ag.matricule}
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center shrink-0">
                        {ag.photoUrl ? (
                          <img
                            src={ag.photoUrl}
                            alt={`${ag.prenom} ${ag.nom}`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="w-4 h-4 text-slate-500" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-white truncate">{ag.prenom} {ag.nom}</p>
                        <p className="text-[11px] text-slate-400 truncate">{ag.quartier} • Grp: {ag.groupeSanguin}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <p className="text-white font-medium">{ag.poste || 'Agent de Sécurité'}</p>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      {ag.typeContrat || 'CDI'}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-200">{ag.siteActuel}</td>
                  <td className="py-3 px-3 text-slate-300 font-mono text-xs whitespace-nowrap">
                    {ag.telephone}
                  </td>
                  {canAccessSalaries && (
                    <td className="py-3 px-3 text-right font-bold text-white whitespace-nowrap">
                      {formatFCFA(ag.salaireBase || 85000)}
                    </td>
                  )}
                  <td className="py-3 px-3 text-center whitespace-nowrap">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        ag.statut === 'En poste'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : ag.statut === 'Absent'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          : ag.statut.includes('Sorti')
                          ? 'bg-slate-800 text-slate-400 border border-slate-700'
                          : 'bg-slate-700 text-slate-300'
                      }`}
                    >
                      {ag.statut}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center whitespace-nowrap">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => onViewBadge(ag)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1 border ${
                          currentSpace === 'direction'
                            ? 'bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border-emerald-500/40'
                            : 'bg-slate-800 hover:bg-slate-700 text-emerald-400 hover:text-white border-slate-700'
                        }`}
                        title={
                          currentSpace === 'direction'
                            ? 'Créer et imprimer le badge PVC recto-verso avec QR code'
                            : 'Voir le badge d’identification'
                        }
                      >
                        {currentSpace === 'direction' && <Printer className="w-3.5 h-3.5" />}
                        <span>{currentSpace === 'direction' ? 'Créer / Imprimer le badge' : 'Badge'}</span>
                      </button>
                      <button
                        onClick={() => handleOpenEditAgent(ag)}
                        className="px-2 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white text-xs font-semibold transition cursor-pointer border border-blue-500/30 flex items-center gap-1"
                        title="Modifier la fiche complète"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Modifier</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ENROLLMENT & EDIT MODAL WITH 3 SECTIONS */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto flex flex-col shadow-2xl text-slate-100">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80 sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
                  <Shield className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-white text-base">
                    {editingAgent ? `Modifier l’Agent : ${editingAgent.prenom} ${editingAgent.nom}` : 'Enrôlement d’un Nouvel Agent de Sécurité'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Fiche conforme au code du travail et convention collective du gardiennage au Niger
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 3 Sections Navigation Tabs */}
            <div className="px-5 pt-3 pb-2 bg-slate-950/50 border-b border-slate-800 flex items-center gap-2 overflow-x-auto">
              <button
                type="button"
                onClick={() => setFormSection('identite')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                  formSection === 'identite'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>1. Identité & Coordonnées</span>
              </button>

              <button
                type="button"
                onClick={() => setFormSection('professionnel')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                  formSection === 'professionnel'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <Briefcase className="w-3.5 h-3.5" />
                <span>2. Informations Professionnelles</span>
              </button>

              <button
                type="button"
                onClick={() => setFormSection('salaire')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                  formSection === 'salaire'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <DollarSign className="w-3.5 h-3.5" />
                <span>3. Informations Salariales</span>
                {!canAccessSalaries && <Lock className="w-3 h-3 text-amber-400 ml-1" />}
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSaveForm} className="p-5 space-y-4">
              {/* SECTION 1: Identité et coordonnées */}
              {formSection === 'identite' && (
                <div className="space-y-4 animate-in fade-in">
                  <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/80 flex items-center justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Matricule RH Agent (Badge & Paie)
                      </span>
                      <p className="font-mono text-base font-black text-emerald-400">{matricule}</p>
                    </div>
                    <span className="text-[10px] px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                      Référence RH (distinct des comptes d’accès)
                    </span>
                  </div>

                  {/* Champ photo d'identité : caméra ou import appareil avec aperçu et remplacement */}
                  <AgentPhotoField
                    value={photoUrl}
                    onChange={setPhotoUrl}
                    agentName={`${prenom} ${nom}`.trim()}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">
                        Nom de famille <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={nom}
                        onChange={(e) => setNom(e.target.value.toUpperCase())}
                        placeholder="Ex: MAMANE, GARBA..."
                        className={`w-full bg-slate-800 border rounded-xl px-3 py-2 text-white focus:outline-none ${
                          formErrors.nom ? 'border-rose-500' : 'border-slate-700 focus:border-emerald-500'
                        }`}
                      />
                      {formErrors.nom && <p className="text-[10px] text-rose-400 mt-0.5">{formErrors.nom}</p>}
                    </div>

                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">
                        Prénom(s) <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={prenom}
                        onChange={(e) => setPrenom(e.target.value)}
                        placeholder="Ex: Ibrahim Dan-Ladi..."
                        className={`w-full bg-slate-800 border rounded-xl px-3 py-2 text-white focus:outline-none ${
                          formErrors.prenom ? 'border-rose-500' : 'border-slate-700 focus:border-emerald-500'
                        }`}
                      />
                      {formErrors.prenom && <p className="text-[10px] text-rose-400 mt-0.5">{formErrors.prenom}</p>}
                    </div>

                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">
                        Date de naissance <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="date"
                        value={dateNaissance}
                        onChange={(e) => setDateNaissance(e.target.value)}
                        className={`w-full bg-slate-800 border rounded-xl px-3 py-2 text-white focus:outline-none ${
                          formErrors.dateNaissance ? 'border-rose-500' : 'border-slate-700 focus:border-emerald-500'
                        }`}
                      />
                      {formErrors.dateNaissance && <p className="text-[10px] text-rose-400 mt-0.5">{formErrors.dateNaissance}</p>}
                    </div>

                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">
                        Téléphone de l'agent (+227) <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={telephone}
                        onChange={(e) => setTelephone(e.target.value)}
                        placeholder="+227 9X XX XX XX"
                        className={`w-full bg-slate-800 border rounded-xl px-3 py-2 text-white focus:outline-none ${
                          formErrors.telephone ? 'border-rose-500' : 'border-slate-700 focus:border-emerald-500'
                        }`}
                      />
                      {formErrors.telephone && <p className="text-[10px] text-rose-400 mt-0.5">{formErrors.telephone}</p>}
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-slate-300 font-semibold mb-1">
                        Adresse ou quartier de résidence à Niamey <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={quartier}
                        onChange={(e) => setQuartier(e.target.value)}
                        placeholder="Ex: Quartier Lazaret, Yantala, Recasement..."
                        className={`w-full bg-slate-800 border rounded-xl px-3 py-2 text-white focus:outline-none ${
                          formErrors.quartier ? 'border-rose-500' : 'border-slate-700 focus:border-emerald-500'
                        }`}
                      />
                      {formErrors.quartier && <p className="text-[10px] text-rose-400 mt-0.5">{formErrors.quartier}</p>}
                    </div>

                    {/* Contact d'urgence facultatif */}
                    <div className="sm:col-span-2 p-3 rounded-xl bg-slate-800/40 border border-slate-800 space-y-2">
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <HeartPulse className="w-3.5 h-3.5 text-rose-400" />
                        <span>Contact d'urgence en cas d'accident de service (Facultatif)</span>
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-slate-400 text-[10px] mb-0.5">Nom du proche ou parent</label>
                          <input
                            type="text"
                            value={contactUrgenceNom}
                            onChange={(e) => setContactUrgenceNom(e.target.value)}
                            placeholder="Ex: Mme Aïchatou Mamane (Épouse)"
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 text-[10px] mb-0.5">Téléphone d'urgence</label>
                          <input
                            type="text"
                            value={contactUrgenceTelephone}
                            onChange={(e) => setContactUrgenceTelephone(e.target.value)}
                            placeholder="+227 9X XX XX XX"
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Groupe Sanguin</label>
                      <select
                        value={groupeSanguin}
                        onChange={(e) => setGroupeSanguin(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                      >
                        <option value="O+">O+</option>
                        <option value="A+">A+</option>
                        <option value="B+">B+</option>
                        <option value="AB+">AB+</option>
                        <option value="O-">O-</option>
                        <option value="A-">A-</option>
                        <option value="B-">B-</option>
                        <option value="AB-">AB-</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">N° Immatriculation CNSS</label>
                      <input
                        type="text"
                        value={numeroCNSS}
                        onChange={(e) => setNumeroCNSS(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION 2: Informations professionnelles */}
              {formSection === 'professionnel' && (
                <div className="space-y-4 animate-in fade-in">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">
                        Date d'embauche <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="date"
                        value={dateEmbauche}
                        onChange={(e) => setDateEmbauche(e.target.value)}
                        className={`w-full bg-slate-800 border rounded-xl px-3 py-2 text-white focus:outline-none ${
                          formErrors.dateEmbauche ? 'border-rose-500' : 'border-slate-700 focus:border-emerald-500'
                        }`}
                      />
                      {formErrors.dateEmbauche && <p className="text-[10px] text-rose-400 mt-0.5">{formErrors.dateEmbauche}</p>}
                    </div>

                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">
                        Poste / Fonction <span className="text-rose-400">*</span>
                      </label>
                      <select
                        value={poste}
                        onChange={(e) => setPoste(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                      >
                        <option value="Chef de Poste">Chef de Poste</option>
                        <option value="Agent de Sécurité Diurne">Agent de Sécurité Diurne (06h-18h)</option>
                        <option value="Agent Vigile Poste Nuit">Agent Vigile Poste Nuit (18h-06h)</option>
                        <option value="Maître-Chien de Sécurité">Maître-Chien de Sécurité (Canin)</option>
                        <option value="Agent de Contrôle Magasin">Agent de Contrôle Magasin</option>
                        <option value="Contrôleur d’Accès & Filtrage">Contrôleur d’Accès & Filtrage</option>
                        <option value="Agent Patrouilleur Mobile">Agent Patrouilleur Mobile</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Type de contrat</label>
                      <select
                        value={typeContrat}
                        onChange={(e) => setTypeContrat(e.target.value as any)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                      >
                        <option value="CDI">CDI (Contrat à Durée Indéterminée)</option>
                        <option value="CDD 12 mois">CDD 12 mois</option>
                        <option value="Période d’essai">Période d’essai</option>
                        <option value="Renfort temporaire">Renfort temporaire / Événementiel</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Site affecté</label>
                      <select
                        value={siteId}
                        onChange={(e) => setSiteId(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                      >
                        {sites.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.nom} ({s.quartier})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Faction / Horaire</label>
                      <select
                        value={horaire}
                        onChange={(e) => setHoraire(e.target.value as any)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                      >
                        <option value="Poste Jour (06h-18h)">Poste Jour (06h-18h)</option>
                        <option value="Poste Nuit (18h-06h)">Poste Nuit (18h-06h)</option>
                        <option value="Repos">Repos</option>
                        <option value="Congé">Congé</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Statut de l'agent</label>
                      <select
                        value={statut}
                        onChange={(e) => setStatut(e.target.value as any)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold"
                      >
                        <option value="En poste">Actif - En poste</option>
                        <option value="De repos">Actif - De repos</option>
                        <option value="En congé">Actif - En congé annuel</option>
                        <option value="Absent">Absent</option>
                        <option value="Sorti (Démission / Fin de contrat)">Sorti (Démission / Fin de contrat)</option>
                      </select>
                    </div>
                  </div>

                  {/* Dotation équipement */}
                  <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-800 space-y-2">
                    <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Dotation et équipement réglementaire remis à l'agent :
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                      <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={equipement.tenueComplete}
                          onChange={(e) => setEquipement({ ...equipement, tenueComplete: e.target.checked })}
                          className="rounded text-emerald-500 bg-slate-700"
                        />
                        <span>Tenue complète</span>
                      </label>
                      <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={equipement.rangers}
                          onChange={(e) => setEquipement({ ...equipement, rangers: e.target.checked })}
                          className="rounded text-emerald-500 bg-slate-700"
                        />
                        <span>Rangers</span>
                      </label>
                      <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={equipement.badge}
                          onChange={(e) => setEquipement({ ...equipement, badge: e.target.checked })}
                          className="rounded text-emerald-500 bg-slate-700"
                        />
                        <span>Badge officiel</span>
                      </label>
                      <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={equipement.tonfaOuMatraque}
                          onChange={(e) => setEquipement({ ...equipement, tonfaOuMatraque: e.target.checked })}
                          className="rounded text-emerald-500 bg-slate-700"
                        />
                        <span>Tonfa / Matraque</span>
                      </label>
                      <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={equipement.torche}
                          onChange={(e) => setEquipement({ ...equipement, torche: e.target.checked })}
                          className="rounded text-emerald-500 bg-slate-700"
                        />
                        <span>Lampe Torche</span>
                      </label>
                      <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={equipement.sifflet}
                          onChange={(e) => setEquipement({ ...equipement, sifflet: e.target.checked })}
                          className="rounded text-emerald-500 bg-slate-700"
                        />
                        <span>Sifflet</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION 3: Informations salariales (Direction & Comptabilité uniquement) */}
              {formSection === 'salaire' && (
                <div className="space-y-4 animate-in fade-in">
                  {!canAccessSalaries ? (
                    <div className="p-8 rounded-2xl bg-slate-800/60 border border-slate-700 text-center space-y-3">
                      <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
                        <Lock className="w-6 h-6" />
                      </div>
                      <h4 className="font-bold text-white text-base">Informations Salariales Confidentielles</h4>
                      <p className="text-xs text-slate-300 max-w-md mx-auto">
                        Conformément au contrôle d'accès, seules la <strong>Direction</strong> et la <strong>Comptabilité</strong> sont habilitées à consulter et paramétrer les salaires et coordonnées bancaires des vigiles.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="p-3.5 rounded-xl bg-purple-950/30 border border-purple-500/30 text-xs text-purple-200 flex items-start gap-2">
                        <DollarSign className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                        <p>
                          <strong>Liaison directe avec la Paie Mensuelle :</strong> Les montants saisis ici alimentent automatiquement la préparation des bulletins de paie dans l'espace Comptabilité afin d'éviter toute double saisie.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <label className="block text-slate-300 font-semibold mb-1">
                            Salaire de base mensuel (FCFA) <span className="text-rose-400">*</span>
                          </label>
                          <input
                            type="number"
                            min="10000"
                            step="1000"
                            value={salaireBase}
                            onChange={(e) => setSalaireBase(Number(e.target.value))}
                            className={`w-full bg-slate-800 border rounded-xl px-3 py-2 text-white font-bold focus:outline-none ${
                              formErrors.salaireBase ? 'border-rose-500' : 'border-slate-700 focus:border-purple-500'
                            }`}
                          />
                          {formErrors.salaireBase && <p className="text-[10px] text-rose-400 mt-0.5">{formErrors.salaireBase}</p>}
                        </div>

                        <div>
                          <label className="block text-slate-300 font-semibold mb-1">
                            Prime de surveillance de nuit (FCFA)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="1000"
                            value={primeNuit}
                            onChange={(e) => setPrimeNuit(Number(e.target.value))}
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-300 font-semibold mb-1">
                            Prime d'assiduité & ponctualité (FCFA)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="1000"
                            value={primeAssiduite}
                            onChange={(e) => setPrimeAssiduite(Number(e.target.value))}
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-300 font-semibold mb-1">
                            Indemnité de panier & transport (FCFA)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="1000"
                            value={indemnitePanier}
                            onChange={(e) => setIndemnitePanier(Number(e.target.value))}
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-300 font-semibold mb-1">
                            Retenues ou Avances habituelles (FCFA)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="1000"
                            value={retenuesOuAvances}
                            onChange={(e) => setRetenuesOuAvances(Number(e.target.value))}
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-300 font-semibold mb-1">Mode de paiement</label>
                          <select
                            value={modePaiement}
                            onChange={(e) => setModePaiement(e.target.value as any)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                          >
                            <option value="Airtel Money / Mobile Money">Airtel Money / Mobile Money</option>
                            <option value="Virement bancaire">Virement bancaire</option>
                            <option value="Espèces contre émargement">Espèces contre émargement</option>
                            <option value="Chèque">Chèque</option>
                          </select>
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-slate-300 font-semibold mb-1">
                            Référence de paiement (RIB compte bancaire ou N° Mobile Money)
                          </label>
                          <input
                            type="text"
                            value={referencePaiement}
                            onChange={(e) => setReferencePaiement(e.target.value)}
                            placeholder="Ex: Compte BSIC NE05 2010... ou N° Airtel +227 9X XX XX XX"
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                          />
                        </div>
                      </div>

                      {/* Live calculation box */}
                      <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700 space-y-2 text-xs">
                        <div className="flex justify-between text-slate-300">
                          <span>Total Salaire Brut Imposable :</span>
                          <span className="font-bold text-white">{formatFCFA(totalBrutCalcule)}</span>
                        </div>
                        <div className="flex justify-between text-rose-300">
                          <span>Cotisation CNSS ouvrière (5.25% Niger) :</span>
                          <span className="font-medium">-{formatFCFA(retenueCNSSCalculee)}</span>
                        </div>
                        {retenuesOuAvances > 0 && (
                          <div className="flex justify-between text-amber-300">
                            <span>Acompte déduit :</span>
                            <span className="font-medium">-{formatFCFA(retenuesOuAvances)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-sm font-black text-emerald-400 pt-2 border-t border-slate-700">
                          <span>Net Prévisionnel Mensuel :</span>
                          <span>{formatFCFA(netPrevisionnel)}</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Navigation & Submit Buttons */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  {formSection !== 'identite' && (
                    <button
                      type="button"
                      onClick={() => {
                        if (formSection === 'salaire') setFormSection('professionnel');
                        else if (formSection === 'professionnel') setFormSection('identite');
                      }}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium cursor-pointer"
                    >
                      Précédent
                    </button>
                  )}
                  {formSection !== 'salaire' && (
                    <button
                      type="button"
                      onClick={() => {
                        if (formSection === 'identite') setFormSection('professionnel');
                        else if (formSection === 'professionnel') setFormSection('salaire');
                      }}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold cursor-pointer"
                    >
                      Suivant
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
                  >
                    Annuler
                  </button>
                  {currentSpace === 'direction' && (
                    <button
                      type="button"
                      onClick={handleSaveAndOpenBadge}
                      className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-emerald-700 text-emerald-300 hover:text-white font-bold text-xs border border-emerald-500/40 flex items-center gap-1.5 transition cursor-pointer"
                      title="Enregistrer la fiche agent et ouvrir l'aperçu d'impression du badge PVC recto-verso"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Créer / Imprimer le badge</span>
                    </button>
                  )}
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-900/30 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>{editingAgent ? 'Enregistrer les modifications' : 'Enrôler définitivement'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
