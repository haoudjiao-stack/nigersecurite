import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockSignInWithEmailAndPassword = vi.fn<(...args: any[]) => any>();
const mockSignOut = vi.fn<(...args: any[]) => any>();
const mockSetPersistence = vi.fn<(...args: any[]) => any>();
const mockOnAuthStateChanged = vi.fn<(...args: any[]) => any>(() => () => {});
const mockGetDoc = vi.fn<(...args: any[]) => any>();
const mockDoc = vi.fn((_db: any, col: string, id: string) => ({ col, id }));

vi.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: (...args: any[]) => mockSignInWithEmailAndPassword(...args),
  signOut: (...args: any[]) => mockSignOut(...args),
  onAuthStateChanged: (...args: any[]) => mockOnAuthStateChanged(...args),
  setPersistence: (...args: any[]) => mockSetPersistence(...args),
  browserLocalPersistence: { type: 'LOCAL' },
  browserSessionPersistence: { type: 'SESSION' },
  inMemoryPersistence: { type: 'NONE' },
  EmailAuthProvider: { credential: vi.fn() },
  reauthenticateWithCredential: vi.fn(),
  updatePassword: vi.fn(),
  updateEmail: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  doc: (db: any, col: string, id: string) => mockDoc(db, col, id),
  getDoc: (...args: any[]) => mockGetDoc(...args),
  getDocFromServer: (...args: any[]) => mockGetDoc(...args),
  updateDoc: vi.fn(),
}));

vi.mock('../src/firebase', () => ({
  auth: { currentUser: null },
  db: {},
  app: {},
}));

import { loginWithEmail, fetchUserProfileDetailed } from '../src/services/authService';

describe('Parcours complet loginWithEmail() — Isolation des étapes et sécurité des journaux', () => {
  const TEST_EMAIL = 'direction@nigersecurite.ne';
  const SECRET_PASSWORD = 'MonMotDePasseSuperSecret_2026!';
  const SECRET_ID_TOKEN = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.SECRET_TOKEN_PAYLOAD';

  let infoSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSetPersistence.mockResolvedValue(undefined);
    mockSignOut.mockResolvedValue(undefined);
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

    expect(allLogs).not.toContain(SECRET_PASSWORD);
    expect(allLogs).not.toContain(SECRET_ID_TOKEN);

    vi.unstubAllGlobals();
    infoSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('1. Continue la connexion si setPersistence(local) échoue (fallback session/mémoire sans erreur générique)', async () => {
    mockSetPersistence
      .mockRejectedValueOnce({ code: 'auth/web-storage-unsupported' })
      .mockResolvedValueOnce(undefined);

    mockSignInWithEmailAndPassword.mockResolvedValue({
      user: {
        uid: 'uid-dir-1',
        email: TEST_EMAIL,
        emailVerified: true,
        getIdToken: vi.fn().mockResolvedValue(SECRET_ID_TOKEN),
      },
    });

    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        uid: 'uid-dir-1',
        email: TEST_EMAIL,
        nom: 'Directeur Général',
        role: 'direction',
        statut: 'actif',
        doitChangerPin: false,
      }),
    });

    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const res = await loginWithEmail(TEST_EMAIL, SECRET_PASSWORD);

    expect(res.success).toBe(true);
    expect(res.step).toBe('session_ready');
    expect(res.user?.role).toBe('direction');
    expect(mockSetPersistence).toHaveBeenCalledTimes(2);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('2. Identifie clairement une erreur d’identifiants Firebase Auth sans confusion avec Firestore', async () => {
    mockSignInWithEmailAndPassword.mockRejectedValue({
      code: 'auth/invalid-credential',
    });

    const res = await loginWithEmail(TEST_EMAIL, SECRET_PASSWORD);

    expect(res.success).toBe(false);
    expect(res.step).toBe('firebase_auth');
    expect(res.errorCategory).toBe('credentials');
    expect(res.error).toMatch(/Identifiant ou mot de passe incorrect/i);
    expect(mockGetDoc).not.toHaveBeenCalled();
  });

  it('3. Distingue les codes de configuration Firebase Auth (ex: unauthorized-domain, internal-error) d’un mot de passe faux', async () => {
    mockSignInWithEmailAndPassword.mockRejectedValue({
      code: 'auth/unauthorized-domain',
    });

    const res = await loginWithEmail(TEST_EMAIL, SECRET_PASSWORD);

    expect(res.success).toBe(false);
    expect(res.step).toBe('firebase_auth');
    expect(res.errorCategory).toBe('auth_config');
    expect(res.error).toMatch(/domaine n’est pas autorisé/i);
    expect(res.error).not.toMatch(/mot de passe incorrect/i);
    expect(res.error).not.toBe('Une erreur est survenue lors de l’authentification. Veuillez réessayer.');
  });

  it('4. Si Firebase Auth réussit mais Firestore client refuse (permission-denied) — même si signOut échoue — arrête immédiatement sans appeler Admin SDK ni contourner', async () => {
    mockSignInWithEmailAndPassword.mockResolvedValue({
      user: {
        uid: 'uid-dir-2',
        email: TEST_EMAIL,
        displayName: 'Directeur',
        emailVerified: true,
        getIdToken: vi.fn().mockResolvedValue(SECRET_ID_TOKEN),
      },
    });

    mockGetDoc.mockRejectedValue({
      code: 'permission-denied',
      message: 'Missing or insufficient permissions.',
    });

    // Simule un échec secondaire de firebaseSignOut lors du nettoyage
    mockSignOut.mockRejectedValue({
      code: 'auth/network-request-failed',
    });

    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const res = await loginWithEmail(TEST_EMAIL, SECRET_PASSWORD);

    expect(res.success).toBe(false);
    expect(res.errorCategory).toBe('firestore_profile');
    expect(res.step).toBe('firestore_profile');
    expect(res.error).toMatch(/Authentification Firebase réussie/i);
    expect(res.error).toMatch(/permission-denied/i);
    expect(res.error).not.toMatch(/mot de passe incorrect/i);
    expect(res.error).not.toBe('Une erreur est survenue lors de l’authentification. Veuillez réessayer.');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('5. Si Firebase Auth réussit mais aucun document /users/{uid} n’existe dans Firestore, arrête sans créer automatiquement de profil Direction', async () => {
    mockSignInWithEmailAndPassword.mockResolvedValue({
      user: {
        uid: 'uid-missing-doc',
        email: TEST_EMAIL,
        displayName: 'Direction',
        emailVerified: true,
        getIdToken: vi.fn().mockResolvedValue(SECRET_ID_TOKEN),
      },
    });

    mockGetDoc.mockResolvedValue({
      exists: () => false,
    });

    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const res = await loginWithEmail(TEST_EMAIL, SECRET_PASSWORD);

    expect(res.success).toBe(false);
    expect(res.errorCategory).toBe('firestore_profile');
    expect(res.step).toBe('firestore_profile');
    expect(res.error).toMatch(/Authentification Firebase réussie/i);
    expect(res.error).toMatch(/aucun document de profil/i);
    expect(res.error).toContain('uid-missing-doc');
    expect(res.error).toContain('ai-studio-nigerscuritgesti-a57ef5a8-c772-4079-9416-ff825a5303ab');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('6. Si Firebase Auth réussit mais le rôle Firestore est invalide ou manquant, rejette avec errorCategory role_invalid sans appeler bootstrap', async () => {
    mockSignInWithEmailAndPassword.mockResolvedValue({
      user: {
        uid: 'uid-bad-role',
        email: TEST_EMAIL,
        emailVerified: true,
        getIdToken: vi.fn().mockResolvedValue(SECRET_ID_TOKEN),
      },
    });

    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        uid: 'uid-bad-role',
        email: TEST_EMAIL,
        role: 'superadmin_inexistant',
        statut: 'actif',
      }),
    });

    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const res = await loginWithEmail(TEST_EMAIL, SECRET_PASSWORD);

    expect(res.success).toBe(false);
    expect(res.errorCategory).toBe('role_invalid');
    expect(res.step).toBe('role_validation');
    expect(res.error).toMatch(/Authentification Firebase réussie/i);
    expect(res.error).toMatch(/rôle manquant ou non autorisé/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('7. Si Firebase Auth réussit mais le compte Firestore est désactivé, rejette avec account_disabled', async () => {
    mockSignInWithEmailAndPassword.mockResolvedValue({
      user: {
        uid: 'uid-disabled',
        email: TEST_EMAIL,
        emailVerified: true,
        getIdToken: vi.fn().mockResolvedValue(SECRET_ID_TOKEN),
      },
    });

    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        uid: 'uid-disabled',
        email: TEST_EMAIL,
        role: 'comptabilite',
        statut: 'desactive',
      }),
    });

    const res = await loginWithEmail(TEST_EMAIL, SECRET_PASSWORD);

    expect(res.success).toBe(false);
    expect(res.errorCategory).toBe('account_disabled');
    expect(res.step).toBe('role_validation');
    expect(res.error).toMatch(/désactivé/i);
    expect(res.error).not.toMatch(/mot de passe incorrect/i);
  });

  it('8. Ne contourne jamais permission-denied via un profil en cache local', async () => {
    const store = new Map<string, string>();
    store.set(
      'niger_securite_cached_user_profile_v1',
      JSON.stringify({
        uid: 'uid-cached',
        email: TEST_EMAIL,
        nom: 'Profil En Cache',
        role: 'direction',
        statut: 'actif',
        doitChangerPin: false,
      })
    );

    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => store.get(k) || null,
        setItem: (k: string, v: string) => store.set(k, v),
        removeItem: (k: string) => store.delete(k),
      },
    });

    mockGetDoc.mockRejectedValue({
      code: 'permission-denied',
      message: 'Missing or insufficient permissions.',
    });

    const result = await fetchUserProfileDetailed('uid-cached', { allowCacheOnNetworkError: true });

    expect(result.profile).toBeNull();
    expect(result.errorCode).toBe('permission-denied');
    expect(store.has('niger_securite_cached_user_profile_v1')).toBe(false);
  });

  it('9. Attribue NIGERSECURITE-001 sans blocage aux comptes existants sans entrepriseId et conserve un entrepriseId explicite', async () => {
    // a) Compte existant sans champ entrepriseId dans Firestore
    mockSignInWithEmailAndPassword.mockResolvedValueOnce({
      user: {
        uid: 'uid-legacy-dir',
        email: TEST_EMAIL,
        emailVerified: true,
        getIdToken: vi.fn().mockResolvedValue(SECRET_ID_TOKEN),
      },
    });
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        uid: 'uid-legacy-dir',
        email: TEST_EMAIL,
        nom: 'Direction Historique',
        role: 'direction',
        statut: 'actif',
        doitChangerPin: false,
      }),
    });

    const legacyRes = await loginWithEmail(TEST_EMAIL, SECRET_PASSWORD);
    expect(legacyRes.success).toBe(true);
    expect(legacyRes.user?.entrepriseId).toBe('NIGERSECURITE-001');

    // b) Compte déjà rattaché à une autre entreprise explicite
    mockSignInWithEmailAndPassword.mockResolvedValueOnce({
      user: {
        uid: 'uid-client-02',
        email: 'dir@client02.ne',
        emailVerified: true,
        getIdToken: vi.fn().mockResolvedValue(SECRET_ID_TOKEN),
      },
    });
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        uid: 'uid-client-02',
        email: 'dir@client02.ne',
        entrepriseId: 'CLIENT-002',
        nom: 'Direction Client 02',
        role: 'direction',
        statut: 'actif',
        doitChangerPin: false,
      }),
    });

    const explicitRes = await loginWithEmail('dir@client02.ne', SECRET_PASSWORD);
    expect(explicitRes.success).toBe(true);
    expect(explicitRes.user?.entrepriseId).toBe('CLIENT-002');
  });
});

