import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve('.');
const EXPECTED_DB_ID = 'ai-studio-nigerscuritgesti-a57ef5a8-c772-4079-9416-ff825a5303ab';
const EXPECTED_PROJECT_ID = 'dev-almanac-twpgt';

describe('Vérification statique de la configuration et des règles Firestore NigerSécurité', () => {
  const rules = fs.readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8');
  const firebaseJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'firebase.json'), 'utf8'));
  const appletConfig = JSON.parse(fs.readFileSync(path.join(ROOT, 'firebase-applet-config.json'), 'utf8'));
  const blueprint = JSON.parse(fs.readFileSync(path.join(ROOT, 'firebase-blueprint.json'), 'utf8'));
  const clientFirebaseTs = fs.readFileSync(path.join(ROOT, 'src/firebase.ts'), 'utf8');
  const serverPinServiceTs = fs.readFileSync(path.join(ROOT, 'src/server/pinService.ts'), 'utf8');

  it('1. Cible explicitement le projet dev-almanac-twpgt et la base nommée (jamais default)', () => {
    expect(appletConfig.projectId).toBe(EXPECTED_PROJECT_ID);
    expect(appletConfig.firestoreDatabaseId).toBe(EXPECTED_DB_ID);
    expect(firebaseJson.firestore?.database).toBe(EXPECTED_DB_ID);
    expect(firebaseJson.firestore?.rules).toBe('firestore.rules');
    expect(clientFirebaseTs).toContain('getFirestore(app, firebaseConfig.firestoreDatabaseId)');
    expect(serverPinServiceTs).toContain('getFirestore(app, dbId)');
  });

  it('2. Utilise rules_version = 2 avec des accolades et parenthèses équilibrées et sans aucune règle publique', () => {
    expect(rules).toMatch(/^rules_version\s*=\s*'2';/m);
    expect(rules).not.toMatch(/allow\s+(read|write|get|list|create|update|delete)[^;]*:\s*if\s+true\s*;/);

    const openBraces = (rules.match(/\{/g) || []).length;
    const closeBraces = (rules.match(/\}/g) || []).length;
    expect(openBraces).toBe(closeBraces);

    const openParens = (rules.match(/\(/g) || []).length;
    const closeParens = (rules.match(/\)/g) || []).length;
    expect(openParens).toBe(closeParens);
  });

  it('3. Protège /users/{userId} : lecture propre ou Direction prête, création Direction-only subordonnés (CPT/CTR) avec verrou atomique, zéro élévation de rôle et zéro suppression', () => {
    const usersBlockMatch = rules.match(/match\s+\/users\/\{userId\}\s*\{([\s\S]*?)\n\s*allow delete: if false;\n\s*\}/);
    expect(usersBlockMatch).not.toBeNull();
    const usersBlock = usersBlockMatch![1];

    expect(usersBlock).toMatch(/allow\s+get:\s*if\s+isAuthenticated\(\)[\s\S]*request\.auth\.uid\s*==\s*userId[\s\S]*isDirectionReady\(\)/);
    expect(usersBlock).toContain('allow list: if isDirectionReady() && canListEntrepriseDoc(resource.data);');
    // Création strictement limitée à Direction prête + validation staff + verrou atomique login_identifiers
    expect(usersBlock).toContain('isValidStaffUserCreate(userId, request.resource.data)');
    expect(usersBlock).toContain('isDirectionReady()');
    expect(usersBlock).toContain('existsAfter(/databases/$(database)/documents/login_identifiers/$(request.resource.data.loginId))');
    expect(usersBlock).toContain('getAfter(/databases/$(database)/documents/login_identifiers/$(request.resource.data.loginId)).data.entrepriseId == request.resource.data.entrepriseId');
    // Jamais de création de compte Direction côté client
    expect(rules).toContain("data.role in ['comptabilite', 'controleur']");
    expect(rules).toContain("loginId.matches('^CPT-[0-9]{4}-[0-9]{3,4}$')");
    expect(rules).toContain("loginId.matches('^CTR-[0-9]{4}-[0-9]{3,4}$')");
    // Mise à jour Direction limitée aux subordonnés de la même entreprise + mise à jour subordonné actif limitée uniquement à doitChangerCodeSecret == false
    expect(usersBlock).toContain('sameEntrepriseAsDoc(resource.data)');
    expect(usersBlock).toContain("resource.data.role in ['controleur', 'comptabilite']");
    expect(usersBlock).toContain("'doitChangerPin', 'pinHash', 'pinSalt'");
    expect(usersBlock).toContain("'doitChangerCodeSecret', 'loginId', 'entrepriseId', 'creeParUid'");
    expect(usersBlock).toContain("affectedKeys().hasOnly(['doitChangerCodeSecret'])");
    expect(usersBlock).toContain('request.resource.data.doitChangerCodeSecret == false');
    expect(usersBlock).toContain("resource.data.statut == 'actif'");
    expect(usersBlock).not.toMatch(/allow\s+delete:\s*if\s+(?!false;)/);
  });

  it('4. Protège /login_identifiers/{loginId} : accès réservé Direction prête, verrou atomique avec /users, cohérence entrepriseId, zéro suppression et zéro accès public', () => {
    const loginIdsBlockMatch = rules.match(/match\s+\/login_identifiers\/\{loginId\}\s*\{([\s\S]*?)\n\s*\}/);
    expect(loginIdsBlockMatch).not.toBeNull();
    const loginIdsBlock = loginIdsBlockMatch![1];

    expect(loginIdsBlock).toMatch(/allow\s+get:\s*if\s+isAuthenticated\(\)[\s\S]*isValidId\(loginId\)[\s\S]*isDirectionReady\(\)[\s\S]*\(resource\s*==\s*null\s*\|\|\s*sameEntrepriseAsDoc\(resource\.data\)\)/);
    expect(loginIdsBlock).toContain('allow list: if isDirectionReady() && canListEntrepriseDoc(resource.data);');
    expect(loginIdsBlock).toContain('isValidLoginIdentifierCreate(loginId, request.resource.data)');
    expect(loginIdsBlock).toContain('existsAfter(/databases/$(database)/documents/users/$(request.resource.data.uid))');
    expect(loginIdsBlock).toContain('getAfter(/databases/$(database)/documents/users/$(request.resource.data.uid)).data.entrepriseId == request.resource.data.entrepriseId');
    expect(loginIdsBlock).toContain('sameEntrepriseAsDoc(resource.data)');
    expect(loginIdsBlock).toContain("affectedKeys().hasOnly(['statut'])");
    expect(loginIdsBlock).toContain('allow delete: if false;');
  });

  it('5. Préserve toutes les collections protégées et synchronise firebase-blueprint.json', () => {
    const requiredMatches = [
      '/users/{userId}',
      '/login_identifiers/{loginId}',
      '/patrol_scans/{scanId}',
      '/patrol_checkpoints/{checkpointId}',
      '/patrol_rounds_config/{configId}',
      '/server_auth_secrets/{secretId}',
      '/server_auth_lockouts/{lockoutId}',
      '/server_action_tickets/{ticketId}',
      '/server_system_state/{stateId}',
      '/validations_paie/{validationId}',
      '/{document=**}',
    ];

    for (const matchPath of requiredMatches) {
      expect(rules).toContain(`match ${matchPath}`);
    }

    expect(Object.keys(blueprint.firestore)).toEqual(
      expect.arrayContaining([
        '/users/{userId}',
        '/login_identifiers/{loginId}',
        '/patrol_checkpoints/{checkpointId}',
        '/patrol_scans/{scanId}',
        '/patrol_rounds_config/{configId}',
        '/validations_paie/{validationId}',
      ])
    );
    expect(blueprint.entities.UserProfile).toBeDefined();
    expect(blueprint.entities.UserProfile.properties.loginId).toBeDefined();
    expect(blueprint.entities.UserProfile.properties.entrepriseId).toBeDefined();
    expect(blueprint.entities.UserProfile.properties.doitChangerCodeSecret).toBeDefined();
    expect(blueprint.entities.LoginIdentifier).toBeDefined();
    expect(blueprint.entities.LoginIdentifier.properties.entrepriseId).toBeDefined();
    expect(blueprint.entities.PatrolScan.properties.statutSynchro).toBeDefined();
    expect(blueprint.entities.PayrollValidation).toBeDefined();
  });

  it('6. Restreint les lectures et créations/mises à jour de scans et points de ronde aux seuls sites affectés au contrôleur (sitesAssignesIds)', () => {
    expect(rules).toContain('function isSiteAssignedToControleur(siteId)');
    expect(rules).toContain("('sitesAssignesIds' in getUserData())");
    expect(rules).toContain('getUserData().sitesAssignesIds is list');
    expect(rules).toContain('siteId in getUserData().sitesAssignesIds');

    const scansBlockMatch = rules.match(/match\s+\/patrol_scans\/\{scanId\}\s*\{([\s\S]*?)\n\s*allow delete: if false;\n\s*\}/);
    expect(scansBlockMatch).not.toBeNull();
    const scansBlock = scansBlockMatch![1];
    expect(scansBlock).toContain('isSiteAssignedToControleur(resource.data.siteId)');
    expect(scansBlock).toContain('isSiteAssignedToControleur(request.resource.data.siteId)');
    expect(scansBlock).toContain('allow list: if (isDirectionReady() || isCompta()) && canListEntrepriseDoc(resource.data);');
    expect(scansBlock).toContain('request.resource.data.siteId == resource.data.siteId');
    expect(scansBlock).toContain('request.resource.data.controleurId == resource.data.controleurId');
    expect(scansBlock).toContain('sameEntrepriseAsDoc(resource.data)');

    const checkpointsBlockMatch = rules.match(/match\s+\/patrol_checkpoints\/\{checkpointId\}\s*\{([\s\S]*?)\n\s*allow delete: if false;\n\s*\}/);
    expect(checkpointsBlockMatch).not.toBeNull();
    const checkpointsBlock = checkpointsBlockMatch![1];
    expect(checkpointsBlock).toMatch(/allow\s+get:\s*if\s+isValidId\(checkpointId\)[\s\S]*sameEntrepriseAsDoc\(resource\.data\)[\s\S]*isSiteAssignedToControleur\(resource\.data\.siteId\)/);
    expect(checkpointsBlock).toMatch(/allow\s+list:\s*if\s+\(isDirectionReady\(\)\s*\|\|\s*isCompta\(\)\s*\|\|\s*isSiteAssignedToControleur\(resource\.data\.siteId\)\)[\s\S]*canListEntrepriseDoc\(resource\.data\);/);

    const roundsBlockMatch = rules.match(/match\s+\/patrol_rounds_config\/\{configId\}\s*\{([\s\S]*?)\n\s*allow delete: if false;\n\s*\}/);
    expect(roundsBlockMatch).not.toBeNull();
    const roundsBlock = roundsBlockMatch![1];
    expect(roundsBlock).toMatch(/allow\s+get:\s*if\s+isValidId\(configId\)[\s\S]*sameEntrepriseAsDoc\(resource\.data\)[\s\S]*isSiteAssignedToControleur\(resource\.data\.siteId\)/);
    expect(roundsBlock).toMatch(/allow\s+list:\s*if\s+\(isDirectionReady\(\)\s*\|\|\s*isCompta\(\)\s*\|\|\s*isSiteAssignedToControleur\(resource\.data\.siteId\)\)[\s\S]*canListEntrepriseDoc\(resource\.data\);/);
  });

  it('7. Verrouille le changement de contrôleur et cloisonne les données transmises à ControleurSpace dans App.tsx et ControleurSpace.tsx', () => {
    const appTsx = fs.readFileSync(path.join(ROOT, 'src/App.tsx'), 'utf8');
    const controleurSpaceTsx = fs.readFileSync(path.join(ROOT, 'src/components/ControleurSpace.tsx'), 'utf8');

    // App.tsx : seul un utilisateur Direction peut activer canSwitchController
    expect(appTsx).toContain("const canSwitchController = currentUser?.role === 'direction';");
    expect(appTsx).toContain('canSwitchController={canSwitchController}');
    expect(appTsx).toContain('onChangeController={canSwitchController ? (ctrl) => setActiveController(ctrl) : undefined}');

    // App.tsx : ControleurSpace reçoit uniquement les données filtrées aux sites assignés
    expect(appTsx).toMatch(/<ControleurSpace[\s\S]*?sites=\{assignedSites\}[\s\S]*?agents=\{controllerAgents\}[\s\S]*?reports=\{controllerReports\}[\s\S]*?patrolScans=\{controllerPatrolScans\}/);
    // App.tsx : SuiviRondesModule en espace contrôleur et NewReportModal reçoivent les données filtrées
    expect(appTsx).toMatch(/<SuiviRondesModule[\s\S]*?sites=\{assignedSites\}[\s\S]*?scans=\{controllerPatrolScans\}/);
    expect(appTsx).toContain("agents={currentSpace === 'controleur' ? controllerAgents : agents}");

    // ControleurSpace.tsx : canSwitchController vaut false par défaut et conditionne l'affichage du sélecteur
    expect(controleurSpaceTsx).toContain('canSwitchController = false');
    expect(controleurSpaceTsx).toContain('{canSwitchController && onChangeController && (');
    expect(controleurSpaceTsx).toContain('recentScans={controllerScans}');
    // Plus de fuite de rapports par sous-chaîne de nom de contrôleur sur un site non assigné
    expect(controleurSpaceTsx).not.toContain('r.controleurNom.toLowerCase().includes');
  });

  it('8. Phase A multi-entreprises : valide entrepriseId sur création CPT/CTR, cohérence croisée /users <-> /login_identifiers, rétrocompatibilité NIGERSECURITE-001 et immutabilité', () => {
    // Fonctions d'aide Phase A présentes et alignées sur NIGERSECURITE-001
    expect(rules).toContain('function isValidEntrepriseId(val)');
    expect(rules).toContain("val.matches('^[A-Z0-9][A-Z0-9_\\\\-]+$')");
    expect(rules).toContain('function effectiveUserEntrepriseId()');
    expect(rules).toContain('function effectiveDocEntrepriseId(docData)');
    expect(rules).toContain('function sameEntrepriseAsDoc(docData)');
    expect(rules).toContain('function canListEntrepriseDoc(docData)');
    expect(rules).toContain('function isValidIncomingEntrepriseField(data)');
    expect(rules).toContain("'NIGERSECURITE-001'");

    // Création staff (/users) et registre (/login_identifiers) : entrepriseId obligatoire et égal à l'entreprise de la Direction créatrice
    const staffFnMatch = rules.match(/function\s+isValidStaffUserCreate[\s\S]*?\n\s*\}/);
    expect(staffFnMatch).not.toBeNull();
    expect(staffFnMatch![0]).toContain("'uid', 'email', 'loginId', 'entrepriseId', 'nom'");
    expect(staffFnMatch![0]).toContain('isValidEntrepriseId(data.entrepriseId)');
    expect(staffFnMatch![0]).toContain('data.entrepriseId == effectiveUserEntrepriseId()');

    const loginFnMatch = rules.match(/function\s+isValidLoginIdentifierCreate[\s\S]*?\n\s*\}/);
    expect(loginFnMatch).not.toBeNull();
    expect(loginFnMatch![0]).toContain("['loginId', 'uid', 'entrepriseId', 'role', 'statut', 'creeLe', 'creeParUid']");
    expect(loginFnMatch![0]).toContain('isValidEntrepriseId(data.entrepriseId)');
    expect(loginFnMatch![0]).toContain('data.entrepriseId == effectiveUserEntrepriseId()');

    // Immutabilité de entrepriseId sur les mises à jour
    const immutabilityMatches = rules.match(/\(!\('entrepriseId' in resource\.data\) \|\| request\.resource\.data\.entrepriseId == resource\.data\.entrepriseId\)/g) || [];
    expect(immutabilityMatches.length).toBeGreaterThanOrEqual(6);

    // Validations de paie : lecture cloisonnée par entreprise, écriture toujours strictement interdite côté client
    const payrollBlockMatch = rules.match(/match\s+\/validations_paie\/\{validationId\}\s*\{([\s\S]*?)\n\s*\}/);
    expect(payrollBlockMatch).not.toBeNull();
    expect(payrollBlockMatch![1]).toContain('sameEntrepriseAsDoc(resource.data)');
    expect(payrollBlockMatch![1]).toContain('canListEntrepriseDoc(resource.data)');
    expect(payrollBlockMatch![1]).toContain('allow write: if false;');

    // Sécurité : aucune règle de création ne doit affaiblir les collections serveur
    expect(rules).toMatch(/match\s+\/server_auth_secrets\/\{secretId\}\s*\{\s*allow read, write: if false;\s*\}/);
    expect(rules).toMatch(/match\s+\/server_auth_lockouts\/\{lockoutId\}\s*\{\s*allow read, write: if false;\s*\}/);
    expect(rules).toMatch(/match\s+\/server_action_tickets\/\{ticketId\}\s*\{\s*allow read, write: if false;\s*\}/);
    expect(rules).toMatch(/match\s+\/server_system_state\/\{stateId\}\s*\{\s*allow read, write: if false;\s*\}/);
    expect(rules).toMatch(/match\s+\/preparations_paie\/\{prepId\}\s*\{\s*allow read, write: if false;\s*\}/);
  });

  it('9. Interdit statiquement toute suppression côté client (allow delete: if false) sur chaque collection métier et verrouille le repli par défaut', () => {
    // Aucune clause allow delete autre que "if false;" ne doit exister dans le fichier
    expect(rules).not.toMatch(/allow\s+delete:\s*if\s+(?!false;)/);

    const noDeleteCollections = [
      '/users/{userId}',
      '/login_identifiers/{loginId}',
      '/patrol_scans/{scanId}',
      '/patrol_checkpoints/{checkpointId}',
      '/patrol_rounds_config/{configId}',
    ];

    for (const collectionPath of noDeleteCollections) {
      const escaped = collectionPath.replace(/[/{}]/g, '\\$&');
      const blockRegex = new RegExp(`match\\s+${escaped}\\s*\\{[\\s\\S]*?allow delete: if false;\\s*\\}`);
      expect(rules).toMatch(blockRegex);
    }

    // Validations de paie et repli global strictement fermés en écriture/suppression
    expect(rules).toMatch(/match\s+\/validations_paie\/\{validationId\}\s*\{[\s\S]*?allow write: if false;\s*\}/);
    expect(rules).toMatch(/match\s+\/\{document=\*\*\}\s*\{\s*allow read, write: if false;\s*\}/);
  });
});

