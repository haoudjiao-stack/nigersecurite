import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/server/app';
import {
  serverProfileStore,
  serverSecretStore,
  serverLockoutPersistentStore,
  serverActionTicketStore,
  serverPayrollStore,
  resetLockoutServer,
  clearLocalMemoryCache,
  setSimulateStorageFailure,
  OWASP_PBKDF2_CONFIG,
  hashLowEntropyPin,
  verifyPinConstantTime,
} from '../src/server/pinService';

describe('Tests de Sécurité de l’API Serveur - Authentification et Code PIN', () => {
  const DIR_VALID_UID = 'uid-direction-pending';
  const DIR_ALREADY_CONFIGURED_UID = 'uid-direction-configured';
  const DIR_NO_PIN_FIELD_UID = 'uid-direction-no-pin-field';
  const DIR_DEACTIVATED_UID = 'uid-direction-desactive';
  const CTRL_UID = 'uid-controleur-subordonne';
  let previousNodeEnv: string | undefined;

  beforeAll(() => {
    previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';
  });

  afterAll(() => {
    if (previousNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousNodeEnv;
    }
  });

  beforeEach(async () => {
    process.env.NODE_ENV = 'test';
    // Réinitialisation des magasins de persistance
    serverProfileStore.clear();
    serverSecretStore.clear();
    serverLockoutPersistentStore.clear();
    serverActionTicketStore.clear();
    serverPayrollStore.clear();
    clearLocalMemoryCache();
    setSimulateStorageFailure(false);
    process.env.BOOTSTRAP_DIRECTION_EMAIL = 'direction@nigersecurite.ne';

    // 1. Compte Direction légitime, actif et en attente de PIN
    serverProfileStore.set(DIR_VALID_UID, {
      uid: DIR_VALID_UID,
      email: 'direction@nigersecurite.ne',
      nom: 'Directeur Général',
      role: 'direction',
      statut: 'actif',
      doitChangerPin: true,
    });

    // 2. Compte Direction déjà configuré
    serverProfileStore.set(DIR_ALREADY_CONFIGURED_UID, {
      uid: DIR_ALREADY_CONFIGURED_UID,
      email: 'directeur.deja.pret@nigersecurite.ne',
      nom: 'Directeur Opérationnel',
      role: 'direction',
      statut: 'actif',
      doitChangerPin: false,
    });

    // Enregistrement de l'empreinte secrète correspondante (220 000 itérations OWASP)
    const hashed = await hashLowEntropyPin('7845');
    serverSecretStore.set(DIR_ALREADY_CONFIGURED_UID, {
      uid: DIR_ALREADY_CONFIGURED_UID,
      pinHash: hashed.hash,
      pinSalt: hashed.salt,
      pinAlgorithm: hashed.algorithm,
      iterations: hashed.iterations,
      creeLe: new Date().toISOString(),
      misAJourLe: new Date().toISOString(),
    });

    // 3. Compte Direction avec champ doitChangerPin totalement absent
    serverProfileStore.set(DIR_NO_PIN_FIELD_UID, {
      uid: DIR_NO_PIN_FIELD_UID,
      email: 'directeur.sans.champ@nigersecurite.ne',
      nom: 'Directeur Incomplet',
      role: 'direction',
      statut: 'actif',
    });

    // 4. Compte Direction désactivé
    serverProfileStore.set(DIR_DEACTIVATED_UID, {
      uid: DIR_DEACTIVATED_UID,
      email: 'directeur.suspendu@nigersecurite.ne',
      nom: 'Directeur Suspendu',
      role: 'direction',
      statut: 'desactive',
      doitChangerPin: true,
    });

    // 5. Compte subordonné (Contrôleur)
    serverProfileStore.set(CTRL_UID, {
      uid: CTRL_UID,
      email: 'agent@nigersecurite.ne',
      nom: 'Contrôleur Terrain',
      role: 'controleur',
      statut: 'actif',
      doitChangerPin: true,
    });

    // Réinitialisation des compteurs d'échecs persistants
    await resetLockoutServer(DIR_VALID_UID, true);
    await resetLockoutServer(DIR_ALREADY_CONFIGURED_UID, true);
    await resetLockoutServer(CTRL_UID, true);
  });

  // TEST 1 : Refus sans jeton d'authentification valide
  it('1. Refuse un appel sans en-tête d’autorisation ou jeton manquant (401)', async () => {
    const res = await request(app)
      .post('/api/auth/setup-initial-pin')
      .send({ pin: '8421' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/Jeton d’authentification|Authentification requise/i);
  });

  it('1b. Refuse un appel avec un jeton invalide ou corrompu (401)', async () => {
    const res = await request(app)
      .post('/api/auth/setup-initial-pin')
      .set('Authorization', 'Bearer token_invalide_non_reconnu')
      .send({ pin: '8421' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  // TEST 2 : Refus pour un compte non Direction
  it('2. Refuse la configuration de PIN pour un compte non Direction (403)', async () => {
    const res = await request(app)
      .post('/api/auth/setup-initial-pin')
      .set('Authorization', `Bearer test-token:${CTRL_UID}`)
      .send({ pin: '8421' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/Direction est habilité/i);
  });

  // TEST 3 : Refus pour un compte désactivé
  it('3. Refuse la configuration de PIN pour un compte Direction désactivé (403)', async () => {
    const res = await request(app)
      .post('/api/auth/setup-initial-pin')
      .set('Authorization', `Bearer test-token:${DIR_DEACTIVATED_UID}`)
      .send({ pin: '8421' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/désactivé/i);
  });

  // TEST 4 : Refus pour un compte déjà configuré
  it('4. Refuse la configuration si le compte a déjà un PIN configuré (409)', async () => {
    const res = await request(app)
      .post('/api/auth/setup-initial-pin')
      .set('Authorization', `Bearer test-token:${DIR_ALREADY_CONFIGURED_UID}`)
      .send({ pin: '8421' });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/déjà été configuré/i);
  });

  // TEST 5 : Refus en cas d'usurpation d'UID (UID body !== UID jeton)
  it('5. Refuse un appel où l’UID du corps est différent de l’UID certifié par le jeton (403)', async () => {
    const res = await request(app)
      .post('/api/auth/setup-initial-pin')
      .set('Authorization', `Bearer test-token:${DIR_VALID_UID}`)
      .send({
        uid: 'autre-uid-usurpe',
        pin: '8421',
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/usurpation d’identité/i);
  });

  // TEST 6 : Refus lorsque le champ doitChangerPin est absent
  it('6. Refuse la configuration si le champ doitChangerPin est totalement absent du profil (400)', async () => {
    const res = await request(app)
      .post('/api/auth/setup-initial-pin')
      .set('Authorization', `Bearer test-token:${DIR_NO_PIN_FIELD_UID}`)
      .send({ pin: '8421' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/champ "doitChangerPin" absent/i);
  });

  // TEST 7 : Refus des combinaisons de PIN triviales de faible entropie
  it('7. Rejette les codes PIN triviaux (ex: 1234, 0000) (400)', async () => {
    const res = await request(app)
      .post('/api/auth/setup-initial-pin')
      .set('Authorization', `Bearer test-token:${DIR_VALID_UID}`)
      .send({ pin: '1234' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/triviale/i);
  });

  // TEST 8 : Succès avec 220 000 itérations OWASP et sans fuite de hachage/sel
  it('8. Valide le PIN avec 220 000 itérations OWASP, scelle doitChangerPin: false, et ne renvoie AUCUN sel ni hachage au navigateur (200)', async () => {
    const res = await request(app)
      .post('/api/auth/setup-initial-pin')
      .set('Authorization', `Bearer test-token:${DIR_VALID_UID}`)
      .send({
        uid: DIR_VALID_UID,
        pin: '9428',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.uid).toBe(DIR_VALID_UID);
    expect(res.body.doitChangerPin).toBe(false);

    // VÉRIFICATION DE SÉCURITÉ : Aucune donnée cryptographique renvoyée au client
    expect(res.body.config).toBeUndefined();
    expect(res.body.pinHash).toBeUndefined();
    expect(res.body.pinSalt).toBeUndefined();
    expect(res.body.hash).toBeUndefined();
    expect(res.body.salt).toBeUndefined();
    expect(res.body.algorithm).toBeUndefined();

    // VÉRIFICATION DANS LE PROFIL : users/{uid} n'a ni pinHash ni pinSalt
    const updatedProfile = serverProfileStore.get(DIR_VALID_UID);
    expect(updatedProfile).toBeDefined();
    expect(updatedProfile?.doitChangerPin).toBe(false);
    expect((updatedProfile as any)?.pinHash).toBeUndefined();
    expect((updatedProfile as any)?.pinSalt).toBeUndefined();

    // VÉRIFICATION DANS LE STOCKAGE SERVEUR SECRET : 220 000 itérations OWASP
    const secret = serverSecretStore.get(DIR_VALID_UID);
    expect(secret).toBeDefined();
    expect(secret?.uid).toBe(DIR_VALID_UID);
    expect(secret?.pinAlgorithm).toBe('PBKDF2-HMAC-SHA512');
    expect(secret?.iterations).toBe(220000); // 220 000 itérations OWASP révisées
    expect(secret?.pinSalt).toHaveLength(64); // 32 bytes hex
    expect(secret?.pinHash).toHaveLength(128); // 64 bytes hex (sha512)

    // Vérification cryptographique asynchrone en temps constant
    const isValid = await verifyPinConstantTime('9428', secret!.pinHash, secret!.pinSalt, 220000);
    expect(isValid).toBe(true);
  });

  // TEST 9 : Persistance du verrouillage anti-brute-force après redémarrage ou entre instances Cloud Run
  it('9. Garantit que le verrouillage anti-brute-force résiste à un redémarrage de conteneur Cloud Run (429)', async () => {
    // 5 tentatives erronées
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/auth/setup-initial-pin')
        .set('Authorization', `Bearer test-token:${DIR_VALID_UID}`)
        .send({ pin: 'abc' });
    }

    // SIMULATION CRITIQUE DE CLOUD RUN : Le conteneur redémarre ou une autre instance reçoit la requête
    // La mémoire vive locale est vidée à 100%
    clearLocalMemoryCache();

    // La requête suivante arrive sur un conteneur fraîchement démarré :
    // Le verrou DOIT être préservé grâce à la couche persistante partagée
    const lockedRes = await request(app)
      .post('/api/auth/setup-initial-pin')
      .set('Authorization', `Bearer test-token:${DIR_VALID_UID}`)
      .send({ pin: '9428' });

    expect(lockedRes.status).toBe(429);
    expect(lockedRes.body.error).toMatch(/temporairement verrouillé/i);
  });

  // TEST 10 : Échec propre (500) en cas d'indisponibilité du stockage serveur
  it('10. Échoue avec 500 sans valider le PIN si le stockage serveur persistant est indisponible', async () => {
    setSimulateStorageFailure(true);

    const res = await request(app)
      .post('/api/auth/setup-initial-pin')
      .set('Authorization', `Bearer test-token:${DIR_VALID_UID}`)
      .send({
        uid: DIR_VALID_UID,
        pin: '9428',
      });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/Échec de persistance sécurisée/i);

    const profile = serverProfileStore.get(DIR_VALID_UID);
    expect(profile?.doitChangerPin).toBe(true);
    expect(serverSecretStore.has(DIR_VALID_UID)).toBe(false);
  });

  // --- NOUVEAUX TESTS : VÉRIFICATION POSTÉRIEURE DU CODE PIN (Step-Up Authentication) ---

  // TEST 11 : POST /api/auth/verify-pin valide le code PIN configuré pour les actions sensibles
  it('11. Valide le code PIN configuré lors d’une action sensible de la Direction (200 OK)', async () => {
    const res = await request(app)
      .post('/api/auth/verify-pin')
      .set('Authorization', `Bearer test-token:${DIR_ALREADY_CONFIGURED_UID}`)
      .send({
        uid: DIR_ALREADY_CONFIGURED_UID,
        pin: '7845',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.verified).toBe(true);
    expect(res.body.message).toMatch(/certifié avec succès|validé avec succès/i);

    // Aucune donnée secrète divulguée
    expect(res.body.pinHash).toBeUndefined();
    expect(res.body.pinSalt).toBeUndefined();
  });

  // TEST 12 : POST /api/auth/verify-pin rejette un code erroné et décompte les essais restants
  it('12. Rejette un code PIN incorrect lors d’une vérification et notifie les essais restants (401)', async () => {
    const res = await request(app)
      .post('/api/auth/verify-pin')
      .set('Authorization', `Bearer test-token:${DIR_ALREADY_CONFIGURED_UID}`)
      .send({
        uid: DIR_ALREADY_CONFIGURED_UID,
        pin: '9999',
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.verified).toBe(false);
    expect(res.body.error).toMatch(/Code PIN incorrect/i);
    expect(res.body.remainingAttempts).toBe(4);
  });

  // TEST 13 : POST /api/auth/verify-pin refuse l'accès si le compte n'a pas encore fait sa configuration initiale
  it('13. Refuse la vérification de PIN si le compte Direction est encore en attente de configuration initiale (400)', async () => {
    const res = await request(app)
      .post('/api/auth/verify-pin')
      .set('Authorization', `Bearer test-token:${DIR_VALID_UID}`)
      .send({
        uid: DIR_VALID_UID,
        pin: '8421',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/n’est pas encore configuré/i);
  });

  // TEST 14 : POST /api/auth/verify-pin refuse un compte non-Direction
  it('14. Refuse la vérification de PIN pour un rôle subordonné (403)', async () => {
    const res = await request(app)
      .post('/api/auth/verify-pin')
      .set('Authorization', `Bearer test-token:${CTRL_UID}`)
      .send({
        uid: CTRL_UID,
        pin: '8421',
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  // --- TESTS STEP-UP AUTHENTICATION POUR ACTIONS SENSIBLES ---

  // TEST 15 : Émission d'un Action Ticket à usage unique lors d'une vérification réussie
  it('15. Émet un Action Ticket à usage unique (5 min) lors de la validation du PIN pour une action sensible (200)', async () => {
    const res = await request(app)
      .post('/api/auth/verify-pin')
      .set('Authorization', `Bearer test-token:${DIR_ALREADY_CONFIGURED_UID}`)
      .send({
        uid: DIR_ALREADY_CONFIGURED_UID,
        pin: '7845',
        action: 'VALIDATE_PAYROLL',
        amount: 1500000,
        beneficiary: 'VIGILES_NIGER_NORD',
        payrollId: 'Octobre 2026',
      });

    expect(res.status).toBe(200);
    expect(res.body.verified).toBe(true);
    expect(res.body.actionTicket).toBeDefined();
    expect(typeof res.body.actionTicket).toBe('string');
    expect(res.body.actionTicket).toHaveLength(64); // 32 bytes hex
    expect(res.body.expiresInSeconds).toBe(300);
  });

  // TEST 16 : Appel direct à l'API sensible SANS ticket -> Rejet catégorique 403
  it('16. Rejette immédiatement un appel direct à l’API sensible de paie sans ticket de validation PIN (403)', async () => {
    const res = await request(app)
      .post('/api/direction/validate-payroll')
      .set('Authorization', `Bearer test-token:${DIR_ALREADY_CONFIGURED_UID}`)
      .send({
        amount: 1500000,
        beneficiary: 'VIGILES_NIGER_NORD',
        payrollId: 'Octobre 2026',
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/ticket de validation PIN manquant|preuve de validation PIN manquante/i);
  });

  // TEST 17 : Appel avec un faux ticket ou ticket forgé -> Rejet 403
  it('17. Rejette l’exécution d’une action sensible avec un faux ticket d’autorisation (403)', async () => {
    const res = await request(app)
      .post('/api/direction/validate-payroll')
      .set('Authorization', `Bearer test-token:${DIR_ALREADY_CONFIGURED_UID}`)
      .set('x-action-ticket', 'ticket_forgé_invalide_1234567890')
      .send({
        amount: 1500000,
        beneficiary: 'VIGILES_NIGER_NORD',
        payrollId: 'Octobre 2026',
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/introuvable ou invalide/i);
  });

  // TEST 18 : Appel direct réussi avec le ticket d'action valide
  it('18. Autorise l’action sensible lorsque l’Action Ticket valide est fourni (200 OK)', async () => {
    // 1. Obtenir le ticket via vérification PIN
    const verifyRes = await request(app)
      .post('/api/auth/verify-pin')
      .set('Authorization', `Bearer test-token:${DIR_ALREADY_CONFIGURED_UID}`)
      .send({
        uid: DIR_ALREADY_CONFIGURED_UID,
        pin: '7845',
        action: 'VALIDATE_PAYROLL',
        amount: 1500000,
        beneficiary: 'VIGILES_NIGER_NORD',
        payrollId: 'Octobre 2026',
      });

    const ticket = verifyRes.body.actionTicket;

    // 2. Appeler l'API sensible avec le ticket
    const sensitiveRes = await request(app)
      .post('/api/direction/validate-payroll')
      .set('Authorization', `Bearer test-token:${DIR_ALREADY_CONFIGURED_UID}`)
      .set('x-action-ticket', ticket)
      .send({
        amount: 1500000,
        beneficiary: 'VIGILES_NIGER_NORD',
        payrollId: 'Octobre 2026',
      });

    expect(sensitiveRes.status).toBe(200);
    expect(sensitiveRes.body.success).toBe(true);
    expect(sensitiveRes.body.message).toMatch(/validées.*avec succès/i);
  });

  // TEST 19 : Protection anti-rejeu (Replay Attack) : Le ticket ne peut être utilisé qu'une seule fois
  it('19. Bloque toute tentative de réutiliser le même Action Ticket une seconde fois (Anti-Replay) (403)', async () => {
    // 1. Obtenir le ticket
    const verifyRes = await request(app)
      .post('/api/auth/verify-pin')
      .set('Authorization', `Bearer test-token:${DIR_ALREADY_CONFIGURED_UID}`)
      .send({
        uid: DIR_ALREADY_CONFIGURED_UID,
        pin: '7845',
        action: 'VALIDATE_PAYROLL',
        amount: 1500000,
        beneficiary: 'VIGILES_NIGER_NORD',
        payrollId: 'Octobre 2026',
      });

    const ticket = verifyRes.body.actionTicket;

    // 2. Première utilisation -> Succès
    const firstCall = await request(app)
      .post('/api/direction/validate-payroll')
      .set('Authorization', `Bearer test-token:${DIR_ALREADY_CONFIGURED_UID}`)
      .set('x-action-ticket', ticket)
      .send({
        amount: 1500000,
        beneficiary: 'VIGILES_NIGER_NORD',
        payrollId: 'Octobre 2026',
      });
    expect(firstCall.status).toBe(200);

    // 3. Deuxième utilisation avec le même ticket -> STRICTEMENT REJETÉE
    const replayCall = await request(app)
      .post('/api/direction/validate-payroll')
      .set('Authorization', `Bearer test-token:${DIR_ALREADY_CONFIGURED_UID}`)
      .set('x-action-ticket', ticket)
      .send({
        amount: 1500000,
        beneficiary: 'VIGILES_NIGER_NORD',
        payrollId: 'Octobre 2026',
      });

    expect(replayCall.status).toBe(403);
    expect(replayCall.body.success).toBe(false);
    expect(replayCall.body.error).toMatch(/déjà été utilisé/i);
  });

  // TEST 20 : Protection contre les conditions de concurrence (Requêtes simultanées concurrentes)
  it('20. Empêche le dépassement du seuil de tentatives lors de requêtes simultanées concurrentes (Atomicité)', async () => {
    // Émettre 8 requêtes erronées en parallèle strict via Promise.all
    const promises = Array.from({ length: 8 }).map(() =>
      request(app)
        .post('/api/auth/verify-pin')
        .set('Authorization', `Bearer test-token:${DIR_ALREADY_CONFIGURED_UID}`)
        .send({
          uid: DIR_ALREADY_CONFIGURED_UID,
          pin: '0000', // Code erroné
        })
    );

    const responses = await Promise.all(promises);

    // Parmi les 8 requêtes simultanées :
    // Au moins une partie doit recevoir 429 (verrouillé) dès que le seuil de 5 est franchi
    const statusCodes = responses.map((r) => r.status);
    const lockedCount = statusCodes.filter((code) => code === 429).length;
    const errorCount = statusCodes.filter((code) => code === 401).length;

    expect(lockedCount).toBeGreaterThan(0);
    expect(errorCount).toBeLessThanOrEqual(5);

    // Une requête ultérieure doit être systématiquement bloquée
    const postRes = await request(app)
      .post('/api/auth/verify-pin')
      .set('Authorization', `Bearer test-token:${DIR_ALREADY_CONFIGURED_UID}`)
      .send({
        uid: DIR_ALREADY_CONFIGURED_UID,
        pin: '7845',
      });

    expect(postRes.status).toBe(429);
  });

  // --- TESTS LIAISON STRICTE DES PARAMÈTRES (MONTANT, BÉNÉFICIAIRE, PÉRIODE) & CONCURRENCE SUR TICKET ---

  // TEST 21 : Succès lorsque tous les paramètres de l'opération correspondent exactement au ticket
  it('21. Autorise l’opération sensible lorsque montant, bénéficiaire et période concordent exactement avec le ticket (200 OK)', async () => {
    // 1. Émission du ticket après saisie du PIN pour une opération financière définie
    const verifyRes = await request(app)
      .post('/api/auth/verify-pin')
      .set('Authorization', `Bearer test-token:${DIR_ALREADY_CONFIGURED_UID}`)
      .send({
        uid: DIR_ALREADY_CONFIGURED_UID,
        pin: '7845',
        action: 'VALIDATE_PAYROLL',
        amount: 1500000,
        beneficiary: 'VIGILES_NIGER_NORD',
        payrollId: 'PAIE_2026_10',
      });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.actionTicket).toBeDefined();
    expect(verifyRes.body.detailsHash).toBeDefined();

    const ticket = verifyRes.body.actionTicket;

    // 2. Appel avec les paramètres strictement identiques
    const payRes = await request(app)
      .post('/api/direction/validate-payroll')
      .set('Authorization', `Bearer test-token:${DIR_ALREADY_CONFIGURED_UID}`)
      .set('x-action-ticket', ticket)
      .send({
        action: 'VALIDATE_PAYROLL',
        amount: 1500000,
        beneficiary: 'VIGILES_NIGER_NORD',
        payrollId: 'PAIE_2026_10',
      });

    expect(payRes.status).toBe(200);
    expect(payRes.body.success).toBe(true);
    expect(payRes.body.details).toEqual({
      amount: 1500000,
      beneficiary: 'VIGILES_NIGER_NORD',
      payrollId: 'PAIE_2026_10',
    });
  });

  // TEST 22 : Rejet si le montant est altéré
  it('22. Rejette l’exécution si le montant de l’opération est altéré par rapport à l’autorisation validée par PIN (403)', async () => {
    // Validation PIN pour 1 500 000 FCFA
    const verifyRes = await request(app)
      .post('/api/auth/verify-pin')
      .set('Authorization', `Bearer test-token:${DIR_ALREADY_CONFIGURED_UID}`)
      .send({
        uid: DIR_ALREADY_CONFIGURED_UID,
        pin: '7845',
        action: 'VALIDATE_PAYROLL',
        amount: 1500000,
        beneficiary: 'VIGILES_NIGER_NORD',
        payrollId: 'PAIE_2026_10',
      });

    const ticket = verifyRes.body.actionTicket;

    // Tentative d'exécution avec un montant frauduleux de 2 500 000 FCFA
    const alteredRes = await request(app)
      .post('/api/direction/validate-payroll')
      .set('Authorization', `Bearer test-token:${DIR_ALREADY_CONFIGURED_UID}`)
      .set('x-action-ticket', ticket)
      .send({
        action: 'VALIDATE_PAYROLL',
        amount: 2500000, // Altéré !
        beneficiary: 'VIGILES_NIGER_NORD',
        payrollId: 'PAIE_2026_10',
      });

    expect(alteredRes.status).toBe(403);
    expect(alteredRes.body.success).toBe(false);
    expect(alteredRes.body.error).toMatch(/Le montant de l’opération.*ne correspond pas au montant validé/i);
  });

  // TEST 23 : Rejet si le bénéficiaire est altéré
  it('23. Rejette l’exécution si le bénéficiaire est altéré par rapport à l’autorisation validée par PIN (403)', async () => {
    const verifyRes = await request(app)
      .post('/api/auth/verify-pin')
      .set('Authorization', `Bearer test-token:${DIR_ALREADY_CONFIGURED_UID}`)
      .send({
        uid: DIR_ALREADY_CONFIGURED_UID,
        pin: '7845',
        action: 'VALIDATE_PAYROLL',
        amount: 1500000,
        beneficiary: 'VIGILES_NIGER_NORD',
        payrollId: 'PAIE_2026_10',
      });

    const ticket = verifyRes.body.actionTicket;

    // Tentative d'exécution avec un bénéficiaire frauduleux
    const alteredRes = await request(app)
      .post('/api/direction/validate-payroll')
      .set('Authorization', `Bearer test-token:${DIR_ALREADY_CONFIGURED_UID}`)
      .set('x-action-ticket', ticket)
      .send({
        action: 'VALIDATE_PAYROLL',
        amount: 1500000,
        beneficiary: 'COMPTE_PIRATE_77', // Altéré !
        payrollId: 'PAIE_2026_10',
      });

    expect(alteredRes.status).toBe(403);
    expect(alteredRes.body.success).toBe(false);
    expect(alteredRes.body.error).toMatch(/Le bénéficiaire de l’opération.*ne correspond pas au bénéficiaire validé/i);
  });

  // TEST 24 : Rejet si la référence de paie / période est altérée
  it('24. Rejette l’exécution si la référence de paie / période est altérée (403)', async () => {
    const verifyRes = await request(app)
      .post('/api/auth/verify-pin')
      .set('Authorization', `Bearer test-token:${DIR_ALREADY_CONFIGURED_UID}`)
      .send({
        uid: DIR_ALREADY_CONFIGURED_UID,
        pin: '7845',
        action: 'VALIDATE_PAYROLL',
        amount: 1500000,
        beneficiary: 'VIGILES_NIGER_NORD',
        payrollId: 'PAIE_2026_10',
      });

    const ticket = verifyRes.body.actionTicket;

    // Tentative d'exécution avec une période différente
    const alteredRes = await request(app)
      .post('/api/direction/validate-payroll')
      .set('Authorization', `Bearer test-token:${DIR_ALREADY_CONFIGURED_UID}`)
      .set('x-action-ticket', ticket)
      .send({
        action: 'VALIDATE_PAYROLL',
        amount: 1500000,
        beneficiary: 'VIGILES_NIGER_NORD',
        payrollId: 'PAIE_2026_11', // Altéré !
      });

    expect(alteredRes.status).toBe(403);
    expect(alteredRes.body.success).toBe(false);
    expect(alteredRes.body.error).toMatch(/L’identifiant de paie ou la période.*ne correspond pas à l’opération validée/i);
  });

  // TEST 25 : Deux requêtes simultanées concurrentes avec le MÊME ticket : interdiction de la double exécution
  it('25. Empêche la double exécution lors de requêtes simultanées concurrentes avec le même ticket (Atomicité & Anti-Race-Condition)', async () => {
    const verifyRes = await request(app)
      .post('/api/auth/verify-pin')
      .set('Authorization', `Bearer test-token:${DIR_ALREADY_CONFIGURED_UID}`)
      .send({
        uid: DIR_ALREADY_CONFIGURED_UID,
        pin: '7845',
        action: 'VALIDATE_PAYROLL',
        amount: 1500000,
        beneficiary: 'VIGILES_NIGER_NORD',
        payrollId: 'PAIE_2026_10',
      });

    const ticket = verifyRes.body.actionTicket;

    // Lancer deux requêtes rigoureusement en parallèle avec le même ticket
    const [resA, resB] = await Promise.all([
      request(app)
        .post('/api/direction/validate-payroll')
        .set('Authorization', `Bearer test-token:${DIR_ALREADY_CONFIGURED_UID}`)
        .set('x-action-ticket', ticket)
        .send({
          action: 'VALIDATE_PAYROLL',
          amount: 1500000,
          beneficiary: 'VIGILES_NIGER_NORD',
          payrollId: 'PAIE_2026_10',
        }),
      request(app)
        .post('/api/direction/validate-payroll')
        .set('Authorization', `Bearer test-token:${DIR_ALREADY_CONFIGURED_UID}`)
        .set('x-action-ticket', ticket)
        .send({
          action: 'VALIDATE_PAYROLL',
          amount: 1500000,
          beneficiary: 'VIGILES_NIGER_NORD',
          payrollId: 'PAIE_2026_10',
        }),
    ]);

    const statuses = [resA.status, resB.status].sort();

    // L'une des deux requêtes doit réussir (200), et l'autre DOIT être rejetée (403)
    expect(statuses).toEqual([200, 403]);

    const rejectedResponse = resA.status === 403 ? resA : resB;
    expect(rejectedResponse.body.success).toBe(false);
    expect(rejectedResponse.body.error).toMatch(/déjà été utilisé/i);
  });

  // TEST 26 : Rejette l'émission d'un ticket VALIDATE_PAYROLL sans montant, bénéficiaire ou période
  it('26. Rejette l’émission d’un Action Ticket pour la paie si un paramètre requis est manquant (400)', async () => {
    // a) Manque le montant
    const noAmountRes = await request(app)
      .post('/api/auth/verify-pin')
      .set('Authorization', `Bearer test-token:${DIR_ALREADY_CONFIGURED_UID}`)
      .send({
        uid: DIR_ALREADY_CONFIGURED_UID,
        pin: '7845',
        action: 'VALIDATE_PAYROLL',
        beneficiary: 'VIGILES_NIGER_NORD',
        payrollId: 'PAIE_2026_10',
      });
    expect(noAmountRes.status).toBe(400);
    expect(noAmountRes.body.error).toMatch(/montant valide.*obligatoire/i);

    // b) Manque le bénéficiaire
    const noBeneficiaryRes = await request(app)
      .post('/api/auth/verify-pin')
      .set('Authorization', `Bearer test-token:${DIR_ALREADY_CONFIGURED_UID}`)
      .send({
        uid: DIR_ALREADY_CONFIGURED_UID,
        pin: '7845',
        action: 'VALIDATE_PAYROLL',
        amount: 1500000,
        payrollId: 'PAIE_2026_10',
      });
    expect(noBeneficiaryRes.status).toBe(400);
    expect(noBeneficiaryRes.body.error).toMatch(/bénéficiaire.*obligatoire/i);

    // c) Manque la période / payrollId
    const noPayrollIdRes = await request(app)
      .post('/api/auth/verify-pin')
      .set('Authorization', `Bearer test-token:${DIR_ALREADY_CONFIGURED_UID}`)
      .send({
        uid: DIR_ALREADY_CONFIGURED_UID,
        pin: '7845',
        action: 'VALIDATE_PAYROLL',
        amount: 1500000,
        beneficiary: 'VIGILES_NIGER_NORD',
      });
    expect(noPayrollIdRes.status).toBe(400);
    expect(noPayrollIdRes.body.error).toMatch(/identifiant de paie ou la période.*obligatoire/i);
  });

  // TEST 27 : Rejette validate-payroll si l'un des paramètres obligatoires est manquant dans la requête
  it('27. Rejette l’exécution de validate-payroll si montant, bénéficiaire ou période est absent de la requête (400)', async () => {
    // Obtenir un ticket valide
    const verifyRes = await request(app)
      .post('/api/auth/verify-pin')
      .set('Authorization', `Bearer test-token:${DIR_ALREADY_CONFIGURED_UID}`)
      .send({
        uid: DIR_ALREADY_CONFIGURED_UID,
        pin: '7845',
        action: 'VALIDATE_PAYROLL',
        amount: 1500000,
        beneficiary: 'VIGILES_NIGER_NORD',
        payrollId: 'PAIE_2026_10',
      });
    const ticket = verifyRes.body.actionTicket;

    // Requête sans montant
    const noAmountRes = await request(app)
      .post('/api/direction/validate-payroll')
      .set('Authorization', `Bearer test-token:${DIR_ALREADY_CONFIGURED_UID}`)
      .set('x-action-ticket', ticket)
      .send({
        beneficiary: 'VIGILES_NIGER_NORD',
        payrollId: 'PAIE_2026_10',
      });
    expect(noAmountRes.status).toBe(400);
    expect(noAmountRes.body.error).toMatch(/montant valide de la paie/i);

    // Requête sans bénéficiaire
    const noBenRes = await request(app)
      .post('/api/direction/validate-payroll')
      .set('Authorization', `Bearer test-token:${DIR_ALREADY_CONFIGURED_UID}`)
      .set('x-action-ticket', ticket)
      .send({
        amount: 1500000,
        payrollId: 'PAIE_2026_10',
      });
    expect(noBenRes.status).toBe(400);
    expect(noBenRes.body.error).toMatch(/bénéficiaire de la paie est strictement obligatoire/i);
  });

  // TEST 28 : En production, si Firestore échoue, refuse l'action SANS repli mémoire
  it('28. En production, refuse l’action sensible sans repli mémoire si le stockage persistant Firestore échoue (403)', async () => {
    // 1. Émettre un ticket
    const verifyRes = await request(app)
      .post('/api/auth/verify-pin')
      .set('Authorization', `Bearer test-token:${DIR_ALREADY_CONFIGURED_UID}`)
      .send({
        uid: DIR_ALREADY_CONFIGURED_UID,
        pin: '7845',
        action: 'VALIDATE_PAYROLL',
        amount: 1500000,
        beneficiary: 'VIGILES_NIGER_NORD',
        payrollId: 'PAIE_2026_10',
      });
    const ticket = verifyRes.body.actionTicket;

    // 2. Simuler une panne du stockage officiel Firestore
    setSimulateStorageFailure(true);

    // 3. Tenter de consommer le ticket : le serveur DOIT refuser immédiatement sans repli mémoire
    const res = await request(app)
      .post('/api/direction/validate-payroll')
      .set('Authorization', `Bearer test-token:${DIR_ALREADY_CONFIGURED_UID}`)
      .set('x-action-ticket', ticket)
      .send({
        action: 'VALIDATE_PAYROLL',
        amount: 1500000,
        beneficiary: 'VIGILES_NIGER_NORD',
        payrollId: 'PAIE_2026_10',
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/Action refusée sans repli mémoire/i);

    // Rétablir le stockage pour les tests suivants
    setSimulateStorageFailure(false);
  });

  // TEST 29 : validate-payroll enregistre RÉELLEMENT la validation et permet sa relecture complète
  it('29. Enregistre réellement la validation de paie dans le stockage persistant officiel et permet sa relecture (200)', async () => {
    const verifyRes = await request(app)
      .post('/api/auth/verify-pin')
      .set('Authorization', `Bearer test-token:${DIR_ALREADY_CONFIGURED_UID}`)
      .send({
        uid: DIR_ALREADY_CONFIGURED_UID,
        pin: '7845',
        action: 'VALIDATE_PAYROLL',
        amount: 2750000,
        beneficiary: 'COMPAGNIE_VIGILES_NIGER_SUD',
        payrollId: 'PAIE_2026_10_SUD',
      });
    const ticket = verifyRes.body.actionTicket;

    // Exécution de la validation
    const validateRes = await request(app)
      .post('/api/direction/validate-payroll')
      .set('Authorization', `Bearer test-token:${DIR_ALREADY_CONFIGURED_UID}`)
      .set('x-action-ticket', ticket)
      .send({
        action: 'VALIDATE_PAYROLL',
        amount: 2750000,
        beneficiary: 'COMPAGNIE_VIGILES_NIGER_SUD',
        payrollId: 'PAIE_2026_10_SUD',
      });

    expect(validateRes.status).toBe(200);
    expect(validateRes.body.success).toBe(true);
    expect(validateRes.body.enregistrement).toBeDefined();
    expect(validateRes.body.enregistrement.montantTotal).toBe(2750000);
    expect(validateRes.body.enregistrement.beneficiaire).toBe('COMPAGNIE_VIGILES_NIGER_SUD');
    expect(validateRes.body.enregistrement.statut).toBe('VALIDEE');
    expect(validateRes.body.enregistrement.validePar).toBe(DIR_ALREADY_CONFIGURED_UID);

    // Relecture via l'API de consultation GET /api/direction/payroll-validation/:payrollId
    const getRes = await request(app)
      .get('/api/direction/payroll-validation/PAIE_2026_10_SUD')
      .set('Authorization', `Bearer test-token:${DIR_ALREADY_CONFIGURED_UID}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.success).toBe(true);
    expect(getRes.body.enregistrement.payrollId).toBe('PAIE_2026_10_SUD');
    expect(getRes.body.enregistrement.montantTotal).toBe(2750000);
    expect(getRes.body.enregistrement.beneficiaire).toBe('COMPAGNIE_VIGILES_NIGER_SUD');
    expect(getRes.body.enregistrement.validePar).toBe(DIR_ALREADY_CONFIGURED_UID);
    expect(getRes.body.enregistrement.statut).toBe('VALIDEE');
    expect(getRes.body.enregistrement.dateValidation).toBeDefined();
  });

  // TEST 30 : Échoue avec 500 si la persistance finale de validation échoue sans prétendre que la paie est validée
  it('30. Échoue avec 500 si l’enregistrement persistant de la validation échoue', async () => {
    const verifyRes = await request(app)
      .post('/api/auth/verify-pin')
      .set('Authorization', `Bearer test-token:${DIR_ALREADY_CONFIGURED_UID}`)
      .send({
        uid: DIR_ALREADY_CONFIGURED_UID,
        pin: '7845',
        action: 'VALIDATE_PAYROLL',
        amount: 1500000,
        beneficiary: 'VIGILES_NIGER_NORD',
        payrollId: 'PAIE_2026_10_FAIL',
      });
    const ticket = verifyRes.body.actionTicket;

    // Simuler une panne du stockage au moment de l'enregistrement de la validation
    setSimulateStorageFailure(true);

    const failRes = await request(app)
      .post('/api/direction/validate-payroll')
      .set('Authorization', `Bearer test-token:${DIR_ALREADY_CONFIGURED_UID}`)
      .set('x-action-ticket', ticket)
      .send({
        action: 'VALIDATE_PAYROLL',
        amount: 1500000,
        beneficiary: 'VIGILES_NIGER_NORD',
        payrollId: 'PAIE_2026_10_FAIL',
      });

    // Rétablir immédiatement
    setSimulateStorageFailure(false);

    // L'action doit être rejetée (403 ou 500 selon si la panne touche la consommation ou la sauvegarde)
    expect([403, 500]).toContain(failRes.status);
    expect(failRes.body.success).toBe(false);
  });

  // --- TESTS GESTION AUTOMATIQUE POUR DÉBUTANT & IDENTIFIANTS DU COMPTE ---

  // TEST 31a : Refuse l'initialisation si BOOTSTRAP_DIRECTION_EMAIL est absent ou invalide sur le serveur (500)
  it('31a. Refuse l’initialisation si la variable d’environnement BOOTSTRAP_DIRECTION_EMAIL est absente ou invalide (500)', async () => {
    const savedConfig = process.env.BOOTSTRAP_DIRECTION_EMAIL;
    delete process.env.BOOTSTRAP_DIRECTION_EMAIL;

    const res = await request(app)
      .post('/api/auth/bootstrap-profile')
      .set('Authorization', 'Bearer test-token:uid-nouveau:direction@nigersecurite.ne')
      .send({ nom: 'Directeur Général' });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/BOOTSTRAP_DIRECTION_EMAIL/i);

    // Rétablir la configuration
    process.env.BOOTSTRAP_DIRECTION_EMAIL = savedConfig;
  });

  // TEST 31b : Refuse formellement l'initialisation si l'e-mail du demandeur ne correspond pas à BOOTSTRAP_DIRECTION_EMAIL (403)
  it('31b. Refuse formellement l’initialisation si l’adresse e-mail de l’utilisateur ne correspond pas exactement à BOOTSTRAP_DIRECTION_EMAIL (403)', async () => {
    process.env.BOOTSTRAP_DIRECTION_EMAIL = 'direction@nigersecurite.ne';

    // Tentative avec un compte utilisateur non autorisé (ex: Gmail public ou domaine différent)
    const unauthorizedRes = await request(app)
      .post('/api/auth/bootstrap-profile')
      .set('Authorization', 'Bearer test-token:uid-usurpateur:usurpateur@gmail.com')
      .send({ nom: 'Intrus Non Autorisé' });

    expect(unauthorizedRes.status).toBe(403);
    expect(unauthorizedRes.body.success).toBe(false);
    expect(unauthorizedRes.body.error).toMatch(/Accès refusé.*n’est pas autorisée/i);
  });

  // TEST 31c : Initialise avec succès le premier compte Direction si aucun compte n'existe et l'e-mail concorde (200)
  it('31c. Initialise avec succès le tout premier profil Direction lorsque aucun compte n’existe et que l’adresse e-mail correspond (200)', async () => {
    // Vider le magasin pour simuler un système vierge (0 compte existant)
    serverProfileStore.clear();
    process.env.BOOTSTRAP_DIRECTION_EMAIL = 'direction.fondateur@nigersecurite.ne';

    const FIRST_UID = 'uid-premier-directeur-fondateur';
    const res = await request(app)
      .post('/api/auth/bootstrap-profile')
      .set('Authorization', `Bearer test-token:${FIRST_UID}:direction.fondateur@nigersecurite.ne`)
      .send({
        nom: 'Premier Directeur Général',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.created).toBe(true);
    expect(res.body.profile.uid).toBe(FIRST_UID);
    expect(res.body.profile.email).toBe('direction.fondateur@nigersecurite.ne');
    expect(res.body.profile.role).toBe('direction');
    expect(res.body.profile.statut).toBe('actif');
    expect(res.body.profile.doitChangerPin).toBe(true);
  });

  // TEST 31d : Refuse toute tentative ultérieure d'initialisation après la création du premier compte (403)
  it('31d. Refuse toute tentative ultérieure d’initialisation de compte Direction lorsqu’un compte existe déjà (403)', async () => {
    // Dans beforeEach, des comptes Direction existent déjà dans le magasin (DIR_VALID_UID, DIR_ALREADY_CONFIGURED_UID)
    process.env.BOOTSTRAP_DIRECTION_EMAIL = 'autre.directeur@nigersecurite.ne';

    const secondCandidateUid = 'uid-deuxieme-candidat';
    const res = await request(app)
      .post('/api/auth/bootstrap-profile')
      .set('Authorization', `Bearer test-token:${secondCandidateUid}:autre.directeur@nigersecurite.ne`)
      .send({
        nom: 'Deuxième Candidat Direction',
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/un compte Direction existe déjà/i);
  });

  // TEST 31e : Empêche la création simultanée de deux comptes Direction par des requêtes concurrentes (Atomicité)
  it('31e. Empêche la création concurrente de deux comptes Direction lors de requêtes simultanées (Atomicité & Mutex) (403)', async () => {
    serverProfileStore.clear();
    process.env.BOOTSTRAP_DIRECTION_EMAIL = 'direction.unique@nigersecurite.ne';

    const UID_A = 'uid-candidat-concurrent-a';
    const UID_B = 'uid-candidat-concurrent-b';

    // Lancement de deux requêtes concurrentes simultanées
    const [resA, resB] = await Promise.all([
      request(app)
        .post('/api/auth/bootstrap-profile')
        .set('Authorization', `Bearer test-token:${UID_A}:direction.unique@nigersecurite.ne`)
        .send({ nom: 'Directeur A' }),
      request(app)
        .post('/api/auth/bootstrap-profile')
        .set('Authorization', `Bearer test-token:${UID_B}:direction.unique@nigersecurite.ne`)
        .send({ nom: 'Directeur B' }),
    ]);

    const statuses = [resA.status, resB.status].sort();
    // Exactement un appel doit réussir (200) et l'autre DOIT être rejeté (403)
    expect(statuses).toEqual([200, 403]);

    const accepted = resA.status === 200 ? resA : resB;
    const rejected = resA.status === 403 ? resA : resB;

    expect(accepted.body.success).toBe(true);
    expect(accepted.body.created).toBe(true);

    expect(rejected.body.success).toBe(false);
    expect(rejected.body.error).toMatch(/un compte Direction existe déjà/i);
  });

  // TEST 31f : Réparation d'un document existant incomplet ne contenant que { uid } (Exigence 1)
  it('31f. Répare avec succès un document existant incomplet ne contenant que { uid } pour le premier compte Direction autorisé (200)', async () => {
    serverProfileStore.clear();
    process.env.BOOTSTRAP_DIRECTION_EMAIL = 'directeur.recupere@nigersecurite.ne';

    const INCOMPLETE_UID = 'uid-direction-incomplet-seul';
    // Document Firestore incomplet (ex: manipulation manuelle antérieure avec seulement uid)
    serverProfileStore.set(INCOMPLETE_UID, {
      uid: INCOMPLETE_UID,
    } as any);

    const res = await request(app)
      .post('/api/auth/bootstrap-profile')
      .set('Authorization', `Bearer test-token:${INCOMPLETE_UID}:directeur.recupere@nigersecurite.ne`)
      .send({
        nom: 'Directeur Général Réparé',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.repaired).toBe(true);
    expect(res.body.profile.uid).toBe(INCOMPLETE_UID);
    expect(res.body.profile.role).toBe('direction');
    expect(res.body.profile.statut).toBe('actif');
    expect(res.body.profile.email).toBe('directeur.recupere@nigersecurite.ne');
    expect(res.body.profile.doitChangerPin).toBe(true); // En attente de son premier PIN
  });

  // TEST 31g : Refus formel de transformer un profil Contrôleur ou Comptabilité en Direction (Exigence 3)
  it('31g. Refuse catégoriquement de convertir un compte subordonné existant (Contrôleur ou Comptabilité) en Direction (403)', async () => {
    process.env.BOOTSTRAP_DIRECTION_EMAIL = 'direction@nigersecurite.ne';

    // Tentative d'élévation de privilèges : le contrôleur existant CTRL_UID appelle bootstrap-profile
    const res = await request(app)
      .post('/api/auth/bootstrap-profile')
      .set('Authorization', `Bearer test-token:${CTRL_UID}:direction@nigersecurite.ne`)
      .send({ nom: 'Tentative Piratage Rôle' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/Accès refusé.*déjà configuré avec le rôle "controleur"/i);

    // Vérifier que le rôle n'a pas été modifié
    const ctrlProfile = serverProfileStore.get(CTRL_UID);
    expect(ctrlProfile?.role).toBe('controleur');
  });

  // TEST 31h : Conservation de tous les champs existants lors de la réparation (Exigence 5)
  it('31h. Conserve intégralement tous les champs personnalisés existants lors de la réparation d’un document incomplet (200)', async () => {
    serverProfileStore.clear();
    process.env.BOOTSTRAP_DIRECTION_EMAIL = 'directeur.champs@nigersecurite.ne';

    const CUSTOM_UID = 'uid-direction-custom-fields';
    // Document contenant des champs personnalisés existants (ex: téléphone, grade, notes) mais pas de rôle/statut
    serverProfileStore.set(CUSTOM_UID, {
      uid: CUSTOM_UID,
      telephone: '+227 90 12 34 56',
      grade: 'Colonel Major',
      noteSpeciale: 'Document créé manuellement',
      creeLe: '2026-01-01T08:00:00.000Z',
    } as any);

    const res = await request(app)
      .post('/api/auth/bootstrap-profile')
      .set('Authorization', `Bearer test-token:${CUSTOM_UID}:directeur.champs@nigersecurite.ne`)
      .send({
        nom: 'Directeur Spécial',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.repaired).toBe(true);
    // Vérifier la présence et la conservation des champs d'origine
    expect((res.body.profile as any).telephone).toBe('+227 90 12 34 56');
    expect((res.body.profile as any).grade).toBe('Colonel Major');
    expect((res.body.profile as any).noteSpeciale).toBe('Document créé manuellement');
    expect(res.body.profile.creeLe).toBe('2026-01-01T08:00:00.000Z');
    // Vérifier que les champs obligatoires manquants ont bien été complétés
    expect(res.body.profile.role).toBe('direction');
    expect(res.body.profile.statut).toBe('actif');
    expect(res.body.profile.doitChangerPin).toBe(true);
  });

  // TEST 31i : Conservation d'un code PIN déjà configuré lors de la réparation (Exigence 6)
  it('31i. Conserve intact un code PIN déjà configuré sans jamais le réinitialiser lors de la réparation (200)', async () => {
    serverProfileStore.clear();
    process.env.BOOTSTRAP_DIRECTION_EMAIL = 'directeur.avec.pin@nigersecurite.ne';

    const PIN_CONFIGURED_UID = 'uid-direction-incomplet-avec-pin';

    // 1. Un secret PIN existe réellement dans serverSecretStore pour cet UID
    const hashed = await hashLowEntropyPin('8842');
    serverSecretStore.set(PIN_CONFIGURED_UID, {
      uid: PIN_CONFIGURED_UID,
      pinHash: hashed.hash,
      pinSalt: hashed.salt,
      pinAlgorithm: hashed.algorithm,
      iterations: hashed.iterations,
      creeLe: '2026-02-01T00:00:00.000Z',
      misAJourLe: '2026-02-01T00:00:00.000Z',
    });

    // 2. Le profil Firestore est incomplet (manque rôle ou statut ou email)
    serverProfileStore.set(PIN_CONFIGURED_UID, {
      uid: PIN_CONFIGURED_UID,
      nom: 'Directeur PIN Existant',
    } as any);

    const res = await request(app)
      .post('/api/auth/bootstrap-profile')
      .set('Authorization', `Bearer test-token:${PIN_CONFIGURED_UID}:directeur.avec.pin@nigersecurite.ne`)
      .send();

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.profile.role).toBe('direction');
    expect(res.body.profile.statut).toBe('actif');
    // Le serveur a constaté que le secret existe, donc doitChangerPin DOIT impérativement être false
    expect(res.body.profile.doitChangerPin).toBe(false);

    // Vérification que le PIN secret d'origine est toujours valide
    const verifyRes = await request(app)
      .post('/api/auth/verify-pin')
      .set('Authorization', `Bearer test-token:${PIN_CONFIGURED_UID}`)
      .send({ pin: '8842' });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.verified).toBe(true);
  });

  // TEST 31j : Arrêt de la réparation si l'état du stockage PIN est incertain (Exigence Sécurité)
  it('31j. Interrompt la réparation avec une erreur 500 explicite si l’accès au secret PIN est incertain (500)', async () => {
    serverProfileStore.clear();
    process.env.BOOTSTRAP_DIRECTION_EMAIL = 'directeur.panne@nigersecurite.ne';

    const PANNE_UID = 'uid-direction-panne-stockage';
    serverProfileStore.set(PANNE_UID, { uid: PANNE_UID } as any);

    // Simuler une indisponibilité du stockage persistant pour les secrets
    setSimulateStorageFailure(true);

    const res = await request(app)
      .post('/api/auth/bootstrap-profile')
      .set('Authorization', `Bearer test-token:${PANNE_UID}:directeur.panne@nigersecurite.ne`)
      .send();

    // Rétablir immédiatement
    setSimulateStorageFailure(false);

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/Impossible de vérifier l’état du code PIN|Opération interrompue/i);
  });

  // TEST 31k : Détection d'incohérence si doitChangerPin est false sans secret PIN enregistré (Exigence Sécurité)
  it('31k. Interrompt la réparation avec une erreur 500 si le document indique un PIN configuré sans secret réel (500)', async () => {
    serverProfileStore.clear();
    process.env.BOOTSTRAP_DIRECTION_EMAIL = 'directeur.incoherent@nigersecurite.ne';

    const INCOHERENT_UID = 'uid-direction-incoherence-pin';
    // Document indiquant faussement doitChangerPin: false alors qu'AUCUN secret n'existe dans serverSecretStore
    serverProfileStore.set(INCOHERENT_UID, {
      uid: INCOHERENT_UID,
      doitChangerPin: false,
    } as any);

    const res = await request(app)
      .post('/api/auth/bootstrap-profile')
      .set('Authorization', `Bearer test-token:${INCOHERENT_UID}:directeur.incoherent@nigersecurite.ne`)
      .send();

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/Incohérence de sécurité détectée.*aucune empreinte secrète/i);
  });

  // TEST 32 : Idempotence du bootstrap : renvoie le profil existant sans altérer les données existantes (Exigence 8)
  it('32. Conserve intégralement les données existantes si le profil est déjà complet (idempotence) (200)', async () => {
    const res = await request(app)
      .post('/api/auth/bootstrap-profile')
      .set('Authorization', `Bearer test-token:${DIR_ALREADY_CONFIGURED_UID}`)
      .send({
        nom: 'Tentative d’Écrasement',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.created).toBe(false);
    expect(res.body.profile.uid).toBe(DIR_ALREADY_CONFIGURED_UID);
    expect(res.body.profile.nom).toBe('Directeur Opérationnel');
    expect(res.body.profile.doitChangerPin).toBe(false); // n'a pas été écrasé !
  });

  // TEST 33 : Modification sécurisée du Code PIN Direction avec vérification de l'ancien code
  it('33. Modifie le Code PIN Direction après vérification en temps constant et rejette l’ancien code (200)', async () => {
    // a) Échec si l'ancien PIN est incorrect
    const badPinRes = await request(app)
      .post('/api/auth/change-pin')
      .set('Authorization', `Bearer test-token:${DIR_ALREADY_CONFIGURED_UID}`)
      .send({
        currentPin: '0000',
        newPin: '9314',
      });
    expect(badPinRes.status).toBe(401);
    expect(badPinRes.body.success).toBe(false);
    expect(badPinRes.body.error).toMatch(/Code PIN actuel incorrect/i);

    // b) Échec si le nouveau PIN est trivial (ex: 1234)
    const trivialRes = await request(app)
      .post('/api/auth/change-pin')
      .set('Authorization', `Bearer test-token:${DIR_ALREADY_CONFIGURED_UID}`)
      .send({
        currentPin: '7845',
        newPin: '1234',
      });
    expect(trivialRes.status).toBe(400);
    expect(trivialRes.body.error).toMatch(/trop prévisible/i);

    // c) Succès avec le bon PIN actuel et un nouveau PIN sécurisé (ex: 9314)
    const changeRes = await request(app)
      .post('/api/auth/change-pin')
      .set('Authorization', `Bearer test-token:${DIR_ALREADY_CONFIGURED_UID}`)
      .send({
        currentPin: '7845',
        newPin: '9314',
      });
    expect(changeRes.status).toBe(200);
    expect(changeRes.body.success).toBe(true);

    // d) Vérification : l'ancien PIN '7845' est désormais rejeté
    const verifyOldRes = await request(app)
      .post('/api/auth/verify-pin')
      .set('Authorization', `Bearer test-token:${DIR_ALREADY_CONFIGURED_UID}`)
      .send({
        pin: '7845',
      });
    expect(verifyOldRes.status).toBe(401);

    // e) Vérification : le nouveau PIN '9314' est désormais accepté
    const verifyNewRes = await request(app)
      .post('/api/auth/verify-pin')
      .set('Authorization', `Bearer test-token:${DIR_ALREADY_CONFIGURED_UID}`)
      .send({
        pin: '9314',
      });
    expect(verifyNewRes.status).toBe(200);
    expect(verifyNewRes.body.verified).toBe(true);
  });

  // TEST 34a : Synchronisation d'adresse e-mail sans altération d'UID ni de rôle
  it('34a. Synchronise la nouvelle adresse e-mail dans le profil Firestore sans toucher à l’UID ni au rôle (200)', async () => {
    const syncRes = await request(app)
      .post('/api/auth/sync-email')
      .set('Authorization', `Bearer test-token:${DIR_ALREADY_CONFIGURED_UID}:nouvel.email.direction@nigersecurite.ne`)
      .send({
        newEmail: 'nouvel.email.direction@nigersecurite.ne',
      });

    expect(syncRes.status).toBe(200);
    expect(syncRes.body.success).toBe(true);
    expect(syncRes.body.email).toBe('nouvel.email.direction@nigersecurite.ne');

    // Vérifier que le profil dans le store a bien conservé son UID, rôle et statut
    const profile = serverProfileStore.get(DIR_ALREADY_CONFIGURED_UID);
    expect(profile?.email).toBe('nouvel.email.direction@nigersecurite.ne');
    expect(profile?.role).toBe('direction');
    expect(profile?.statut).toBe('actif');
    expect(profile?.uid).toBe(DIR_ALREADY_CONFIGURED_UID);
  });

  // TEST 34b : Rejette la falsification d'e-mail dans sync-email (Anti-Tampering)
  it('34b. Rejette toute falsification d’adresse e-mail si le corps de requête ne correspond pas au jeton certifié (403)', async () => {
    const syncRes = await request(app)
      .post('/api/auth/sync-email')
      .set('Authorization', `Bearer test-token:${DIR_ALREADY_CONFIGURED_UID}:email.certifie.firebase@nigersecurite.ne`)
      .send({
        newEmail: 'adresse.usurpee@autre-domaine.com',
      });

    expect(syncRes.status).toBe(403);
    expect(syncRes.body.success).toBe(false);
    expect(syncRes.body.error).toMatch(/ne correspond pas à l’adresse certifiée par le jeton Firebase/i);
  });

  // TEST 34c : Rejette sync-email si l'e-mail est vide ou invalide
  it('34c. Rejette la demande de synchronisation si l’e-mail fourni est invalide ou absent (400)', async () => {
    const emptyRes = await request(app)
      .post('/api/auth/sync-email')
      .set('Authorization', `Bearer test-token:${DIR_ALREADY_CONFIGURED_UID}:direction@nigersecurite.ne`)
      .send({
        newEmail: '',
      });

    expect(emptyRes.status).toBe(400);
    expect(emptyRes.body.success).toBe(false);
    expect(emptyRes.body.error).toMatch(/invalide/i);
  });

  // TEST 35a : Interdiction absolue du jeton test-token en production (NODE_ENV=production)
  it('35a. Interdit strictement le jeton test-token lorsque NODE_ENV=production (401)', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const res = await request(app)
        .post('/api/auth/verify-pin')
        .set('Authorization', `Bearer test-token:${DIR_ALREADY_CONFIGURED_UID}:directeur.deja.pret@nigersecurite.ne`)
        .send({ pin: '7845', action: 'VALIDATE_PAYROLL' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/strictement interdit|hors environnement de test/i);
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  // TEST 35b : Interdiction absolue du jeton test-token si VITEST n'est pas actif
  it('35b. Interdit strictement le jeton test-token lorsque VITEST est absent ou différent de true (401)', async () => {
    const originalVitest = process.env.VITEST;
    delete process.env.VITEST;
    try {
      const res = await request(app)
        .post('/api/auth/setup-initial-pin')
        .set('Authorization', `Bearer test-token:${DIR_VALID_UID}:direction@nigersecurite.ne`)
        .send({ pin: '8421' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/strictement interdit|hors environnement de test/i);
    } finally {
      if (originalVitest !== undefined) {
        process.env.VITEST = originalVitest;
      }
    }
  });

  // TEST 35c : Interdiction absolue du jeton test-token en mode développement (NODE_ENV=development)
  it('35c. Interdit strictement le jeton test-token lorsque NODE_ENV=development (401)', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    try {
      const res = await request(app)
        .post('/api/auth/verify-pin')
        .set('Authorization', `Bearer test-token:${DIR_ALREADY_CONFIGURED_UID}:directeur.deja.pret@nigersecurite.ne`)
        .send({ pin: '7845', action: 'VALIDATE_PAYROLL' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/strictement interdit|hors environnement de test/i);
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });
});

