import React from 'react';
import { X, CheckCircle2, ShieldCheck, Database, Lock, Smartphone, FileSpreadsheet, CreditCard, Radio, AlertCircle } from 'lucide-react';

interface RoadmapModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RoadmapModal: React.FC<RoadmapModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const steps = [
    {
      num: 'Étape 1',
      title: 'Base de données persistante & Multi-tenant sécurisé',
      status: 'À configurer',
      icon: Database,
      color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
      description:
        'Connecter une base de données relationnelle (PostgreSQL / Cloud SQL) ou NoSQL (Firestore) pour stocker de façon permanente les clients, contrats, agents, plannings, factures et rapports de ronde sans perte au rafraîchissement.',
      technicalDetails: 'Schéma strict pour agents de sécurité, géolocalisations, historisation des fiches de paie et séparations des données d’entreprise.',
    },
    {
      num: 'Étape 2',
      title: 'Authentification & Rôles stricts (RBAC)',
      status: 'À configurer',
      icon: Lock,
      color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
      description:
        'Mettre en place un système de connexion sécurisé avec comptes distincts : Direction (accès total & rapports financiers), Comptable (accès exclusif factures et paies), et Contrôleur terrain (accès restreint à la saisie des rondes et fiches de présence).',
      technicalDetails: 'Sessions chiffrées, gestion des mots de passe sécurisée, tokens JWT ou Firebase Auth, protection contre les usurpations.',
    },
    {
      num: 'Étape 3',
      title: 'Mode Hors-Ligne (PWA) pour le Contrôleur Terrain',
      status: 'À configurer',
      icon: Smartphone,
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
      description:
        'Au Niger (notamment en zones industrielles ou périphérie de Niamey), la couverture 4G peut être fluctuante. L’application doit pouvoir enregistrer les rondes, photos et pointages localement sur le smartphone, puis synchroniser automatiquement dès le retour du réseau.',
      technicalDetails: 'Service Workers, stockage IndexedDB local, réconciliation automatique avec horodatage infalsifiable.',
    },
    {
      num: 'Étape 4',
      title: 'Génération PDF officielle & Conformité réglementaire Niger',
      status: 'À configurer',
      icon: FileSpreadsheet,
      color: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
      description:
        'Impression et téléchargement en un clic de Factures pro-forma et définitives avec mentions DGI Niger (NIF, RCCM, TVA 19% ou attestation d’exonération pour les ONG), ainsi que des bulletins de paie avec cotisations CNSS réelles.',
      technicalDetails: 'Moteur PDF côté serveur ou client (ex: pdfmake/jspdf), modèles prêts pour signature et cachet d’entreprise.',
    },
    {
      num: 'Étape 5',
      title: 'Intégration Mobile Money & Alertes SMS d’urgence',
      status: 'À configurer',
      icon: CreditCard,
      color: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
      description:
        'Possibilité de recevoir des règlements de factures ou de verser des acomptes/salaires via Airtel Money Niger, Moov Flooz, Al Izza, et notification SMS immédiate à la Direction lors d’une alerte grave ou d’un abandon de poste la nuit.',
      technicalDetails: 'API Gateway locale sécurisée, Webhooks de paiement et service SMS (Twilio ou passerelle SMS locale nigérienne).',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-start justify-between bg-slate-900/90 sticky top-0 z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <ShieldCheck className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold text-white">Feuille de Route : Passage en Production Réelle</h2>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Cette maquette interactive démontre l’ergonomie complète. Voici les 5 jalons techniques pour la rendre 100% opérationnelle sans aucun coût caché.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4">
          <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/80 text-xs sm:text-sm text-slate-300 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-300">Engagement de transparence et budget maîtrisé :</p>
              <p className="mt-1 text-slate-300 leading-relaxed">
                Aucun abonnement payant, service Cloud facturé ou passerelle commerciale n’a été souscrit. Les étapes ci-dessous pourront être déployées progressivement avec des technologies gratuites ou à coût quasi-nul (hébergement gratuit de démarrage, bases de données open-source, etc.).
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {steps.map((step, idx) => {
              const Icon = step.icon;
              return (
                <div
                  key={idx}
                  className="p-4 rounded-xl bg-slate-800/40 border border-slate-800 hover:border-slate-700 transition"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2.5">
                      <span className={`p-2 rounded-lg border ${step.color}`}>
                        <Icon className="w-4 h-4" />
                      </span>
                      <div>
                        <span className="text-xs font-semibold tracking-wider uppercase text-slate-400">{step.num}</span>
                        <h3 className="font-bold text-slate-100 text-sm sm:text-base">{step.title}</h3>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700 self-start sm:self-auto">
                      {step.status}
                    </span>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed pl-0 sm:pl-11">
                    {step.description}
                  </p>
                  
                  <div className="mt-2.5 pl-0 sm:pl-11 text-xs text-slate-400 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/80">
                    <span className="font-semibold text-slate-300">Spécification technique recommandée : </span>
                    {step.technicalDetails}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-slate-400 text-center sm:text-left">
            Vous pouvez tester toutes les fonctionnalités de démonstration ci-dessous sans risque.
          </p>
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition cursor-pointer shadow-lg shadow-emerald-900/30"
          >
            Fermer et explorer la démonstration
          </button>
        </div>
      </div>
    </div>
  );
};
