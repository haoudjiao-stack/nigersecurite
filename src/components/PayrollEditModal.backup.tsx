import React, { useState, useEffect } from 'react';
import {
  X,
  Calculator,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Send,
  Save,
  DollarSign,
  User,
  Calendar,
  FileText,
  RotateCcw,
} from 'lucide-react';
import { FichePaieAgent, AgentSecurite, StatutFichePaie } from '../types';

interface PayrollEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  payslipToEdit: FichePaieAgent | null;
  agents: AgentSecurite[];
  existingPayslips: FichePaieAgent[];
  onSave: (slip: FichePaieAgent, submitForValidation: boolean) => void;
}

const MONTHS_LIST = [
  'Octobre 2026',
  'Novembre 2026',
  'Décembre 2026',
  'Janvier 2026',
  'Février 2025',
  'Mars 2025',
  'Avril 2025',
  'Mai 2025',
  'Juin 2025',
  'Juillet 2025',
  'Août 2025',
  'Septembre 2025',
];

export const PayrollEditModal: React.FC<PayrollEditModalProps> = ({
  isOpen,
  onClose,
  payslipToEdit,
  agents,
  existingPayslips,
  onSave,
}) => {
  if (!isOpen) return null;

  const isEditing = Boolean(payslipToEdit);

  // Available active agents
  const availableAgents = agents.filter((ag) => !ag.statut.includes('Sorti'));

  // Form states
  const [selectedAgentId, setSelectedAgentId] = useState<string>(
    payslipToEdit?.agentId || (availableAgents[0]?.id ?? '')
  );
  const [mois, setMois] = useState<string>(payslipToEdit?.mois || 'Octobre 2026');

  // Selected agent details
  const currentAgent = agents.find((a) => a.id === selectedAgentId) || availableAgents[0];

  // Financial fields
  const [salaireBase, setSalaireBase] = useState<number>(
    payslipToEdit?.salaireBase ?? currentAgent?.salaireBase ?? 85000
  );
  const [prime, setPrime] = useState<number>(
    payslipToEdit?.prime ??
      (payslipToEdit
        ? (payslipToEdit.primeDeNuit || 0) +
          (payslipToEdit.primeDePanier || 0) +
          (payslipToEdit.primeAssiduite || 0)
        : (currentAgent?.primeNuit || 0) +
          (currentAgent?.primeAssiduite || 0) +
          (currentAgent?.indemnitePanier || 0))
  );
  const [retenueCNSS, setRetenueCNSS] = useState<number>(
    payslipToEdit?.retenueCNSS ?? Math.round(((currentAgent?.salaireBase || 85000) + prime) * 0.0525)
  );
  const [acompteRetenu, setAcompteRetenu] = useState<number>(
    payslipToEdit?.acompteRetenu ?? currentAgent?.retenuesOuAvances ?? 0
  );
  const [autresRetenues, setAutresRetenues] = useState<number>(
    payslipToEdit?.autresRetenues ?? 0
  );
  const [commentaire, setCommentaire] = useState<string>(payslipToEdit?.commentaire || '');

  // Validation & Error states
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // When agent changes (in new mode), auto-update base salary and suggested primes
  const handleAgentChange = (newAgentId: string) => {
    setSelectedAgentId(newAgentId);
    const ag = agents.find((a) => a.id === newAgentId);
    if (ag) {
      setSalaireBase(ag.salaireBase);
      const suggestedPrime = ag.primeNuit + ag.primeAssiduite + ag.indemnitePanier;
      setPrime(suggestedPrime);
      const brut = ag.salaireBase + suggestedPrime;
      setRetenueCNSS(Math.round(brut * 0.0525));
      setAcompteRetenu(ag.retenuesOuAvances);
    }
  };

  // Auto-recalculate CNSS 5.25% based on base + prime
  const handleRecalculateCNSS = () => {
    const brut = Math.max(0, Number(salaireBase) || 0) + Math.max(0, Number(prime) || 0);
    setRetenueCNSS(Math.round(brut * 0.0525));
  };

  // Calculations
  const totalGains = Math.max(0, Number(salaireBase) || 0) + Math.max(0, Number(prime) || 0);
  const totalRetenues =
    Math.max(0, Number(retenueCNSS) || 0) +
    Math.max(0, Number(acompteRetenu) || 0) +
    Math.max(0, Number(autresRetenues) || 0);
  const rawNet = totalGains - totalRetenues;
  const isNetNegativeOrInvalid = rawNet < 0 || isNaN(rawNet);
  const netAPayer = Math.max(0, rawNet);

  // Check for duplicate payslip for the same agent & month
  const duplicateSlip = existingPayslips.find(
    (p) =>
      p.agentId === selectedAgentId &&
      p.mois.trim().toLowerCase() === mois.trim().toLowerCase() &&
      (!isEditing || p.id !== payslipToEdit?.id)
  );

  const formatFCFA = (val: number) => new Intl.NumberFormat('fr-FR').format(val) + ' FCFA';

  const handleSubmit = (submitForValidation: boolean) => {
    setErrorMsg(null);

    if (!selectedAgentId || !currentAgent) {
      setErrorMsg("Veuillez sélectionner un agent de sécurité.");
      return;
    }

    if (!mois.trim()) {
      setErrorMsg("Veuillez renseigner le mois de paie concerné.");
      return;
    }

    if (salaireBase <= 0) {
      setErrorMsg("Le salaire de base doit être supérieur à 0 FCFA.");
      return;
    }

    if (isNetNegativeOrInvalid) {
      setErrorMsg(
        `Incohérence des montants : Les retenues totales (${formatFCFA(
          totalRetenues
        )}) dépassent les gains totaux (${formatFCFA(
          totalGains
        )}). Le salaire net à payer ne peut être négatif.`
      );
      return;
    }

    const newOrUpdatedSlip: FichePaieAgent = {
      id: payslipToEdit ? payslipToEdit.id : (duplicateSlip ? duplicateSlip.id : `pay-${Date.now()}`),
      agentId: currentAgent.id,
      agentMatricule: currentAgent.matricule,
      agentNom: `${currentAgent.prenom} ${currentAgent.nom}`,
      poste: currentAgent.poste,
      mois: mois.trim(),
      salaireBase: Number(salaireBase),
      prime: Number(prime),
      primeDeNuit: payslipToEdit?.primeDeNuit || 0,
      primeDePanier: payslipToEdit?.primeDePanier || 0,
      primeAssiduite: payslipToEdit?.primeAssiduite || 0,
      totalBrut: totalGains,
      retenueCNSS: Number(retenueCNSS),
      acompteRetenu: Number(acompteRetenu),
      autresRetenues: Number(autresRetenues),
      commentaire: commentaire.trim() || undefined,
      netAPayer,
      statut: submitForValidation ? 'En attente de validation' : 'Brouillon',
      // If was rejected and resubmitted, clear reject message
      motifRejet: submitForValidation ? undefined : payslipToEdit?.motifRejet,
    };

    onSave(newOrUpdatedSlip, submitForValidation);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto flex flex-col shadow-2xl text-slate-100 my-auto">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/70 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base sm:text-lg">
                {isEditing ? 'Modifier la paie mensuelle' : 'Préparer la paie d’un agent'}
              </h3>
              <p className="text-xs text-slate-400">
                Calcul précis selon les règles de paie et cotisations CNSS (Niger)
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

        {/* Form Body */}
        <div className="p-4 sm:p-6 space-y-5">
          {/* Duplicate Alert (Requirement 9) */}
          {duplicateSlip && (
            <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-200 text-xs flex items-start gap-2.5 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-300">
                  Avertissement doublon paie :
                </p>
                <p className="mt-0.5 text-amber-200/90 leading-relaxed">
                  Une fiche de paie existe déjà pour cet agent sur le mois de <strong>{mois}</strong> (actuellement au statut <em>« {duplicateSlip.statut} »</em>).
                  L'enregistrement mettra à jour cette fiche sans créer de doublon.
                </p>
              </div>
            </div>
          )}

          {/* If the slip was previously rejected by Direction, show the motif */}
          {payslipToEdit?.statut === 'Rejetée' && payslipToEdit.motifRejet && (
            <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-rose-300">
                  Motif du rejet par la Direction Générale :
                </p>
                <p className="mt-0.5 text-rose-200/90 italic">
                  « {payslipToEdit.motifRejet} »
                </p>
                <p className="mt-1 text-[11px] text-rose-300">
                  Veuillez rectifier les montants ci-dessous avant de renvoyer pour visa.
                </p>
              </div>
            </div>
          )}

          {/* Agent & Month Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-blue-400" />
                <span>Agent de sécurité concerné *</span>
              </label>
              {payslipToEdit ? (
                <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 text-xs">
                  <p className="font-bold text-white text-sm">{payslipToEdit.agentNom}</p>
                  <p className="text-emerald-400 font-mono mt-0.5">
                    {payslipToEdit.agentMatricule} • {payslipToEdit.poste}
                  </p>
                </div>
              ) : (
                <select
                  value={selectedAgentId}
                  onChange={(e) => handleAgentChange(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs sm:text-sm focus:border-emerald-500 focus:outline-none"
                >
                  {availableAgents.map((ag) => (
                    <option key={ag.id} value={ag.id}>
                      {ag.prenom} {ag.nom} ({ag.matricule}) - {ag.poste}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-purple-400" />
                <span>Mois de paie concerné *</span>
              </label>
              <select
                value={mois}
                onChange={(e) => setMois(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs sm:text-sm focus:border-emerald-500 focus:outline-none"
              >
                {MONTHS_LIST.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Auto-filled Base Salary (from Agent Record) */}
          <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                Fiche Agent
              </span>
              <p className="text-xs font-semibold text-white mt-1">
                Salaire de base contractuel (récupéré automatiquement)
              </p>
              <p className="text-[11px] text-slate-400">
                Base fixée lors de l'enrôlement ou de la mise à jour du contrat de travail
              </p>
            </div>
            <div className="text-right">
              <span className="text-lg sm:text-xl font-black text-emerald-400">
                {formatFCFA(salaireBase)}
              </span>
            </div>
          </div>

          {/* Modifiable Variables (Prime, CNSS, Acompte, Autres Retenues) */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <span>Rubriques variables du mois (Saisie & ajustement Comptabilité)</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Prime */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1 text-emerald-300">
                    <span className="font-bold">+</span> Primes totales (Nuit, Panier, Assiduité)
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">FCFA</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={prime}
                  onChange={(e) => setPrime(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-emerald-300 font-semibold text-sm focus:border-emerald-500 focus:outline-none"
                  placeholder="0"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Ex: Indemnités de faction de nuit ou primes d'assiduité terrain
                </p>
              </div>

              {/* CNSS (5.25% or modified) */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1 text-rose-300">
                    <span className="font-bold">-</span> Cotisation CNSS (Part ouvrière)
                  </span>
                  <button
                    type="button"
                    onClick={handleRecalculateCNSS}
                    className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer underline"
                    title="Recalculer 5.25% sur Salaire brut (Base + Primes)"
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                    <span>Auto (5.25%)</span>
                  </button>
                </label>
                <input
                  type="number"
                  min="0"
                  step="500"
                  value={retenueCNSS}
                  onChange={(e) => setRetenueCNSS(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-rose-300 font-semibold text-sm focus:border-rose-500 focus:outline-none"
                  placeholder="0"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Déclarée et versée à la Caisse Nationale de Sécurité Sociale
                </p>
              </div>

              {/* Acompte */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1 text-amber-300">
                    <span className="font-bold">-</span> Acompte sur salaire perçu
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">FCFA</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={acompteRetenu}
                  onChange={(e) => setAcompteRetenu(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-amber-300 font-semibold text-sm focus:border-amber-500 focus:outline-none"
                  placeholder="0"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Avances de mi-mois déduites du règlement final
                </p>
              </div>

              {/* Autres Retenues (Facultatif) */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1 text-purple-300">
                    <span className="font-bold">-</span> Autres retenues (Facultatif)
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">FCFA</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={autresRetenues}
                  onChange={(e) => setAutresRetenues(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-purple-300 font-semibold text-sm focus:border-purple-500 focus:outline-none"
                  placeholder="0"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Pénalités, absences non justifiées, équipement ou trousseau
                </p>
              </div>
            </div>

            {/* Commentaire / Motif d'ajustement (Facultatif) */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <span>Commentaire & justification de la préparation (Facultatif)</span>
              </label>
              <textarea
                value={commentaire}
                onChange={(e) => setCommentaire(e.target.value)}
                rows={2}
                placeholder="Ex : Heures nocturnes validées suite au rapport de ronde ; déduction de l'acompte du 15..."
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs sm:text-sm focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Automatic Calculation & Net to Pay Preview */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border-2 border-emerald-500/40 space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-300 border-b border-slate-800 pb-2">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <Calculator className="w-4 h-4" />
                <span>Formule légale automatique :</span>
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                Base + Prime - CNSS - Acompte - Autres
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="p-2 rounded-lg bg-slate-800/60">
                <p className="text-slate-400 text-[10px]">Brut Total (+)</p>
                <p className="font-bold text-emerald-400 mt-0.5">{formatFCFA(totalGains)}</p>
              </div>
              <div className="p-2 rounded-lg bg-slate-800/60">
                <p className="text-slate-400 text-[10px]">CNSS Ouvrière (-)</p>
                <p className="font-bold text-rose-400 mt-0.5">{formatFCFA(retenueCNSS)}</p>
              </div>
              <div className="p-2 rounded-lg bg-slate-800/60">
                <p className="text-slate-400 text-[10px]">Acompte Déduit (-)</p>
                <p className="font-bold text-amber-400 mt-0.5">{formatFCFA(acompteRetenu)}</p>
              </div>
              <div className="p-2 rounded-lg bg-slate-800/60">
                <p className="text-slate-400 text-[10px]">Autres Retenues (-)</p>
                <p className="font-bold text-purple-400 mt-0.5">{formatFCFA(autresRetenues)}</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-2 border-t border-slate-800">
              <div>
                <p className="text-xs uppercase tracking-wider font-extrabold text-white">
                  Net à Payer Réel à l’Agent :
                </p>
                <p className="text-[11px] text-slate-400">
                  Montant en FCFA ordonnancé après visa hiérarchique
                </p>
              </div>
              <div className="text-right">
                <span
                  className={`text-2xl sm:text-3xl font-black ${
                    isNetNegativeOrInvalid ? 'text-rose-500 animate-pulse' : 'text-emerald-400'
                  }`}
                >
                  {isNetNegativeOrInvalid ? 'MONTANT INVALIDE' : formatFCFA(netAPayer)}
                </span>
              </div>
            </div>

            {isNetNegativeOrInvalid && (
              <p className="text-xs text-rose-400 font-bold flex items-center gap-1.5 mt-1">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>
                  Erreur : Le total des retenues ({formatFCFA(totalRetenues)}) dépasse les gains ({formatFCFA(totalGains)}). Ajustez les retenues ou la prime.
                </span>
              </p>
            )}
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Footer Actions (Requirement 6: Enregistrer le brouillon & Soumettre à la Direction) */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex flex-col sm:flex-row items-center justify-between gap-3 sticky bottom-0 z-10">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
          >
            Annuler
          </button>

          <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
            {/* Save as Draft Button */}
            <button
              type="button"
              disabled={isNetNegativeOrInvalid}
              onClick={() => handleSubmit(false)}
              className={`w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                isNetNegativeOrInvalid
                  ? 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 hover:border-slate-500 shadow-sm'
              }`}
            >
              <Save className="w-4 h-4 text-slate-400" />
              <span>Enregistrer le brouillon</span>
            </button>

            {/* Submit to Direction for Validation */}
            <button
              type="button"
              disabled={isNetNegativeOrInvalid}
              onClick={() => handleSubmit(true)}
              className={`w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg transition cursor-pointer ${
                isNetNegativeOrInvalid
                  ? 'bg-emerald-950/40 text-emerald-800 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/40'
              }`}
            >
              <Send className="w-4 h-4" />
              <span>Soumettre à la Direction pour validation</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
