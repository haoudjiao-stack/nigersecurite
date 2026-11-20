/**
 * Service d'Authentification Individuelle et de Gestion des Sessions
 * NIGER SÉCURITÉ - Niamey
 *
 * Ce service encapsule Firebase Authentication avec persistance locale sécurisée
 * et réconciliation du profil de rôle stocké dans Firestore.
 */

import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
  browserLocalPersistence,
  browserSessionPersistence,
  inMemoryPersistence,
  setPersistence,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  updateEmail,
} from 'firebase/auth';
import { doc, getDoc, getDocFromServer, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import firebaseConfig from '../../firebase-applet-config.json';
import { UserProfile, UserSpace } from '../types';
import {
  normalizeLoginIdentifier,
  resolveLoginInputToAuthEmail,
  validateSecretCode,
} from './loginIdentifierUtils';
import { resolveEffectiveEntrepriseId } from '../utils/enterpriseContext';

const STORAGE_KEYS_AUTH = {
  CACHED_PROFILE: 'niger_securite_cached_user_profile_v1',
  LAST_LOGIN_TIMESTAMP: 'niger_securite_last_auth_timestamp_v1',
} as const;

export type AuthErrorCategory =
  | 'credentials'
  | 'auth_config'
  | 'auth_network'
  | 'firestore_profile'
  | 'role_invalid'
  | 'account_disabled'
  | 'server_error'
  | 'unknown';

export type AuthFlowStep =
  | 'persistence'
  | 'firebase_auth'
  | 'firestore_profile'
  | 'server_bootstrap'
  | 'role_validation'
  | 'session_ready';

export interface LoginResult {
  success: boolean;
  user?: UserProfile;
  error?: string;
  errorCategory?: AuthErrorCategory;
  step?: AuthFlowStep;
}

/**
 * Journalise une étape du flux d'authentification de manière sûre :
 * n'enregistre jamais de mot de passe, code PIN, jeton ID ni secret.
 */
function logAuthDiagnostic(
  level: 'info' | 'warn' | 'error',
  step: string,
  details?: Record<string, string | number | boolean | null | undefined>
): void {
  const safePayload = details ? { ...details } : {};
  const prefix = `[NIGER SÉCURITÉ Auth][${step}]`;
  if (level === 'error') {
    console.error(prefix, safePayload);
  } else if (level === 'warn') {
    console.warn(prefix, safePayload);
  } else {
    console.info(prefix, safePayload);
  }
}

/**
 * Traduit les codes d'erreur techniques Firebase Auth en messages clairs en français.
 * Uniquement réservé aux erreurs renvoyées par Firebase Authentication.
 */
export function translateAuthError(errorCode: string): { message: string; category: AuthErrorCategory } {
  switch (errorCode) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return {
        category: 'credentials',
        message: 'Identifiant ou mot de passe incorrect. Vérifiez vos informations de connexion.',
      };
    case 'auth/invalid-email':
      return {
        category: 'credentials',
        message: 'Adresse email invalide. Veuillez saisir une adresse électronique correcte.',
      };
    case 'auth/missing-email':
      return {
        category: 'credentials',
        message: 'Adresse email manquante. Veuillez saisir votre identifiant.',
      };
    case 'auth/missing-password':
      return {
        category: 'credentials',
        message: 'Mot de passe manquant. Veuillez saisir votre mot de passe.',
      };
    case 'auth/user-disabled':
      return {
        category: 'account_disabled',
        message: 'Ce compte utilisateur a été désactivé dans Firebase Authentication. Veuillez contacter la Direction.',
      };
    case 'auth/too-many-requests':
      return {
        category: 'credentials',
        message: 'Trop de tentatives infructueuses. L’accès est temporairement suspendu par mesure de sécurité. Réessayez dans quelques minutes.',
      };
    case 'auth/network-request-failed':
      return {
        category: 'auth_network',
        message: 'Connexion réseau impossible avec Firebase Authentication. Vérifiez votre connexion Internet.',
      };
    case 'auth/operation-not-allowed':
      return {
        category: 'auth_config',
        message: 'La connexion par email et mot de passe n’est pas activée dans Firebase Authentication.',
      };
    case 'auth/unauthorized-domain':
      return {
        category: 'auth_config',
        message: 'Ce domaine n’est pas autorisé dans la configuration Firebase Authentication (Authorized domains).',
      };
    case 'auth/invalid-api-key':
    case 'auth/app-not-authorized':
      return {
        category: 'auth_config',
        message: 'Configuration Firebase Authentication invalide ou non autorisée pour ce projet.',
      };
    case 'auth/web-storage-unsupported':
      return {
        category: 'auth_config',
        message: 'Le stockage local du navigateur est bloqué ou non pris en charge pour la session.',
      };
    case 'auth/quota-exceeded':
      return {
        category: 'auth_network',
        message: 'Quota Firebase Authentication temporairement dépassé. Veuillez réessayer dans un moment.',
      };
    case 'auth/internal-error':
      return {
        category: 'auth_config',
        message: 'Erreur interne de Firebase Authentication (auth/internal-error). Vérifiez la configuration ou réessayez.',
      };
    default:
      return {
        category: 'unknown',
        message: errorCode
          ? `Échec Firebase Authentication (${errorCode}). Vérifiez la configuration ou réessayez.`
          : 'Une erreur inattendue est survenue lors de Firebase Authentication. Veuillez réessayer.',
      };
  }
}

/**
 * Configure la persistance Firebase Auth avec repli progressif sûr
 * (Local -> Session -> Mémoire) pour ne jamais bloquer la connexion en iframe ou navigation privée.
 */
async function configureAuthPersistenceSafe(): Promise<'local' | 'session' | 'memory' | 'default'> {
  try {
    await setPersistence(auth, browserLocalPersistence);
    return 'local';
  } catch (errLocal: any) {
    logAuthDiagnostic('warn', 'STEP_1_PERSISTENCE_FALLBACK', {
      attempted: 'local',
      errorCode: errLocal?.code || errLocal?.name || 'unknown',
    });
  }

  try {
    await setPersistence(auth, browserSessionPersistence);
    return 'session';
  } catch (errSession: any) {
    logAuthDiagnostic('warn', 'STEP_1_PERSISTENCE_FALLBACK', {
      attempted: 'session',
      errorCode: errSession?.code || errSession?.name || 'unknown',
    });
  }

  try {
    await setPersistence(auth, inMemoryPersistence);
    return 'memory';
  } catch (errMem: any) {
    logAuthDiagnostic('warn', 'STEP_1_PERSISTENCE_FALLBACK', {
      attempted: 'memory',
      errorCode: errMem?.code || errMem?.name || 'unknown',
    });
    return 'default';
  }
}

/**
 * Déconnexion de nettoyage protégée : ne lève jamais d'exception afin de ne pas
 * masquer l'erreur réelle (Firestore / serveur / rôle) survenue après Firebase Auth.
 */
async function safeCleanupSignOut(contextStep: string): Promise<void> {
  try {
    await firebaseSignOut(auth);
  } catch (signOutErr: any) {
    logAuthDiagnostic('warn', `${contextStep}_SIGNOUT_CLEANUP_FAILED`, {
      errorCode: signOutErr?.code || signOutErr?.name || 'unknown',
    });
  } finally {
    saveCachedUserProfile(null);
  }
}

/**
 * Sauvegarde le profil utilisateur dans le stockage local pour le fonctionnement hors ligne.
 */
export function saveCachedUserProfile(profile: UserProfile | null): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    if (profile) {
      window.localStorage.setItem(STORAGE_KEYS_AUTH.CACHED_PROFILE, JSON.stringify(profile));
      window.localStorage.setItem(STORAGE_KEYS_AUTH.LAST_LOGIN_TIMESTAMP, Date.now().toString());
    } else {
      window.localStorage.removeItem(STORAGE_KEYS_AUTH.CACHED_PROFILE);
      window.localStorage.removeItem(STORAGE_KEYS_AUTH.LAST_LOGIN_TIMESTAMP);
    }
  } catch (err: any) {
    logAuthDiagnostic('warn', 'CACHE_PROFILE_WRITE_FAILED', {
      errorCode: err?.name || 'storage-error',
    });
  }
}

/**
 * Récupère le dernier profil utilisateur mis en cache localement.
 */
export function getCachedUserProfile(): UserProfile | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS_AUTH.CACHED_PROFILE);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UserProfile;
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      ...parsed,
      entrepriseId: resolveEffectiveEntrepriseId(parsed.entrepriseId),
    };
  } catch {
    return null;
  }
}

/**
 * Rôles autorisés dans l'application
 */
const VALID_ROLES: UserSpace[] = ['direction', 'comptabilite', 'controleur'];

/**
 * Valide qu'un profil utilisateur est complet, actif et correspond à l'UID authentifié.
 */
function isValidActiveProfile(profile: UserProfile | null, expectedUid: string): boolean {
  if (!profile) return false;
  return (
    profile.uid === expectedUid &&
    profile.statut === 'actif' &&
    VALID_ROLES.includes(profile.role)
  );
}

/**
 * Résultat détaillé de la lecture client du profil Firestore.
 */
export interface FetchUserProfileResult {
  profile: UserProfile | null;
  exists: boolean;
  errorCode?: string;
  errorMessage?: string;
}

// Verrou de coordination empêchant onAuthStateChanged d'exécuter un double bootstrap
// ou une déconnexion prématurée pendant le déroulement explicite de loginWithEmail().
let isExplicitLoginInProgress = false;

/**
 * Codes d'erreur Firestore strictement transitoires (réseau) pouvant autoriser
 * un repli sur le cache local lors d'une reprise de session hors ligne uniquement.
 * Un refus de sécurité (`permission-denied`) ou un document inexistant ne doit JAMAIS utiliser le cache.
 */
const TRANSIENT_NETWORK_FIRESTORE_CODES = new Set(['unavailable', 'deadline-exceeded']);

/**
 * Récupère le profil d'un utilisateur depuis Firestore via le SDK Client Web
 * avec diagnostic d'erreur précis (distingue un document réellement absent d'un refus
 * des règles Firestore `permission-denied` ou d'une coupure réseau).
 */
export async function fetchUserProfileDetailed(
  uid: string,
  options: { allowCacheOnNetworkError?: boolean } = {}
): Promise<FetchUserProfileResult> {
  const { allowCacheOnNetworkError = false } = options;

  // 1. Si l'appareil est explicitement hors connexion, vérifier le cache local uniquement si autorisé
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    if (allowCacheOnNetworkError) {
      const cached = getCachedUserProfile();
      if (isValidActiveProfile(cached, uid)) {
        logAuthDiagnostic('info', 'STEP_3_FIRESTORE_OFFLINE_CACHE_HIT', {
          role: cached?.role,
        });
        return { profile: cached, exists: true };
      }
    }
    logAuthDiagnostic('warn', 'STEP_3_FIRESTORE_OFFLINE_NO_CACHE', {});
    return {
      profile: null,
      exists: false,
      errorCode: 'offline',
      errorMessage: 'Appareil hors ligne sans session locale valide.',
    };
  }

  // 2. Lecture directe du document officiel Firestore /users/{uid} par le SDK Client authentifié
  // Lors d'une connexion explicite (allowCacheOnNetworkError = false), on force la lecture serveur
  // via getDocFromServer pour éviter toute réponse négative issue d'un cache mémoire obsolète.
  try {
    const userDocRef = doc(db, 'users', uid);
    const snap =
      !allowCacheOnNetworkError && typeof getDocFromServer === 'function'
        ? await getDocFromServer(userDocRef)
        : await getDoc(userDocRef);

    if (snap.exists()) {
      const data = snap.data();
      const rawRole = data.role as UserSpace;
      const rawStatut = data.statut === 'desactive' ? 'desactive' : data.statut === 'actif' ? 'actif' : null;

      // Vérification de conformité du profil Firestore
      if (!rawRole || !VALID_ROLES.includes(rawRole)) {
        logAuthDiagnostic('warn', 'STEP_3_FIRESTORE_INVALID_ROLE', {
          exists: true,
          rolePresent: Boolean(rawRole),
        });
        saveCachedUserProfile(null);
        return {
          profile: null,
          exists: true,
          errorCode: 'invalid-role',
          errorMessage: 'Profil Firestore présent mais rôle manquant ou non autorisé.',
        };
      }

      if (!rawStatut) {
        logAuthDiagnostic('warn', 'STEP_3_FIRESTORE_INVALID_STATUS', {
          exists: true,
          role: rawRole,
        });
      }

      const profile: UserProfile = {
        uid,
        email: data.email || auth.currentUser?.email || '',
        loginId: typeof data.loginId === 'string' ? normalizeLoginIdentifier(data.loginId) : undefined,
        entrepriseId: resolveEffectiveEntrepriseId(data.entrepriseId),
        nom: data.nom || 'Collaborateur NIGER SÉCURITÉ',
        prenom: data.prenom,
        role: rawRole,
        statut: rawStatut || 'desactive',
        grade: data.grade,
        telephone: data.telephone,
        sitesAssignesIds: Array.isArray(data.sitesAssignesIds) ? data.sitesAssignesIds : [],
        doitChangerPin: Boolean(data.doitChangerPin),
        doitChangerCodeSecret: Boolean(data.doitChangerCodeSecret),
        creeParUid: typeof data.creeParUid === 'string' ? data.creeParUid : undefined,
        derniereConnexion: new Date().toISOString(),
        creeLe: data.creeLe || new Date().toISOString(),
      };

      // Si le profil est actif, mettre à jour le cache local pour fonctionnement hors ligne
      if (profile.statut === 'actif') {
        saveCachedUserProfile(profile);
      } else {
        saveCachedUserProfile(null);
      }

      logAuthDiagnostic('info', 'STEP_3_FIRESTORE_PROFILE_LOADED', {
        exists: true,
        role: profile.role,
        statut: profile.statut,
        doitChangerPin: Boolean(profile.doitChangerPin),
      });

      return { profile, exists: true };
    } else {
      logAuthDiagnostic('warn', 'STEP_3_FIRESTORE_PROFILE_NOT_FOUND', {
        exists: false,
        uid,
        path: `users/${uid}`,
        databaseId: firebaseConfig.firestoreDatabaseId || '(default)',
      });
      saveCachedUserProfile(null);
      return { profile: null, exists: false };
    }
  } catch (err: any) {
    const errorCode = err?.code || 'firestore-error';
    const errorMessage = err?.message || 'Erreur inconnue lors de la lecture Firestore.';
    logAuthDiagnostic('error', 'STEP_3_FIRESTORE_READ_ERROR', {
      operationType: 'get',
      path: 'users/{uid}',
      errorCode,
      errorMessage,
    });

    // Ne JAMAIS contourner un refus des règles (permission-denied) ou un échec de connexion explicite
    if (allowCacheOnNetworkError && TRANSIENT_NETWORK_FIRESTORE_CODES.has(errorCode)) {
      const cached = getCachedUserProfile();
      if (isValidActiveProfile(cached, uid)) {
        return { profile: cached, exists: true, errorCode, errorMessage };
      }
    }

    saveCachedUserProfile(null);
    return {
      profile: null,
      exists: false,
      errorCode,
      errorMessage,
    };
  }
}

/**
 * Récupère le profil d'un utilisateur depuis Firestore avec repli sécurisé sur le cache local.
 * Refuse formellement tout profil absent, invalide ou désactivé.
 * Aucune attribution de rôle par analyse de l'adresse email.
 */
export async function fetchUserProfile(uid: string): Promise<UserProfile | null> {
  const res = await fetchUserProfileDetailed(uid);
  return res.profile;
}

/**
 * Connexion individuelle par adresse email et mot de passe.
 * Exige un compte authentifié valide ET la lecture directe par le SDK Client
 * d'un document /users/{uid} actif dans Firestore (sans appel Admin SDK ni création automatique).
 */
export async function loginWithEmail(email: string, pass: string): Promise<LoginResult> {
  isExplicitLoginInProgress = true;
  try {
    // ÉTAPE 1 : Configuration sûre de la persistance (ne bloque pas en cas d'environnement restreint)
    const persistenceMode = await configureAuthPersistenceSafe();
    logAuthDiagnostic('info', 'STEP_1_PERSISTENCE_READY', { persistenceMode });

    // ÉTAPE 2 : Authentification Firebase Authentication (isolée)
    let firebaseUser: User;
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), pass);
      firebaseUser = cred.user;
      // Garantir un jeton d'identité Firebase Auth à jour avant la lecture Firestore
      await firebaseUser.getIdToken(true);
      logAuthDiagnostic('info', 'STEP_2_FIREBASE_AUTH_SUCCESS', {
        emailVerified: Boolean(firebaseUser.emailVerified),
      });
    } catch (authErr: any) {
      const errorCode = authErr?.code || '';
      const translated = translateAuthError(errorCode);
      logAuthDiagnostic('warn', 'STEP_2_FIREBASE_AUTH_FAILED', {
        errorCode: errorCode || 'unknown',
        category: translated.category,
      });
      return {
        success: false,
        error: translated.message,
        errorCategory: translated.category,
        step: 'firebase_auth',
      };
    }

    const uid = firebaseUser.uid;

    // ÉTAPE 3 : Lecture directe du profil /users/{uid} par le SDK Client Web authentifié
    // (Privilégiée conformément aux règles Firestore allow get: request.auth.uid == userId)
    let fetchResult: FetchUserProfileResult;
    try {
      fetchResult = await fetchUserProfileDetailed(uid, { allowCacheOnNetworkError: false });
    } catch (firestoreUnexpectedErr: any) {
      logAuthDiagnostic('error', 'STEP_3_FIRESTORE_UNEXPECTED_ERROR', {
        errorCode: firestoreUnexpectedErr?.code || 'unknown',
      });
      await safeCleanupSignOut('STEP_3_UNEXPECTED');
      return {
        success: false,
        errorCategory: 'firestore_profile',
        step: 'firestore_profile',
        error:
          'Authentification Firebase réussie, mais la lecture directe de votre profil dans Firestore a rencontré une erreur inattendue.',
      };
    }

    const profile = fetchResult.profile;

    // ÉTAPE 4 : Arrêt immédiat si le profil est absent ou refusé (aucun contournement ni création automatique)
    if (!profile) {
      await safeCleanupSignOut('STEP_4_NO_PROFILE');

      if (fetchResult.errorCode === 'invalid-role') {
        return {
          success: false,
          errorCategory: 'role_invalid',
          step: 'role_validation',
          error:
            'Authentification Firebase réussie, mais votre profil Firestore contient un rôle manquant ou non autorisé. Contactez la Direction.',
        };
      }

      if (fetchResult.errorCode === 'permission-denied') {
        return {
          success: false,
          errorCategory: 'firestore_profile',
          step: 'firestore_profile',
          error:
            'Authentification Firebase réussie, mais la lecture directe du document /users/{uid} dans Firestore a été refusée par les règles de sécurité actives (permission-denied). Aucun contournement ni création automatique de profil n’a été tenté.',
        };
      }

      if (fetchResult.errorCode) {
        return {
          success: false,
          errorCategory: 'firestore_profile',
          step: 'firestore_profile',
          error: `Authentification Firebase réussie, mais le profil Firestore ne peut pas être chargé (${fetchResult.errorCode}).`,
        };
      }

      const targetDbId = firebaseConfig.firestoreDatabaseId || '(default)';
      const verifiedEmail = firebaseUser.email || email.trim();
      return {
        success: false,
        errorCategory: 'firestore_profile',
        step: 'firestore_profile',
        error: `Authentification Firebase réussie (${verifiedEmail} • UID : ${uid}), mais aucun document de profil /users/${uid} n’existe dans la base Firestore "${targetDbId}". Vérifiez dans Console Firebase que l’ID du document dans la collection "users" de cette base est exactement "${uid}". La création automatique côté serveur est impossible sur AI Studio Starter (Admin SDK : PERMISSION_DENIED).`,
      };
    }

    // ÉTAPE 5 : Validation stricte du statut et du rôle (Direction / Comptabilité / Contrôleur)
    if (profile.statut === 'desactive') {
      logAuthDiagnostic('warn', 'STEP_5_ACCOUNT_DISABLED', { role: profile.role });
      await safeCleanupSignOut('STEP_5_DISABLED');
      return {
        success: false,
        errorCategory: 'account_disabled',
        step: 'role_validation',
        error: 'Authentification Firebase réussie, mais ce compte utilisateur a été désactivé par la Direction. Accès refusé.',
      };
    }

    if (!VALID_ROLES.includes(profile.role)) {
      logAuthDiagnostic('warn', 'STEP_5_ROLE_INVALID', {});
      await safeCleanupSignOut('STEP_5_ROLE_INVALID');
      return {
        success: false,
        errorCategory: 'role_invalid',
        step: 'role_validation',
        error: 'Authentification Firebase réussie, mais le rôle d’accès attribué dans Firestore n’est pas autorisé.',
      };
    }

    logAuthDiagnostic('info', 'STEP_5_SESSION_READY', {
      role: profile.role,
      doitChangerPin: Boolean(profile.doitChangerPin),
    });

    return {
      success: true,
      user: profile,
      step: 'session_ready',
    };
  } catch (unexpectedErr: any) {
    logAuthDiagnostic('error', 'LOGIN_UNEXPECTED_FATAL', {
      errorCode: unexpectedErr?.code || unexpectedErr?.name || 'unknown',
    });
    return {
      success: false,
      errorCategory: 'unknown',
      error: 'Une erreur technique imprévue est survenue après la tentative de connexion. Consultez les journaux de diagnostic.',
    };
  } finally {
    isExplicitLoginInProgress = false;
  }
}

/**
 * Connexion unifiée pour les trois profils NigerSécurité :
 * - Direction   : adresse e-mail professionnelle + mot de passe
 * - Comptable   : identifiant CPT-2026-XXX + code secret personnel
 * - Contrôleur  : identifiant CTR-2026-XXX + code secret personnel
 */
export async function loginWithIdentifierOrEmail(
  rawIdentifier: string,
  secret: string
): Promise<LoginResult> {
  const resolved = resolveLoginInputToAuthEmail(rawIdentifier);
  if (!resolved.valid || !resolved.authEmail) {
    return {
      success: false,
      errorCategory: 'credentials',
      step: 'firebase_auth',
      error: resolved.error || 'Identifiant invalide.',
    };
  }

  const res = await loginWithEmail(resolved.authEmail, secret);

  if (!res.success) {
    if (resolved.inputType === 'login_id' && res.errorCategory === 'credentials') {
      return {
        ...res,
        error:
          'Identifiant ou code secret incorrect. Vérifiez votre identifiant attribué (CPT-2026-XXX ou CTR-2026-XXX) et votre code secret personnel.',
      };
    }
    return res;
  }

  // Vérification supplémentaire de cohérence entre le préfixe CPT/CTR et le rôle Firestore
  if (resolved.inputType === 'login_id' && res.user) {
    const profileLoginId = res.user.loginId ? normalizeLoginIdentifier(res.user.loginId) : undefined;
    if (
      (resolved.expectedRole && res.user.role !== resolved.expectedRole) ||
      (profileLoginId && resolved.loginId && profileLoginId !== resolved.loginId)
    ) {
      logAuthDiagnostic('warn', 'STEP_5_LOGIN_ID_ROLE_MISMATCH', {
        expectedRole: resolved.expectedRole,
        actualRole: res.user.role,
      });
      await safeCleanupSignOut('STEP_5_LOGIN_ID_MISMATCH');
      return {
        success: false,
        errorCategory: 'role_invalid',
        step: 'role_validation',
        error:
          'Incohérence entre votre identifiant de connexion et le rôle enregistré dans Firestore. Contactez la Direction.',
      };
    }
  }

  return res;
}

/**
 * Résultat du bootstrap serveur avec distinction des erreurs HTTP.
 */
export interface BootstrapProfileResult {
  profile: UserProfile | null;
  error?: string;
  errorCode?: string;
  httpStatus?: number;
  isServerError?: boolean;
}

/**
 * Initialisation automatique sécurisée du profil utilisateur par le serveur.
 * Permet au compte Direction de fonctionner dès sa première connexion sans saisie d'UID.
 * Distingue explicitement les erreurs serveur (HTTP 500 / IAM) d'un profil absent.
 */
export async function bootstrapUserProfileServer(user: User): Promise<BootstrapProfileResult> {
  try {
    const idToken = await user.getIdToken();
    const res = await fetch('/api/auth/bootstrap-profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        email: user.email || '',
        nom: user.displayName || 'Direction Générale',
      }),
    });

    let data: any = null;
    try {
      data = await res.json();
    } catch {
      // Ignorer si la réponse n'est pas du JSON
    }

    if (res.ok && data?.success && data?.profile) {
      const p = data.profile;
      const userProfile: UserProfile = {
        uid: p.uid,
        email: p.email,
        entrepriseId: resolveEffectiveEntrepriseId(p.entrepriseId),
        nom: p.nom || 'Direction Générale',
        role: p.role,
        statut: p.statut,
        doitChangerPin: Boolean(p.doitChangerPin),
        derniereConnexion: new Date().toISOString(),
        creeLe: p.misAJourLe || new Date().toISOString(),
        sitesAssignesIds: [],
      };
      if (userProfile.statut === 'actif') {
        saveCachedUserProfile(userProfile);
      }
      logAuthDiagnostic('info', 'STEP_4_SERVER_BOOTSTRAP_SUCCESS', {
        httpStatus: res.status,
        role: userProfile.role,
        created: Boolean(data.created),
      });
      return { profile: userProfile, httpStatus: res.status };
    }

    const serverCode = typeof data?.code === 'string' ? data.code : undefined;

    // Gestion explicite des erreurs HTTP pour ne pas masquer un problème d'infrastructure
    if (res.status >= 500) {
      const serverDetail = data?.error || 'Erreur interne du serveur lors de l’accès à Firestore.';
      logAuthDiagnostic('error', 'STEP_4_SERVER_BOOTSTRAP_HTTP_5XX', {
        httpStatus: res.status,
        errorCode: serverCode || 'SERVER_ERROR',
      });
      return {
        profile: null,
        error: `Erreur serveur (HTTP ${res.status}) : ${serverDetail}`,
        errorCode: serverCode,
        httpStatus: res.status,
        isServerError: true,
      };
    }

    if (res.status === 403) {
      const forbiddenDetail = data?.error || 'Initialisation refusée : vous n’êtes pas autorisé à créer ce profil.';
      logAuthDiagnostic('warn', 'STEP_4_SERVER_BOOTSTRAP_HTTP_403', {
        httpStatus: res.status,
        errorCode: serverCode || 'FORBIDDEN',
      });
      return {
        profile: null,
        error: forbiddenDetail,
        errorCode: serverCode,
        httpStatus: res.status,
        isServerError: false,
      };
    }

    if (res.status === 401) {
      const unauthorizedDetail = data?.error || 'Session d’authentification expirée ou non autorisée.';
      logAuthDiagnostic('warn', 'STEP_4_SERVER_BOOTSTRAP_HTTP_401', {
        httpStatus: res.status,
        errorCode: serverCode || 'UNAUTHORIZED',
      });
      return {
        profile: null,
        error: unauthorizedDetail,
        errorCode: serverCode,
        httpStatus: res.status,
        isServerError: false,
      };
    }

    if (data?.error) {
      logAuthDiagnostic('warn', 'STEP_4_SERVER_BOOTSTRAP_ERROR', {
        httpStatus: res.status,
        errorCode: serverCode || 'HTTP_ERROR',
      });
      return {
        profile: null,
        error: data.error,
        errorCode: serverCode,
        httpStatus: res.status,
        isServerError: false,
      };
    }
  } catch (err: any) {
    logAuthDiagnostic('error', 'STEP_4_SERVER_BOOTSTRAP_NETWORK_ERROR', {
      errorCode: err?.code || err?.name || 'network-error',
    });
    return {
      profile: null,
      error: 'Impossible de joindre le serveur applicatif pour charger ou initialiser votre profil.',
      errorCode: 'SERVER_UNREACHABLE',
      isServerError: true,
    };
  }

  return { profile: null };
}

/**
 * Déconnexion individuelle propre et purge sécurisée de la session locale.
 */
export async function logoutUser(): Promise<void> {
  try {
    await firebaseSignOut(auth);
  } catch (err) {
    console.warn('[NIGER SÉCURITÉ Auth] Erreur lors de signOut:', err);
  } finally {
    saveCachedUserProfile(null);
  }
}

/**
 * Abonnement réactif à l'état d'authentification Firebase.
 * Valide formellement le profil officiel avant toute notification.
 */
export function subscribeToAuthState(
  callback: (profile: UserProfile | null, firebaseUser: User | null) => void
): () => void {
  // En mode hors-ligne uniquement, restaurer immédiatement la session locale validée
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    const initialCached = getCachedUserProfile();
    if (initialCached && initialCached.statut === 'actif' && VALID_ROLES.includes(initialCached.role)) {
      callback(initialCached, auth.currentUser);
    } else {
      callback(null, auth.currentUser);
    }
  }

  return onAuthStateChanged(auth, async (user) => {
    // Ne pas interférer pendant l'exécution explicite de loginWithEmail()
    if (isExplicitLoginInProgress) {
      return;
    }

    if (user) {
      const fetchRes = await fetchUserProfileDetailed(user.uid, { allowCacheOnNetworkError: true });
      const profile = fetchRes.profile;
      if (!profile || profile.statut !== 'actif' || !VALID_ROLES.includes(profile.role)) {
        await safeCleanupSignOut('AUTH_STATE_OBSERVER');
        callback(null, null);
      } else {
        callback(profile, user);
      }
    } else {
      saveCachedUserProfile(null);
      callback(null, null);
    }
  });
}

/**
 * Met à jour le statut d'obligation de changement de code PIN dans la session locale
 * après validation et scellement par le mécanisme serveur.
 */
export function updateUserPinStatus(
  uid: string,
  doitChangerPin: boolean
): { success: boolean } {
  const cached = getCachedUserProfile();
  if (cached && cached.uid === uid) {
    cached.doitChangerPin = doitChangerPin;
    saveCachedUserProfile(cached);
  }
  return { success: true };
}

/**
 * Modifie le mot de passe de connexion du compte connecté.
 * Exige la ré-authentification avec le mot de passe actuel.
 * Ne stocke jamais le mot de passe en clair.
 */
export async function changeUserPassword(
  currentPass: string,
  newPass: string
): Promise<{ success: boolean; error?: string }> {
  const user = auth.currentUser;
  if (!user || !user.email) {
    return { success: false, error: 'Aucune session active trouvée. Veuillez vous reconnecter.' };
  }

  if (!newPass || newPass.length < 6) {
    return { success: false, error: 'Le nouveau mot de passe doit comporter au moins 6 caractères.' };
  }

  try {
    // 1. Ré-authentification de sécurité avec les identifiants actuels
    const credential = EmailAuthProvider.credential(user.email, currentPass);
    await reauthenticateWithCredential(user, credential);

    // 2. Mise à jour du mot de passe dans Firebase Auth
    await updatePassword(user, newPass);

    return { success: true };
  } catch (err: any) {
    logAuthDiagnostic('error', 'CHANGE_PASSWORD_FAILED', { errorCode: err?.code || 'unknown' });
    if (err?.code === 'auth/wrong-password' || err?.code === 'auth/invalid-credential') {
      return { success: false, error: 'Le mot de passe actuel saisi est incorrect.' };
    }
    return { success: false, error: translateAuthError(err?.code || '').message };
  }
}

/**
 * Modifie le code secret personnel d'un Comptable ou Contrôleur connecté.
 * - Exige la ré-authentification avec le code secret actuel
 * - Impose les règles de robustesse (minimum 6 caractères, rejet des codes triviaux)
 * - Met à jour le drapeau doitChangerCodeSecret à false dans /users/{uid} (autorisé pour compte actif uniquement)
 * - Ne stocke et ne journalise jamais le code secret en clair
 */
export async function changePersonalSecretCode(
  currentSecret: string,
  newSecret: string
): Promise<{ success: boolean; error?: string; profileUpdated?: boolean }> {
  const user = auth.currentUser;
  if (!user || !user.email) {
    return { success: false, error: 'Aucune session active trouvée. Veuillez vous reconnecter.' };
  }

  if (!currentSecret) {
    return { success: false, error: 'Veuillez saisir votre code secret actuel.' };
  }

  const secretCheck = validateSecretCode(newSecret);
  if (!secretCheck.valid) {
    return { success: false, error: secretCheck.error };
  }

  if (currentSecret === newSecret) {
    return {
      success: false,
      error: 'Le nouveau code secret doit être différent du code secret actuel.',
    };
  }

  try {
    const credential = EmailAuthProvider.credential(user.email, currentSecret);
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, newSecret);

    let profileUpdated = false;
    const cached = getCachedUserProfile();
    if (!cached || cached.role === 'comptabilite' || cached.role === 'controleur') {
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          doitChangerCodeSecret: false,
        });
        profileUpdated = true;
      } catch (flagErr: any) {
        logAuthDiagnostic('warn', 'CLEAR_SECRET_CODE_FLAG_FAILED', {
          errorCode: flagErr?.code || 'unknown',
        });
      }
    }

    if (cached && cached.uid === user.uid) {
      cached.doitChangerCodeSecret = false;
      saveCachedUserProfile(cached);
    }

    return { success: true, profileUpdated };
  } catch (err: any) {
    logAuthDiagnostic('error', 'CHANGE_SECRET_CODE_FAILED', { errorCode: err?.code || 'unknown' });
    if (err?.code === 'auth/wrong-password' || err?.code === 'auth/invalid-credential') {
      return { success: false, error: 'Le code secret actuel saisi est incorrect.' };
    }
    return { success: false, error: translateAuthError(err?.code || '').message };
  }
}

/**
 * Modifie l'adresse e-mail de connexion du compte Direction.
 * Exige la ré-authentification avec le mot de passe actuel, puis synchronise
 * l'e-mail dans Firestore sans altérer l'UID ni perdre l'historique ou le profil.
 */
export async function changeUserEmail(
  currentPass: string,
  newEmail: string
): Promise<{ success: boolean; error?: string }> {
  const user = auth.currentUser;
  if (!user || !user.email) {
    return { success: false, error: 'Aucune session active trouvée. Veuillez vous reconnecter.' };
  }

  const cleanEmail = newEmail.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { success: false, error: 'Veuillez saisir une adresse e-mail valide.' };
  }

  if (cleanEmail === user.email.toLowerCase()) {
    return { success: false, error: 'La nouvelle adresse est identique à votre adresse actuelle.' };
  }

  try {
    // 1. Ré-authentification obligatoire avec le mot de passe actuel
    const credential = EmailAuthProvider.credential(user.email, currentPass);
    await reauthenticateWithCredential(user, credential);

    // 2. Mise à jour dans Firebase Authentication
    await updateEmail(user, cleanEmail);

    // 3. Synchronisation côté serveur de Firestore /users/{uid}
    const idToken = await user.getIdToken(true);
    const syncRes = await fetch('/api/auth/sync-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ newEmail: cleanEmail }),
    });

    if (!syncRes.ok) {
      console.warn('[NIGER SÉCURITÉ Auth] Avertissement: la mise à jour Firestore a renvoyé un statut non 200.');
    }

    // 4. Mise à jour du cache local
    const cached = getCachedUserProfile();
    if (cached && cached.uid === user.uid) {
      cached.email = cleanEmail;
      saveCachedUserProfile(cached);
    }

    return { success: true };
  } catch (err: any) {
    logAuthDiagnostic('error', 'CHANGE_EMAIL_FAILED', { errorCode: err?.code || 'unknown' });
    if (err?.code === 'auth/wrong-password' || err?.code === 'auth/invalid-credential') {
      return { success: false, error: 'Le mot de passe actuel saisi est incorrect.' };
    }
    if (err?.code === 'auth/email-already-in-use') {
      return { success: false, error: 'Cette adresse e-mail est déjà utilisée par un autre compte.' };
    }
    return { success: false, error: translateAuthError(err?.code || '').message };
  }
}

/**
 * Modifie le code PIN opérationnel Direction (4 à 8 chiffres).
 * Exige le code PIN actuel, contrôlé côté serveur avec 220 000 itérations OWASP.
 */
export async function changeDirectionPin(
  currentPin: string,
  newPin: string
): Promise<{ success: boolean; error?: string; message?: string }> {
  try {
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) {
      return { success: false, error: 'Session non active. Veuillez vous reconnecter.' };
    }

    const res = await fetch('/api/auth/change-pin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ currentPin, newPin }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Échec de la modification du code PIN.' };
    }

    return { success: true, message: data.message };
  } catch (err: any) {
    logAuthDiagnostic('error', 'CHANGE_PIN_NETWORK_ERROR', { errorCode: err?.code || err?.name || 'unknown' });
    return { success: false, error: 'Erreur réseau lors de la communication avec le serveur de sécurité.' };
  }
}
