export type UserSpace = 'direction' | 'comptabilite' | 'controleur';
export type UserRole = UserSpace;
export type StaffAccountRole = 'comptabilite' | 'controleur';
export type AccountStatus = 'actif' | 'desactive';

export interface UserProfile {
  uid: string;
  email: string;
  loginId?: string;
  entrepriseId?: string;
  nom: string;
  prenom?: string;
  role: UserSpace;
  statut: AccountStatus;
  grade?: string;
  telephone?: string;
  sitesAssignesIds?: string[];
  doitChangerPin?: boolean;
  doitChangerCodeSecret?: boolean;
  creeParUid?: string;
  derniereConnexion?: string;
  creeLe?: string;
}

export interface LoginIdentifierRecord {
  loginId: string;
  uid: string;
  entrepriseId?: string;
  role: StaffAccountRole;
  statut: AccountStatus;
  creeLe: string;
  creeParUid: string;
}

export interface DirectionPinConfig {
  salt: string;
  hash: string;
  iterations: number;
  doitChangerPin: boolean;
  misAJourLe: string;
}

export interface PinLockoutState {
  failedAttempts: number;
  lockedUntil: number | null;
}


export type MainNavModule = 
  | 'tableau_de_bord'
  | 'clients'
  | 'contrats'
  | 'sites'
  | 'agents'
  | 'factures'
  | 'paie'
  | 'rapports'
  | 'parametres'
  | 'mes_sites'
  | 'documents_comptables'
  | 'suivi_rondes';

export interface EnterpriseSettings {
  entrepriseId?: string;
  raisonSociale: string;
  sigle: string;
  nif: string;
  rccm: string;
  numeroCNSS: string;
  agrementMinistere: string;
  adresse: string;
  ville: string;
  telephonePrincipal: string;
  telephoneUrgence247: string;
  email: string;
  banquePrincipale: string;
  ribBancaire: string;
  tauxTVA: number; // 19%
  tauxCNSSOuvrier: number; // 5.25%
  logoUrl?: string; // Logo entreprise au format Data URL (Base64) ou URL d'image
}

export type StatutValidationPaie =
  | 'En préparation par Comptabilité'
  | 'Transmis à la Direction pour validation'
  | 'Validé par la Direction'
  | 'Salaires payés';

export interface ControleurProfile {
  id: string;
  nom: string;
  grade: string;
  telephone: string;
  zonePatrouille: string;
  sitesAssignesIds: string[];
}

export interface Client {
  id: string;
  entrepriseId?: string;
  nom: string;
  secteur: 'Banque' | 'Diplomatique' | 'ONG' | 'Industrie' | 'Commerce' | 'Résidence VIP';
  ville: string;
  adresse: string;
  contactNom: string;
  contactTelephone: string;
  email: string;
  statut: 'Actif' | 'En négociation' | 'Suspendu';
  nbSites: number;
  montantMensuelTotalFCFA: number;
}

// --- CONTRATS COMMERCIAUX (CLIENTS & PRESTATIONS) ---
export type TypePrestationCommerciale =
  | 'Prestation de gardiennage poste fixe 24/7'
  | 'Escorte & Cortège sécurisé'
  | 'Gardiennage événementiel & renfort'
  | 'Surveillance ponctuelle'
  | 'Sécurité rapprochée / VIP'
  | 'Mise à disposition d’agents de sécurité'
  | 'Autre prestation de sécurité';

export type ModeFacturationCommercial =
  | 'Mensuel'
  | 'Hebdomadaire'
  | 'Journalier'
  | 'Forfait unique'
  | 'Personnalisé';

export type StatutContratCommercial =
  | 'Brouillon'
  | 'En attente de signature'
  | 'Actif'
  | 'Suspendu'
  | 'Terminé'
  | 'Résilié'
  | 'En cours' // Rétrocompatibilité
  | 'À renouveler'; // Rétrocompatibilité

export interface ContratCommercial {
  id: string;
  entrepriseId?: string;
  numeroContrat: string;
  clientId: string;
  clientNom: string;
  siteNom: string;
  typePrestation: TypePrestationCommerciale;
  descriptionPrestation: string;
  dateDebut: string;
  dateFin?: string;
  dureeCalculee?: string;
  nombreAgents: number;
  horairesService: string;
  montantFCFA: number;
  modeFacturation: ModeFacturationCommercial;
  conditionsPaiement: string;
  estRenouvelable: boolean;
  dateRenouvellement?: string;
  statut: StatutContratCommercial;
  superviseurZone?: string;

  // Champs de rétrocompatibilité pour les composants existants
  montantMensuelHT: number;
  typeGarde?: string;
  effectifVigiles?: number;
  frequenceFacturation?: 'Mensuelle' | 'Trimestrielle' | 'Annuelle';
}

// Alias Contract pour rétrocompatibilité totale
export type Contract = ContratCommercial;

// --- CONTRATS DE TRAVAIL DES AGENTS (RH & EMPLOI) ---
export type TypeContratTravail = 'CDD' | 'CDI';

export type StatutContratTravail =
  | 'Brouillon'
  | 'En attente de signature'
  | 'Actif'
  | 'Terminé'
  | 'Résilié';

export interface ContratTravailAgent {
  id: string;
  entrepriseId?: string;
  numeroContrat: string; // Ex: "CT-CDD-2026-042" ou "CT-CDI-2024-001"
  agentId: string;
  agentMatricule: string;
  agentNom: string;
  agentPrenom: string;
  poste: string;
  typeContrat: TypeContratTravail; // CDD ou CDI
  dateDebut: string;
  dateFin?: string; // Facultatif pour CDI, requis pour CDD
  dureeCalculee?: string;
  salaireBase: number; // en FCFA
  primeAssiduite?: number;
  primeNuit?: number;
  indemnitePanier?: number;
  modePaiement: 'Virement bancaire' | 'Espèces contre émargement' | 'Airtel Money / Mobile Money' | 'Chèque';
  referencePaiement?: string;
  siteAffectation: string;
  statut: StatutContratTravail;
  alerteExpiration?: {
    estExpire: boolean;
    joursRestants: number;
    message: string;
  };
  notes?: string;
}

export interface PointControleSite {
  id: string; // Ex: "CKP-BSIC-01"
  entrepriseId?: string;
  siteId: string;
  siteNom: string;
  nom: string; // Ex: "Guérite Principale Accès Nord"
  emplacement: string; // Ex: "Rez-de-chaussée face Boulevard"
  consignes: string; // Ex: "Vérifier le portail, la serrure et l'éclairage de faction"
  ordre: number; // 1, 2, 3...
  qrPayload: string; // Format vérifiable: "NSP_PATROL:{siteId}:{pointId}:{cleSecurite}"
  estActif: boolean;
  creeLe: string;
}

export interface ProgrammeRondeSite {
  id: string;
  entrepriseId?: string;
  siteId: string;
  nomRonde: string; // Ex: "Ronde Nocturne 23h - 01h"
  heureDebut: string; // "23:00"
  heureFin: string; // "01:00"
  pointsObligatoiresIds: string[]; // Liste des IDs de points à flasher
  ordreStrict: boolean; // Si true, l'ordre des points doit être scrupuleusement respecté
  actif: boolean;
}

export type StatutScanConformite =
  | 'Conforme'
  | 'En retard'
  | 'Hors plage horaire'
  | 'Point répété';

export interface ScanPointControle {
  id: string; // Clé idempotente: "SCAN_${siteId}_${pointId}_${timestamp}"
  entrepriseId?: string;
  siteId: string;
  siteNom: string;
  pointId: string;
  pointNom: string;
  controleurId: string;
  controleurNom: string;
  controleurGrade: string;
  scanneLe: string; // Horodatage ISO
  horaireScan: string; // "23:14"
  dateScan: string; // "2026-10-31"
  statutConformite: StatutScanConformite;
  observations?: string;
  statutSynchro: 'synchronise' | 'en_attente';
  creeLe: string;
}

export interface SiteGardiennage {
  id: string;
  entrepriseId?: string;
  nom: string;
  clientId: string;
  clientNom: string;
  quartier: string;
  ville: string;
  postesRequis: number;
  effectifActuel: number;
  niveauRisque: 'Standard' | 'Élevé' | 'Sensible / VIP';
  responsableSite: string;
  telephoneResponsable: string;
  consignesParticulieres: string;
  derniereVisiteControle: string;
  statutConformite: 'Conforme' | 'Anomalie signalée' | 'Non contrôlé aujourd’hui';
  controleurAssigneId?: string;
  pointsControle?: PointControleSite[];
  programmesRondes?: ProgrammeRondeSite[];
}

export interface AgentSecurite {
  id: string;
  entrepriseId?: string;
  // Section 1: Identité et coordonnées
  matricule: string; // Unique, automatique
  photoUrl?: string; // Photo d'identité de l'agent (Data URL JPEG/PNG compressée pour badge PVC)
  nom: string;
  prenom: string;
  dateNaissance: string;
  telephone: string;
  quartier: string; // Adresse ou quartier
  contactUrgenceNom?: string; // Facultatif
  contactUrgenceTelephone?: string; // Facultatif
  groupeSanguin: string;
  numeroCNSS: string;

  // Section 2: Informations professionnelles
  dateEmbauche: string;
  poste: string;
  typeContrat: 'CDI' | 'CDD 12 mois' | 'Période d’essai' | 'Renfort temporaire';
  siteActuel: string;
  siteId: string;
  horaire: 'Poste Jour (06h-18h)' | 'Poste Nuit (18h-06h)' | 'Repos' | 'Congé';
  statut: 'En poste' | 'De repos' | 'En congé' | 'Absent' | 'Sorti (Démission / Fin de contrat)';
  equipement: {
    tenueComplete: boolean;
    rangers: boolean;
    badge: boolean;
    tonfaOuMatraque: boolean;
    torche: boolean;
    sifflet: boolean;
  };

  // Section 3: Informations salariales (Direction & Comptabilité uniquement)
  salaireBase: number; // en FCFA
  primeNuit: number;
  primeAssiduite: number;
  indemnitePanier: number;
  retenuesOuAvances: number;
  modePaiement: 'Virement bancaire' | 'Espèces contre émargement' | 'Airtel Money / Mobile Money' | 'Chèque';
  referencePaiement?: string; // Ex: Compte bancaire ou N° Mobile Money
}

export type StatutFacture =
  | 'Brouillon'
  | 'À payer'
  | 'Partielle'
  | 'Partiellement payée'
  | 'Payée'
  | 'En retard'
  | 'En attente';

export interface ReglementFacture {
  id: string;
  dateReglement: string;
  montant: number; // en FCFA
  modePaiement: 'Virement bancaire' | 'Chèque' | 'Espèces' | 'Airtel Money / Mobile Money';
  reference?: string;
  note?: string;
}

export interface FactureMensuelle {
  id: string;
  entrepriseId?: string;
  numeroFacture: string;
  clientId: string;
  clientNom: string;
  contratId?: string;
  contratNumero?: string;
  siteNom?: string;
  mois: string; // e.g. "Octobre 2026"
  dateEmission: string;
  dateEcheance: string;
  descriptionPrestation?: string;
  montantHT: number;
  tauxTVA: number; // 0% pour ONG exonérées ou 19% TVA normale Niger
  montantTVA: number;
  montantTTC: number;
  montantRegle: number; // Somme des règlements perçus
  resteADevoir: number; // montantTTC - montantRegle
  statut: StatutFacture;
  reglements: ReglementFacture[];
  modePaiement?: 'Virement bancaire' | 'Chèque' | 'Espèces' | 'Airtel Money / Mobile Money';
  notesInternes?: string;
}

export type StatutFichePaie =
  | 'Brouillon'
  | 'En attente de validation'
  | 'Validée'
  | 'Payée'
  | 'Rejetée';

export interface FichePaieAgent {
  id: string;
  entrepriseId?: string;
  agentId: string;
  agentMatricule: string;
  agentNom: string;
  poste: string;
  mois: string; // e.g. "Octobre 2026"
  salaireBase: number; // en FCFA (récupéré automatiquement depuis la fiche)
  prime: number; // Prime saisie/modifiée par la Comptabilité
  primeDeNuit?: number;
  primeDePanier?: number;
  primeAssiduite?: number;
  totalBrut: number;
  retenueCNSS: number; // Saisie/modifiée par la Comptabilité (~5.25% part ouvrière)
  acompteRetenu: number; // Saisi/modifié par la Comptabilité
  autresRetenues: number; // Champ facultatif pour autres retenues (pénalités, absences non justifiées...)
  commentaire?: string; // Champ facultatif: motif ou observations de paie
  netAPayer: number; // Formule: salaire de base + prime - CNSS - acompte - autres retenues
  statut: StatutFichePaie;
  motifRejet?: string; // Saisi par la Direction lors d'un rejet
  commentaireValidation?: string; // Visa / note de la Direction
  dateValidation?: string;
  datePaiement?: string; // Enregistré par la Comptabilité lors du paiement réel
  montantPaye?: number;
  modePaiement?: 'Virement bancaire' | 'Airtel Money' | 'Moov Money' | 'Al Izza' | 'Espèces contre émargement' | 'Chèque';
  referencePaiement?: string; // Référence de quittance ou de transaction
}

export interface RapportControle {
  id: string;
  entrepriseId?: string;
  dateHeure: string;
  controleurNom: string;
  siteId: string;
  siteNom: string;
  quartier: string;
  agentsPresents: string[];
  agentsAbsents: string[];
  tenueReglementaire: 'Impeccable' | 'Incomplète' | 'Non conforme';
  registreMainCouranteTenu: boolean;
  equipementConforme: boolean;
  vigilancePoste: 'Excellente' | 'Moyenne' | 'Endormissement / Défaut d’attention';
  incidentSignale: boolean;
  typeIncident?: string;
  descriptionIncident?: string;
  coordonneesGPS: string;
  observations: string;
  statut: 'Validé' | 'Action requise' | 'Alerte transmise Direction';
  photoUrl?: string;
}
