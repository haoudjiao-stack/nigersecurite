import { describe, it, beforeAll, afterAll, beforeEach, expect } from 'vitest';
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import * as fs from 'fs';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, query, where, writeBatch } from 'firebase/firestore';

describe('Tests de Sécurité Firestore - NigerSécurité', () => {
  let testEnv: RulesTestEnvironment;

  const DIR_PENDING_UID = 'dir_pending_pin_uid';
  const DIR_READY_UID = 'dir_ready_pin_uid';
  const DIR_OTHER_UID = 'dir_other_uid';
  const DIR_NO_PIN_FIELD_UID = 'dir_no_pin_field_uid';
  const CTRL_UID = 'controleur_actif_uid';
  const COMPTA_UID = 'compta_actif_uid';

  beforeAll(async () => {
    const rules = fs.readFileSync('firestore.rules', 'utf8');
    testEnv = await initializeTestEnvironment({
      projectId: 'test-niger-secu-rules',
      firestore: {
        rules,
        host: '127.0.0.1',
        port: 8080,
      },
    });
  });

  afterAll(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();

    // Configuration des comptes de référence avec privilèges Admin
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();

      // 1. Compte Direction en attente de configuration de PIN (doitChangerPin: true)
      await setDoc(doc(db, 'users', DIR_PENDING_UID), {
        uid: DIR_PENDING_UID,
        email: 'direction.pending@nigersecurite.ne',
        nom: 'Direction En Attente',
        role: 'direction',
        statut: 'actif',
        doitChangerPin: true,
        creeLe: '2026-11-08T00:00:00.000Z',
      });

      // 2. Compte Direction opérationnel (PIN configuré, doitChangerPin: false)
      await setDoc(doc(db, 'users', DIR_READY_UID), {
        uid: DIR_READY_UID,
        email: 'direction.ready@nigersecurite.ne',
        nom: 'Direction Opérationnelle',
        role: 'direction',
        statut: 'actif',
        doitChangerPin: false,
        creeLe: '2026-11-08T00:00:00.000Z',
      });

      // 3. Autre compte Direction
      await setDoc(doc(db, 'users', DIR_OTHER_UID), {
        uid: DIR_OTHER_UID,
        email: 'direction.autre@nigersecurite.ne',
        nom: 'Autre Direction',
        role: 'direction',
        statut: 'actif',
        doitChangerPin: false,
        creeLe: '2026-11-08T00:00:00.000Z',
      });

      // 4. Compte Contrôleur subordonné
      await setDoc(doc(db, 'users', CTRL_UID), {
        uid: CTRL_UID,
        email: 'controleur@nigersecurite.ne',
        nom: 'Contrôleur Terrain',
        role: 'controleur',
        statut: 'actif',
        sitesAssignesIds: ['site-1'],
        creeLe: '2026-11-08T00:00:00.000Z',
      });

      // 5. Compte Comptabilité
      await setDoc(doc(db, 'users', COMPTA_UID), {
        uid: COMPTA_UID,
        email: 'compta@nigersecurite.ne',
        nom: 'Responsable Comptable',
        role: 'comptabilite',
        statut: 'actif',
        creeLe: '2026-11-08T00:00:00.000Z',
      });

      // 6. Pointage de référence
      await setDoc(doc(db, 'patrol_scans', 'scan-ref-1'), {
        id: 'scan-ref-1',
        siteId: 'site-1',
        pointId: 'pt-1',
        controleurId: CTRL_UID,
        scanneLe: '2026-11-08T06:00:00.000Z',
        statutConformite: 'Conforme',
        statutSynchro: 'synchronise',
        creeLe: '2026-11-08T06:00:00.000Z',
      });

      // 7. Checkpoint de référence
      await setDoc(doc(db, 'patrol_checkpoints', 'cp-ref-1'), {
        id: 'cp-ref-1',
        siteId: 'site-1',
        nom: 'Point Entrée Nord',
        qrPayload: 'NS-PT-001',
        estActif: true,
        creeLe: '2026-11-08T00:00:00.000Z',
      });

      // 8. Compte Direction avec champ doitChangerPin totalement absent
      await setDoc(doc(db, 'users', DIR_NO_PIN_FIELD_UID), {
        uid: DIR_NO_PIN_FIELD_UID,
        email: 'direction.sans.champ@nigersecurite.ne',
        nom: 'Direction Sans Champ PIN',
        role: 'direction',
        statut: 'actif',
        creeLe: '2026-11-08T00:00:00.000Z',
      });
    });
  });

  // TEST 1 : Une mise à jour directe de doitChangerPin par le client est formellement REFUSÉE
  it('1. Rejette toute tentative par le client de modifier doitChangerPin directement', async () => {
    // Un compte Direction (même prêt) tente de modifier doitChangerPin directement
    const dirReadyContext = testEnv.authenticatedContext(DIR_READY_UID);
    const db = dirReadyContext.firestore();

    const updateAttempt = updateDoc(doc(db, 'users', DIR_PENDING_UID), {
      doitChangerPin: false,
    });
    await assertFails(updateAttempt);

    // Le compte en attente tente lui-même de désactiver son propre flag
    const dirPendingContext = testEnv.authenticatedContext(DIR_PENDING_UID);
    const dbPending = dirPendingContext.firestore();

    const selfUpdateAttempt = updateDoc(doc(dbPending, 'users', DIR_PENDING_UID), {
      doitChangerPin: false,
    });
    await assertFails(selfUpdateAttempt);
  });

  // TEST 2 : Les données protégées sont inaccessibles tant que la configuration du PIN est en attente
  it('2. Bloque l’accès aux données protégées si le PIN Direction est en attente (doitChangerPin: true)', async () => {
    const dirPendingContext = testEnv.authenticatedContext(DIR_PENDING_UID);
    const db = dirPendingContext.firestore();

    // a) Lecture des pointages de ronde -> REFUSÉE
    await assertFails(getDocs(collection(db, 'patrol_scans')));
    await assertFails(getDoc(doc(db, 'patrol_scans', 'scan-ref-1')));

    // b) Lecture des checkpoints de ronde -> REFUSÉE
    await assertFails(getDocs(collection(db, 'patrol_checkpoints')));
    await assertFails(getDoc(doc(db, 'patrol_checkpoints', 'cp-ref-1')));

    // c) Liste de l'annuaire des utilisateurs -> REFUSÉE
    await assertFails(getDocs(collection(db, 'users')));

    // d) Création d'un sous-compte -> REFUSÉE
    await assertFails(
      setDoc(doc(db, 'users', 'nouveau-ctrl'), {
        uid: 'nouveau-ctrl',
        email: 'nouveau@nigersecurite.ne',
        nom: 'Nouveau Agent',
        role: 'controleur',
        statut: 'actif',
        creeLe: '2026-11-08T06:00:00.000Z',
      })
    );

    // e) Seule la lecture unitaire de SON PROPRE profil est permise (pour initialiser l'app et afficher l'invitation PIN)
    await assertSucceeds(getDoc(doc(db, 'users', DIR_PENDING_UID)));
  });

  // TEST 3 : Le parcours prévu permet d'accéder aux données une fois le PIN configuré
  it('3. Autorise l’accès aux données pour un compte Direction dont le PIN est validé (doitChangerPin: false)', async () => {
    const dirReadyContext = testEnv.authenticatedContext(DIR_READY_UID);
    const db = dirReadyContext.firestore();

    // a) Lecture des pointages de ronde -> AUTORISÉE
    await assertSucceeds(getDocs(collection(db, 'patrol_scans')));
    await assertSucceeds(getDoc(doc(db, 'patrol_scans', 'scan-ref-1')));

    // b) Lecture des checkpoints de ronde -> AUTORISÉE
    await assertSucceeds(getDocs(collection(db, 'patrol_checkpoints')));
    await assertSucceeds(getDoc(doc(db, 'patrol_checkpoints', 'cp-ref-1')));

    // c) Liste de l'annuaire des utilisateurs -> AUTORISÉE
    await assertSucceeds(getDocs(collection(db, 'users')));

    // d) Création d'un point de contrôle de ronde -> AUTORISÉE
    await assertSucceeds(
      setDoc(doc(db, 'patrol_checkpoints', 'cp-nouveau-1'), {
        id: 'cp-nouveau-1',
        siteId: 'site-1',
        nom: 'Nouveau Point Sud',
        qrPayload: 'NS-PT-SUD',
        estActif: true,
        creeLe: '2026-11-08T06:30:00.000Z',
      })
    );
  });

  // TEST 4 : Les autres profils ne peuvent pas être modifiés hors des permissions prévues
  it('4. Empêche la modification de profils hors des règles prévues (protection stricte des rôles et identités)', async () => {
    const dirReadyContext = testEnv.authenticatedContext(DIR_READY_UID);
    const db = dirReadyContext.firestore();

    // a) Direction tentant de modifier un AUTRE profil Direction -> REFUSÉE
    await assertFails(
      updateDoc(doc(db, 'users', DIR_OTHER_UID), {
        nom: 'Piratage Nom Autre Direction',
      })
    );

    // b) Direction tentant d'élever un contrôleur au rôle Direction -> REFUSÉE
    await assertFails(
      updateDoc(doc(db, 'users', CTRL_UID), {
        role: 'direction',
      })
    );

    // c) Direction tentant de modifier l'UID ou l'email d'un subordonné -> REFUSÉE
    await assertFails(
      updateDoc(doc(db, 'users', CTRL_UID), {
        email: 'nouveau.email@hack.ne',
      })
    );

    // d) Direction mettant à jour le statut ou les sites d'un contrôleur subordonné -> AUTORISÉE
    await assertSucceeds(
      updateDoc(doc(db, 'users', CTRL_UID), {
        statut: 'desactive',
      })
    );
  });

  // TEST 5 : Rejet de la Direction si doitChangerPin est totalement absent
  it('5. Rejette l’accès aux données protégées si le champ doitChangerPin est totalement absent du document Direction', async () => {
    const dirNoPinContext = testEnv.authenticatedContext(DIR_NO_PIN_FIELD_UID);
    const db = dirNoPinContext.firestore();

    // a) Doit être refusé sur les pointages
    await assertFails(getDocs(collection(db, 'patrol_scans')));
    await assertFails(getDoc(doc(db, 'patrol_scans', 'scan-ref-1')));

    // b) Doit être refusé sur les checkpoints
    await assertFails(getDocs(collection(db, 'patrol_checkpoints')));
    await assertFails(getDoc(doc(db, 'patrol_checkpoints', 'cp-ref-1')));

    // c) Doit être refusé sur la liste des utilisateurs
    await assertFails(getDocs(collection(db, 'users')));

    // d) Seule la lecture de son propre profil est permise
    await assertSucceeds(getDoc(doc(db, 'users', DIR_NO_PIN_FIELD_UID)));
  });

  // TEST 6 : Étanchéité absolue de users/{uid} contre pinHash et pinSalt
  it('6. Empêche tout client d’injecter ou de modifier pinHash ou pinSalt dans users/{uid}', async () => {
    const dirReadyContext = testEnv.authenticatedContext(DIR_READY_UID);
    const db = dirReadyContext.firestore();

    // a) Tentative par Direction d'injecter pinHash sur un profil subordonné -> REFUSÉE
    await assertFails(
      updateDoc(doc(db, 'users', CTRL_UID), {
        pinHash: 'injected_hash_attempt',
      })
    );

    // b) Tentative par Direction d'injecter pinSalt sur un profil subordonné -> REFUSÉE
    await assertFails(
      updateDoc(doc(db, 'users', CTRL_UID), {
        pinSalt: 'injected_salt_attempt',
      })
    );

    // c) Tentative d'auto-mise à jour avec pinHash sur son propre profil -> REFUSÉE
    await assertFails(
      updateDoc(doc(db, 'users', DIR_READY_UID), {
        pinHash: 'self_hash_attempt',
      })
    );
  });

  // TEST 7 : La collection /server_auth_secrets est 100% inaccessible en lecture à tout client SDK
  it('7. Rejette toute lecture de /server_auth_secrets par un client SDK (même Direction authentifiée)', async () => {
    // Insérer un secret de test via les privilèges admin d'émulateur
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'server_auth_secrets', DIR_READY_UID), {
        uid: DIR_READY_UID,
        pinHash: 'secret_hash_value_123',
        pinSalt: 'secret_salt_value_456',
        iterations: 210000,
      });
    });

    const dirReadyContext = testEnv.authenticatedContext(DIR_READY_UID);
    const db = dirReadyContext.firestore();

    // a) Tentative de lecture unitaire de son PROPRE secret -> STRICTEMENT REFUSÉE
    await assertFails(getDoc(doc(db, 'server_auth_secrets', DIR_READY_UID)));

    // b) Tentative de liste des secrets par Direction -> STRICTEMENT REFUSÉE
    await assertFails(getDocs(collection(db, 'server_auth_secrets')));

    // c) Tentative de lecture par un autre utilisateur (contrôleur) -> STRICTEMENT REFUSÉE
    const ctrlContext = testEnv.authenticatedContext(CTRL_UID);
    await assertFails(getDoc(doc(ctrlContext.firestore(), 'server_auth_secrets', DIR_READY_UID)));
  });

  // TEST 8 : La collection /server_auth_secrets est 100% inaccessible en écriture à tout client SDK
  it('8. Rejette toute écriture ou altération de /server_auth_secrets par un client SDK', async () => {
    const dirReadyContext = testEnv.authenticatedContext(DIR_READY_UID);
    const db = dirReadyContext.firestore();

    // a) Tentative de création d'un document secret -> STRICTEMENT REFUSÉE
    await assertFails(
      setDoc(doc(db, 'server_auth_secrets', DIR_READY_UID), {
        uid: DIR_READY_UID,
        pinHash: 'malicious_client_hash',
        pinSalt: 'malicious_salt',
      })
    );

    // b) Tentative de mise à jour d'un document secret -> STRICTEMENT REFUSÉE
    await assertFails(
      updateDoc(doc(db, 'server_auth_secrets', DIR_READY_UID), {
        pinHash: 'updated_hash',
      })
    );
  });

  // TEST 9 : La collection /server_auth_lockouts est 100% inaccessible à tout client SDK
  it('9. Rejette toute lecture ou écriture de /server_auth_lockouts par un client SDK', async () => {
    // Insérer un verrou de test via les privilèges admin
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'server_auth_lockouts', DIR_READY_UID), {
        uid: DIR_READY_UID,
        failedAttempts: 5,
        lockedUntil: Date.now() + 600000,
      });
    });

    const dirReadyContext = testEnv.authenticatedContext(DIR_READY_UID);
    const db = dirReadyContext.firestore();

    // Lecture refusée
    await assertFails(getDoc(doc(db, 'server_auth_lockouts', DIR_READY_UID)));
    await assertFails(getDocs(collection(db, 'server_auth_lockouts')));

    // Écriture refusée
    await assertFails(
      setDoc(doc(db, 'server_auth_lockouts', 'tentative-lockout'), {
        uid: 'tentative-lockout',
        failedAttempts: 0,
        lockedUntil: null,
      })
    );
  });

  // TEST 10 : La collection /server_action_tickets est 100% inaccessible à tout client SDK
  it('10. Rejette toute lecture ou écriture de /server_action_tickets par un client SDK', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'server_action_tickets', 'ticket-test-123'), {
        ticketId: 'ticket-test-123',
        uid: DIR_READY_UID,
        action: 'VALIDATE_PAYROLL',
        used: false,
      });
    });

    const dirReadyContext = testEnv.authenticatedContext(DIR_READY_UID);
    const db = dirReadyContext.firestore();

    // Lecture refusée
    await assertFails(getDoc(doc(db, 'server_action_tickets', 'ticket-test-123')));
    await assertFails(getDocs(collection(db, 'server_action_tickets')));

    // Écriture refusée
    await assertFails(
      setDoc(doc(db, 'server_action_tickets', 'ticket-malveillant'), {
        ticketId: 'ticket-malveillant',
        uid: DIR_READY_UID,
        action: 'VALIDATE_PAYROLL',
      })
    );
  });

  // TEST 11 : La collection /validations_paie est protégée en écriture contre tout client SDK
  it('11. Rejette toute écriture directe de /validations_paie par un client SDK (réservé au backend de confiance)', async () => {
    // Insérer une validation côté serveur / règles désactivées
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'validations_paie', 'val_paie_octobre_2026'), {
        id: 'val_paie_octobre_2026',
        payrollId: 'PAIE_2026_10',
        montantTotal: 1500000,
        beneficiaire: 'VIGILES_NIGER_NORD',
        validePar: DIR_READY_UID,
        statut: 'VALIDEE',
      });
    });

    const dirReadyContext = testEnv.authenticatedContext(DIR_READY_UID);
    const db = dirReadyContext.firestore();

    // Lecture autorisée pour la Direction prête
    await assertSucceeds(getDoc(doc(db, 'validations_paie', 'val_paie_octobre_2026')));

    // Écriture / modification directe interdite au client SDK
    await assertFails(
      setDoc(doc(db, 'validations_paie', 'val_fraude_client'), {
        id: 'val_fraude_client',
        montantTotal: 9999999,
        statut: 'VALIDEE',
      })
    );

    await assertFails(
      updateDoc(doc(db, 'validations_paie', 'val_paie_octobre_2026'), {
        montantTotal: 2000000,
      })
    );
  });

  // TEST 12 : Chaque rôle (Comptabilité, Contrôleur) lit uniquement SON propre profil, jamais celui d'un tiers ni la liste
  it('12. Autorise Comptabilité et Contrôleur à lire leur propre profil users/{uid} mais bloque la lecture des tiers et le listage', async () => {
    const comptaDb = testEnv.authenticatedContext(COMPTA_UID).firestore();
    const ctrlDb = testEnv.authenticatedContext(CTRL_UID).firestore();

    await assertSucceeds(getDoc(doc(comptaDb, 'users', COMPTA_UID)));
    await assertSucceeds(getDoc(doc(ctrlDb, 'users', CTRL_UID)));

    await assertFails(getDoc(doc(comptaDb, 'users', CTRL_UID)));
    await assertFails(getDoc(doc(comptaDb, 'users', DIR_READY_UID)));
    await assertFails(getDoc(doc(ctrlDb, 'users', COMPTA_UID)));
    await assertFails(getDocs(collection(comptaDb, 'users')));
    await assertFails(getDocs(collection(ctrlDb, 'users')));
  });

  // TEST 13 : Aucun utilisateur ne peut modifier son propre rôle, statut, PIN ou profil côté client, ni créer un utilisateur hors transaction atomique CPT/CTR
  it('13. Interdit toute auto-modification de rôle/statut/PIN/profil et toute création hors protocole atomique Direction', async () => {
    const ctrlDb = testEnv.authenticatedContext(CTRL_UID).firestore();
    const comptaDb = testEnv.authenticatedContext(COMPTA_UID).firestore();
    const dirDb = testEnv.authenticatedContext(DIR_READY_UID).firestore();

    await assertFails(updateDoc(doc(ctrlDb, 'users', CTRL_UID), { role: 'direction' }));
    await assertFails(updateDoc(doc(ctrlDb, 'users', CTRL_UID), { statut: 'desactive' }));
    await assertFails(updateDoc(doc(ctrlDb, 'users', CTRL_UID), { prenom: 'AutoModif' }));
    await assertFails(updateDoc(doc(comptaDb, 'users', COMPTA_UID), { role: 'direction' }));
    await assertFails(updateDoc(doc(dirDb, 'users', DIR_READY_UID), { doitChangerPin: true }));

    // Création isolée sans login_identifiers atomique -> REFUSÉE
    await assertFails(
      setDoc(doc(dirDb, 'users', 'nouveau-compte-client'), {
        uid: 'nouveau-compte-client',
        email: 'ctr-2026-010@acces.nigersecurite.ne',
        loginId: 'CTR-2026-010',
        entrepriseId: 'NIGERSECURITE-001',
        nom: 'Test Client',
        role: 'controleur',
        statut: 'actif',
        doitChangerCodeSecret: true,
        creeLe: '2026-11-17T00:00:00.000Z',
        creeParUid: DIR_READY_UID,
      })
    );

    // Création d'un compte Direction côté client -> STRICTEMENT REFUSÉE
    await assertFails(
      setDoc(doc(dirDb, 'users', 'nouvelle-direction-client'), {
        uid: 'nouvelle-direction-client',
        email: 'dir@nigersecurite.ne',
        loginId: 'CPT-2026-099',
        entrepriseId: 'NIGERSECURITE-001',
        nom: 'Pirate Direction',
        role: 'direction',
        statut: 'actif',
        doitChangerCodeSecret: false,
        creeLe: '2026-11-17T00:00:00.000Z',
        creeParUid: DIR_READY_UID,
      })
    );
  });

  // TEST 14 : Aucun accès public (non authentifié) sur aucune collection
  it('14. Rejette tout accès non authentifié sur users, login_identifiers, patrol_scans, patrol_checkpoints, patrol_rounds_config et validations_paie', async () => {
    const anonDb = testEnv.unauthenticatedContext().firestore();

    await assertFails(getDoc(doc(anonDb, 'users', DIR_READY_UID)));
    await assertFails(getDocs(collection(anonDb, 'users')));
    await assertFails(getDoc(doc(anonDb, 'login_identifiers', 'CPT-2026-001')));
    await assertFails(getDocs(collection(anonDb, 'login_identifiers')));
    await assertFails(getDoc(doc(anonDb, 'patrol_scans', 'scan-ref-1')));
    await assertFails(getDocs(collection(anonDb, 'patrol_scans')));
    await assertFails(getDoc(doc(anonDb, 'patrol_checkpoints', 'cp-ref-1')));
    await assertFails(getDocs(collection(anonDb, 'patrol_checkpoints')));
    await assertFails(getDocs(collection(anonDb, 'patrol_rounds_config')));
    await assertFails(getDocs(collection(anonDb, 'validations_paie')));
  });

  // TEST 15 : Un subordonné actif peut uniquement passer son propre doitChangerCodeSecret à false (jamais à true, jamais si désactivé)
  it('15. Autorise uniquement doitChangerCodeSecret=false par un subordonné actif et bloque toute écriture d’un compte désactivé', async () => {
    const ctrlDb = testEnv.authenticatedContext(CTRL_UID).firestore();
    await assertSucceeds(updateDoc(doc(ctrlDb, 'users', CTRL_UID), { doitChangerCodeSecret: false }));
    await assertFails(updateDoc(doc(ctrlDb, 'users', CTRL_UID), { doitChangerCodeSecret: true }));

    // Désactivation par la Direction -> bloque l'accès aux données protégées ET à doitChangerCodeSecret
    const dirDb = testEnv.authenticatedContext(DIR_READY_UID).firestore();
    await assertSucceeds(updateDoc(doc(dirDb, 'users', CTRL_UID), { statut: 'desactive' }));

    await assertFails(getDocs(collection(ctrlDb, 'patrol_checkpoints')));
    await assertFails(getDoc(doc(ctrlDb, 'patrol_scans', 'scan-ref-1')));
    await assertFails(updateDoc(doc(ctrlDb, 'users', CTRL_UID), { doitChangerCodeSecret: false }));
  });

  // TEST 16 : Cloisonnement strict par sitesAssignesIds pour un contrôleur actif (site-1 autorisé, site-2 interdit)
  it('16. Restreint les lectures et créations/mises à jour de scans et points de ronde aux seuls sites affectés au contrôleur', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      await setDoc(doc(adminDb, 'patrol_checkpoints', 'cp-site-2'), {
        id: 'cp-site-2',
        siteId: 'site-2',
        nom: 'Point Site Non Assigné',
        qrPayload: 'NS-PT-002',
        estActif: true,
        creeLe: '2026-11-08T00:00:00.000Z',
      });
      await setDoc(doc(adminDb, 'patrol_rounds_config', 'cfg-site-1'), {
        id: 'cfg-site-1',
        siteId: 'site-1',
        nomRonde: 'Ronde Site 1',
        pointsObligatoiresIds: ['cp-ref-1'],
        actif: true,
      });
      await setDoc(doc(adminDb, 'patrol_rounds_config', 'cfg-site-2'), {
        id: 'cfg-site-2',
        siteId: 'site-2',
        nomRonde: 'Ronde Site 2',
        pointsObligatoiresIds: ['cp-site-2'],
        actif: true,
      });
      await setDoc(doc(adminDb, 'patrol_scans', 'scan-site-2'), {
        id: 'scan-site-2',
        siteId: 'site-2',
        pointId: 'cp-site-2',
        controleurId: CTRL_UID,
        scanneLe: '2026-11-08T07:00:00.000Z',
        statutConformite: 'Conforme',
        statutSynchro: 'en_attente',
        creeLe: '2026-11-08T07:00:00.000Z',
      });
    });

    const ctrlDb = testEnv.authenticatedContext(CTRL_UID).firestore();

    // Site assigné ('site-1') -> AUTORISÉ
    await assertSucceeds(getDoc(doc(ctrlDb, 'patrol_checkpoints', 'cp-ref-1')));
    await assertSucceeds(
      getDocs(query(collection(ctrlDb, 'patrol_checkpoints'), where('siteId', '==', 'site-1')))
    );
    await assertSucceeds(getDoc(doc(ctrlDb, 'patrol_rounds_config', 'cfg-site-1')));
    await assertSucceeds(getDoc(doc(ctrlDb, 'patrol_scans', 'scan-ref-1')));
    await assertSucceeds(
      setDoc(doc(ctrlDb, 'patrol_scans', 'scan-valide-site-1'), {
        id: 'scan-valide-site-1',
        siteId: 'site-1',
        pointId: 'cp-ref-1',
        controleurId: CTRL_UID,
        scanneLe: '2026-11-08T08:00:00.000Z',
        statutConformite: 'Conforme',
        statutSynchro: 'synchronise',
        creeLe: '2026-11-08T08:00:00.000Z',
      })
    );

    // Site non assigné ('site-2') ou requête globale non filtrée -> REFUSÉ
    await assertFails(getDoc(doc(ctrlDb, 'patrol_checkpoints', 'cp-site-2')));
    await assertFails(getDocs(collection(ctrlDb, 'patrol_checkpoints')));
    await assertFails(
      getDocs(query(collection(ctrlDb, 'patrol_checkpoints'), where('siteId', '==', 'site-2')))
    );
    await assertFails(getDoc(doc(ctrlDb, 'patrol_rounds_config', 'cfg-site-2')));
    await assertFails(getDocs(collection(ctrlDb, 'patrol_rounds_config')));
    await assertFails(getDoc(doc(ctrlDb, 'patrol_scans', 'scan-site-2')));
    await assertFails(
      updateDoc(doc(ctrlDb, 'patrol_scans', 'scan-site-2'), { statutSynchro: 'synchronise' })
    );
    await assertFails(
      setDoc(doc(ctrlDb, 'patrol_scans', 'scan-fraude-site-2'), {
        id: 'scan-fraude-site-2',
        siteId: 'site-2',
        pointId: 'cp-site-2',
        controleurId: CTRL_UID,
        scanneLe: '2026-11-08T08:05:00.000Z',
        statutConformite: 'Conforme',
        statutSynchro: 'synchronise',
        creeLe: '2026-11-08T08:05:00.000Z',
      })
    );
  });

  // TEST 17 : Phase A multi-entreprises — création atomique CPT/CTR avec entrepriseId, cohérence croisée et cloisonnement inter-entreprises
  it('17. Phase A : autorise la création atomique CPT/CTR avec entrepriseId cohérent et bloque tout accès inter-entreprises', async () => {
    const DIR_CLIENT2_UID = 'dir_client2_uid';
    const CTRL_CLIENT2_UID = 'ctrl_client2_uid';

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      await setDoc(doc(adminDb, 'users', DIR_CLIENT2_UID), {
        uid: DIR_CLIENT2_UID,
        email: 'direction@client2.ne',
        entrepriseId: 'CLIENT-002',
        nom: 'Direction Client 2',
        role: 'direction',
        statut: 'actif',
        doitChangerPin: false,
        creeLe: '2026-11-18T00:00:00.000Z',
      });
      await setDoc(doc(adminDb, 'users', CTRL_CLIENT2_UID), {
        uid: CTRL_CLIENT2_UID,
        email: 'ctr-2026-501@acces.nigersecurite.ne',
        loginId: 'CTR-2026-501',
        entrepriseId: 'CLIENT-002',
        nom: 'Contrôleur Client 2',
        role: 'controleur',
        statut: 'actif',
        sitesAssignesIds: ['site-1'], // Même siteId que NIGERSECURITE-001 pour vérifier l'absence de fuite inter-entreprises
        creeLe: '2026-11-18T00:00:00.000Z',
      });
      await setDoc(doc(adminDb, 'validations_paie', 'val_ns_1'), {
        id: 'val_ns_1',
        montantTotal: 2500000,
        statut: 'VALIDEE',
      });
    });

    const dirNsDb = testEnv.authenticatedContext(DIR_READY_UID).firestore();
    const dirClient2Db = testEnv.authenticatedContext(DIR_CLIENT2_UID).firestore();
    const ctrlClient2Db = testEnv.authenticatedContext(CTRL_CLIENT2_UID).firestore();

    // a) Direction historique NIGERSECURITE-001 (sans champ entrepriseId) peut pré-vérifier un identifiant libre (resource == null)
    await assertSucceeds(getDoc(doc(dirNsDb, 'login_identifiers', 'CPT-2026-011')));

    // b) Création atomique CPT-2026-011 avec entrepriseId = NIGERSECURITE-001 cohérent dans /users et /login_identifiers -> AUTORISÉE
    const validBatch = writeBatch(dirNsDb);
    validBatch.set(doc(dirNsDb, 'login_identifiers', 'CPT-2026-011'), {
      loginId: 'CPT-2026-011',
      uid: 'staff_cpt_011',
      entrepriseId: 'NIGERSECURITE-001',
      role: 'comptabilite',
      statut: 'actif',
      creeLe: '2026-11-18T10:00:00.000Z',
      creeParUid: DIR_READY_UID,
    });
    validBatch.set(doc(dirNsDb, 'users', 'staff_cpt_011'), {
      uid: 'staff_cpt_011',
      email: 'cpt-2026-011@acces.nigersecurite.ne',
      loginId: 'CPT-2026-011',
      entrepriseId: 'NIGERSECURITE-001',
      nom: 'Comptable NigerSécurité',
      role: 'comptabilite',
      statut: 'actif',
      sitesAssignesIds: [],
      doitChangerCodeSecret: true,
      creeLe: '2026-11-18T10:00:00.000Z',
      creeParUid: DIR_READY_UID,
    });
    await assertSucceeds(validBatch.commit());

    // c) Création atomique avec entrepriseId différent de l'entreprise de la Direction -> REFUSÉE
    const wrongTenantBatch = writeBatch(dirNsDb);
    wrongTenantBatch.set(doc(dirNsDb, 'login_identifiers', 'CPT-2026-012'), {
      loginId: 'CPT-2026-012',
      uid: 'staff_cpt_012',
      entrepriseId: 'CLIENT-002',
      role: 'comptabilite',
      statut: 'actif',
      creeLe: '2026-11-18T10:05:00.000Z',
      creeParUid: DIR_READY_UID,
    });
    wrongTenantBatch.set(doc(dirNsDb, 'users', 'staff_cpt_012'), {
      uid: 'staff_cpt_012',
      email: 'cpt-2026-012@acces.nigersecurite.ne',
      loginId: 'CPT-2026-012',
      entrepriseId: 'CLIENT-002',
      nom: 'Tentative Usurpation Entreprise',
      role: 'comptabilite',
      statut: 'actif',
      sitesAssignesIds: [],
      doitChangerCodeSecret: true,
      creeLe: '2026-11-18T10:05:00.000Z',
      creeParUid: DIR_READY_UID,
    });
    await assertFails(wrongTenantBatch.commit());

    // d) Création atomique avec divergence entrepriseId entre /users et /login_identifiers -> REFUSÉE
    const mismatchBatch = writeBatch(dirNsDb);
    mismatchBatch.set(doc(dirNsDb, 'login_identifiers', 'CPT-2026-013'), {
      loginId: 'CPT-2026-013',
      uid: 'staff_cpt_013',
      entrepriseId: 'NIGERSECURITE-001',
      role: 'comptabilite',
      statut: 'actif',
      creeLe: '2026-11-18T10:06:00.000Z',
      creeParUid: DIR_READY_UID,
    });
    mismatchBatch.set(doc(dirNsDb, 'users', 'staff_cpt_013'), {
      uid: 'staff_cpt_013',
      email: 'cpt-2026-013@acces.nigersecurite.ne',
      loginId: 'CPT-2026-013',
      entrepriseId: 'CLIENT-002',
      nom: 'Divergence Entreprise',
      role: 'comptabilite',
      statut: 'actif',
      sitesAssignesIds: [],
      doitChangerCodeSecret: true,
      creeLe: '2026-11-18T10:06:00.000Z',
      creeParUid: DIR_READY_UID,
    });
    await assertFails(mismatchBatch.commit());

    // e) Immutabilité de entrepriseId lors d'une mise à jour par Direction -> REFUSÉE
    await assertFails(updateDoc(doc(dirNsDb, 'users', 'staff_cpt_011'), { entrepriseId: 'CLIENT-002' }));

    // f) Direction CLIENT-002 bloquée sur toutes les données NIGERSECURITE-001 (get, update, list non filtré)
    await assertFails(getDoc(doc(dirClient2Db, 'users', CTRL_UID)));
    await assertFails(getDoc(doc(dirClient2Db, 'users', 'staff_cpt_011')));
    await assertFails(getDoc(doc(dirClient2Db, 'login_identifiers', 'CPT-2026-011')));
    await assertFails(updateDoc(doc(dirClient2Db, 'users', CTRL_UID), { statut: 'desactive' }));
    await assertFails(getDocs(collection(dirClient2Db, 'users')));
    await assertFails(getDocs(collection(dirClient2Db, 'login_identifiers')));
    await assertFails(getDoc(doc(dirClient2Db, 'patrol_scans', 'scan-ref-1')));
    await assertFails(getDoc(doc(dirClient2Db, 'patrol_checkpoints', 'cp-ref-1')));
    await assertFails(getDoc(doc(dirClient2Db, 'validations_paie', 'val_ns_1')));
    await assertFails(getDocs(collection(dirClient2Db, 'patrol_scans')));

    // g) Direction CLIENT-002 autorisée sur ses propres requêtes filtrées par entrepriseId
    await assertSucceeds(
      getDocs(query(collection(dirClient2Db, 'users'), where('entrepriseId', '==', 'CLIENT-002')))
    );

    // h) Contrôleur CLIENT-002 ne peut PAS lire un checkpoint ou scan NIGERSECURITE-001 même si siteId == 'site-1'
    await assertFails(getDoc(doc(ctrlClient2Db, 'patrol_checkpoints', 'cp-ref-1')));
    await assertFails(getDoc(doc(ctrlClient2Db, 'patrol_scans', 'scan-ref-1')));
  });

  // TEST 18 : Refus strict de toutes les suppressions (allow delete: if false / allow write: if false) et des écritures anonymes
  it('18. Rejette toute suppression (deleteDoc) par tous les rôles sur toutes les collections ainsi que toute écriture anonyme', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      await setDoc(doc(adminDb, 'login_identifiers', 'CPT-2026-018'), {
        loginId: 'CPT-2026-018',
        uid: COMPTA_UID,
        entrepriseId: 'NIGERSECURITE-001',
        role: 'comptabilite',
        statut: 'actif',
        creeLe: '2026-11-18T00:00:00.000Z',
        creeParUid: DIR_READY_UID,
      });
      await setDoc(doc(adminDb, 'patrol_rounds_config', 'cfg-del-1'), {
        id: 'cfg-del-1',
        siteId: 'site-1',
        nomRonde: 'Ronde Suppression Test',
        pointsObligatoiresIds: ['cp-ref-1'],
        actif: true,
      });
      await setDoc(doc(adminDb, 'validations_paie', 'val-del-1'), {
        id: 'val-del-1',
        montantTotal: 1200000,
        statut: 'VALIDEE',
      });
    });

    const dirDb = testEnv.authenticatedContext(DIR_READY_UID).firestore();
    const comptaDb = testEnv.authenticatedContext(COMPTA_UID).firestore();
    const ctrlDb = testEnv.authenticatedContext(CTRL_UID).firestore();
    const anonDb = testEnv.unauthenticatedContext().firestore();

    // Direction opérationnelle : aucune suppression autorisée
    await assertFails(deleteDoc(doc(dirDb, 'users', CTRL_UID)));
    await assertFails(deleteDoc(doc(dirDb, 'users', DIR_READY_UID)));
    await assertFails(deleteDoc(doc(dirDb, 'login_identifiers', 'CPT-2026-018')));
    await assertFails(deleteDoc(doc(dirDb, 'patrol_scans', 'scan-ref-1')));
    await assertFails(deleteDoc(doc(dirDb, 'patrol_checkpoints', 'cp-ref-1')));
    await assertFails(deleteDoc(doc(dirDb, 'patrol_rounds_config', 'cfg-del-1')));
    await assertFails(deleteDoc(doc(dirDb, 'validations_paie', 'val-del-1')));

    // Contrôleur : impossible de supprimer son propre scan ou son propre profil
    await assertFails(deleteDoc(doc(ctrlDb, 'patrol_scans', 'scan-ref-1')));
    await assertFails(deleteDoc(doc(ctrlDb, 'users', CTRL_UID)));

    // Comptabilité : impossible de supprimer une validation de paie ou un scan
    await assertFails(deleteDoc(doc(comptaDb, 'validations_paie', 'val-del-1')));
    await assertFails(deleteDoc(doc(comptaDb, 'patrol_scans', 'scan-ref-1')));

    // Utilisateur anonyme : aucune écriture ni suppression autorisée
    await assertFails(deleteDoc(doc(anonDb, 'patrol_scans', 'scan-ref-1')));
    await assertFails(
      setDoc(doc(anonDb, 'patrol_checkpoints', 'cp-anon'), {
        id: 'cp-anon',
        siteId: 'site-1',
        nom: 'Point Anonyme',
        qrPayload: 'ANON-1',
        estActif: true,
        creeLe: '2026-11-18T00:00:00.000Z',
      })
    );
    await assertFails(
      setDoc(doc(anonDb, 'users', 'anon-uid'), {
        uid: 'anon-uid',
        email: 'anon@nigersecurite.ne',
        nom: 'Anonyme',
        role: 'direction',
        statut: 'actif',
        creeLe: '2026-11-18T00:00:00.000Z',
      })
    );
  });

  // TEST 19 : Modifications autorisées et interdites sur /login_identifiers/{loginId}
  it('19. Contrôle strictement les mises à jour autorisées (statut uniquement) et interdites de /login_identifiers', async () => {
    const DIR_CLIENT2_UID = 'dir_client2_t19';

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      await setDoc(doc(adminDb, 'users', DIR_CLIENT2_UID), {
        uid: DIR_CLIENT2_UID,
        email: 'dir.t19@client2.ne',
        entrepriseId: 'CLIENT-002',
        nom: 'Direction Client 2 T19',
        role: 'direction',
        statut: 'actif',
        doitChangerPin: false,
        creeLe: '2026-11-18T00:00:00.000Z',
      });
      await setDoc(doc(adminDb, 'login_identifiers', 'CPT-2026-020'), {
        loginId: 'CPT-2026-020',
        uid: 'staff_cpt_020',
        entrepriseId: 'NIGERSECURITE-001',
        role: 'comptabilite',
        statut: 'actif',
        creeLe: '2026-11-18T00:00:00.000Z',
        creeParUid: DIR_READY_UID,
      });
      await setDoc(doc(adminDb, 'login_identifiers', 'CPT-2026-021'), {
        loginId: 'CPT-2026-021',
        uid: 'staff_cpt_021',
        entrepriseId: 'CLIENT-002',
        role: 'comptabilite',
        statut: 'actif',
        creeLe: '2026-11-18T00:00:00.000Z',
        creeParUid: DIR_CLIENT2_UID,
      });
    });

    const dirNsDb = testEnv.authenticatedContext(DIR_READY_UID).firestore();
    const dirPendingDb = testEnv.authenticatedContext(DIR_PENDING_UID).firestore();
    const comptaDb = testEnv.authenticatedContext(COMPTA_UID).firestore();
    const ctrlDb = testEnv.authenticatedContext(CTRL_UID).firestore();
    const dirClient2Db = testEnv.authenticatedContext(DIR_CLIENT2_UID).firestore();

    // Autorisé : Direction prête de la même entreprise peut uniquement basculer statut (actif <-> desactive)
    await assertSucceeds(updateDoc(doc(dirNsDb, 'login_identifiers', 'CPT-2026-020'), { statut: 'desactive' }));
    await assertSucceeds(updateDoc(doc(dirNsDb, 'login_identifiers', 'CPT-2026-020'), { statut: 'actif' }));

    // Interdit : altération des champs scellés, statut hors enum ou ajout de champ
    await assertFails(updateDoc(doc(dirNsDb, 'login_identifiers', 'CPT-2026-020'), { uid: 'autre_uid' }));
    await assertFails(updateDoc(doc(dirNsDb, 'login_identifiers', 'CPT-2026-020'), { role: 'controleur' }));
    await assertFails(updateDoc(doc(dirNsDb, 'login_identifiers', 'CPT-2026-020'), { loginId: 'CPT-2026-999' }));
    await assertFails(updateDoc(doc(dirNsDb, 'login_identifiers', 'CPT-2026-020'), { entrepriseId: 'CLIENT-002' }));
    await assertFails(updateDoc(doc(dirNsDb, 'login_identifiers', 'CPT-2026-020'), { creeLe: '2025-01-01T00:00:00.000Z' }));
    await assertFails(updateDoc(doc(dirNsDb, 'login_identifiers', 'CPT-2026-020'), { creeParUid: DIR_OTHER_UID }));
    await assertFails(updateDoc(doc(dirNsDb, 'login_identifiers', 'CPT-2026-020'), { statut: 'suspendu' }));
    await assertFails(updateDoc(doc(dirNsDb, 'login_identifiers', 'CPT-2026-020'), { statut: 'desactive', note: 'extra' }));

    // Interdit : Direction sans PIN validé, Comptabilité ou Contrôleur
    await assertFails(getDoc(doc(dirPendingDb, 'login_identifiers', 'CPT-2026-020')));
    await assertFails(updateDoc(doc(dirPendingDb, 'login_identifiers', 'CPT-2026-020'), { statut: 'desactive' }));
    await assertFails(getDoc(doc(comptaDb, 'login_identifiers', 'CPT-2026-020')));
    await assertFails(getDocs(collection(comptaDb, 'login_identifiers')));
    await assertFails(updateDoc(doc(comptaDb, 'login_identifiers', 'CPT-2026-020'), { statut: 'desactive' }));
    await assertFails(getDoc(doc(ctrlDb, 'login_identifiers', 'CPT-2026-020')));
    await assertFails(updateDoc(doc(ctrlDb, 'login_identifiers', 'CPT-2026-020'), { statut: 'desactive' }));

    // Interdit : accès ou mise à jour inter-entreprises dans les deux sens
    await assertFails(getDoc(doc(dirClient2Db, 'login_identifiers', 'CPT-2026-020')));
    await assertFails(updateDoc(doc(dirClient2Db, 'login_identifiers', 'CPT-2026-020'), { statut: 'desactive' }));
    await assertFails(getDoc(doc(dirNsDb, 'login_identifiers', 'CPT-2026-021')));
    await assertFails(updateDoc(doc(dirNsDb, 'login_identifiers', 'CPT-2026-021'), { statut: 'desactive' }));
  });

  // TEST 20 : Couverture complète du rôle Comptabilité (lectures autorisées, écritures interdites, révocation et isolation)
  it('20. Vérifie les permissions complètes du rôle Comptabilité (lectures métier, doitChangerCodeSecret, refus d’écritures et révocation)', async () => {
    const COMPTA_CLIENT2_UID = 'compta_client2_t20';

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      await setDoc(doc(adminDb, 'patrol_rounds_config', 'cfg-compta-1'), {
        id: 'cfg-compta-1',
        siteId: 'site-1',
        nomRonde: 'Ronde Suivi Compta',
        pointsObligatoiresIds: ['cp-ref-1'],
        actif: true,
      });
      await setDoc(doc(adminDb, 'validations_paie', 'val-compta-ns'), {
        id: 'val-compta-ns',
        montantTotal: 1800000,
        statut: 'VALIDEE',
      });
      await setDoc(doc(adminDb, 'validations_paie', 'val-compta-c2'), {
        id: 'val-compta-c2',
        entrepriseId: 'CLIENT-002',
        montantTotal: 950000,
        statut: 'VALIDEE',
      });
      await setDoc(doc(adminDb, 'users', COMPTA_CLIENT2_UID), {
        uid: COMPTA_CLIENT2_UID,
        email: 'cpt-2026-520@acces.nigersecurite.ne',
        loginId: 'CPT-2026-520',
        entrepriseId: 'CLIENT-002',
        nom: 'Comptable Client 2',
        role: 'comptabilite',
        statut: 'actif',
        creeLe: '2026-11-18T00:00:00.000Z',
      });
      await setDoc(doc(adminDb, 'preparations_paie', 'prep-secret-1'), {
        id: 'prep-secret-1',
        montantTotal: 1800000,
      });
    });

    const comptaDb = testEnv.authenticatedContext(COMPTA_UID).firestore();
    const comptaClient2Db = testEnv.authenticatedContext(COMPTA_CLIENT2_UID).firestore();
    const dirDb = testEnv.authenticatedContext(DIR_READY_UID).firestore();

    // Autorisé pour Comptabilité NIGERSECURITE-001 : lectures métier et passage de son propre doitChangerCodeSecret à false
    await assertSucceeds(getDoc(doc(comptaDb, 'patrol_scans', 'scan-ref-1')));
    await assertSucceeds(getDocs(collection(comptaDb, 'patrol_scans')));
    await assertSucceeds(getDoc(doc(comptaDb, 'patrol_checkpoints', 'cp-ref-1')));
    await assertSucceeds(getDocs(collection(comptaDb, 'patrol_checkpoints')));
    await assertSucceeds(getDoc(doc(comptaDb, 'patrol_rounds_config', 'cfg-compta-1')));
    await assertSucceeds(getDocs(collection(comptaDb, 'patrol_rounds_config')));
    await assertSucceeds(getDoc(doc(comptaDb, 'validations_paie', 'val-compta-ns')));
    await assertSucceeds(getDocs(collection(comptaDb, 'validations_paie')));
    await assertSucceeds(updateDoc(doc(comptaDb, 'users', COMPTA_UID), { doitChangerCodeSecret: false }));

    // Interdit pour Comptabilité : auto-modification hors doitChangerCodeSecret=false et toute écriture métier/serveur
    await assertFails(updateDoc(doc(comptaDb, 'users', COMPTA_UID), { doitChangerCodeSecret: true }));
    await assertFails(updateDoc(doc(comptaDb, 'users', COMPTA_UID), { nom: 'AutoModif Compta' }));
    await assertFails(updateDoc(doc(comptaDb, 'users', COMPTA_UID), { statut: 'desactive' }));
    await assertFails(updateDoc(doc(comptaDb, 'users', COMPTA_UID), { entrepriseId: 'CLIENT-002' }));
    await assertFails(updateDoc(doc(comptaDb, 'users', CTRL_UID), { statut: 'desactive' }));
    await assertFails(
      setDoc(doc(comptaDb, 'patrol_scans', 'scan-compta-interdit'), {
        id: 'scan-compta-interdit',
        siteId: 'site-1',
        pointId: 'cp-ref-1',
        controleurId: COMPTA_UID,
        scanneLe: '2026-11-18T09:00:00.000Z',
        statutConformite: 'Conforme',
        statutSynchro: 'synchronise',
        creeLe: '2026-11-18T09:00:00.000Z',
      })
    );
    await assertFails(
      setDoc(doc(comptaDb, 'patrol_checkpoints', 'cp-compta-interdit'), {
        id: 'cp-compta-interdit',
        siteId: 'site-1',
        nom: 'Point Interdit',
        qrPayload: 'CPT-FORBIDDEN',
        estActif: true,
        creeLe: '2026-11-18T09:00:00.000Z',
      })
    );
    await assertFails(updateDoc(doc(comptaDb, 'patrol_checkpoints', 'cp-ref-1'), { nom: 'Modif Compta' }));
    await assertFails(updateDoc(doc(comptaDb, 'patrol_rounds_config', 'cfg-compta-1'), { actif: false }));
    await assertFails(
      setDoc(doc(comptaDb, 'validations_paie', 'val-compta-fraude'), {
        id: 'val-compta-fraude',
        montantTotal: 9999999,
        statut: 'VALIDEE',
      })
    );
    await assertFails(getDoc(doc(comptaDb, 'preparations_paie', 'prep-secret-1')));
    await assertFails(getDoc(doc(comptaDb, 'server_auth_secrets', DIR_READY_UID)));

    // Comptabilité CLIENT-002 : bloquée sur NIGERSECURITE-001 et sur list non filtré, autorisée sur son entreprise filtrée
    await assertFails(getDoc(doc(comptaClient2Db, 'validations_paie', 'val-compta-ns')));
    await assertFails(getDoc(doc(comptaClient2Db, 'patrol_scans', 'scan-ref-1')));
    await assertFails(getDocs(collection(comptaClient2Db, 'validations_paie')));
    await assertSucceeds(getDoc(doc(comptaClient2Db, 'validations_paie', 'val-compta-c2')));
    await assertSucceeds(
      getDocs(query(collection(comptaClient2Db, 'validations_paie'), where('entrepriseId', '==', 'CLIENT-002')))
    );

    // Révocation par la Direction : bloque immédiatement toutes les lectures et mises à jour de la Comptabilité
    await assertSucceeds(updateDoc(doc(dirDb, 'users', COMPTA_UID), { statut: 'desactive' }));
    await assertFails(getDoc(doc(comptaDb, 'validations_paie', 'val-compta-ns')));
    await assertFails(getDocs(collection(comptaDb, 'patrol_scans')));
    await assertFails(updateDoc(doc(comptaDb, 'users', COMPTA_UID), { doitChangerCodeSecret: false }));
  });

  // TEST 21 : Cloisonnement strict entre deux contrôleurs affectés au MÊME site
  it('21. Empêche un contrôleur d’accéder aux données ou scans d’un autre contrôleur même sur un site partagé', async () => {
    const CTRL_B_UID = 'controleur_b_uid';

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      await setDoc(doc(adminDb, 'users', CTRL_B_UID), {
        uid: CTRL_B_UID,
        email: 'ctr-2026-021@acces.nigersecurite.ne',
        loginId: 'CTR-2026-021',
        entrepriseId: 'NIGERSECURITE-001',
        nom: 'Second Contrôleur Terrain',
        role: 'controleur',
        statut: 'actif',
        sitesAssignesIds: ['site-1'], // Même site assigné que CTRL_UID
        creeLe: '2026-11-18T00:00:00.000Z',
      });
      await setDoc(doc(adminDb, 'patrol_scans', 'scan-ctrl-b'), {
        id: 'scan-ctrl-b',
        siteId: 'site-1',
        pointId: 'cp-ref-1',
        controleurId: CTRL_B_UID,
        scanneLe: '2026-11-18T07:30:00.000Z',
        statutConformite: 'Conforme',
        statutSynchro: 'en_attente',
        creeLe: '2026-11-18T07:30:00.000Z',
      });
    });

    const ctrlADb = testEnv.authenticatedContext(CTRL_UID).firestore();
    const ctrlBDb = testEnv.authenticatedContext(CTRL_B_UID).firestore();

    // Autorisé : chaque contrôleur peut mettre à jour les champs techniques de SON propre scan sur son site assigné
    await assertSucceeds(
      updateDoc(doc(ctrlADb, 'patrol_scans', 'scan-ref-1'), {
        statutSynchro: 'synchronise',
        synchroniseLe: '2026-11-18T08:00:00.000Z',
      })
    );
    await assertSucceeds(getDoc(doc(ctrlBDb, 'patrol_scans', 'scan-ctrl-b')));
    await assertSucceeds(
      updateDoc(doc(ctrlBDb, 'patrol_scans', 'scan-ctrl-b'), {
        statutSynchro: 'synchronise',
      })
    );

    // Interdit : CTRL_A ne peut ni lire ni modifier le scan de CTRL_B même sur le même site-1
    await assertFails(getDoc(doc(ctrlADb, 'patrol_scans', 'scan-ctrl-b')));
    await assertFails(updateDoc(doc(ctrlADb, 'patrol_scans', 'scan-ctrl-b'), { statutSynchro: 'synchronise' }));

    // Interdit : usurpation d'un autre controleurId à la création d'un scan
    await assertFails(
      setDoc(doc(ctrlADb, 'patrol_scans', 'scan-usurpation-ctrl-b'), {
        id: 'scan-usurpation-ctrl-b',
        siteId: 'site-1',
        pointId: 'cp-ref-1',
        controleurId: CTRL_B_UID,
        scanneLe: '2026-11-18T08:10:00.000Z',
        statutConformite: 'Conforme',
        statutSynchro: 'synchronise',
        creeLe: '2026-11-18T08:10:00.000Z',
      })
    );

    // Interdit : altération de champs métier sur son propre scan, listage des scans, lecture du profil d'un autre contrôleur ou écriture checkpoints
    await assertFails(updateDoc(doc(ctrlADb, 'patrol_scans', 'scan-ref-1'), { observations: 'Altération interdite' }));
    await assertFails(updateDoc(doc(ctrlADb, 'patrol_scans', 'scan-ref-1'), { statutConformite: 'En retard' }));
    await assertFails(updateDoc(doc(ctrlADb, 'patrol_scans', 'scan-ref-1'), { controleurId: CTRL_B_UID }));
    await assertFails(getDocs(collection(ctrlADb, 'patrol_scans')));
    await assertFails(getDocs(query(collection(ctrlADb, 'patrol_scans'), where('siteId', '==', 'site-1'))));
    await assertFails(getDoc(doc(ctrlADb, 'users', CTRL_B_UID)));
    await assertFails(updateDoc(doc(ctrlADb, 'patrol_checkpoints', 'cp-ref-1'), { nom: 'Modif Contrôleur' }));
  });

  // TEST 22 : Matrice bidirectionnelle complète NIGERSECURITE-001 <-> CLIENT-002 (incluant la limite documentée de Phase A)
  it('22. Vérifie l’isolation bidirectionnelle NIGERSECURITE-001 <-> CLIENT-002 sur toutes les collections', async () => {
    const DIR_CLIENT2_UID = 'dir_client2_t22';
    const CTRL_CLIENT2_UID = 'ctrl_client2_t22';

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      await setDoc(doc(adminDb, 'users', DIR_CLIENT2_UID), {
        uid: DIR_CLIENT2_UID,
        email: 'dir.t22@client2.ne',
        entrepriseId: 'CLIENT-002',
        nom: 'Direction Client 2 T22',
        role: 'direction',
        statut: 'actif',
        doitChangerPin: false,
        creeLe: '2026-11-18T00:00:00.000Z',
      });
      await setDoc(doc(adminDb, 'users', CTRL_CLIENT2_UID), {
        uid: CTRL_CLIENT2_UID,
        email: 'ctr-2026-522@acces.nigersecurite.ne',
        loginId: 'CTR-2026-522',
        entrepriseId: 'CLIENT-002',
        nom: 'Contrôleur Client 2 T22',
        role: 'controleur',
        statut: 'actif',
        sitesAssignesIds: ['site-1'],
        creeLe: '2026-11-18T00:00:00.000Z',
      });
      await setDoc(doc(adminDb, 'login_identifiers', 'CTR-2026-522'), {
        loginId: 'CTR-2026-522',
        uid: CTRL_CLIENT2_UID,
        entrepriseId: 'CLIENT-002',
        role: 'controleur',
        statut: 'actif',
        creeLe: '2026-11-18T00:00:00.000Z',
        creeParUid: DIR_CLIENT2_UID,
      });
      await setDoc(doc(adminDb, 'patrol_checkpoints', 'cp-client2-1'), {
        id: 'cp-client2-1',
        entrepriseId: 'CLIENT-002',
        siteId: 'site-1',
        nom: 'Point Client 2',
        qrPayload: 'C2-PT-001',
        estActif: true,
        creeLe: '2026-11-18T00:00:00.000Z',
      });
      await setDoc(doc(adminDb, 'patrol_rounds_config', 'cfg-client2-1'), {
        id: 'cfg-client2-1',
        entrepriseId: 'CLIENT-002',
        siteId: 'site-1',
        nomRonde: 'Ronde Client 2',
        pointsObligatoiresIds: ['cp-client2-1'],
        actif: true,
      });
      await setDoc(doc(adminDb, 'patrol_scans', 'scan-client2-1'), {
        id: 'scan-client2-1',
        entrepriseId: 'CLIENT-002',
        siteId: 'site-1',
        pointId: 'cp-client2-1',
        controleurId: CTRL_CLIENT2_UID,
        scanneLe: '2026-11-18T07:00:00.000Z',
        statutConformite: 'Conforme',
        statutSynchro: 'en_attente',
        creeLe: '2026-11-18T07:00:00.000Z',
      });
      await setDoc(doc(adminDb, 'validations_paie', 'val-client2-1'), {
        id: 'val-client2-1',
        entrepriseId: 'CLIENT-002',
        montantTotal: 900000,
        statut: 'VALIDEE',
      });
      await setDoc(doc(adminDb, 'patrol_rounds_config', 'cfg-ns-t22'), {
        id: 'cfg-ns-t22',
        siteId: 'site-1',
        nomRonde: 'Ronde NS T22',
        pointsObligatoiresIds: ['cp-ref-1'],
        actif: true,
      });
      await setDoc(doc(adminDb, 'validations_paie', 'val-ns-t22'), {
        id: 'val-ns-t22',
        montantTotal: 1500000,
        statut: 'VALIDEE',
      });
    });

    const dirNsDb = testEnv.authenticatedContext(DIR_READY_UID).firestore();
    const comptaNsDb = testEnv.authenticatedContext(COMPTA_UID).firestore();
    const ctrlNsDb = testEnv.authenticatedContext(CTRL_UID).firestore();
    const dirClient2Db = testEnv.authenticatedContext(DIR_CLIENT2_UID).firestore();
    const ctrlClient2Db = testEnv.authenticatedContext(CTRL_CLIENT2_UID).firestore();

    // A) Sens NIGERSECURITE-001 -> CLIENT-002 : lectures unitaires (get), mises à jour et créations usurpées REFUSÉES
    // Note Phase A : canListEntrepriseDoc tolère encore le list non filtré côté NIGERSECURITE-001 jusqu'à la Phase B.
    await assertFails(getDoc(doc(dirNsDb, 'users', CTRL_CLIENT2_UID)));
    await assertFails(getDoc(doc(dirNsDb, 'login_identifiers', 'CTR-2026-522')));
    await assertFails(getDoc(doc(dirNsDb, 'patrol_scans', 'scan-client2-1')));
    await assertFails(getDoc(doc(dirNsDb, 'patrol_checkpoints', 'cp-client2-1')));
    await assertFails(getDoc(doc(dirNsDb, 'patrol_rounds_config', 'cfg-client2-1')));
    await assertFails(getDoc(doc(dirNsDb, 'validations_paie', 'val-client2-1')));
    await assertFails(updateDoc(doc(dirNsDb, 'users', CTRL_CLIENT2_UID), { statut: 'desactive' }));
    await assertFails(updateDoc(doc(dirNsDb, 'login_identifiers', 'CTR-2026-522'), { statut: 'desactive' }));
    await assertFails(updateDoc(doc(dirNsDb, 'patrol_checkpoints', 'cp-client2-1'), { nom: 'Piraté NS' }));
    await assertFails(updateDoc(doc(dirNsDb, 'patrol_rounds_config', 'cfg-client2-1'), { actif: false }));
    await assertFails(
      setDoc(doc(dirNsDb, 'patrol_checkpoints', 'cp-ns-spoof'), {
        id: 'cp-ns-spoof',
        entrepriseId: 'CLIENT-002',
        siteId: 'site-1',
        nom: 'Usurpation Client 2',
        qrPayload: 'SPOOF-1',
        estActif: true,
        creeLe: '2026-11-18T10:00:00.000Z',
      })
    );
    await assertFails(getDoc(doc(comptaNsDb, 'patrol_scans', 'scan-client2-1')));
    await assertFails(getDoc(doc(comptaNsDb, 'validations_paie', 'val-client2-1')));
    await assertFails(getDoc(doc(ctrlNsDb, 'patrol_checkpoints', 'cp-client2-1')));
    await assertFails(getDoc(doc(ctrlNsDb, 'patrol_rounds_config', 'cfg-client2-1')));
    await assertFails(getDoc(doc(ctrlNsDb, 'patrol_scans', 'scan-client2-1')));
    await assertFails(
      setDoc(doc(ctrlNsDb, 'patrol_scans', 'scan-ns-spoof'), {
        id: 'scan-ns-spoof',
        entrepriseId: 'CLIENT-002',
        siteId: 'site-1',
        pointId: 'cp-ref-1',
        controleurId: CTRL_UID,
        scanneLe: '2026-11-18T10:00:00.000Z',
        statutConformite: 'Conforme',
        statutSynchro: 'synchronise',
        creeLe: '2026-11-18T10:00:00.000Z',
      })
    );

    // B) Sens CLIENT-002 -> NIGERSECURITE-001 : get, update, list non filtré, list filtré NS et créations sans entrepriseId REFUSÉS
    await assertFails(getDoc(doc(dirClient2Db, 'patrol_rounds_config', 'cfg-ns-t22')));
    await assertFails(getDoc(doc(dirClient2Db, 'validations_paie', 'val-ns-t22')));
    await assertFails(updateDoc(doc(dirClient2Db, 'patrol_checkpoints', 'cp-ref-1'), { nom: 'Piraté C2' }));
    await assertFails(updateDoc(doc(dirClient2Db, 'patrol_rounds_config', 'cfg-ns-t22'), { actif: false }));
    await assertFails(getDocs(collection(dirClient2Db, 'patrol_checkpoints')));
    await assertFails(getDocs(collection(dirClient2Db, 'patrol_rounds_config')));
    await assertFails(getDocs(collection(dirClient2Db, 'validations_paie')));
    await assertFails(
      getDocs(query(collection(dirClient2Db, 'users'), where('entrepriseId', '==', 'NIGERSECURITE-001')))
    );
    // Création sans champ entrepriseId refusée hors NIGERSECURITE-001
    await assertFails(
      setDoc(doc(dirClient2Db, 'patrol_checkpoints', 'cp-c2-sans-tenant'), {
        id: 'cp-c2-sans-tenant',
        siteId: 'site-1',
        nom: 'Sans EntrepriseId',
        qrPayload: 'C2-NOTENANT',
        estActif: true,
        creeLe: '2026-11-18T10:00:00.000Z',
      })
    );
    await assertFails(
      setDoc(doc(ctrlClient2Db, 'patrol_scans', 'scan-c2-sans-tenant'), {
        id: 'scan-c2-sans-tenant',
        siteId: 'site-1',
        pointId: 'cp-client2-1',
        controleurId: CTRL_CLIENT2_UID,
        scanneLe: '2026-11-18T10:00:00.000Z',
        statutConformite: 'Conforme',
        statutSynchro: 'synchronise',
        creeLe: '2026-11-18T10:00:00.000Z',
      })
    );
    // Contrôleur CLIENT-002 ne peut pas lister patrol_checkpoints sans filtre entrepriseId == CLIENT-002
    await assertFails(
      getDocs(query(collection(ctrlClient2Db, 'patrol_checkpoints'), where('siteId', '==', 'site-1')))
    );

    // C) Accès légitimes CLIENT-002 -> CLIENT-002 : AUTORISÉS
    await assertSucceeds(
      setDoc(doc(dirClient2Db, 'patrol_checkpoints', 'cp-client2-new'), {
        id: 'cp-client2-new',
        entrepriseId: 'CLIENT-002',
        siteId: 'site-1',
        nom: 'Nouveau Point Client 2',
        qrPayload: 'C2-PT-NEW',
        estActif: true,
        creeLe: '2026-11-18T10:15:00.000Z',
      })
    );
    await assertSucceeds(
      updateDoc(doc(dirClient2Db, 'patrol_checkpoints', 'cp-client2-1'), { nom: 'Point Client 2 Nord' })
    );
    await assertSucceeds(
      getDocs(query(collection(dirClient2Db, 'patrol_checkpoints'), where('entrepriseId', '==', 'CLIENT-002')))
    );
    await assertSucceeds(getDoc(doc(ctrlClient2Db, 'patrol_checkpoints', 'cp-client2-1')));
    await assertSucceeds(
      getDocs(
        query(
          collection(ctrlClient2Db, 'patrol_checkpoints'),
          where('siteId', '==', 'site-1'),
          where('entrepriseId', '==', 'CLIENT-002')
        )
      )
    );
    await assertSucceeds(
      setDoc(doc(ctrlClient2Db, 'patrol_scans', 'scan-client2-new'), {
        id: 'scan-client2-new',
        entrepriseId: 'CLIENT-002',
        siteId: 'site-1',
        pointId: 'cp-client2-1',
        controleurId: CTRL_CLIENT2_UID,
        scanneLe: '2026-11-18T10:20:00.000Z',
        statutConformite: 'Conforme',
        statutSynchro: 'synchronise',
        creeLe: '2026-11-18T10:20:00.000Z',
      })
    );
  });
});


