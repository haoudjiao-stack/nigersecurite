/**
 * Service de Gestion des Comptes d'Accès (Comptable & Contrôleur)
 * NIGER SÉCURITÉ - Niamey
 *
 * Compatible à 100 % avec Google AI Studio Starter (zéro Admin SDK requis) :
 * - Création Firebase Auth dans une instance secondaire isolée en mémoire (inMemoryPersistence)
 *   afin de ne JAMAIS déconnecter la Direction ni altérer son stockage de session.
 * - Réservation atomique de /login_identifiers/{loginId} et création de /users/{uid} via runTransaction().
 * - Retour arrière automatique (deleteUser) en cas d'échec Firestore pour éviter tout compte orphelin.
 * - Zéro stockage de code secret en clair dans Firestore ou dans les journaux.
 */

import { initializeApp, deleteApp, FirebaseApp } from 'firebase/app';
import {
  initializeAuth,
  inMemoryPersistence,
  createUserWithEmailAndPassword,
  deleteUser,
  signOut as firebaseSignOut,
  Auth,
  User,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDocFromServer,
  getDocs,
  getDocsFromServer,
  onSnapshot,
  runTransaction,
  updateDoc,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { auth, db } from '../firebase';
import {
  AccountStatus,
  LoginIdentifierRecord,
  StaffAccountRole,
  UserProfile,
} from '../types';
import {
  loginIdentifierToAuthEmail,
  normalizeLoginIdentifier,
  validateLoginIdentifierForRole,
  validateSecretCode,
} from './loginIdentifierUtils';
import { getCachedUserProfile } from './authService';
import {
  DEFAULT_ENTREPRISE_ID,
  normalizeEntrepriseId,
  resolveEffectiveEntrepriseId,
} from '../utils/enterpriseContext';

export enum FirestoreOperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: FirestoreOperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

function logStructuredFirestoreError(
  error: unknown,
  operationType: FirestoreOperationType,
  path: string | null
): FirestoreErrorInfo {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
  };
  console.error('[NIGER SÉCURITÉ StaffAccounts] Firestore Error:', JSON.stringify(errInfo));
  return errInfo;
}

export interface CreateStaffAccountInput {
  role: StaffAccountRole;
  loginId: string;
  entrepriseId?: string;
  nom: string;
  prenom?: string;
  grade?: string;
  telephone?: string;
  sitesAssignesIds?: string[];
  secretCode: string;
}

export interface CreateStaffAccountResult {
  success: boolean;
  account?: UserProfile;
  error?: string;
  errorCode?: string;
  rolledBack?: boolean;
}

export interface ListStaffAccountsResult {
  success: boolean;
  accounts: UserProfile[];
  existingLoginIds: string[];
  error?: string;
}

/**
 * Crée durablement un compte Comptable (CPT-YYYY-XXX) ou Contrôleur (CTR-YYYY-XXX)
 * depuis la session Direction active, sans déconnecter la Direction.
 */
export async function createStaffAccountByDirection(
  input: CreateStaffAccountInput
): Promise<CreateStaffAccountResult> {
  const directionUser = auth.currentUser;
  if (!directionUser) {
    return {
      success: false,
      errorCode: 'unauthenticated',
      error: 'Session Direction non active. Veuillez vous reconnecter.',
    };
  }

  const directionUid = directionUser.uid;

  // 1. Validation locale stricte avant tout appel Firebase
  if (input.role !== 'comptabilite' && input.role !== 'controleur') {
    return {
      success: false,
      errorCode: 'invalid-role',
      error: 'Seuls les comptes Comptable et Contrôleur peuvent être créés depuis cet écran.',
    };
  }

  const loginCheck = validateLoginIdentifierForRole(input.loginId, input.role);
  if (!loginCheck.valid) {
    return {
      success: false,
      errorCode: 'invalid-login-id',
      error: loginCheck.error,
    };
  }
  const normalizedLoginId = loginCheck.normalized;

  const cleanNom = String(input.nom || '').trim();
  if (cleanNom.length < 2 || cleanNom.length > 120) {
    return {
      success: false,
      errorCode: 'invalid-name',
      error: 'Le nom complet doit comporter entre 2 et 120 caractères.',
    };
  }

  const cleanPrenom = String(input.prenom || '').trim().slice(0, 100);
  const cleanGrade = String(input.grade || '').trim().slice(0, 100);
  const cleanTelephone = String(input.telephone || '').trim().slice(0, 40);
  const cleanSites =
    input.role === 'controleur' && Array.isArray(input.sitesAssignesIds)
      ? Array.from(
          new Set(
            input.sitesAssignesIds
              .map((s) => String(s || '').trim())
              .filter((s) => s.length > 0 && s.length <= 128)
          )
        ).slice(0, 100)
      : [];

  const secretCheck = validateSecretCode(input.secretCode);
  if (!secretCheck.valid) {
    return {
      success: false,
      errorCode: 'weak-secret',
      error: secretCheck.error,
    };
  }

  // Résolution stricte de l'entreprise héritée du compte Direction créateur :
  // - Si fournie explicitement par la session Direction, elle doit être valide.
  // - Sinon, reprise depuis le profil Direction actif en cache (même UID) ou NIGERSECURITE-001 pour les comptes historiques.
  let inheritedEntrepriseId: string;
  if (input.entrepriseId !== undefined) {
    const normalizedInputEntreprise = normalizeEntrepriseId(input.entrepriseId);
    if (!normalizedInputEntreprise) {
      return {
        success: false,
        errorCode: 'invalid-entreprise-id',
        error: 'Identifiant interne d’entreprise invalide (ex: NIGERSECURITE-001).',
      };
    }
    inheritedEntrepriseId = normalizedInputEntreprise;
  } else {
    const cachedDirectionProfile = getCachedUserProfile();
    const cachedEntreprise =
      cachedDirectionProfile?.uid === directionUid ? cachedDirectionProfile.entrepriseId : undefined;
    inheritedEntrepriseId = resolveEffectiveEntrepriseId(cachedEntreprise, DEFAULT_ENTREPRISE_ID);
  }

  const internalAuthEmail = loginIdentifierToAuthEmail(normalizedLoginId);
  const loginIdRef = doc(db, 'login_identifiers', normalizedLoginId);

  // 2. Pré-vérification serveur de l'unicité dans Firestore avant de créer l'utilisateur Auth
  try {
    const existingSnap = await getDocFromServer(loginIdRef);
    if (existingSnap.exists()) {
      return {
        success: false,
        errorCode: 'login-id-already-exists',
        error: `L’identifiant ${normalizedLoginId} est déjà attribué à un autre compte. Choisissez un autre numéro.`,
      };
    }
  } catch (err: any) {
    logStructuredFirestoreError(err, FirestoreOperationType.GET, `login_identifiers/${normalizedLoginId}`);
    if (err?.code === 'permission-denied') {
      return {
        success: false,
        errorCode: 'permission-denied',
        error:
          'Accès refusé par les règles Firestore lors de la vérification de l’identifiant. Vérifiez que votre compte Direction est actif, que son PIN est configuré et que les règles Firestore à jour sont déployées.',
      };
    }
    return {
      success: false,
      errorCode: err?.code || 'firestore-precheck-failed',
      error: 'Impossible de vérifier la disponibilité de cet identifiant dans Firestore. Vérifiez votre connexion Internet.',
    };
  }

  // 3. Initialisation d'une application Firebase secondaire strictement en mémoire
  //    Garantit zéro modification du stockage local et zéro déconnexion de la Direction.
  const secondaryAppName = `ns-provision-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let secondaryApp: FirebaseApp | null = null;
  let secondaryAuth: Auth | null = null;
  let createdAuthUser: User | null = null;

  try {
    secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
    secondaryAuth = initializeAuth(secondaryApp, {
      persistence: inMemoryPersistence,
    });

    // 4. Création du compte Firebase Authentication sur l'instance secondaire uniquement
    try {
      const credential = await createUserWithEmailAndPassword(
        secondaryAuth,
        internalAuthEmail,
        input.secretCode
      );
      createdAuthUser = credential.user;
    } catch (authErr: any) {
      const code = authErr?.code || 'auth-create-failed';
      if (code === 'auth/email-already-in-use') {
        return {
          success: false,
          errorCode: 'login-id-already-exists',
          error: `L’identifiant ${normalizedLoginId} existe déjà dans Firebase Authentication. Choisissez un autre numéro.`,
        };
      }
      if (code === 'auth/weak-password') {
        return {
          success: false,
          errorCode: 'weak-secret',
          error: 'Le code secret a été jugé trop faible par Firebase Authentication (minimum 6 caractères).',
        };
      }
      if (code === 'auth/operation-not-allowed') {
        return {
          success: false,
          errorCode: 'auth-operation-not-allowed',
          error: 'La création de comptes par identifiant/mot de passe n’est pas activée dans Firebase Authentication.',
        };
      }
      if (code === 'auth/network-request-failed') {
        return {
          success: false,
          errorCode: 'network-error',
          error: 'Connexion réseau impossible avec Firebase Authentication. Aucun compte n’a été créé.',
        };
      }
      return {
        success: false,
        errorCode: code,
        error: `Échec lors de la création dans Firebase Authentication (${code}).`,
      };
    }

    const newUid = createdAuthUser.uid;
    const nowIso = new Date().toISOString();
    const userDocRef = doc(db, 'users', newUid);

    const loginRecord: LoginIdentifierRecord = {
      loginId: normalizedLoginId,
      uid: newUid,
      entrepriseId: inheritedEntrepriseId,
      role: input.role,
      statut: 'actif',
      creeLe: nowIso,
      creeParUid: directionUid,
    };

    // Document Firestore garanti sans aucun champ secret (zéro code secret, zéro hash, zéro PIN)
    const userPayload: Record<string, unknown> = {
      uid: newUid,
      email: internalAuthEmail,
      loginId: normalizedLoginId,
      entrepriseId: inheritedEntrepriseId,
      nom: cleanNom,
      role: input.role,
      statut: 'actif',
      sitesAssignesIds: cleanSites,
      doitChangerCodeSecret: true,
      creeLe: nowIso,
      creeParUid: directionUid,
    };

    if (cleanPrenom) userPayload.prenom = cleanPrenom;
    if (cleanGrade) userPayload.grade = cleanGrade;
    if (cleanTelephone) userPayload.telephone = cleanTelephone;

    // 5. Transaction atomique Firestore : /login_identifiers/{loginId} + /users/{newUid}
    try {
      await runTransaction(db, async (tx) => {
        const [txLoginSnap, txUserSnap] = await Promise.all([
          tx.get(loginIdRef),
          tx.get(userDocRef),
        ]);

        if (txLoginSnap.exists()) {
          const dupErr: any = new Error('LOGIN_ID_DUPLICATE');
          dupErr.code = 'login-id-already-exists';
          throw dupErr;
        }
        if (txUserSnap.exists()) {
          const uidErr: any = new Error('USER_UID_DUPLICATE');
          uidErr.code = 'user-already-exists';
          throw uidErr;
        }

        tx.set(loginIdRef, loginRecord);
        tx.set(userDocRef, userPayload);
      });
    } catch (txErr: any) {
      logStructuredFirestoreError(
        txErr,
        FirestoreOperationType.CREATE,
        `users/${newUid} + login_identifiers/${normalizedLoginId}`
      );

      // 6. Retour arrière immédiat pour éviter tout compte orphelin dans Firebase Authentication
      let rolledBack = false;
      if (createdAuthUser) {
        try {
          await deleteUser(createdAuthUser);
          rolledBack = true;
        } catch (rollbackErr: any) {
          console.error('[NIGER SÉCURITÉ StaffAccounts] Échec du retour arrière deleteUser:', {
            code: rollbackErr?.code || 'rollback-failed',
            uid: newUid,
          });
        }
      }

      if (txErr?.code === 'login-id-already-exists') {
        return {
          success: false,
          errorCode: 'login-id-already-exists',
          rolledBack,
          error: `L’identifiant ${normalizedLoginId} vient déjà d’être réservé. Choisissez un autre numéro.`,
        };
      }

      if (txErr?.code === 'permission-denied') {
        return {
          success: false,
          errorCode: 'permission-denied',
          rolledBack,
          error: rolledBack
            ? 'Écriture refusée par les règles Firestore (permission-denied). Le compte Firebase Authentication créé a été annulé automatiquement (aucun compte orphelin).'
            : 'Écriture refusée par les règles Firestore (permission-denied) et le nettoyage automatique du compte Firebase Auth a échoué.',
        };
      }

      return {
        success: false,
        errorCode: txErr?.code || 'firestore-transaction-failed',
        rolledBack,
        error: rolledBack
          ? 'Erreur lors de l’enregistrement dans Firestore. La création a été annulée proprement sans laisser de compte orphelin.'
          : 'Erreur lors de l’enregistrement dans Firestore et échec du nettoyage automatique du compte Firebase Authentication.',
      };
    }

    const createdProfile: UserProfile = {
      uid: newUid,
      email: internalAuthEmail,
      loginId: normalizedLoginId,
      entrepriseId: inheritedEntrepriseId,
      nom: cleanNom,
      prenom: cleanPrenom || undefined,
      role: input.role,
      statut: 'actif',
      grade: cleanGrade || undefined,
      telephone: cleanTelephone || undefined,
      sitesAssignesIds: cleanSites,
      doitChangerCodeSecret: true,
      creeLe: nowIso,
      creeParUid: directionUid,
    };

    return {
      success: true,
      account: createdProfile,
    };
  } finally {
    // 7. Nettoyage systématique de l'application secondaire (la Direction reste connectée sur `auth`)
    if (secondaryAuth) {
      await firebaseSignOut(secondaryAuth).catch(() => {});
    }
    if (secondaryApp) {
      await deleteApp(secondaryApp).catch(() => {});
    }
  }
}

/**
 * Charge la liste officielle des comptes utilisateurs et des identifiants réservés (Direction uniquement).
 */
export async function listStaffAccountsAndIdentifiers(
  directionEntrepriseId?: string
): Promise<ListStaffAccountsResult> {
  try {
    const usersCol = collection(db, 'users');
    const idsCol = collection(db, 'login_identifiers');

    const [usersSnap, idsSnap] = await Promise.all([
      typeof getDocsFromServer === 'function' ? getDocsFromServer(usersCol) : getDocs(usersCol),
      typeof getDocsFromServer === 'function' ? getDocsFromServer(idsCol) : getDocs(idsCol),
    ]);

    const targetEntrepriseId = directionEntrepriseId
      ? resolveEffectiveEntrepriseId(directionEntrepriseId)
      : undefined;

    const accounts: UserProfile[] = [];
    const loginIdSet = new Set<string>();

    usersSnap.forEach((docSnap) => {
      const data = docSnap.data();
      const loginId = typeof data.loginId === 'string' ? normalizeLoginIdentifier(data.loginId) : undefined;
      if (loginId) loginIdSet.add(loginId);

      const effectiveEntrepriseId = resolveEffectiveEntrepriseId(data.entrepriseId);
      if (targetEntrepriseId && effectiveEntrepriseId !== targetEntrepriseId) {
        return;
      }

      accounts.push({
        uid: data.uid || docSnap.id,
        email: data.email || '',
        loginId,
        entrepriseId: effectiveEntrepriseId,
        nom: data.nom || 'Utilisateur',
        prenom: data.prenom,
        role: data.role,
        statut: data.statut === 'desactive' ? 'desactive' : 'actif',
        grade: data.grade,
        telephone: data.telephone,
        sitesAssignesIds: Array.isArray(data.sitesAssignesIds) ? data.sitesAssignesIds : [],
        doitChangerPin: Boolean(data.doitChangerPin),
        doitChangerCodeSecret: Boolean(data.doitChangerCodeSecret),
        creeParUid: data.creeParUid,
        derniereConnexion: data.derniereConnexion,
        creeLe: data.creeLe,
      });
    });

    idsSnap.forEach((docSnap) => {
      const data = docSnap.data();
      const id = normalizeLoginIdentifier(data.loginId || docSnap.id);
      if (id) loginIdSet.add(id);
    });

    // Tri : Comptables puis Contrôleurs puis Direction, plus récents en premier
    accounts.sort((a, b) => {
      const dateA = a.creeLe ? new Date(a.creeLe).getTime() : 0;
      const dateB = b.creeLe ? new Date(b.creeLe).getTime() : 0;
      return dateB - dateA;
    });

    return {
      success: true,
      accounts,
      existingLoginIds: Array.from(loginIdSet),
    };
  } catch (err: any) {
    logStructuredFirestoreError(err, FirestoreOperationType.LIST, 'users + login_identifiers');
    const errorMsg =
      err?.code === 'permission-denied'
        ? 'Accès refusé par les règles Firestore pour la lecture de l’annuaire des comptes. Vérifiez que votre compte Direction est actif et que les règles sont déployées.'
        : 'Impossible de charger la liste des comptes depuis Firestore. Vérifiez votre connexion Internet.';
    return {
      success: false,
      accounts: [],
      existingLoginIds: [],
      error: errorMsg,
    };
  }
}

/**
 * Active ou désactive un compte Comptable ou Contrôleur dans Firestore.
 * Met à jour atomiquement /users/{uid}.statut et /login_identifiers/{loginId}.statut.
 * La désactivation bloque immédiatement la connexion ET tous les accès Firestore protégés.
 */
export async function updateStaffAccountStatus(
  uid: string,
  loginId: string | undefined,
  statut: AccountStatus
): Promise<{ success: boolean; error?: string }> {
  if (!uid || (statut !== 'actif' && statut !== 'desactive')) {
    return { success: false, error: 'Paramètres de mise à jour du statut invalides.' };
  }

  const userRef = doc(db, 'users', uid);
  const normalizedLoginId = loginId ? normalizeLoginIdentifier(loginId) : '';
  const loginRef = normalizedLoginId ? doc(db, 'login_identifiers', normalizedLoginId) : null;

  try {
    await runTransaction(db, async (tx) => {
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists()) {
        throw new Error('Compte utilisateur introuvable dans Firestore.');
      }
      const userData = userSnap.data();
      if (userData.role === 'direction') {
        throw new Error('Un compte Direction ne peut pas être modifié ou désactivé depuis cette interface.');
      }

      const loginSnap = loginRef ? await tx.get(loginRef) : null;

      tx.update(userRef, { statut });
      if (loginRef && loginSnap?.exists()) {
        tx.update(loginRef, { statut });
      }
    });

    return { success: true };
  } catch (err: any) {
    logStructuredFirestoreError(err, FirestoreOperationType.UPDATE, `users/${uid}`);
    if (err?.code === 'permission-denied') {
      return {
        success: false,
        error: 'Modification refusée par les règles Firestore (permission-denied).',
      };
    }
    return {
      success: false,
      error: err?.message || 'Impossible de mettre à jour le statut du compte.',
    };
  }
}

/**
 * Met à jour les sites de ronde assignés à un Contrôleur terrain (Direction uniquement).
 */
export async function updateStaffAssignedSites(
  uid: string,
  sitesAssignesIds: string[]
): Promise<{ success: boolean; error?: string }> {
  if (!uid) {
    return { success: false, error: 'Identifiant utilisateur manquant.' };
  }

  const cleanSites = Array.from(
    new Set(
      (sitesAssignesIds || [])
        .map((s) => String(s || '').trim())
        .filter((s) => s.length > 0 && s.length <= 128)
    )
  ).slice(0, 100);

  try {
    await updateDoc(doc(db, 'users', uid), {
      sitesAssignesIds: cleanSites,
    });
    return { success: true };
  } catch (err: any) {
    logStructuredFirestoreError(err, FirestoreOperationType.UPDATE, `users/${uid}`);
    return {
      success: false,
      error:
        err?.code === 'permission-denied'
          ? 'Modification des sites assignés refusée par les règles Firestore.'
          : 'Impossible d’enregistrer les sites assignés pour ce contrôleur.',
    };
  }
}

/**
 * Écoute en temps réel le propre document /users/{uid} de l'utilisateur connecté.
 * Permet d'appliquer immédiatement une désactivation décidée par la Direction
 * ou une mise à jour de sites assignés sans attendre la prochaine reconnexion.
 */
export function subscribeToOwnUserProfile(
  uid: string,
  onProfileUpdate: (profile: UserProfile) => void,
  onAccountRevoked: (reason: string) => void
): () => void {
  const userRef = doc(db, 'users', uid);
  return onSnapshot(
    userRef,
    (snap) => {
      if (!snap.exists()) {
        onAccountRevoked('Votre profil utilisateur n’existe plus dans Firestore.');
        return;
      }
      const data = snap.data();
      if (data.statut !== 'actif') {
        onAccountRevoked('Ce compte a été désactivé par la Direction. Votre session a été fermée.');
        return;
      }
      onProfileUpdate({
        uid,
        email: data.email || auth.currentUser?.email || '',
        loginId: typeof data.loginId === 'string' ? normalizeLoginIdentifier(data.loginId) : undefined,
        entrepriseId: resolveEffectiveEntrepriseId(data.entrepriseId),
        nom: data.nom || 'Collaborateur NIGER SÉCURITÉ',
        prenom: data.prenom,
        role: data.role,
        statut: 'actif',
        grade: data.grade,
        telephone: data.telephone,
        sitesAssignesIds: Array.isArray(data.sitesAssignesIds) ? data.sitesAssignesIds : [],
        doitChangerPin: Boolean(data.doitChangerPin),
        doitChangerCodeSecret: Boolean(data.doitChangerCodeSecret),
        creeParUid: data.creeParUid,
        derniereConnexion: data.derniereConnexion,
        creeLe: data.creeLe,
      });
    },
    (error) => {
      // Ne jamais déconnecter sur une simple coupure réseau transitoire
      if (error?.code === 'permission-denied') {
        logStructuredFirestoreError(error, FirestoreOperationType.GET, `users/${uid}`);
        onAccountRevoked('Accès refusé à votre profil utilisateur par les règles Firestore.');
      }
    }
  );
}
