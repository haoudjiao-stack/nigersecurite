import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockInitializeApp = vi.fn();
const mockDeleteApp = vi.fn();
const mockInitializeAuth = vi.fn();
const mockCreateUserWithEmailAndPassword = vi.fn();
const mockDeleteUser = vi.fn();
const mockSignInWithEmailAndPassword = vi.fn();
const mockSignOut = vi.fn();
const mockSetPersistence = vi.fn();
const mockOnAuthStateChanged = vi.fn<(...args: any[]) => any>(() => () => {});
const mockReauthenticateWithCredential = vi.fn();
const mockUpdatePassword = vi.fn();
const mockUpdateEmail = vi.fn();
const mockCredential = vi.fn((email: string, secret: string) => ({ email, secret }));

const mockDoc = vi.fn((_db: any, col: string, id: string) => ({ col, id, path: `${col}/${id}` }));
const mockCollection = vi.fn((_db: any, col: string) => ({ col }));
const mockGetDoc = vi.fn();
const mockGetDocFromServer = vi.fn();
const mockGetDocs = vi.fn();
const mockGetDocsFromServer = vi.fn();
const mockUpdateDoc = vi.fn();
const mockRunTransaction = vi.fn();
const mockOnSnapshot = vi.fn();

const mockPrimaryAuth = vi.hoisted(() => ({
  currentUser: null as any,
}));

vi.mock('firebase/app', () => ({
  initializeApp: (...args: any[]) => mockInitializeApp(...args),
  deleteApp: (...args: any[]) => mockDeleteApp(...args),
}));

vi.mock('firebase/auth', () => ({
  initializeAuth: (...args: any[]) => mockInitializeAuth(...args),
  createUserWithEmailAndPassword: (...args: any[]) => mockCreateUserWithEmailAndPassword(...args),
  deleteUser: (...args: any[]) => mockDeleteUser(...args),
  signInWithEmailAndPassword: (...args: any[]) => mockSignInWithEmailAndPassword(...args),
  signOut: (...args: any[]) => mockSignOut(...args),
  onAuthStateChanged: (...args: any[]) => mockOnAuthStateChanged(...args),
  setPersistence: (...args: any[]) => mockSetPersistence(...args),
  browserLocalPersistence: { type: 'LOCAL' },
  browserSessionPersistence: { type: 'SESSION' },
  inMemoryPersistence: { type: 'NONE' },
  EmailAuthProvider: { credential: (email: string, pass: string) => mockCredential(email, pass) },
  reauthenticateWithCredential: (...args: any[]) => mockReauthenticateWithCredential(...args),
  updatePassword: (...args: any[]) => mockUpdatePassword(...args),
  updateEmail: (...args: any[]) => mockUpdateEmail(...args),
}));

vi.mock('firebase/firestore', () => ({
  doc: (db: any, col: string, id: string) => mockDoc(db, col, id),
  collection: (db: any, col: string) => mockCollection(db, col),
  getDoc: (...args: any[]) => mockGetDoc(...args),
  getDocFromServer: (...args: any[]) => mockGetDocFromServer(...args),
  getDocs: (...args: any[]) => mockGetDocs(...args),
  getDocsFromServer: (...args: any[]) => mockGetDocsFromServer(...args),
  updateDoc: (...args: any[]) => mockUpdateDoc(...args),
  runTransaction: (...args: any[]) => mockRunTransaction(...args),
  onSnapshot: (...args: any[]) => mockOnSnapshot(...args),
}));

vi.mock('../src/firebase', () => ({
  auth: mockPrimaryAuth,
  db: { __mockDb: true },
  app: { __mockPrimaryApp: true },
}));

import {
  INTERNAL_LOGIN_DOMAIN,
  normalizeLoginIdentifier,
  validateLoginIdentifierForRole,
  loginIdentifierToAuthEmail,
  resolveLoginInputToAuthEmail,
  validateSecretCode,
  suggestNextLoginIdentifier,
  generateStrongSecretCode,
} from '../src/services/loginIdentifierUtils';
import {
  loginWithIdentifierOrEmail,
  changePersonalSecretCode,
} from '../src/services/authService';
import {
  createStaffAccountByDirection,
  listStaffAccountsAndIdentifiers,
  updateStaffAccountStatus,
  subscribeToOwnUserProfile,
} from '../src/services/staffAccountsService';
import {
  DEFAULT_ENTREPRISE_ID,
  normalizeEntrepriseId,
  resolveEffectiveEntrepriseId,
} from '../src/utils/enterpriseContext';

describe('Utilitaires identifiants CPT/CTR et codes secrets', () => {
  it('1. Normalise et valide strictement les formats CPT-YYYY-XXX et CTR-YYYY-XXX selon le rôle', () => {
    expect(normalizeLoginIdentifier('  cpt-2026-001 ')).toBe('CPT-2026-001');
    expect(validateLoginIdentifierForRole('cpt-2026-001', 'comptabilite')).toEqual({
      valid: true,
      normalized: 'CPT-2026-001',
    });
    expect(validateLoginIdentifierForRole('CTR-2026-042', 'controleur')).toEqual({
      valid: true,
      normalized: 'CTR-2026-042',
    });

    // Mauvais préfixe pour le rôle
    expect(validateLoginIdentifierForRole('CTR-2026-001', 'comptabilite').valid).toBe(false);
    expect(validateLoginIdentifierForRole('CPT-2026-001', 'controleur').valid).toBe(false);
    // Matricule RH interdit comme identifiant de connexion
    expect(validateLoginIdentifierForRole('NS-2026-5730', 'controleur').valid).toBe(false);
    expect(validateLoginIdentifierForRole('CPT-26-01', 'comptabilite').valid).toBe(false);
  });

  it('2. Convertit de manière déterministe un identifiant CPT/CTR en email technique sans lecture Firestore', () => {
    expect(loginIdentifierToAuthEmail('CPT-2026-001')).toBe(`cpt-2026-001@${INTERNAL_LOGIN_DOMAIN}`);
    expect(loginIdentifierToAuthEmail('ctr-2026-019')).toBe(`ctr-2026-019@${INTERNAL_LOGIN_DOMAIN}`);
    expect(() => loginIdentifierToAuthEmail('NS-2026-5730')).toThrow();
  });

  it('3. Résout les 3 parcours de connexion (Direction e-mail, Comptable CPT, Contrôleur CTR)', () => {
    const dir = resolveLoginInputToAuthEmail('ambsecurity2026@gmail.com');
    expect(dir.valid).toBe(true);
    expect(dir.inputType).toBe('email');
    expect(dir.authEmail).toBe('ambsecurity2026@gmail.com');

    const cpt = resolveLoginInputToAuthEmail('cpt-2026-003');
    expect(cpt.valid).toBe(true);
    expect(cpt.inputType).toBe('login_id');
    expect(cpt.loginId).toBe('CPT-2026-003');
    expect(cpt.expectedRole).toBe('comptabilite');
    expect(cpt.authEmail).toBe('cpt-2026-003@acces.nigersecurite.ne');

    const ctr = resolveLoginInputToAuthEmail('CTR-2026-012');
    expect(ctr.valid).toBe(true);
    expect(ctr.inputType).toBe('login_id');
    expect(ctr.loginId).toBe('CTR-2026-012');
    expect(ctr.expectedRole).toBe('controleur');
    expect(ctr.authEmail).toBe('ctr-2026-012@acces.nigersecurite.ne');

    expect(resolveLoginInputToAuthEmail('NS-2026-5730').valid).toBe(false);
  });

  it('4. Suggère le prochain identifiant libre sans collision', () => {
    expect(suggestNextLoginIdentifier('comptabilite', [], 2026)).toBe('CPT-2026-001');
    expect(
      suggestNextLoginIdentifier('comptabilite', ['CPT-2026-001', 'CPT-2026-004', 'CTR-2026-009'], 2026)
    ).toBe('CPT-2026-005');
    expect(
      suggestNextLoginIdentifier('controleur', ['CTR-2026-001', 'CTR-2026-002'], 2026)
    ).toBe('CTR-2026-003');
  });

  it('5. Impose un code secret d’au moins 6 caractères et rejette les codes triviaux', () => {
    expect(validateSecretCode('12345').valid).toBe(false);
    expect(validateSecretCode('000000').valid).toBe(false);
    expect(validateSecretCode('123456').valid).toBe(false);
    expect(validateSecretCode('111111').valid).toBe(false);
    expect(validateSecretCode('aaaaaa').valid).toBe(false);
    expect(validateSecretCode(' Ns2026!').valid).toBe(false);

    expect(validateSecretCode('Niamey#2026').valid).toBe(true);
    const generated = generateStrongSecretCode(8);
    expect(generated.length).toBe(8);
    expect(validateSecretCode(generated).valid).toBe(true);
  });
});

describe('Parcours complet création, connexion, changement de code secret et désactivation', () => {
  const SECRET_CODE = 'CodeSecretRobust_9482!';
  const NEW_SECRET_CODE = 'NouveauCodePerso_7319!';

  let infoSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrimaryAuth.currentUser = null;
    mockSetPersistence.mockResolvedValue(undefined);
    mockSignOut.mockResolvedValue(undefined);
    mockDeleteApp.mockResolvedValue(undefined);
    mockDeleteUser.mockResolvedValue(undefined);
    mockInitializeApp.mockReturnValue({ name: 'secondary-provision-app' });
    mockInitializeAuth.mockReturnValue({ name: 'secondary-provision-auth' });

    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    const allLogs = [
      ...infoSpy.mock.calls.flat(),
      ...warnSpy.mock.calls.flat(),
      ...errorSpy.mock.calls.flat(),
    ]
      .map((item) => (typeof item === 'string' ? item : JSON.stringify(item)))
      .join(' ');

    // Précaution obligatoire #3 : aucun code secret ne doit apparaître dans les journaux
    expect(allLogs).not.toContain(SECRET_CODE);
    expect(allLogs).not.toContain(NEW_SECRET_CODE);

    infoSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('6. Crée un compte Comptable depuis Direction sans déconnecter la Direction et sans stocker le code secret dans Firestore', async () => {
    const directionSession = {
      uid: 'woy8IIoMZ5ObwLz2I0k5II20Ehb2',
      email: 'ambsecurity2026@gmail.com',
    };
    mockPrimaryAuth.currentUser = directionSession;

    mockGetDocFromServer.mockResolvedValue({ exists: () => false });
    mockCreateUserWithEmailAndPassword.mockResolvedValue({
      user: { uid: 'uid-cpt-new-01', email: 'cpt-2026-001@acces.nigersecurite.ne' },
    });

    const writtenDocs: Record<string, any> = {};
    mockRunTransaction.mockImplementation(async (_db: any, fn: any) => {
      const tx = {
        get: vi.fn().mockResolvedValue({ exists: () => false }),
        set: vi.fn((ref: any, data: any) => {
          writtenDocs[ref.path] = data;
        }),
      };
      return fn(tx);
    });

    const res = await createStaffAccountByDirection({
      role: 'comptabilite',
      loginId: 'cpt-2026-001',
      nom: 'MOUSSA',
      prenom: 'Aminata',
      grade: 'Chef Comptable',
      secretCode: SECRET_CODE,
    });

    expect(res.success).toBe(true);
    expect(res.account?.loginId).toBe('CPT-2026-001');
    expect(res.account?.role).toBe('comptabilite');
    expect(res.account?.doitChangerCodeSecret).toBe(true);

    // Instance secondaire en mémoire uniquement + nettoyage complet
    expect(mockInitializeAuth).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ persistence: { type: 'NONE' } })
    );
    expect(mockDeleteApp).toHaveBeenCalledTimes(1);
    // La Direction n'a PAS été déconnectée
    expect(mockPrimaryAuth.currentUser).toBe(directionSession);

    // Vérifier les 2 documents atomiques écrits dans Firestore
    const loginDoc = writtenDocs['login_identifiers/CPT-2026-001'];
    const userDoc = writtenDocs['users/uid-cpt-new-01'];
    expect(loginDoc).toEqual(
      expect.objectContaining({
        loginId: 'CPT-2026-001',
        uid: 'uid-cpt-new-01',
        entrepriseId: DEFAULT_ENTREPRISE_ID,
        role: 'comptabilite',
        statut: 'actif',
        creeParUid: 'woy8IIoMZ5ObwLz2I0k5II20Ehb2',
      })
    );
    expect(userDoc).toEqual(
      expect.objectContaining({
        uid: 'uid-cpt-new-01',
        email: 'cpt-2026-001@acces.nigersecurite.ne',
        loginId: 'CPT-2026-001',
        entrepriseId: DEFAULT_ENTREPRISE_ID,
        role: 'comptabilite',
        statut: 'actif',
        doitChangerCodeSecret: true,
        creeParUid: 'woy8IIoMZ5ObwLz2I0k5II20Ehb2',
      })
    );

    // Zéro secret stocké dans Firestore
    const serialized = JSON.stringify(writtenDocs);
    expect(serialized).not.toContain(SECRET_CODE);
    expect(userDoc.pinHash).toBeUndefined();
    expect(userDoc.pinSalt).toBeUndefined();
    expect(userDoc.codeSecret).toBeUndefined();
    expect(userDoc.password).toBeUndefined();
  });

  it('7. Bloque immédiatement la duplication d’un identifiant déjà présent dans /login_identifiers', async () => {
    mockPrimaryAuth.currentUser = { uid: 'woy8IIoMZ5ObwLz2I0k5II20Ehb2' };
    mockGetDocFromServer.mockResolvedValue({ exists: () => true });

    const res = await createStaffAccountByDirection({
      role: 'controleur',
      loginId: 'CTR-2026-001',
      nom: 'IBRAHIM',
      secretCode: SECRET_CODE,
    });

    expect(res.success).toBe(false);
    expect(res.errorCode).toBe('login-id-already-exists');
    expect(mockCreateUserWithEmailAndPassword).not.toHaveBeenCalled();
  });

  it('8. Exécute un retour arrière automatique (deleteUser) si la transaction Firestore échoue afin d’éviter tout compte orphelin', async () => {
    const directionSession = { uid: 'woy8IIoMZ5ObwLz2I0k5II20Ehb2' };
    mockPrimaryAuth.currentUser = directionSession;
    mockGetDocFromServer.mockResolvedValue({ exists: () => false });

    const orphanUser = { uid: 'uid-orphan-99', email: 'ctr-2026-002@acces.nigersecurite.ne' };
    mockCreateUserWithEmailAndPassword.mockResolvedValue({ user: orphanUser });
    mockRunTransaction.mockRejectedValue({
      code: 'permission-denied',
      message: 'Missing or insufficient permissions.',
    });

    const res = await createStaffAccountByDirection({
      role: 'controleur',
      loginId: 'CTR-2026-002',
      nom: 'GARBA',
      secretCode: SECRET_CODE,
    });

    expect(res.success).toBe(false);
    expect(res.errorCode).toBe('permission-denied');
    expect(res.rolledBack).toBe(true);
    expect(mockDeleteUser).toHaveBeenCalledWith(orphanUser);
    expect(mockDeleteApp).toHaveBeenCalledTimes(1);
    expect(mockPrimaryAuth.currentUser).toBe(directionSession);
  });

  it('9. Authentifie un Contrôleur par CTR-2026-001 et rejette un compte désactivé ou incohérent', async () => {
    // a) Connexion Contrôleur valide
    mockSignInWithEmailAndPassword.mockResolvedValueOnce({
      user: {
        uid: 'uid-ctr-1',
        email: 'ctr-2026-001@acces.nigersecurite.ne',
        emailVerified: false,
        getIdToken: vi.fn().mockResolvedValue('tok-1'),
      },
    });
    mockGetDocFromServer.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        uid: 'uid-ctr-1',
        email: 'ctr-2026-001@acces.nigersecurite.ne',
        loginId: 'CTR-2026-001',
        nom: 'DAN-INNA',
        role: 'controleur',
        statut: 'actif',
        sitesAssignesIds: ['site-1'],
        doitChangerCodeSecret: true,
      }),
    });

    const ok = await loginWithIdentifierOrEmail('ctr-2026-001', SECRET_CODE);
    expect(ok.success).toBe(true);
    expect(ok.user?.role).toBe('controleur');
    expect(ok.user?.loginId).toBe('CTR-2026-001');

    // b) Compte désactivé -> connexion refusée + signOut
    mockSignInWithEmailAndPassword.mockResolvedValueOnce({
      user: {
        uid: 'uid-cpt-disabled',
        email: 'cpt-2026-002@acces.nigersecurite.ne',
        emailVerified: false,
        getIdToken: vi.fn().mockResolvedValue('tok-2'),
      },
    });
    mockGetDocFromServer.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        uid: 'uid-cpt-disabled',
        email: 'cpt-2026-002@acces.nigersecurite.ne',
        loginId: 'CPT-2026-002',
        nom: 'COMPTA',
        role: 'comptabilite',
        statut: 'desactive',
      }),
    });

    const disabled = await loginWithIdentifierOrEmail('CPT-2026-002', SECRET_CODE);
    expect(disabled.success).toBe(false);
    expect(disabled.errorCategory).toBe('account_disabled');
    expect(mockSignOut).toHaveBeenCalled();

    // c) Incohérence préfixe CPT vs rôle controleur -> refusée
    mockSignInWithEmailAndPassword.mockResolvedValueOnce({
      user: {
        uid: 'uid-mismatch',
        email: 'cpt-2026-009@acces.nigersecurite.ne',
        emailVerified: false,
        getIdToken: vi.fn().mockResolvedValue('tok-3'),
      },
    });
    mockGetDocFromServer.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        uid: 'uid-mismatch',
        email: 'cpt-2026-009@acces.nigersecurite.ne',
        loginId: 'CPT-2026-009',
        nom: 'INCOHERENT',
        role: 'controleur',
        statut: 'actif',
      }),
    });

    const mismatch = await loginWithIdentifierOrEmail('CPT-2026-009', SECRET_CODE);
    expect(mismatch.success).toBe(false);
    expect(mismatch.errorCategory).toBe('role_invalid');
  });

  it('10. Permet au Comptable/Contrôleur de changer son code secret personnel et réinitialise doitChangerCodeSecret', async () => {
    mockPrimaryAuth.currentUser = {
      uid: 'uid-cpt-1',
      email: 'cpt-2026-001@acces.nigersecurite.ne',
    };
    mockReauthenticateWithCredential.mockResolvedValue({});
    mockUpdatePassword.mockResolvedValue(undefined);
    mockUpdateDoc.mockResolvedValue(undefined);

    const weakRes = await changePersonalSecretCode(SECRET_CODE, '123456');
    expect(weakRes.success).toBe(false);
    expect(mockUpdatePassword).not.toHaveBeenCalled();

    const okRes = await changePersonalSecretCode(SECRET_CODE, NEW_SECRET_CODE);
    expect(okRes.success).toBe(true);
    expect(okRes.profileUpdated).toBe(true);
    expect(mockReauthenticateWithCredential).toHaveBeenCalledTimes(1);
    expect(mockUpdatePassword).toHaveBeenCalledWith(mockPrimaryAuth.currentUser, NEW_SECRET_CODE);
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'users/uid-cpt-1' }),
      { doitChangerCodeSecret: false }
    );
  });

  it('11. Désactive atomiquement /users/{uid} et /login_identifiers/{loginId}, refuse de toucher un compte Direction et révoque en temps réel', async () => {
    const updates: Record<string, any> = {};
    mockRunTransaction.mockImplementationOnce(async (_db: any, fn: any) => {
      const tx = {
        get: vi.fn((ref: any) =>
          Promise.resolve({
            exists: () => true,
            data: () =>
              ref.col === 'users'
                ? { uid: 'uid-ctr-1', role: 'controleur', statut: 'actif' }
                : { loginId: 'CTR-2026-001', statut: 'actif' },
          })
        ),
        update: vi.fn((ref: any, patch: any) => {
          updates[ref.path] = patch;
        }),
      };
      return fn(tx);
    });

    const disableRes = await updateStaffAccountStatus('uid-ctr-1', 'CTR-2026-001', 'desactive');
    expect(disableRes.success).toBe(true);
    expect(updates['users/uid-ctr-1']).toEqual({ statut: 'desactive' });
    expect(updates['login_identifiers/CTR-2026-001']).toEqual({ statut: 'desactive' });

    // Refus sur un compte Direction
    mockRunTransaction.mockImplementationOnce(async (_db: any, fn: any) => {
      const tx = {
        get: vi.fn().mockResolvedValue({
          exists: () => true,
          data: () => ({ uid: 'woy8IIoMZ5ObwLz2I0k5II20Ehb2', role: 'direction', statut: 'actif' }),
        }),
        update: vi.fn(),
      };
      return fn(tx);
    });
    const dirAttempt = await updateStaffAccountStatus('woy8IIoMZ5ObwLz2I0k5II20Ehb2', undefined, 'desactive');
    expect(dirAttempt.success).toBe(false);

    // Surveillance temps réel : déclenche onAccountRevoked dès que statut passe à desactive
    const onUpdate = vi.fn();
    const onRevoked = vi.fn();
    mockOnSnapshot.mockImplementationOnce((_ref: any, onNext: any) => {
      onNext({
        exists: () => true,
        data: () => ({ uid: 'uid-ctr-1', role: 'controleur', statut: 'desactive' }),
      });
      return () => {};
    });

    subscribeToOwnUserProfile('uid-ctr-1', onUpdate, onRevoked);
    expect(onRevoked).toHaveBeenCalledTimes(1);
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('12. Fait hériter explicitement entrepriseId du compte Direction aux nouveaux comptes CPT/CTR et rejette un identifiant invalide', async () => {
    expect(DEFAULT_ENTREPRISE_ID).toBe('NIGERSECURITE-001');
    expect(normalizeEntrepriseId(' nigersecurite-001 ')).toBe('NIGERSECURITE-001');
    expect(normalizeEntrepriseId('x')).toBeUndefined();
    expect(resolveEffectiveEntrepriseId(undefined)).toBe('NIGERSECURITE-001');

    mockPrimaryAuth.currentUser = {
      uid: 'uid-dir-client-02',
      email: 'dir@client02.ne',
    };

    // Rejet d'un entrepriseId malformé avant tout appel Firebase
    const invalidRes = await createStaffAccountByDirection({
      role: 'controleur',
      loginId: 'CTR-2026-021',
      entrepriseId: '??',
      nom: 'TEST',
      secretCode: SECRET_CODE,
    });
    expect(invalidRes.success).toBe(false);
    expect(invalidRes.errorCode).toBe('invalid-entreprise-id');
    expect(mockCreateUserWithEmailAndPassword).not.toHaveBeenCalled();

    // Héritage explicite d'une entreprise spécifique (ex: CLIENT-002)
    mockGetDocFromServer.mockResolvedValueOnce({ exists: () => false });
    mockCreateUserWithEmailAndPassword.mockResolvedValueOnce({
      user: { uid: 'uid-ctr-client-02', email: 'ctr-2026-021@acces.nigersecurite.ne' },
    });

    const writtenDocs: Record<string, any> = {};
    mockRunTransaction.mockImplementationOnce(async (_db: any, fn: any) => {
      const tx = {
        get: vi.fn().mockResolvedValue({ exists: () => false }),
        set: vi.fn((ref: any, data: any) => {
          writtenDocs[ref.path] = data;
        }),
      };
      return fn(tx);
    });

    const okRes = await createStaffAccountByDirection({
      role: 'controleur',
      loginId: 'CTR-2026-021',
      entrepriseId: 'client-002',
      nom: 'ISSIFOU',
      secretCode: SECRET_CODE,
    });

    expect(okRes.success).toBe(true);
    expect(okRes.account?.entrepriseId).toBe('CLIENT-002');
    expect(writtenDocs['users/uid-ctr-client-02']?.entrepriseId).toBe('CLIENT-002');
    expect(writtenDocs['login_identifiers/CTR-2026-021']?.entrepriseId).toBe('CLIENT-002');
  });

  it('13. Attribue NIGERSECURITE-001 aux comptes existants sans champ entrepriseId et filtre l’annuaire par entreprise', async () => {
    const fakeUsersDocs = [
      {
        id: 'uid-dir-legacy',
        data: () => ({
          uid: 'uid-dir-legacy',
          email: 'direction@nigersecurite.ne',
          nom: 'Direction Historique',
          role: 'direction',
          statut: 'actif',
          // Pas de champ entrepriseId dans Firestore -> doit hériter NIGERSECURITE-001
        }),
      },
      {
        id: 'uid-cpt-ns1',
        data: () => ({
          uid: 'uid-cpt-ns1',
          email: 'cpt-2026-001@acces.nigersecurite.ne',
          loginId: 'CPT-2026-001',
          entrepriseId: 'NIGERSECURITE-001',
          nom: 'Comptable NS1',
          role: 'comptabilite',
          statut: 'actif',
        }),
      },
      {
        id: 'uid-cpt-other',
        data: () => ({
          uid: 'uid-cpt-other',
          email: 'cpt-2026-099@acces.nigersecurite.ne',
          loginId: 'CPT-2026-099',
          entrepriseId: 'AUTRE-CLIENT-002',
          nom: 'Comptable Autre Société',
          role: 'comptabilite',
          statut: 'actif',
        }),
      },
    ];

    const fakeLoginDocs = [
      { id: 'CPT-2026-001', data: () => ({ loginId: 'CPT-2026-001' }) },
      { id: 'CPT-2026-099', data: () => ({ loginId: 'CPT-2026-099' }) },
    ];

    mockGetDocsFromServer
      .mockResolvedValueOnce({ forEach: (cb: any) => fakeUsersDocs.forEach(cb) })
      .mockResolvedValueOnce({ forEach: (cb: any) => fakeLoginDocs.forEach(cb) });

    const listRes = await listStaffAccountsAndIdentifiers('NIGERSECURITE-001');
    expect(listRes.success).toBe(true);
    expect(listRes.accounts.map((a) => a.uid)).toEqual(
      expect.arrayContaining(['uid-dir-legacy', 'uid-cpt-ns1'])
    );
    expect(listRes.accounts.map((a) => a.uid)).not.toContain('uid-cpt-other');
    expect(listRes.accounts.find((a) => a.uid === 'uid-dir-legacy')?.entrepriseId).toBe(
      'NIGERSECURITE-001'
    );
    // Les identifiants réservés restent connus globalement pour éviter toute collision Auth
    expect(listRes.existingLoginIds).toEqual(
      expect.arrayContaining(['CPT-2026-001', 'CPT-2026-099'])
    );
  });
});

