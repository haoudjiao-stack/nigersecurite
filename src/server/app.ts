import express, { Request, Response } from 'express';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import {
  getServerFirestore,
  hashLowEntropyPin,
  verifyPinConstantTime,
  checkLockoutServer,
  recordFailedAttemptServer,
  resetLockoutServer,
  validateDirectionProfileForPinSetup,
  getStoredSecretServer,
  issueActionTicket,
  consumeActionTicket,
  acquireUidLock,
  serverProfileStore,
  serverSecretStore,
  getSimulateStorageFailure,
  UserProfileRecord,
  PayrollValidationRecord,
  savePayrollValidationServer,
  fetchPayrollValidationServer,
} from './pinService';
import { resolveEffectiveEntrepriseId } from '../utils/enterpriseContext';

export const app = express();
app.use(express.json());

// Initialisation idempotente de Firebase Admin
const FIREBASE_PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID || 'dev-almanac-twpgt';
if (!getApps().length) {
  initializeApp({ projectId: FIREBASE_PROJECT_ID });
}

/**
 * Vérifie si le processus s'exécute exclusivement dans le runner de tests automatisés Vitest.
 * Les jetons synthétiques `test-token:` sont STRICTEMENT interdits en production
 * et dans tout autre contexte d'exécution.
 */
export function isAutomatedTestRuntime(): boolean {
  return process.env.NODE_ENV === 'test' && process.env.VITEST === 'true';
}

/**
 * Valide un jeton Firebase ID côté serveur et extrait l'UID certifié.
 * Impose la vérification cryptographique Google officielle en production ;
 * les jetons synthétiques `test-token:` ne sont acceptés qu'en environnement
 * de test automatisé Vitest (NODE_ENV === 'test' && VITEST === 'true').
 */
async function verifyServerIdToken(authHeader: string | undefined): Promise<{
  valid: boolean;
  uid?: string;
  email?: string;
  isTestToken?: boolean;
  error?: string;
}> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      valid: false,
      error: 'Jeton d’authentification Firebase manquant ou format Bearer invalide.',
    };
  }

  const token = authHeader.split('Bearer ')[1]?.trim();
  if (!token) {
    return { valid: false, error: 'Jeton Bearer vide.' };
  }

  // 1. Rejet absolu des jetons synthétiques hors environnement de test automatisé Vitest
  if (token.startsWith('test-token:')) {
    if (!isAutomatedTestRuntime()) {
      console.warn(
        '[NIGER SÉCURITÉ Server Auth][VERIFY_TOKEN] Rejet de sécurité : tentative d’utilisation d’un jeton test-token hors environnement de test automatisé.'
      );
      return {
        valid: false,
        error: 'Jeton de test strictement interdit en production ou hors environnement de test automatisé.',
      };
    }

    const parts = token.split(':');
    const uid = parts[1];
    if (!uid) {
      return { valid: false, error: 'Jeton de test malformé.' };
    }
    return { valid: true, uid, email: parts[2] || `${uid}@nigersecurite.ne`, isTestToken: true };
  }

  // 2. Vérification cryptographique officielle via le SDK Firebase Admin
  try {
    const decoded = await getAuth().verifyIdToken(token);
    return { valid: true, uid: decoded.uid, email: decoded.email, isTestToken: false };
  } catch (err: any) {
    console.warn('[NIGER SÉCURITÉ Server Auth][VERIFY_TOKEN] Jeton Firebase ID invalide ou expiré:', {
      code: err?.code || 'auth/invalid-id-token',
    });
    return {
      valid: false,
      error: `Jeton Firebase invalide ou expiré : ${err.message || 'Signature non reconnue'}`,
    };
  }
}

/**
 * Détecte explicitement un refus IAM Firestore Admin SDK (code gRPC 7 / PERMISSION_DENIED),
 * distinct des autres pannes techniques ou erreurs métier.
 */
function isFirestoreIamPermissionDenied(err: any): boolean {
  if (!err) return false;
  if (err.isFirestorePermissionDenied === true) return true;
  if (err.code === 7) return true;
  const rawMessage = String(err.message || '');
  return (
    rawMessage.includes('PERMISSION_DENIED') ||
    rawMessage.includes('Missing or insufficient permissions')
  );
}

const FIRESTORE_IAM_DENIED_MESSAGE =
  'Erreur serveur Firestore (7 PERMISSION_DENIED) : le compte de service serveur ne dispose pas de l’autorisation IAM requise (roles/datastore.user) sur cet environnement Starter pour lire ou écrire cette ressource côté serveur.';

/**
 * Récupère le profil utilisateur officiel depuis Firestore (ou le magasin serveur de test).
 */
async function fetchUserProfileServer(uid: string, isTestToken = false): Promise<UserProfileRecord | null> {
  if (isTestToken && isAutomatedTestRuntime()) {
    return serverProfileStore.get(uid) || null;
  }

  try {
    const db = getServerFirestore();
    const snap = await db.collection('users').doc(uid).get();
    if (snap.exists) {
      return snap.data() as UserProfileRecord;
    }
  } catch (err: any) {
    if (isAutomatedTestRuntime() && serverProfileStore.has(uid)) {
      return serverProfileStore.get(uid)!;
    }
    const rawMessage = err?.message || 'Erreur inconnue';
    const isPermissionDenied = isFirestoreIamPermissionDenied(err);
    console.error('[NIGER SÉCURITÉ Server Auth][FETCH_USER_PROFILE] Échec lecture Firestore Admin:', {
      code: err?.code ?? null,
      isPermissionDenied,
      message: rawMessage,
    });
    const wrappedErr: any = new Error(
      `Échec de lecture du profil utilisateur Firestore : ${rawMessage}`
    );
    wrappedErr.code = err?.code;
    wrappedErr.isFirestorePermissionDenied = isPermissionDenied;
    throw wrappedErr;
  }

  if (isAutomatedTestRuntime() && serverProfileStore.has(uid)) {
    return serverProfileStore.get(uid)!;
  }

  return null;
}

/**
 * Persiste le hachage et le statut PIN de manière strictement étanche et résiliente :
 * 1. L'empreinte secrète (pinHash + pinSalt) est stockée EXCLUSIVEMENT dans /server_auth_secrets/{uid}.
 *    Cette collection est verrouillée à 100% dans firestore.rules pour tout client SDK.
 * 2. Le document public /users/{uid} reçoit UNIQUEMENT doitChangerPin: false (AUCUN hash, AUCUN sel).
 * 3. En production, l'écriture DOIT réussir sur Firestore Admin pour survivre aux redémarrages.
 *    En cas d'échec du stockage serveur, une erreur est levée pour interrompre l'opération.
 */
async function persistPinSetupServer(params: {
  uid: string;
  pinHash: string;
  pinSalt: string;
  pinAlgorithm: string;
  iterations: number;
  isTestToken?: boolean;
}): Promise<void> {
  const { uid, pinHash, pinSalt, pinAlgorithm, iterations, isTestToken } = params;

  if (getSimulateStorageFailure()) {
    throw new Error('Erreur simulée de stockage Firestore Admin.');
  }

  const nowIso = new Date().toISOString();

  // Mode Test / Émulateur unitaire
  if (isTestToken) {
    serverSecretStore.set(uid, {
      uid,
      pinHash,
      pinSalt,
      pinAlgorithm,
      iterations,
      creeLe: nowIso,
      misAJourLe: nowIso,
    });

    const existing = serverProfileStore.get(uid) || {
      uid,
      email: `${uid}@nigersecurite.ne`,
      nom: 'Direction',
      role: 'direction',
      statut: 'actif',
    };

    serverProfileStore.set(uid, {
      ...existing,
      doitChangerPin: false,
      misAJourLe: nowIso,
    });
    return;
  }

  // Mode Production : Persistance obligatoire dans Firestore Admin
  try {
    const db = getServerFirestore();
    const batch = db.batch();

    // A. Écriture du secret dans la collection privée serveur
    const secretRef = db.collection('server_auth_secrets').doc(uid);
    batch.set(secretRef, {
      uid,
      pinHash,
      pinSalt,
      pinAlgorithm,
      iterations,
      creeLe: nowIso,
      misAJourLe: nowIso,
    });

    // B. Mise à jour du profil utilisateur : UNIQUEMENT doitChangerPin et horodatage
    const userRef = db.collection('users').doc(uid);
    batch.update(userRef, {
      doitChangerPin: false,
      misAJourLe: nowIso,
    });

    await batch.commit();

    serverSecretStore.set(uid, {
      uid,
      pinHash,
      pinSalt,
      pinAlgorithm,
      iterations,
      creeLe: nowIso,
      misAJourLe: nowIso,
    });

    const currentMem = serverProfileStore.get(uid);
    if (currentMem) {
      serverProfileStore.set(uid, { ...currentMem, doitChangerPin: false, misAJourLe: nowIso });
    }
  } catch (err: any) {
    console.error(`[NIGER SÉCURITÉ Server API] Échec critique d'écriture Firestore Admin pour l'UID ${uid}:`, err);
    const wrappedErr: any = new Error(
      `Échec de persistance sur Firestore Admin : ${err.message || 'Service indisponible'}`
    );
    wrappedErr.code = err?.code;
    wrappedErr.isFirestorePermissionDenied = isFirestoreIamPermissionDenied(err);
    throw wrappedErr;
  }
}

/**
 * Route officielle 1 : Validation et Enregistrement du Premier Code PIN Direction
 * POST /api/auth/setup-initial-pin
 */
app.post('/api/auth/setup-initial-pin', async (req: Request, res: Response) => {
  try {
    // A. Validation du jeton Firebase ID côté serveur
    const tokenResult = await verifyServerIdToken(req.headers.authorization);
    if (!tokenResult.valid || !tokenResult.uid) {
      return res.status(401).json({
        success: false,
        error: tokenResult.error || 'Authentification requise via jeton Firebase ID valide.',
      });
    }

    const authenticatedUid = tokenResult.uid;
    const isTestToken = tokenResult.isTestToken;

    // B. Vérification de non-usurpation d'UID
    if (req.body.uid && req.body.uid !== authenticatedUid) {
      return res.status(403).json({
        success: false,
        error: 'Tentative d’usurpation d’identité : l’UID fourni ne correspond pas à l’UID certifié par le jeton Firebase.',
      });
    }

    // C. Contrôle anti-brute-force serveur persistant (Cloud Run multi-instances, sérialisé contre conditions de concurrence)
    const lockoutState = await checkLockoutServer(authenticatedUid, isTestToken);
    if (lockoutState.isLocked) {
      return res.status(429).json({
        success: false,
        error: `Accès temporairement verrouillé suite à plusieurs tentatives erronées. Réessayez dans ${lockoutState.remainingMinutes} minute(s).`,
      });
    }

    // D. Validation de présence du code PIN
    const rawPin = req.body.pin;
    if (!rawPin || typeof rawPin !== 'string') {
      const failed = await recordFailedAttemptServer(authenticatedUid, isTestToken);
      return res.status(400).json({
        success: false,
        error: 'Le champ "pin" est obligatoire.',
        remainingAttempts: failed.remainingAttempts,
      });
    }

    const cleanPin = rawPin.trim();

    // E. Validation de format (4 à 8 chiffres exclusivement)
    if (!/^\d{4,8}$/.test(cleanPin)) {
      const failed = await recordFailedAttemptServer(authenticatedUid, isTestToken);
      return res.status(400).json({
        success: false,
        error: 'Le code PIN doit comporter exclusivement entre 4 et 8 chiffres.',
        remainingAttempts: failed.remainingAttempts,
      });
    }

    // F. Rejet serveur des combinaisons triviales
    const TRIVIAL_PINS = ['0000', '1234', '1111', '123456', '000000', '2222', '3333', '9999'];
    if (TRIVIAL_PINS.includes(cleanPin)) {
      const failed = await recordFailedAttemptServer(authenticatedUid, isTestToken);
      return res.status(400).json({
        success: false,
        error: 'Combinaison triviale rejetée par la politique de sécurité serveur NIGER SÉCURITÉ.',
        remainingAttempts: failed.remainingAttempts,
      });
    }

    // G. Chargement et vérification du profil utilisateur officiel
    let profile: UserProfileRecord | null = null;
    try {
      profile = await fetchUserProfileServer(authenticatedUid, isTestToken);
    } catch (err: any) {
      if (isFirestoreIamPermissionDenied(err)) {
        return res.status(500).json({
          success: false,
          code: 'FIRESTORE_PERMISSION_DENIED',
          error: FIRESTORE_IAM_DENIED_MESSAGE,
        });
      }
      return res.status(500).json({
        success: false,
        error: 'Impossible d’accéder au profil utilisateur pour vérification d’habilitation.',
      });
    }

    const profileValidation = validateDirectionProfileForPinSetup(profile);
    if (!profileValidation.valid) {
      return res.status(profileValidation.statusCode || 400).json({
        success: false,
        error: profileValidation.error,
      });
    }

    // H. Hachage asynchrone conforme OWASP PBKDF2-HMAC-SHA512 (220 000 itérations, sel 32 octets)
    const cryptoHashResult = await hashLowEntropyPin(cleanPin);

    // I. Persistance sécurisée
    try {
      await persistPinSetupServer({
        uid: authenticatedUid,
        pinHash: cryptoHashResult.hash,
        pinSalt: cryptoHashResult.salt,
        pinAlgorithm: cryptoHashResult.algorithm,
        iterations: cryptoHashResult.iterations,
        isTestToken,
      });
    } catch (storageErr: any) {
      console.error('[NIGER SÉCURITÉ Server API] Échec du stockage persistant:', storageErr);
      if (isFirestoreIamPermissionDenied(storageErr)) {
        return res.status(500).json({
          success: false,
          code: 'FIRESTORE_PERMISSION_DENIED',
          error: FIRESTORE_IAM_DENIED_MESSAGE,
        });
      }
      return res.status(500).json({
        success: false,
        error: 'Échec de persistance sécurisée : le stockage serveur officiel (Firestore Admin) est indisponible. Aucune modification n’a été validée.',
      });
    }

    // J. Réinitialisation du verrou anti-brute-force persistant
    await resetLockoutServer(authenticatedUid, isTestToken);

    // K. Réponse stricte au navigateur : confirmation de succès SANS AUCUN hachage ni sel
    return res.status(200).json({
      success: true,
      message: 'Code PIN Direction validé et scellé avec succès côté serveur.',
      uid: authenticatedUid,
      doitChangerPin: false,
      misAJourLe: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[NIGER SÉCURITÉ Server API] Erreur interne setup-pin:', err);
    if (isFirestoreIamPermissionDenied(err)) {
      return res.status(500).json({
        success: false,
        code: 'FIRESTORE_PERMISSION_DENIED',
        error: FIRESTORE_IAM_DENIED_MESSAGE,
      });
    }
    return res.status(500).json({
      success: false,
      error: 'Erreur interne du serveur lors de la validation du code PIN.',
    });
  }
});

/**
 * Route : Initialisation / Récupération automatique du premier profil Direction
 * POST /api/auth/bootstrap-profile
 *
 * SÉCURITÉ RENFORCÉE (Zero-Trust & Single Bootstrap Authority) :
 * 1. Vérification d'idempotence : Si l'utilisateur connecté possède déjà un profil,
 *    celui-ci est renvoyé intact sans modification de rôle, de données ni de PIN.
 * 2. Vérification de la configuration serveur obligatoire :
 *    La variable d'environnement BOOTSTRAP_DIRECTION_EMAIL doit être définie avec une
 *    adresse e-mail exacte. Les domaines génériques non qualifiés sont refusés.
 * 3. Filtrage strict de l'adresse du demandeur :
 *    Seul l'e-mail exact correspondant à BOOTSTRAP_DIRECTION_EMAIL est autorisé à
 *    initialiser le premier compte Direction. Tout autre e-mail est rejeté (403 Forbidden).
 * 4. Contrôle d'unicité absolue du compte Direction :
 *    Si au moins un profil Direction existe déjà dans Firestore, toute nouvelle tentative
 *    d'initialisation privilégiée est formellement rejetée (403 Forbidden).
 * 5. Atomicité transactionnelle anti-race-condition :
 *    L'opération est protégée par un verrou mémoire global et une transaction Firestore
 *    garantissant qu'aucune requête simultanée concurrente ne peut créer un double compte Direction.
 */
/**
 * Vérifie si un profil utilisateur est complet et ne nécessite aucune réparation.
 * Un profil complet contient son UID, un rôle autorisé, un statut valide,
 * une adresse e-mail valide et un état booléen défini pour doitChangerPin.
 */
function isCompleteUserProfile(profile: UserProfileRecord | null | undefined): boolean {
  if (!profile) return false;
  return (
    typeof profile.uid === 'string' &&
    profile.uid.trim().length > 0 &&
    typeof profile.role === 'string' &&
    ['direction', 'comptabilite', 'controleur'].includes(profile.role) &&
    typeof profile.statut === 'string' &&
    ['actif', 'desactive'].includes(profile.statut) &&
    typeof profile.email === 'string' &&
    profile.email.includes('@') &&
    typeof profile.doitChangerPin === 'boolean'
  );
}

/**
 * Route : Initialisation / Récupération automatique du premier profil Direction
 * POST /api/auth/bootstrap-profile
 *
 * SÉCURITÉ RENFORCÉE (Zero-Trust & Single Bootstrap Authority) :
 * 1. Vérification d'idempotence : Si le profil est déjà COMPLET et Direction,
 *    celui-ci est renvoyé intact sans modification de rôle, de données ni de PIN.
 * 2. Protection contre l'usurpation de rôle : Si le document possède déjà un rôle
 *    subordonné ('controleur' ou 'comptabilite'), toute conversion en Direction est strictement refusée (403).
 * 3. Réparation sécurisée de document incomplet :
 *    Si le document existe mais est incomplet (ex: créé manuellement avec seulement { uid }),
 *    la réparation n'est autorisée QU'APRÈS validation stricte de BOOTSTRAP_DIRECTION_EMAIL et
 *    vérification qu'aucun autre compte Direction n'existe déjà.
 * 4. Préservation intégrale des données existantes :
 *    Les champs existants (ex: téléphone, grade, notes) sont rigoureusement conservés.
 * 5. Préservation absolue du PIN configuré :
 *    Le serveur vérifie l'existence réelle d'un secret PIN dans /server_auth_secrets/{uid}.
 *    Si un secret existe, le PIN n'est JAMAIS réinitialisé (doitChangerPin = false).
 *    Si l'état du secret est incertain ou incohérent, l'opération est arrêtée avec une erreur explicite.
 * 6. Atomicité anti-concurrence :
 *    L'opération est protégée par acquireUidLock('GLOBAL_DIRECTION_BOOTSTRAP_LOCK') et une transaction Firestore.
 */
app.post('/api/auth/bootstrap-profile', async (req: Request, res: Response) => {
  try {
    const tokenResult = await verifyServerIdToken(req.headers.authorization);
    if (!tokenResult.valid || !tokenResult.uid) {
      console.warn('[NIGER SÉCURITÉ Server Auth][BOOTSTRAP_PROFILE] Rejet HTTP 401 : jeton invalide ou absent.');
      return res.status(401).json({
        success: false,
        code: 'UNAUTHORIZED',
        error: tokenResult.error || 'Authentification requise pour initialiser le profil.',
      });
    }

    const authenticatedUid = tokenResult.uid;
    const isTestToken = tokenResult.isTestToken;

    // 1. Contrôle préalable sur le profil existant
    const existing = await fetchUserProfileServer(authenticatedUid, isTestToken);

    // Refus formel de transformer un compte déjà subordonné (Contrôleur ou Comptabilité) en Direction
    if (existing && existing.role && existing.role !== 'direction') {
      console.warn('[NIGER SÉCURITÉ Server Auth][BOOTSTRAP_PROFILE] Rejet HTTP 403 : rôle subordonné existant.', {
        existingRole: existing.role,
      });
      return res.status(403).json({
        success: false,
        code: 'ROLE_CONVERSION_FORBIDDEN',
        error: `Accès refusé : ce compte est déjà configuré avec le rôle "${existing.role}". Il est strictement interdit de le convertir en compte Direction.`,
      });
    }

    // Idempotence : si le profil est déjà complet et Direction, le renvoyer intact sans modification
    if (existing && isCompleteUserProfile(existing) && existing.role === 'direction') {
      return res.status(200).json({
        success: true,
        profile: existing,
        created: false,
      });
    }

    // Sérialisation atomique globale pour empêcher toute condition de course concurrente
    return await acquireUidLock('GLOBAL_DIRECTION_BOOTSTRAP_LOCK', async () => {
      // Re-vérifier l'existence au cas où une requête concurrente venait de le créer ou réparer
      const doubleCheck = await fetchUserProfileServer(authenticatedUid, isTestToken);

      if (doubleCheck && doubleCheck.role && doubleCheck.role !== 'direction') {
        return res.status(403).json({
          success: false,
          error: `Accès refusé : ce compte est déjà configuré avec le rôle "${doubleCheck.role}". Il est strictement interdit de le convertir en compte Direction.`,
        });
      }

      if (doubleCheck && isCompleteUserProfile(doubleCheck) && doubleCheck.role === 'direction') {
        return res.status(200).json({
          success: true,
          profile: doubleCheck,
          created: false,
        });
      }

      // 2. Contrôle de la configuration serveur obligatoire (BOOTSTRAP_DIRECTION_EMAIL)
      const rawBootstrapConfig = process.env.BOOTSTRAP_DIRECTION_EMAIL;
      const configuredBootstrapEmail = (rawBootstrapConfig || '').toLowerCase().trim();

      if (!configuredBootstrapEmail || !configuredBootstrapEmail.includes('@') || configuredBootstrapEmail.startsWith('@')) {
        return res.status(500).json({
          success: false,
          error: 'Configuration serveur manquante ou invalide : la variable BOOTSTRAP_DIRECTION_EMAIL doit être définie avec une adresse e-mail exacte.',
        });
      }

      // Rejet des domaines génériques non qualifiés sans boîte aux lettres
      if (!configuredBootstrapEmail.split('@')[0]) {
        return res.status(500).json({
          success: false,
          error: 'Configuration serveur invalide : BOOTSTRAP_DIRECTION_EMAIL ne peut pas être un simple nom de domaine.',
        });
      }

      // 3. Contrôle strict de l'adresse e-mail certifiée du demandeur
      const userEmail = (tokenResult.email || '').toLowerCase().trim();
      if (!userEmail || userEmail !== configuredBootstrapEmail) {
        return res.status(403).json({
          success: false,
          error: `Accès refusé : l’adresse e-mail "${userEmail || 'inconnue'}" n’est pas autorisée à initialiser le profil Direction principal.`,
        });
      }

      // 4. Contrôle d'état du secret PIN côté serveur (Zero-Trust)
      let hasExistingPinSecret = false;
      try {
        const secret = await getStoredSecretServer(authenticatedUid, isTestToken);
        if (secret && secret.pinHash && secret.pinSalt) {
          hasExistingPinSecret = true;
        }
      } catch (secretErr: any) {
        return res.status(500).json({
          success: false,
          error: 'Impossible de vérifier l’état du code PIN dans le stockage sécurisé. Opération interrompue par sécurité.',
        });
      }

      // Détection d'incohérence critique : si le profil indiquait déjà doitChangerPin: false mais qu'aucun secret n'existe
      if (doubleCheck && doubleCheck.doitChangerPin === false && !hasExistingPinSecret) {
        return res.status(500).json({
          success: false,
          error: 'Incohérence de sécurité détectée : le profil indique un code PIN configuré mais aucune empreinte secrète n’a été trouvée. Opération interrompue.',
        });
      }

      // 5. Détermination sécurisée de doitChangerPin :
      // - Si un secret PIN existe : JAMAIS réinitialisé, doitChangerPin reste/devient false.
      // - Si aucun secret PIN n'existe : doitChangerPin est fixé à true (obligatoire pour configurer le PIN).
      const targetDoitChangerPin = hasExistingPinSecret ? false : true;

      // 6. Préservation de toutes les données existantes (fusion sécurisée sans écrasement)
      const nowIso = new Date().toISOString();
      const existingData = (doubleCheck || {}) as Record<string, any>;
      const isRepair = Boolean(doubleCheck && (doubleCheck.uid || Object.keys(doubleCheck).length > 0));

      const finalProfile: UserProfileRecord = {
        ...existingData,
        uid: authenticatedUid,
        email: userEmail,
        entrepriseId: resolveEffectiveEntrepriseId(
          existingData.entrepriseId || process.env.DEFAULT_ENTREPRISE_ID
        ),
        nom: existingData.nom || (typeof req.body.nom === 'string' && req.body.nom.trim() ? req.body.nom.trim() : 'Direction Générale'),
        role: 'direction',
        statut: existingData.statut === 'desactive' ? 'desactive' : 'actif',
        doitChangerPin: targetDoitChangerPin,
        creeLe: existingData.creeLe || nowIso,
        misAJourLe: nowIso,
      };

      // 7. Contrôle d'unicité absolue : vérifier qu'AUCUN AUTRE compte Direction n'existe déjà
      if (isTestToken) {
        const otherDirectionExists = Array.from(serverProfileStore.values()).some(
          (p) => p.role === 'direction' && p.uid !== authenticatedUid
        );
        if (otherDirectionExists) {
          return res.status(403).json({
            success: false,
            error: 'Initialisation refusée : un compte Direction existe déjà dans l’application. Tout nouveau compte doit être créé par la Direction existante.',
          });
        }

        serverProfileStore.set(authenticatedUid, finalProfile);
        return res.status(200).json({
          success: true,
          profile: finalProfile,
          created: !isRepair,
          repaired: isRepair,
          message: isRepair
            ? 'Profil Direction complété et réparé avec succès.'
            : 'Profil Direction initialisé avec succès. Veuillez configurer votre code PIN personnel.',
        });
      }

      // Mode Production : Transaction atomique Firestore
      const db = getServerFirestore();
      const bootstrapDocRef = db.collection('server_system_state').doc('direction_bootstrap');
      const userDocRef = db.collection('users').doc(authenticatedUid);

      return await db.runTransaction(async (transaction) => {
        const bootstrapSnap = await transaction.get(bootstrapDocRef);
        if (bootstrapSnap.exists && bootstrapSnap.data()?.bootstrapped === true && bootstrapSnap.data()?.directionUid !== authenticatedUid) {
          return res.status(403).json({
            success: false,
            error: 'Initialisation refusée : le premier compte Direction a déjà été initialisé. Tout nouveau compte doit être créé par la Direction existante.',
          });
        }

        const existingUsersQuery = await db.collection('users').where('role', '==', 'direction').limit(2).get();
        const hasOtherDirection = existingUsersQuery.docs.some((docSnap) => docSnap.id !== authenticatedUid);
        if (hasOtherDirection) {
          return res.status(403).json({
            success: false,
            error: 'Initialisation refusée : un compte Direction existe déjà dans l’application.',
          });
        }

        transaction.set(
          bootstrapDocRef,
          {
            bootstrapped: true,
            directionUid: authenticatedUid,
            email: userEmail,
            creeLe: existingData.creeLe || nowIso,
            misAJourLe: nowIso,
          },
          { merge: true }
        );

        transaction.set(userDocRef, finalProfile, { merge: true });

        return res.status(200).json({
          success: true,
          profile: finalProfile,
          created: !isRepair,
          repaired: isRepair,
          message: isRepair
            ? 'Profil Direction complété et réparé avec succès.'
            : 'Profil Direction initialisé avec succès. Veuillez configurer votre code PIN personnel.',
        });
      });
    });
  } catch (err: any) {
    const rawMsg = String(err?.message || 'Erreur inconnue');
    const isPermissionDenied = isFirestoreIamPermissionDenied(err);

    console.error('[NIGER SÉCURITÉ Server Auth][BOOTSTRAP_PROFILE] Erreur serveur:', {
      code: err?.code ?? null,
      isPermissionDenied,
      message: rawMsg,
    });

    if (isPermissionDenied) {
      return res.status(500).json({
        success: false,
        code: 'FIRESTORE_PERMISSION_DENIED',
        error:
          'Erreur serveur Firestore (7 PERMISSION_DENIED) : le compte de service serveur ne dispose pas de l’autorisation IAM requise (roles/datastore.user) pour accéder au profil.',
      });
    }

    return res.status(500).json({
      success: false,
      code: 'INTERNAL_SERVER_ERROR',
      error: 'Erreur serveur lors de la synchronisation automatique du profil.',
    });
  }
});

/**
 * Route : Modification sécurisée du Code PIN Direction
 * POST /api/auth/change-pin
 * Permet au compte Direction de changer son code PIN opérationnel.
 * Exige le code PIN actuel, vérifie le verrouillage anti-brute-force,
 * puis hache le nouveau code PIN avec 220 000 itérations OWASP PBKDF2-HMAC-SHA-512.
 */
app.post('/api/auth/change-pin', async (req: Request, res: Response) => {
  try {
    const tokenResult = await verifyServerIdToken(req.headers.authorization);
    if (!tokenResult.valid || !tokenResult.uid) {
      return res.status(401).json({
        success: false,
        error: tokenResult.error || 'Authentification requise.',
      });
    }

    const authenticatedUid = tokenResult.uid;
    const isTestToken = tokenResult.isTestToken;

    // Contrôle du profil Direction actif
    const profile = await fetchUserProfileServer(authenticatedUid, isTestToken);
    if (!profile || profile.role !== 'direction' || profile.statut !== 'actif') {
      return res.status(403).json({
        success: false,
        error: 'Seul un profil Direction actif peut modifier le code PIN.',
      });
    }

    if (profile.doitChangerPin) {
      return res.status(400).json({
        success: false,
        error: 'Le code PIN initial n’est pas encore configuré. Utilisez la route de configuration initiale.',
      });
    }

    // Contrôle anti-brute-force
    const lockout = await checkLockoutServer(authenticatedUid, isTestToken);
    if (lockout.isLocked) {
      return res.status(429).json({
        success: false,
        error: `Accès temporairement verrouillé suite à plusieurs tentatives erronées. Réessayez dans ${lockout.remainingMinutes} minute(s).`,
      });
    }

    const { currentPin, newPin } = req.body;
    if (!currentPin || typeof currentPin !== 'string' || !/^\d{4,8}$/.test(currentPin.trim())) {
      return res.status(400).json({
        success: false,
        error: 'Le code PIN actuel est obligatoire (4 à 8 chiffres).',
      });
    }

    if (!newPin || typeof newPin !== 'string' || !/^\d{4,8}$/.test(newPin.trim())) {
      return res.status(400).json({
        success: false,
        error: 'Le nouveau code PIN doit comporter exclusivement entre 4 et 8 chiffres.',
      });
    }

    const cleanCurrentPin = currentPin.trim();
    const cleanNewPin = newPin.trim();

    if (['0000', '1234', '1111', '123456', '000000'].includes(cleanNewPin)) {
      return res.status(400).json({
        success: false,
        error: 'Ce nouveau code PIN est trop prévisible. Choisissez une combinaison plus sécurisée.',
      });
    }

    // Récupérer le secret stocké
    const secret = await getStoredSecretServer(authenticatedUid, isTestToken);
    if (!secret || !secret.pinHash || !secret.pinSalt) {
      return res.status(404).json({
        success: false,
        error: 'Aucune empreinte de sécurité trouvée pour ce compte.',
      });
    }

    // Vérification du PIN actuel en temps constant
    const isMatch = await verifyPinConstantTime(
      cleanCurrentPin,
      secret.pinHash,
      secret.pinSalt,
      secret.iterations
    );

    if (!isMatch) {
      const failed = await recordFailedAttemptServer(authenticatedUid, isTestToken);
      if (failed.isLocked) {
        return res.status(429).json({
          success: false,
          error: 'Accès temporairement verrouillé suite à 5 tentatives consécutives erronées. Réessayez dans 10 minute(s).',
        });
      }
      return res.status(401).json({
        success: false,
        error: `Code PIN actuel incorrect. Il vous reste ${failed.remainingAttempts} tentative(s).`,
        remainingAttempts: failed.remainingAttempts,
      });
    }

    // PIN actuel validé : réinitialiser le verrou
    await resetLockoutServer(authenticatedUid, isTestToken);

    // Hachage du nouveau PIN (220 000 itérations OWASP)
    const cryptoHashResult = await hashLowEntropyPin(cleanNewPin);

    // Persistance sécurisée dans le stockage serveur
    await persistPinSetupServer({
      uid: authenticatedUid,
      pinHash: cryptoHashResult.hash,
      pinSalt: cryptoHashResult.salt,
      pinAlgorithm: cryptoHashResult.algorithm,
      iterations: cryptoHashResult.iterations,
      isTestToken,
    });

    return res.status(200).json({
      success: true,
      message: 'Code PIN Direction modifié avec succès.',
    });
  } catch (err: any) {
    console.error('[NIGER SÉCURITÉ Server API] Erreur change-pin:', err);
    if (isFirestoreIamPermissionDenied(err)) {
      return res.status(500).json({
        success: false,
        code: 'FIRESTORE_PERMISSION_DENIED',
        error: FIRESTORE_IAM_DENIED_MESSAGE,
      });
    }
    return res.status(500).json({
      success: false,
      error: 'Erreur serveur lors de la mise à jour du code PIN.',
    });
  }
});

/**
 * Route : Synchronisation de l'e-mail dans le profil Firestore après mise à jour Firebase Auth
 * POST /api/auth/sync-email
 * Met à jour le champ email dans /users/{uid} sans toucher au rôle, à l'UID ni aux données.
 */
app.post('/api/auth/sync-email', async (req: Request, res: Response) => {
  try {
    const tokenResult = await verifyServerIdToken(req.headers.authorization);
    if (!tokenResult.valid || !tokenResult.uid) {
      return res.status(401).json({
        success: false,
        error: tokenResult.error || 'Authentification requise.',
      });
    }

    const authenticatedUid = tokenResult.uid;
    const isTestToken = tokenResult.isTestToken;

    // Protection anti-falsification : l'adresse e-mail doit correspondre au jeton certifié
    const certifiedEmail = (tokenResult.email || '').toLowerCase().trim();
    const rawRequested = req.body.newEmail;

    if (rawRequested !== undefined) {
      if (typeof rawRequested !== 'string' || !rawRequested.trim() || !rawRequested.includes('@') || rawRequested.trim().startsWith('@')) {
        return res.status(400).json({
          success: false,
          error: 'Adresse email invalide.',
        });
      }
    }

    const requestedEmail = typeof rawRequested === 'string' ? rawRequested.toLowerCase().trim() : '';

    if (certifiedEmail && requestedEmail && certifiedEmail !== requestedEmail) {
      return res.status(403).json({
        success: false,
        error: 'Tentative de falsification rejetée : l’adresse e-mail demandée ne correspond pas à l’adresse certifiée par le jeton Firebase.',
      });
    }

    const newEmail = requestedEmail || certifiedEmail;

    if (!newEmail || !newEmail.includes('@') || newEmail.startsWith('@')) {
      return res.status(400).json({
        success: false,
        error: 'Adresse email invalide.',
      });
    }

    // Récupérer le profil existant
    const profile = await fetchUserProfileServer(authenticatedUid, isTestToken);
    if (!profile) {
      return res.status(404).json({
        success: false,
        error: 'Profil utilisateur introuvable.',
      });
    }

    const nowIso = new Date().toISOString();
    const updatedProfile: UserProfileRecord = {
      ...profile,
      email: newEmail,
      misAJourLe: nowIso,
    };

    if (isTestToken) {
      serverProfileStore.set(authenticatedUid, updatedProfile);
    } else {
      const db = getServerFirestore();
      await db.collection('users').doc(authenticatedUid).update({
        email: newEmail,
        misAJourLe: nowIso,
      });
    }

    return res.status(200).json({
      success: true,
      email: newEmail,
      message: 'Adresse e-mail synchronisée avec succès dans votre profil.',
    });
  } catch (err: any) {
    console.error('[NIGER SÉCURITÉ Server API] Erreur sync-email:', err);
    if (isFirestoreIamPermissionDenied(err)) {
      return res.status(500).json({
        success: false,
        code: 'FIRESTORE_PERMISSION_DENIED',
        error: FIRESTORE_IAM_DENIED_MESSAGE,
      });
    }
    return res.status(500).json({
      success: false,
      error: 'Erreur lors de la synchronisation de l’adresse e-mail.',
    });
  }
});

/**
 * Route officielle 2 : Vérification du Code PIN Direction & Émission de Ticket d'Action Sensible
 * POST /api/auth/verify-pin
 * Permet de valider cryptographiquement le code PIN pour les actions hautement sensibles
 * et délivre une preuve temporaire (Action Ticket) à usage unique valable 5 minutes.
 */
app.post('/api/auth/verify-pin', async (req: Request, res: Response) => {
  try {
    // 1. Validation du jeton Firebase ID
    const tokenResult = await verifyServerIdToken(req.headers.authorization);
    if (!tokenResult.valid || !tokenResult.uid) {
      return res.status(401).json({
        success: false,
        error: tokenResult.error || 'Authentification requise via jeton Firebase ID valide.',
      });
    }

    const authenticatedUid = tokenResult.uid;
    const isTestToken = tokenResult.isTestToken;

    // 2. Contrôle anti-usurpation d'UID
    if (req.body.uid && req.body.uid !== authenticatedUid) {
      return res.status(403).json({
        success: false,
        error: 'Tentative d’usurpation d’identité : l’UID fourni ne correspond pas à l’UID certifié.',
      });
    }

    // 3. Contrôle anti-brute-force persistant
    const lockoutState = await checkLockoutServer(authenticatedUid, isTestToken);
    if (lockoutState.isLocked) {
      return res.status(429).json({
        success: false,
        error: `Accès temporairement verrouillé suite à plusieurs tentatives erronées. Réessayez dans ${lockoutState.remainingMinutes} minute(s).`,
      });
    }

    // 4. Présence et format du code PIN saisi
    const rawPin = req.body.pin;
    if (!rawPin || typeof rawPin !== 'string') {
      const failed = await recordFailedAttemptServer(authenticatedUid, isTestToken);
      if (failed.isLocked) {
        return res.status(429).json({
          success: false,
          error: 'Accès temporairement verrouillé suite à plusieurs tentatives erronées. Réessayez dans 10 minute(s).',
        });
      }
      return res.status(400).json({
        success: false,
        error: 'Le champ "pin" est obligatoire.',
        remainingAttempts: failed.remainingAttempts,
      });
    }

    const cleanPin = rawPin.trim();
    if (!/^\d{4,8}$/.test(cleanPin)) {
      const failed = await recordFailedAttemptServer(authenticatedUid, isTestToken);
      if (failed.isLocked) {
        return res.status(429).json({
          success: false,
          error: 'Accès temporairement verrouillé suite à plusieurs tentatives erronées. Réessayez dans 10 minute(s).',
        });
      }
      return res.status(400).json({
        success: false,
        error: 'Le code PIN doit comporter exclusivement entre 4 et 8 chiffres.',
        remainingAttempts: failed.remainingAttempts,
      });
    }

    // 5. Contrôle du rôle et du statut
    const profile = await fetchUserProfileServer(authenticatedUid, isTestToken);
    if (!profile || profile.role !== 'direction' || profile.statut !== 'actif') {
      return res.status(403).json({
        success: false,
        error: 'Seul un profil Direction actif peut exécuter cette vérification.',
      });
    }

    if (profile.doitChangerPin === true) {
      return res.status(400).json({
        success: false,
        error: 'Le code PIN Direction n’est pas encore configuré. Procédez d’abord à la configuration initiale.',
      });
    }

    // 6. Récupération du secret depuis le stockage serveur étanche
    const secret = await getStoredSecretServer(authenticatedUid, isTestToken);
    if (!secret || !secret.pinHash || !secret.pinSalt) {
      return res.status(404).json({
        success: false,
        error: 'Aucune empreinte de sécurité trouvée pour ce compte.',
      });
    }

    // 7. Vérification en temps constant avec dérivation asynchrone PBKDF2-HMAC-SHA512 (220 000 itérations)
    const isMatch = await verifyPinConstantTime(
      cleanPin,
      secret.pinHash,
      secret.pinSalt,
      secret.iterations
    );

    if (!isMatch) {
      const failed = await recordFailedAttemptServer(authenticatedUid, isTestToken);
      if (failed.isLocked) {
        return res.status(429).json({
          success: false,
          verified: false,
          error: 'Accès temporairement verrouillé suite à 5 tentatives erronées consécutives. Réessayez dans 10 minute(s).',
        });
      }
      return res.status(401).json({
        success: false,
        verified: false,
        error: `Code PIN incorrect. Il vous reste ${failed.remainingAttempts} tentative(s) avant verrouillage temporaire.`,
        remainingAttempts: failed.remainingAttempts,
      });
    }

    // 8. Succès : réinitialiser le verrou anti-brute-force persistant
    await resetLockoutServer(authenticatedUid, isTestToken);

    // 9. Émission facultative d'une preuve d'action temporaire (Ticket Step-Up à usage unique)
    let actionTicket: string | undefined;
    let expiresInSeconds: number | undefined;
    let detailsHash: string | undefined;

    if (req.body.action && typeof req.body.action === 'string') {
      try {
        const ticketResult = await issueActionTicket({
          uid: authenticatedUid,
          action: req.body.action,
          amount: req.body.amount !== undefined ? req.body.amount : req.body.montant,
          beneficiary: req.body.beneficiary || req.body.beneficiaire,
          payrollId: req.body.payrollId || req.body.periode || req.body.mois || req.body.targetId,
          targetId: req.body.targetId || req.body.mois,
          isTestToken,
        });
        actionTicket = ticketResult.ticketId;
        expiresInSeconds = ticketResult.expiresInSeconds;
        detailsHash = ticketResult.detailsHash;
      } catch (ticketErr: any) {
        return res.status(400).json({
          success: false,
          error: ticketErr.message || 'Paramètres invalides pour l’émission du ticket d’autorisation.',
        });
      }
    }

    return res.status(200).json({
      success: true,
      verified: true,
      message: 'Code PIN Direction certifié avec succès.',
      uid: authenticatedUid,
      actionTicket,
      expiresInSeconds,
      detailsHash,
    });
  } catch (err: any) {
    console.error('[NIGER SÉCURITÉ Server API] Erreur vérification PIN:', err);
    if (isFirestoreIamPermissionDenied(err)) {
      return res.status(500).json({
        success: false,
        code: 'FIRESTORE_PERMISSION_DENIED',
        error: FIRESTORE_IAM_DENIED_MESSAGE,
      });
    }
    return res.status(500).json({
      success: false,
      error: 'Erreur interne du serveur lors de la vérification du code PIN.',
    });
  }
});

/**
 * Route sensible Direction : Validation et Clôture de la Paie des Vigiles
 * POST /api/direction/validate-payroll
 *
 * SÉCURITÉ ZERO-TRUST :
 * Cette API refuse catégoriquement l'exécution basée uniquement sur l'état du navigateur.
 * Elle exige une preuve serveur d'autorisation éphémère (Action Ticket à usage unique),
 * obtenue via /api/auth/verify-pin.
 *
 * LIAISON STRICTE DES PARAMÈTRES :
 * Le ticket est vérifié avec les paramètres exacts de l'opération (action, montant, bénéficiaire, paie/période).
 * Toute divergence ou réutilisation concurrente simultanée entraîne un rejet HTTP 403 immédiat.
 */
app.post('/api/direction/validate-payroll', async (req: Request, res: Response) => {
  try {
    // 1. Validation du jeton Firebase ID
    const tokenResult = await verifyServerIdToken(req.headers.authorization);
    if (!tokenResult.valid || !tokenResult.uid) {
      return res.status(401).json({
        success: false,
        error: tokenResult.error || 'Authentification requise via jeton Firebase ID valide.',
      });
    }

    const authenticatedUid = tokenResult.uid;
    const isTestToken = tokenResult.isTestToken;

    // 2. Contrôle d'habilitation Direction active
    const profile = await fetchUserProfileServer(authenticatedUid, isTestToken);
    if (!profile || profile.role !== 'direction' || profile.statut !== 'actif') {
      return res.status(403).json({
        success: false,
        error: 'Seul un profil Direction actif est habilité à valider la paie.',
      });
    }

    const rawAmount = req.body.amount !== undefined ? req.body.amount : req.body.montant;
    const beneficiary = req.body.beneficiary || req.body.beneficiaire;
    const payrollId = req.body.payrollId || req.body.periode || req.body.mois;

    // Validation stricte des 3 paramètres obligatoires pour la paie
    if (rawAmount === undefined || isNaN(Number(rawAmount)) || Number(rawAmount) <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Le montant valide de la paie (> 0 FCFA) est strictement obligatoire pour valider la paie.',
      });
    }

    if (!beneficiary || typeof beneficiary !== 'string' || !beneficiary.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Le bénéficiaire de la paie est strictement obligatoire pour valider la paie.',
      });
    }

    if (!payrollId || typeof payrollId !== 'string' || !payrollId.trim()) {
      return res.status(400).json({
        success: false,
        error: 'L’identifiant de paie ou la période est strictement obligatoire pour valider la paie.',
      });
    }

    const amount = Number(rawAmount);
    const actionTicket = (req.headers['x-action-ticket'] as string) || req.body.actionTicket;

    // 3. Exigence absolue d'une preuve de validation PIN (Action Ticket)
    if (!actionTicket) {
      return res.status(403).json({
        success: false,
        error: 'Action sensible refusée : preuve de validation PIN manquante. Veuillez saisir votre code PIN Direction pour valider cette opération.',
      });
    }

    // 4. Consommation atomique à usage unique (anti-rejeu, atomicité concurrente et contrôle d'intégrité des paramètres)
    const ticketVerification = await consumeActionTicket({
      ticketId: actionTicket,
      expectedUid: authenticatedUid,
      expectedAction: req.body.action || 'VALIDATE_PAYROLL',
      expectedAmount: amount,
      expectedBeneficiary: beneficiary.trim(),
      expectedPayrollId: payrollId.trim(),
      expectedTargetId: req.body.targetId || payrollId.trim(),
      isTestToken,
    });

    if (!ticketVerification.valid) {
      return res.status(403).json({
        success: false,
        error: `Action sensible refusée : ${ticketVerification.error}`,
      });
    }

    // 5. Enregistrement RÉEL et persistant de la validation de paie
    const validationRecord: PayrollValidationRecord = {
      id: `val_${payrollId.trim().toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`,
      payrollId: payrollId.trim(),
      mois: payrollId.trim(),
      montantTotal: amount,
      beneficiaire: beneficiary.trim(),
      validePar: authenticatedUid,
      ticketId: actionTicket,
      statut: 'VALIDEE',
      dateValidation: new Date().toISOString(),
      misAJourLe: new Date().toISOString(),
    };

    try {
      await savePayrollValidationServer(validationRecord, isTestToken);
    } catch (saveErr: any) {
      console.error('[NIGER SÉCURITÉ Server API] Échec enregistrement validation paie:', saveErr);
      if (isFirestoreIamPermissionDenied(saveErr)) {
        return res.status(500).json({
          success: false,
          code: 'FIRESTORE_PERMISSION_DENIED',
          error: FIRESTORE_IAM_DENIED_MESSAGE,
        });
      }
      return res.status(500).json({
        success: false,
        error: 'Échec critique lors de l’enregistrement de la validation de paie dans Firestore officiel.',
      });
    }

    return res.status(200).json({
      success: true,
      message: `Fiches de paie validées et enregistrées avec succès par la Direction pour la période : ${payrollId.trim()}.`,
      validePar: authenticatedUid,
      enregistrement: validationRecord,
      details: {
        amount,
        beneficiary: beneficiary.trim(),
        payrollId: payrollId.trim(),
      },
      dateValidation: validationRecord.dateValidation,
    });
  } catch (err: any) {
    console.error('[NIGER SÉCURITÉ Server API] Erreur validation paie sensible:', err);
    if (isFirestoreIamPermissionDenied(err)) {
      return res.status(500).json({
        success: false,
        code: 'FIRESTORE_PERMISSION_DENIED',
        error: FIRESTORE_IAM_DENIED_MESSAGE,
      });
    }
    return res.status(500).json({
      success: false,
      error: 'Erreur interne du serveur lors de la validation de la paie.',
    });
  }
});

/**
 * Route de consultation de l'enregistrement officiel de validation de paie
 * GET /api/direction/payroll-validation/:payrollId
 */
app.get('/api/direction/payroll-validation/:payrollId', async (req: Request, res: Response) => {
  try {
    const tokenResult = await verifyServerIdToken(req.headers.authorization);
    if (!tokenResult.valid || !tokenResult.uid) {
      return res.status(401).json({
        success: false,
        error: tokenResult.error || 'Authentification requise via jeton Firebase ID valide.',
      });
    }

    const isTestToken = tokenResult.isTestToken;
    const payrollId = req.params.payrollId;

    const record = await fetchPayrollValidationServer(payrollId, isTestToken);
    if (!record) {
      return res.status(404).json({
        success: false,
        error: `Aucun enregistrement de validation trouvé pour la période ou identifiant : ${payrollId}.`,
      });
    }

    return res.status(200).json({
      success: true,
      enregistrement: record,
    });
  } catch (err: any) {
    console.error('[NIGER SÉCURITÉ Server API] Erreur récupération validation paie:', err);
    return res.status(500).json({
      success: false,
      error: 'Erreur interne du serveur lors de la récupération de la validation de paie.',
    });
  }
});
