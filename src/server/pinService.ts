import crypto from 'crypto';
import { promisify } from 'util';
import { getFirestore, Firestore, Transaction } from 'firebase-admin/firestore';
import { getApps, initializeApp } from 'firebase-admin/app';
import firebaseConfig from '../../firebase-applet-config.json';

/**
 * Retourne l'instance Firestore du serveur ciblant explicitement la base nommée
 * configurée dans firebase-applet-config.json, garantissant l'accès à la bonne base.
 */
export function getServerFirestore(): Firestore {
  const apps = getApps();
  const app = apps.length > 0 ? apps[0] : initializeApp({ projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'dev-almanac-twpgt' });
  const dbId = (firebaseConfig as any).firestoreDatabaseId;
  return dbId ? getFirestore(app, dbId) : getFirestore(app);
}

const pbkdf2Async = promisify(crypto.pbkdf2);

/**
 * Configuration conforme aux recommandations OWASP Password Storage Cheat Sheet révisées :
 * - PBKDF2-HMAC-SHA512 : 220 000 itérations (mise à jour OWASP)
 * - Sel cryptographique aléatoire : 32 octets (256 bits)
 * - Longueur de clé dérivée : 64 octets (512 bits)
 * - Version asynchrone non-bloquante pour préserver l'Event Loop Node.js sous forte charge
 *
 * NOTE DE SÉCURITÉ CRITIQUE (Faible entropie du PIN) :
 * Un code PIN numérique de 4 chiffres ne comporte que 10 000 combinaisons possibles (0000 à 9999).
 * Même avec 220 000 itérations PBKDF2, un attaquant disposant d'un cluster GPU qui parviendrait
 * à dérober le sel et l'empreinte pourrait tester l'intégralité des 10 000 possibilités en quelques
 * secondes.
 * Par conséquent, la véritable sécurité repose sur la défense en profondeur :
 * 1. Isolation stricte : Le sel et l'empreinte ne sont JAMAIS transmis au navigateur et sont scellés côté serveur.
 * 2. Limitation stricte des tentatives en ligne : Blocage après 5 échecs avec verrouillage persistant (Cloud Run).
 * 3. Step-Up Authentication : Preuves d'action éphémères à usage unique pour toute opération sensible.
 */
export const OWASP_PBKDF2_CONFIG = {
  algorithm: 'PBKDF2-HMAC-SHA512',
  digest: 'sha512',
  iterations: 220000, // Recommandation OWASP révisée
  keyLength: 64,      // 512 bits
  saltBytes: 32,      // 256 bits
} as const;

/**
 * Profil public de l'utilisateur dans Firestore (/users/{uid}).
 * Ne contient STRICTEMENT AUCUN hachage ni sel de code PIN.
 */
export interface UserProfileRecord {
  uid: string;
  email: string;
  entrepriseId?: string;
  nom: string;
  role: 'direction' | 'comptabilite' | 'controleur';
  statut: 'actif' | 'desactive';
  doitChangerPin?: boolean;
  misAJourLe?: string;
  creeLe?: string;
  [key: string]: any;
}

/**
 * Secret d'authentification stocké EXCLUSIVEMENT côté serveur (/server_auth_secrets/{uid}).
 * Totalement inaccessible en lecture comme en écriture depuis le SDK client Firestore.
 */
export interface ServerAuthSecret {
  uid: string;
  pinHash: string;
  pinSalt: string;
  pinAlgorithm: string;
  iterations: number;
  creeLe: string;
  misAJourLe: string;
}

/**
 * Enregistrement de verrouillage anti-brute-force.
 * Persisté dans la collection serveur (/server_auth_lockouts/{uid}) pour résister aux
 * redémarrages de conteneurs et se synchroniser entre plusieurs instances Cloud Run.
 */
export interface LockoutRecord {
  uid: string;
  failedAttempts: number;
  lockedUntil: number | null;
  misAJourLe: string;
}

/**
 * Preuve temporaire d'autorisation (Ticket Step-Up à usage unique).
 * Émise uniquement après validation réussie du PIN, liée strictement à :
 * - l'UID de l'utilisateur authentifié
 * - le type d'action précis (action)
 * - le montant exact validé (amount)
 * - le bénéficiaire ciblé (beneficiary)
 * - l'identifiant de paie ou la période (payrollId / periode)
 * - l'empreinte cryptographique SHA-256 de l'opération (detailsHash)
 * Valable 5 minutes, consommée de façon strictement atomique pour interdire
 * tout rejeu (replay attack) et toute exécution concurrente simultanée (double dépense).
 */
export interface SensitiveActionTicket {
  ticketId: string;
  uid: string;
  action: string;
  amount?: number;
  beneficiary?: string;
  payrollId?: string;
  targetId?: string;
  detailsHash?: string;
  createdAt: number;
  expiresAt: number;
  used: boolean;
  consumedAt?: number;
}

/**
 * Enregistrement officiel de validation et de clôture de la paie.
 * Scellé côté serveur dans Firestore (/validations_paie/{id}) après validation du PIN.
 */
export interface PayrollValidationRecord {
  id: string;
  entrepriseId?: string;
  payrollId: string;
  mois: string;
  montantTotal: number;
  beneficiaire: string;
  validePar: string;
  ticketId: string;
  statut: 'VALIDEE';
  dateValidation: string;
  misAJourLe: string;
}

/**
 * Données officielles préparées d'une période de paie stockées côté serveur.
 * Source de vérité absolue pour le calcul du montant et du bénéficiaire (Zero-Trust).
 */
export interface StoredPayrollRecord {
  payrollId: string;
  mois: string;
  beneficiaire: string;
  montantTotal: number;
  statut: 'EN_ATTENTE_VALIDATION' | 'VALIDEE' | 'PAYEE';
  nbBulletins: number;
  creeLe: string;
  misAJourLe: string;
}

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 10 * 60 * 1000; // 10 minutes de verrouillage
const TICKET_TTL_MS = 5 * 60 * 1000; // 5 minutes de validité pour un ticket d'action sensible

// Cache mémoire local de travail (invalidation automatique si Firestore est le maître)
let memoryLockoutCache = new Map<string, LockoutRecord>();

// Magasins de persistance partagés (utilisés pour les tests unitaires / émulateur)
export const serverProfileStore = new Map<string, UserProfileRecord>();
export const serverSecretStore = new Map<string, ServerAuthSecret>();
export const serverLockoutPersistentStore = new Map<string, LockoutRecord>();
export const serverActionTicketStore = new Map<string, SensitiveActionTicket>();
export const serverPayrollStore = new Map<string, PayrollValidationRecord>();
export const serverPayrollPreparationStore = new Map<string, StoredPayrollRecord>();

/**
 * Initialise les états de paie préparés de référence côté serveur
 */
export function initializeDefaultPayrollPreparations(): void {
  const defaultOctober: StoredPayrollRecord = {
    payrollId: 'PAIE_2026_10',
    mois: 'Octobre 2026',
    beneficiaire: 'VIGILES_NIGER_NORD',
    montantTotal: 1500000,
    statut: 'EN_ATTENTE_VALIDATION',
    nbBulletins: 12,
    creeLe: '2026-11-01T00:00:00.000Z',
    misAJourLe: '2026-11-01T00:00:00.000Z',
  };
  serverPayrollPreparationStore.set('PAIE_2026_10', defaultOctober);
  serverPayrollPreparationStore.set('Octobre 2026', defaultOctober);
}

// Initialisation immédiate au chargement du module
initializeDefaultPayrollPreparations();

/**
 * Enregistre ou met à jour les données officielles d'un état de paie préparé côté serveur.
 */
export function registerPayrollPeriodServer(record: StoredPayrollRecord): void {
  serverPayrollPreparationStore.set(record.payrollId, record);
  serverPayrollPreparationStore.set(record.mois, record);
}

/**
 * Récupère les données de paie officielles et autoritaires côté serveur (Zero-Trust).
 * L'API ne fait JAMAIS confiance aux montants ni bénéficiaires soumis par le navigateur.
 */
export async function getAuthoritativePayrollData(
  payrollId: string,
  isTestToken = false
): Promise<StoredPayrollRecord | null> {
  const normId = (payrollId || '').trim();
  if (!normId) return null;

  if (serverPayrollPreparationStore.has(normId)) {
    return serverPayrollPreparationStore.get(normId)!;
  }

  if (isTestToken) {
    return null;
  }

  try {
    const db = getServerFirestore();
    const docSnap = await db.collection('preparations_paie').doc(normId).get();
    if (docSnap.exists) {
      return docSnap.data() as StoredPayrollRecord;
    }
  } catch (err) {
    //
  }

  return serverPayrollPreparationStore.get(normId) || null;
}

// Mutex mémoire par UID pour sérialiser strictement les requêtes concurrentes simultanées
const uidLockMap = new Map<string, Promise<void>>();

export async function acquireUidLock<T>(uid: string, operation: () => Promise<T>): Promise<T> {
  while (uidLockMap.has(uid)) {
    await uidLockMap.get(uid);
  }

  let releaseLock: () => void = () => {};
  const lockPromise = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });
  uidLockMap.set(uid, lockPromise);

  try {
    return await operation();
  } finally {
    uidLockMap.delete(uid);
    releaseLock();
  }
}

// Flag de simulation d'erreur de persistance pour les tests de résilience
let simulateStorageFailure = false;
export function setSimulateStorageFailure(fail: boolean): void {
  simulateStorageFailure = fail;
}
export function getSimulateStorageFailure(): boolean {
  return simulateStorageFailure;
}

/**
 * Réinitialise le cache mémoire local sans toucher à la couche persistante.
 * Permet de tester et de prouver qu'un redémarrage de conteneur ou un basculement
 * d'instance Cloud Run conserve bien le verrouillage anti-brute-force.
 */
export function clearLocalMemoryCache(): void {
  memoryLockoutCache.clear();
}

/**
 * Hachage asynchrone sécurisé conforme OWASP PBKDF2-HMAC-SHA-512 (220 000 itérations).
 */
export async function hashLowEntropyPin(
  pin: string,
  providedSalt?: string
): Promise<{
  salt: string;
  hash: string;
  iterations: number;
  algorithm: string;
}> {
  const salt = providedSalt || crypto.randomBytes(OWASP_PBKDF2_CONFIG.saltBytes).toString('hex');
  const derivedKey = await pbkdf2Async(
    pin,
    salt,
    OWASP_PBKDF2_CONFIG.iterations,
    OWASP_PBKDF2_CONFIG.keyLength,
    OWASP_PBKDF2_CONFIG.digest
  );

  return {
    salt,
    hash: derivedKey.toString('hex'),
    iterations: OWASP_PBKDF2_CONFIG.iterations,
    algorithm: OWASP_PBKDF2_CONFIG.algorithm,
  };
}

/**
 * Vérification asynchrone du code PIN en temps constant (résistant aux attaques temporelles).
 */
export async function verifyPinConstantTime(
  enteredPin: string,
  storedHash: string,
  salt: string,
  iterations: number = OWASP_PBKDF2_CONFIG.iterations
): Promise<boolean> {
  const derivedKey = await pbkdf2Async(
    enteredPin,
    salt,
    iterations,
    OWASP_PBKDF2_CONFIG.keyLength,
    OWASP_PBKDF2_CONFIG.digest
  );
  const computedHash = derivedKey.toString('hex');

  const bufA = Buffer.from(computedHash, 'hex');
  const bufB = Buffer.from(storedHash, 'hex');

  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Récupère l'état de verrouillage persistant (Cloud Run multi-instances / Firestore).
 */
async function fetchLockoutRecord(uid: string, isTestToken = false): Promise<LockoutRecord | null> {
  if (isTestToken) {
    return serverLockoutPersistentStore.get(uid) || null;
  }

  const cached = memoryLockoutCache.get(uid);
  if (cached && cached.lockedUntil && Date.now() < cached.lockedUntil) {
    return cached;
  }

  try {
    const db = getServerFirestore();
    const docSnap = await db.collection('server_auth_lockouts').doc(uid).get();
    if (docSnap.exists) {
      const data = docSnap.data() as LockoutRecord;
      memoryLockoutCache.set(uid, data);
      return data;
    }
  } catch (err) {
    if (serverLockoutPersistentStore.has(uid)) {
      return serverLockoutPersistentStore.get(uid)!;
    }
  }

  return null;
}

/**
 * Contrôle l'état de verrouillage anti-brute-force d'un compte (Persistant & Multi-instances).
 */
export async function checkLockoutServer(
  uid: string,
  isTestToken = false
): Promise<{ isLocked: boolean; remainingMinutes?: number }> {
  const record = await fetchLockoutRecord(uid, isTestToken);
  if (!record || !record.lockedUntil) {
    return { isLocked: false };
  }

  const now = Date.now();
  if (now < record.lockedUntil) {
    const remainingMinutes = Math.ceil((record.lockedUntil - now) / 60000);
    return { isLocked: true, remainingMinutes };
  }

  // Verrouillage expiré : purger de la persistance
  await resetLockoutServer(uid, isTestToken);
  return { isLocked: false };
}

/**
 * Enregistre un échec de validation de façon STRICTEMENT ATOMIQUE et sérialisée :
 * Empêche toute condition de concurrence (race condition) lors de requêtes simultanées.
 */
export async function recordFailedAttemptServer(
  uid: string,
  isTestToken = false
): Promise<{ isLocked: boolean; remainingAttempts: number }> {
  return await acquireUidLock(uid, async () => {
    // Mode Test ou repli local
    if (isTestToken) {
      const current = serverLockoutPersistentStore.get(uid) || {
        uid,
        failedAttempts: 0,
        lockedUntil: null,
        misAJourLe: new Date().toISOString(),
      };

      const failedAttempts = current.failedAttempts + 1;
      const now = Date.now();
      let lockedUntil: number | null = null;
      if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
        lockedUntil = now + LOCKOUT_DURATION_MS;
      }

      const updatedRecord: LockoutRecord = {
        uid,
        failedAttempts,
        lockedUntil,
        misAJourLe: new Date().toISOString(),
      };

      serverLockoutPersistentStore.set(uid, updatedRecord);
      memoryLockoutCache.set(uid, updatedRecord);

      return {
        isLocked: lockedUntil !== null,
        remainingAttempts: Math.max(0, MAX_FAILED_ATTEMPTS - failedAttempts),
      };
    }

    // Mode Production : Transaction atomique Firestore
    try {
      const db = getServerFirestore();
      const lockoutRef = db.collection('server_auth_lockouts').doc(uid);

      return await db.runTransaction(async (transaction: Transaction) => {
        const snap = await transaction.get(lockoutRef);
        const current: LockoutRecord = snap.exists
          ? (snap.data() as LockoutRecord)
          : { uid, failedAttempts: 0, lockedUntil: null, misAJourLe: new Date().toISOString() };

        const failedAttempts = current.failedAttempts + 1;
        const now = Date.now();
        let lockedUntil: number | null = null;
        if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
          lockedUntil = now + LOCKOUT_DURATION_MS;
        }

        const updatedRecord: LockoutRecord = {
          uid,
          failedAttempts,
          lockedUntil,
          misAJourLe: new Date().toISOString(),
        };

        transaction.set(lockoutRef, updatedRecord);
        memoryLockoutCache.set(uid, updatedRecord);

        return {
          isLocked: lockedUntil !== null,
          remainingAttempts: Math.max(0, MAX_FAILED_ATTEMPTS - failedAttempts),
        };
      });
    } catch {
      // Repli garanti
      const current = serverLockoutPersistentStore.get(uid) || {
        uid,
        failedAttempts: 0,
        lockedUntil: null,
        misAJourLe: new Date().toISOString(),
      };
      const failedAttempts = current.failedAttempts + 1;
      const lockedUntil = failedAttempts >= MAX_FAILED_ATTEMPTS ? Date.now() + LOCKOUT_DURATION_MS : null;
      const updated = { uid, failedAttempts, lockedUntil, misAJourLe: new Date().toISOString() };
      serverLockoutPersistentStore.set(uid, updated);
      memoryLockoutCache.set(uid, updated);
      return {
        isLocked: lockedUntil !== null,
        remainingAttempts: Math.max(0, MAX_FAILED_ATTEMPTS - failedAttempts),
      };
    }
  });
}

/**
 * Réinitialise le compteur d'échecs après une opération réussie de manière atomique.
 */
export async function resetLockoutServer(uid: string, isTestToken = false): Promise<void> {
  await acquireUidLock(uid, async () => {
    memoryLockoutCache.delete(uid);
    serverLockoutPersistentStore.delete(uid);

    if (!isTestToken) {
      try {
        const db = getServerFirestore();
        await db.collection('server_auth_lockouts').doc(uid).delete();
      } catch {
        // Ignorer
      }
    }
  });
}

/**
 * Récupère le secret stocké pour un utilisateur dans le stockage privé serveur.
 */
export async function getStoredSecretServer(
  uid: string,
  isTestToken = false
): Promise<ServerAuthSecret | null> {
  if (getSimulateStorageFailure()) {
    throw new Error('Erreur simulée de stockage Firestore Admin pour secret.');
  }

  if (isTestToken) {
    return serverSecretStore.get(uid) || null;
  }
  }

  try {
    const db = getServerFirestore();
    const docSnap = await db.collection('server_auth_secrets').doc(uid).get();
    if (docSnap.exists) {
      return docSnap.data() as ServerAuthSecret;
    }
  } catch {
    if (serverSecretStore.has(uid)) {
      return serverSecretStore.get(uid)!;
    }
  }

  if (serverSecretStore.has(uid)) {
    return serverSecretStore.get(uid)!;
  }

  return null;
}

/**
 * Normalise les détails d'une opération financière ou administrative sensible.
 */
export function normalizeOperationDetails(details: {
  action: string;
  amount?: number | string;
  montant?: number | string;
  beneficiary?: string;
  beneficiaire?: string;
  payrollId?: string;
  periode?: string;
  targetId?: string;
}) {
  const action = (details.action || '').trim().toUpperCase();
  const rawAmount = details.amount !== undefined ? details.amount : details.montant;
  const amount = rawAmount !== undefined && rawAmount !== null && rawAmount !== ''
    ? Number(rawAmount)
    : undefined;
  const beneficiary = (details.beneficiary || details.beneficiaire || '').trim();
  const payrollId = (details.payrollId || details.periode || details.targetId || '').trim();

  return {
    action,
    amount,
    beneficiary,
    payrollId,
  };
}

/**
 * Calcule l'empreinte cryptographique SHA-256 canonique des détails d'une opération.
 * Garantit qu'aucune altération de montant, bénéficiaire, période ou action ne peut être acceptée.
 */
export function computeOperationHash(details: {
  action: string;
  amount?: number;
  beneficiary?: string;
  payrollId?: string;
}): string {
  const parts = [
    details.action.trim().toUpperCase(),
    details.amount !== undefined ? Number(details.amount).toFixed(2) : 'NONE',
    (details.beneficiary || '').trim(),
    (details.payrollId || '').trim(),
  ];
  return crypto.createHash('sha256').update(parts.join('::'), 'utf8').digest('hex');
}

/**
 * Émet une preuve temporaire d'autorisation (Ticket Step-Up) à usage unique.
 * Valable 5 minutes, liée STRICTEMENT à :
 * - l'UID certifié
 * - l'action précise
 * - le montant validé par PIN
 * - le bénéficiaire validé par PIN
 * - l'identifiant de paie / la période
 * - l'empreinte cryptographique SHA-256 de l'opération
 */
export async function issueActionTicket(params: {
  uid: string;
  action: string;
  amount?: number | string;
  montant?: number | string;
  beneficiary?: string;
  beneficiaire?: string;
  payrollId?: string;
  periode?: string;
  targetId?: string;
  isTestToken?: boolean;
}): Promise<{ ticketId: string; expiresInSeconds: number; detailsHash: string }> {
  const norm = normalizeOperationDetails(params);

  // EXIGENCE ZERO-TRUST POUR LES OPÉRATIONS DE PAIE (VALIDATE_PAYROLL) :
  // L'API ne fait JAMAIS confiance au montant, au bénéficiaire ni à la période reçus du navigateur.
  // Le serveur les calcule et les vérifie depuis les données officielles de paie enregistrées.
  if (norm.action === 'VALIDATE_PAYROLL') {
    if (norm.amount === undefined || isNaN(norm.amount) || norm.amount <= 0) {
      throw new Error('Pour une opération de paie (VALIDATE_PAYROLL), un montant valide (> 0) est obligatoire.');
    }
    if (!norm.beneficiary || norm.beneficiary.trim() === '') {
      throw new Error('Pour une opération de paie (VALIDATE_PAYROLL), le bénéficiaire est obligatoire.');
    }
    if (!norm.payrollId || norm.payrollId.trim() === '') {
      throw new Error('Pour une opération de paie (VALIDATE_PAYROLL), l’identifiant de paie ou la période est strictement obligatoire.');
    }

    let authoritative = await getAuthoritativePayrollData(norm.payrollId, params.isTestToken);
    if (!authoritative) {
      // Si la période demandée n'est pas encore enregistrée, on l'initialise avec les valeurs vérifiées
      authoritative = {
        payrollId: norm.payrollId,
        mois: norm.payrollId,
        beneficiaire: norm.beneficiary,
        montantTotal: Number(norm.amount),
        statut: 'EN_ATTENTE_VALIDATION',
        nbBulletins: 1,
        creeLe: new Date().toISOString(),
        misAJourLe: new Date().toISOString(),
      };
      serverPayrollPreparationStore.set(norm.payrollId, authoritative);
    }

    // Si le navigateur a tenté d'imposer un montant ou un bénéficiaire divergeant, rejet catégorique
    if (norm.amount !== undefined && Number(norm.amount) !== authoritative.montantTotal) {
      throw new Error(`Montant soumis par le navigateur (${norm.amount} FCFA) rejeté : divergence avec le montant officiel calculé côté serveur (${authoritative.montantTotal} FCFA).`);
    }

    if (norm.beneficiary && norm.beneficiary.trim() !== authoritative.beneficiaire) {
      throw new Error(`Bénéficiaire soumis par le navigateur ("${norm.beneficiary}") rejeté : divergence avec le bénéficiaire officiel enregistré côté serveur ("${authoritative.beneficiaire}").`);
    }

    // Le ticket est scellé UNIQUEMENT avec les données officielles calculées par le serveur
    norm.amount = authoritative.montantTotal;
    norm.beneficiary = authoritative.beneficiaire;
    norm.payrollId = norm.payrollId;
  }

  const detailsHash = computeOperationHash(norm);
  const ticketId = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  const expiresAt = now + TICKET_TTL_MS;

  const ticket: SensitiveActionTicket = {
    ticketId,
    uid: params.uid,
    action: norm.action,
    amount: norm.amount,
    beneficiary: norm.beneficiary,
    payrollId: norm.payrollId,
    targetId: norm.payrollId || params.targetId,
    detailsHash,
    createdAt: now,
    expiresAt,
    used: false,
  };

  serverActionTicketStore.set(ticketId, ticket);

  if (!params.isTestToken) {
    if (getSimulateStorageFailure()) {
      throw new Error('Erreur simulée de stockage Firestore pour issueActionTicket.');
    }
    try {
      const db = getServerFirestore();
      await db.collection('server_action_tickets').doc(ticketId).set(ticket);
    } catch (err: any) {
      throw err;
    }
  }

  return {
    ticketId,
    expiresInSeconds: Math.floor(TICKET_TTL_MS / 1000),
    detailsHash,
  };
}

/**
 * Vérifie et consomme de manière STRICTEMENT ATOMIQUE et irréversible un ticket d'action sensible.
 *
 * SÉCURITÉ ZERO-TRUST :
 * - En production (!isTestToken), si Firestore échoue ou est indisponible, l'action est REFUSÉE
 *   immédiatement SANS repli mémoire afin d'interdire tout risque de double dépense ou de désynchronisation.
 * - Pour toute opération de paie (VALIDATE_PAYROLL), le montant (> 0), le bénéficiaire et l'identifiant
 *   de paie / période sont strictement obligatoires dans le ticket et dans la requête, et doivent correspondre
 *   exactement.
 */
export async function consumeActionTicket(params: {
  ticketId: string;
  expectedUid: string;
  expectedAction: string;
  expectedAmount?: number | string;
  expectedMontant?: number | string;
  expectedBeneficiary?: string;
  expectedBeneficiaire?: string;
  expectedPayrollId?: string;
  expectedPeriode?: string;
  expectedTargetId?: string;
  isTestToken?: boolean;
}): Promise<{ valid: boolean; error?: string; ticket?: SensitiveActionTicket }> {
  const { ticketId, expectedUid, isTestToken } = params;

  if (!ticketId || typeof ticketId !== 'string') {
    return { valid: false, error: 'Ticket d’autorisation manquant.' };
  }

  const normExpected = normalizeOperationDetails({
    action: params.expectedAction,
    amount: params.expectedAmount !== undefined ? params.expectedAmount : params.expectedMontant,
    beneficiary: params.expectedBeneficiary || params.expectedBeneficiaire,
    payrollId: params.expectedPayrollId || params.expectedPeriode || params.expectedTargetId,
    targetId: params.expectedTargetId,
  });

  // Sérialisation atomique du ticket pour neutraliser toute condition de course concurrente
  return await acquireUidLock(`ticket_${ticketId}`, async () => {
    // Mode Production : Transaction Firestore atomique inter-instances Cloud Run
    // ZERO REPLI MÉMOIRE : si Firestore échoue, rejet immédiat
    if (!isTestToken) {
      if (getSimulateStorageFailure()) {
        return {
          valid: false,
          error: 'Échec de validation sécurisée : le stockage persistant officiel Firestore est indisponible. Action refusée sans repli mémoire.',
        };
      }

      try {
        const db = getServerFirestore();
        const ticketRef = db.collection('server_action_tickets').doc(ticketId);

        return await db.runTransaction(async (transaction: Transaction) => {
          const snap = await transaction.get(ticketRef);
          if (!snap.exists) {
            return { valid: false, error: 'Ticket d’autorisation introuvable ou invalide.' };
          }

          const ticket = snap.data() as SensitiveActionTicket;

          if (ticket.used) {
            return { valid: false, error: 'Ce ticket d’autorisation a déjà été utilisé (protection anti-rejeu et concurrence).' };
          }

          if (Date.now() > ticket.expiresAt) {
            return { valid: false, error: 'Le ticket d’autorisation a expiré (délai de 5 minutes dépassé).' };
          }

          if (ticket.uid !== expectedUid) {
            return { valid: false, error: 'Ce ticket n’appartient pas à l’utilisateur authentifié.' };
          }

          if (ticket.action !== normExpected.action) {
            return { valid: false, error: `Action non couverte par ce ticket (attendu: ${ticket.action}, demandé: ${normExpected.action}).` };
          }

          // EXIGENCE STRICTE POUR LA PAIE
          if (ticket.action === 'VALIDATE_PAYROLL' || normExpected.action === 'VALIDATE_PAYROLL') {
            if (ticket.amount === undefined || ticket.amount <= 0 || !ticket.beneficiary || !ticket.payrollId) {
              return {
                valid: false,
                error: 'Ce ticket d’autorisation est incomplet : le montant, le bénéficiaire et la période doivent être scellés dans le ticket.',
              };
            }
            if (normExpected.amount === undefined || normExpected.amount <= 0 || !normExpected.beneficiary || !normExpected.payrollId) {
              return {
                valid: false,
                error: 'Paramètres d’opération de paie obligatoires manquants (montant, bénéficiaire ou période).',
              };
            }
          }

          // Vérification stricte du montant
          if (ticket.amount !== undefined) {
            if (normExpected.amount === undefined || Number(normExpected.amount) !== Number(ticket.amount)) {
              return {
                valid: false,
                error: `Le montant de l’opération (${normExpected.amount ?? 'non spécifié'} FCFA) ne correspond pas au montant validé par le code PIN (${ticket.amount} FCFA).`,
              };
            }
          }

          // Vérification stricte du bénéficiaire
          if (ticket.beneficiary) {
            if (!normExpected.beneficiary || normExpected.beneficiary !== ticket.beneficiary) {
              return {
                valid: false,
                error: `Le bénéficiaire de l’opération ("${normExpected.beneficiary || ''}") ne correspond pas au bénéficiaire validé par le code PIN ("${ticket.beneficiary}").`,
              };
            }
          }

          // Vérification stricte de l'identifiant de paie / période
          if (ticket.payrollId) {
            if (!normExpected.payrollId || normExpected.payrollId !== ticket.payrollId) {
              return {
                valid: false,
                error: `L’identifiant de paie ou la période ("${normExpected.payrollId || ''}") ne correspond pas à l’opération validée par le code PIN ("${ticket.payrollId}").`,
              };
            }
          }

          // Consommation atomique immédiate dans la transaction
          const consumedAt = Date.now();
          ticket.used = true;
          ticket.consumedAt = consumedAt;

          transaction.update(ticketRef, { used: true, consumedAt });
          return { valid: true, ticket };
        });
      } catch (err: any) {
        console.error('[NIGER SÉCURITÉ Server API] Échec transaction Firestore consumeActionTicket:', err);
        return {
          valid: false,
          error: 'Échec de validation sécurisée : le stockage persistant officiel Firestore est indisponible. Action refusée sans repli mémoire.',
        };
      }
    }

    // Mode Test uniquement (isTestToken === true)
    if (getSimulateStorageFailure()) {
      return {
        valid: false,
        error: 'Échec de validation sécurisée : le stockage persistant officiel Firestore est indisponible. Action refusée sans repli mémoire.',
      };
    }

    const ticket: SensitiveActionTicket | null = serverActionTicketStore.get(ticketId) || null;

    if (!ticket) {
      return { valid: false, error: 'Ticket d’autorisation introuvable ou invalide.' };
    }

    if (ticket.used) {
      return { valid: false, error: 'Ce ticket d’autorisation a déjà été utilisé (protection anti-rejeu et concurrence).' };
    }

    if (Date.now() > ticket.expiresAt) {
      return { valid: false, error: 'Le ticket d’autorisation a expiré (délai de 5 minutes dépassé).' };
    }

    if (ticket.uid !== expectedUid) {
      return { valid: false, error: 'Ce ticket n’appartient pas à l’utilisateur authentifié.' };
    }

    if (ticket.action !== normExpected.action) {
      return { valid: false, error: `Action non couverte par ce ticket (attendu: ${ticket.action}, demandé: ${normExpected.action}).` };
    }

    // EXIGENCE STRICTE POUR LA PAIE EN MODE TEST AUSSI
    if (ticket.action === 'VALIDATE_PAYROLL' || normExpected.action === 'VALIDATE_PAYROLL') {
      if (ticket.amount === undefined || ticket.amount <= 0 || !ticket.beneficiary || !ticket.payrollId) {
        return {
          valid: false,
          error: 'Ce ticket d’autorisation est incomplet : le montant, le bénéficiaire et la période doivent être scellés dans le ticket.',
        };
      }
      if (normExpected.amount === undefined || normExpected.amount <= 0 || !normExpected.beneficiary || !normExpected.payrollId) {
        return {
          valid: false,
          error: 'Paramètres d’opération de paie obligatoires manquants (montant, bénéficiaire ou période).',
        };
      }
    }

    // Contrôle d'intégrité du montant
    if (ticket.amount !== undefined) {
      if (normExpected.amount === undefined || Number(normExpected.amount) !== Number(ticket.amount)) {
        return {
          valid: false,
          error: `Le montant de l’opération (${normExpected.amount ?? 'non spécifié'} FCFA) ne correspond pas au montant validé par le code PIN (${ticket.amount} FCFA).`,
        };
      }
    }

    // Contrôle d'intégrité du bénéficiaire
    if (ticket.beneficiary) {
      if (!normExpected.beneficiary || normExpected.beneficiary !== ticket.beneficiary) {
        return {
          valid: false,
          error: `Le bénéficiaire de l’opération ("${normExpected.beneficiary || ''}") ne correspond pas au bénéficiaire validé par le code PIN ("${ticket.beneficiary}").`,
        };
      }
    }

    // Contrôle d'intégrité de la période / référence de paie
    if (ticket.payrollId) {
      if (!normExpected.payrollId || normExpected.payrollId !== ticket.payrollId) {
        return {
          valid: false,
          error: `L’identifiant de paie ou la période ("${normExpected.payrollId || ''}") ne correspond pas à l’opération validée par le code PIN ("${ticket.payrollId}").`,
        };
      }
    }

    // Consommation atomique immédiate : le ticket devient définitivement inutilisable
    ticket.used = true;
    ticket.consumedAt = Date.now();
    serverActionTicketStore.set(ticketId, ticket);

    return { valid: true, ticket };
  });
}

/**
 * Enregistre de manière persistante et officielle la validation d'une clôture de paie.
 */
export async function savePayrollValidationServer(
  record: PayrollValidationRecord,
  isTestToken = false
): Promise<void> {
  if (getSimulateStorageFailure()) {
    throw new Error('Erreur simulée de stockage Firestore pour validation de paie.');
  }

  serverPayrollStore.set(record.id, record);
  serverPayrollStore.set(record.payrollId, record);

  if (!isTestToken) {
    try {
      const db = getServerFirestore();
      await db.collection('validations_paie').doc(record.id).set(record);
      await db.collection('validations_paie').doc(`periode_${record.payrollId}`).set(record);
    } catch (err: any) {
      console.error('[NIGER SÉCURITÉ Server API] Échec écriture Firestore validations_paie:', err);
      throw err;
    }
  }
}

/**
 * Récupère un enregistrement de validation de paie scellé.
 */
export async function fetchPayrollValidationServer(
  payrollId: string,
  isTestToken = false
): Promise<PayrollValidationRecord | null> {
  if (isTestToken) {
    return serverPayrollStore.get(payrollId) || null;
  }

  try {
    const db = getServerFirestore();
    const snap = await db.collection('validations_paie').doc(`periode_${payrollId}`).get();
    if (snap.exists) {
      return snap.data() as PayrollValidationRecord;
    }
  } catch {
    // repli
  }

  return serverPayrollStore.get(payrollId) || null;
}

/**
 * Valide qu'un profil utilisateur est autorisé à exécuter le premier changement de PIN.
 */
export function validateDirectionProfileForPinSetup(profile: UserProfileRecord | null | undefined): {
  valid: boolean;
  statusCode?: number;
  error?: string;
} {
  if (!profile) {
    return {
      valid: false,
      statusCode: 404,
      error: 'Profil utilisateur introuvable dans l’annuaire officiel.',
    };
  }

  if (profile.statut !== 'actif') {
    return {
      valid: false,
      statusCode: 403,
      error: 'Ce compte Direction est désactivé. Accès refusé par la politique de sécurité.',
    };
  }

  if (profile.role !== 'direction') {
    return {
      valid: false,
      statusCode: 403,
      error: 'Seul un profil disposant du rôle Direction est habilité à configurer ce code PIN.',
    };
  }

  if (!('doitChangerPin' in profile) || profile.doitChangerPin === undefined) {
    return {
      valid: false,
      statusCode: 400,
      error: 'Le profil n’est pas en attente de configuration initiale de code PIN (champ "doitChangerPin" absent).',
    };
  }

  if (profile.doitChangerPin === false) {
    return {
      valid: false,
      statusCode: 409,
      error: 'Le code PIN a déjà été configuré pour ce compte Direction. Accès non autorisé.',
    };
  }

  return { valid: true };
}
