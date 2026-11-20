import {
  collection,
  doc,
  setDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { ScanPointControle, PointControleSite, ProgrammeRondeSite } from '../types';
import { STORAGE_KEYS, safeLoadFromStorage, safeSaveToStorage } from '../utils/storageUtils';

/**
 * Service de synchronisation des rondes entre le terrain (Contrôleurs) et le siège (Direction).
 * Fonctionne en architecture "Offline-First" :
 * 1. Consigne immédiatement le scan dans le localStorage du smartphone (garantie 100% hors-ligne).
 * 2. Transmet le scan de manière transparente à Firestore dès que le réseau est accessible.
 * 3. Assure une écriture idempotente (clé unique) pour éliminer tout risque de doublon.
 */

// Écouteur en temps réel pour l'espace Direction
export function subscribeToLivePatrolScans(
  onUpdate: (scans: ScanPointControle[]) => void,
  onError?: (err: any) => void
): () => void {
  try {
    const scansRef = collection(db, 'patrol_scans');
    const q = query(scansRef, orderBy('scanneLe', 'desc'), limit(150));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const liveScans: ScanPointControle[] = [];
        snapshot.forEach((docSnap) => {
          liveScans.push(docSnap.data() as ScanPointControle);
        });

        // Fusionner avec les scans locaux en attente
        const localScansRes = safeLoadFromStorage<ScanPointControle[]>(STORAGE_KEYS.PATROL_SCANS, []);
        const mergedMap = new Map<string, ScanPointControle>();

        // Les scans locaux prédominent s'ils sont plus récents ou en attente
        localScansRes.data.forEach((s) => mergedMap.set(s.id, s));
        liveScans.forEach((s) => mergedMap.set(s.id, s));

        const result = Array.from(mergedMap.values()).sort(
          (a, b) => new Date(b.scanneLe).getTime() - new Date(a.scanneLe).getTime()
        );

        onUpdate(result);
      },
      (err) => {
        console.warn('[NIGER SÉCURITÉ Sync] Écoute Firestore en mode dégradé local:', err);
        // Fallback local en cas de problème réseau
        const fallback = safeLoadFromStorage<ScanPointControle[]>(STORAGE_KEYS.PATROL_SCANS, []).data;
        onUpdate(fallback);
        if (onError) onError(err);
      }
    );

    return unsubscribe;
  } catch (err) {
    console.error('[NIGER SÉCURITÉ Sync] Erreur initialisation abonnement scans:', err);
    const fallback = safeLoadFromStorage<ScanPointControle[]>(STORAGE_KEYS.PATROL_SCANS, []).data;
    onUpdate(fallback);
    return () => {};
  }
}

/**
 * Enregistre un scan de ronde avec priorité locale et synchronisation Firestore en tâche de fond.
 */
export async function recordPatrolScan(scan: ScanPointControle): Promise<{
  success: boolean;
  synced: boolean;
  scan: ScanPointControle;
}> {
  // 1. Sauvegarde locale immédiate (Offline-First)
  const currentScans = safeLoadFromStorage<ScanPointControle[]>(STORAGE_KEYS.PATROL_SCANS, []).data;
  const existingIdx = currentScans.findIndex((s) => s.id === scan.id);
  const updatedScans = existingIdx >= 0
    ? currentScans.map((s, idx) => (idx === existingIdx ? scan : s))
    : [scan, ...currentScans];

  safeSaveToStorage(STORAGE_KEYS.PATROL_SCANS, updatedScans);

  // Ajouter à la file d'attente hors-ligne si non synchronisé
  const offlineQueue = safeLoadFromStorage<ScanPointControle[]>(STORAGE_KEYS.OFFLINE_SCANS, []).data;
  if (!offlineQueue.some((s) => s.id === scan.id)) {
    safeSaveToStorage(STORAGE_KEYS.OFFLINE_SCANS, [...offlineQueue, scan]);
    notifyQueueChanged();
  }

  // Si l'appareil est hors-ligne (Wi-Fi et données coupés), retour IMMÉDIAT garanti
  // Le pointage est déjà en sécurité dans la mémoire locale et dans la file d'attente.
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { success: true, synced: false, scan };
  }

  // Verrou de sécurité Firebase Auth : aucun envoi Firestore si aucun utilisateur connecté
  // ou si le scan n'appartient pas au compte Firebase actuellement authentifié (ex: scans démo).
  const currentFirebaseUser = auth.currentUser;
  if (!currentFirebaseUser || scan.controleurId !== currentFirebaseUser.uid) {
    return { success: true, synced: false, scan };
  }

  // 2. Tentative de transmission vers Firestore UNIQUEMENT si connecté et authentifié, avec timeout strict de 2000ms
  try {
    const scanDocRef = doc(db, 'patrol_scans', scan.id);
    const payloadToCloud = {
      ...scan,
      statutSynchro: 'synchronise' as const,
      synchroniseLe: new Date().toISOString(),
    };

    // Timeout strict de 2 secondes : ne JAMAIS faire attendre l'interface sur le terrain
    const networkTimeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout réseau Firestore')), 2000)
    );

    await Promise.race([
      setDoc(scanDocRef, payloadToCloud, { merge: true }),
      networkTimeout,
    ]);

    // Succès cloud : mettre à jour le statut local
    const finalScan: ScanPointControle = { ...scan, statutSynchro: 'synchronise' };
    const syncedList = updatedScans.map((s) => (s.id === scan.id ? finalScan : s));
    safeSaveToStorage(STORAGE_KEYS.PATROL_SCANS, syncedList);

    // Retirer de la file hors-ligne (uniquement après résolution réussie de setDoc)
    const remainingQueue = safeLoadFromStorage<ScanPointControle[]>(STORAGE_KEYS.OFFLINE_SCANS, [])
      .data.filter((s) => s.id !== scan.id);
    safeSaveToStorage(STORAGE_KEYS.OFFLINE_SCANS, remainingQueue);
    notifyQueueChanged();

    return { success: true, synced: true, scan: finalScan };
  } catch (cloudErr) {
    console.warn('[NIGER SÉCURITÉ Sync] Réseau indisponible ou lent, scan conservé hors-ligne:', cloudErr);
    return { success: true, synced: false, scan };
  }
}

/**
 * Tente de vider la file d'attente hors-ligne et synchronise tous les scans en attente vers Firestore.
 */
export async function flushOfflineScansQueue(): Promise<{
  syncedCount: number;
  remainingCount: number;
}> {
  const offlineQueue = safeLoadFromStorage<ScanPointControle[]>(STORAGE_KEYS.OFFLINE_SCANS, []).data;
  if (offlineQueue.length === 0) {
    return { syncedCount: 0, remainingCount: 0 };
  }

  // Ne pas tenter l'envoi si le téléphone est hors-ligne
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { syncedCount: 0, remainingCount: offlineQueue.length };
  }

  // Verrou de sécurité Firebase Auth : aucun envoi Firestore si aucun utilisateur connecté
  const currentFirebaseUser = auth.currentUser;
  if (!currentFirebaseUser) {
    return { syncedCount: 0, remainingCount: offlineQueue.length };
  }

  let syncedCount = 0;
  const remaining: ScanPointControle[] = [];

  for (const scan of offlineQueue) {
    // Si le scan appartient à un autre contrôleur ou provient de la démo,
    // on le conserve intact dans la file locale sans l'envoyer et sans bloquer les autres scans
    if (scan.controleurId !== currentFirebaseUser.uid) {
      remaining.push(scan);
      continue;
    }

    try {
      const scanDocRef = doc(db, 'patrol_scans', scan.id);
      const networkTimeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout synchro')), 2500)
      );
      await Promise.race([
        setDoc(
          scanDocRef,
          {
            ...scan,
            statutSynchro: 'synchronise',
            synchroniseLe: new Date().toISOString(),
          },
          { merge: true }
        ),
        networkTimeout,
      ]);
      syncedCount++;
    } catch (err: any) {
      // Détecter un refus de sécurité explicite Firestore (ex: compte désactivé par la Direction)
      const isPermissionDenied =
        err?.code === 'permission-denied' ||
        err?.message?.includes('permission-denied') ||
        err?.message?.includes('Missing or insufficient permissions');

      if (isPermissionDenied) {
        console.warn(`[NIGER SÉCURITÉ Sync] Scan ${scan.id} refusé par Firestore (permission-denied). Sauvegarde sécurisée dans le sas local.`);
        // Procédure de copie préalable sécurisée : on enregistre d'abord dans REJECTED_SCANS
        const currentRejected = safeLoadFromStorage<ScanPointControle[]>(STORAGE_KEYS.REJECTED_SCANS, []).data;
        const existsAlready = currentRejected.some((r) => r.id === scan.id);
        const updatedRejected = existsAlready
          ? currentRejected
          : [
              ...currentRejected,
              {
                ...scan,
                observations: (scan.observations || '') + ' [Refusé par Firestore : compte non actif ou non autorisé]',
              },
            ];

        const saveRes = safeSaveToStorage(STORAGE_KEYS.REJECTED_SCANS, updatedRejected);
        if (saveRes) {
          // Si et seulement si l'enregistrement dans le sas a réussi avec certitude,
          // on évite de renvoyer le scan dans OFFLINE_SCANS pour stopper la boucle infinie de rejet.
          // Le scan reste conservé à 100% dans STORAGE_KEYS.PATROL_SCANS et STORAGE_KEYS.REJECTED_SCANS.
          continue;
        }
      }

      // En cas d'erreur réseau, timeout ou si la sauvegarde dans le sas a échoué,
      // on conserve impérativement le scan dans la file d'attente locale (aucune donnée perdue).
      remaining.push(scan);
    }
  }

  safeSaveToStorage(STORAGE_KEYS.OFFLINE_SCANS, remaining);
  notifyQueueChanged();

  // Mettre à jour la liste générale locale
  if (syncedCount > 0) {
    const allScans = safeLoadFromStorage<ScanPointControle[]>(STORAGE_KEYS.PATROL_SCANS, []).data;
    const remainingIds = new Set(remaining.map((r) => r.id));
    const updatedAll = allScans.map((s) => {
      if (!remainingIds.has(s.id) && s.statutSynchro === 'en_attente') {
        return { ...s, statutSynchro: 'synchronise' as const };
      }
      return s;
    });
    safeSaveToStorage(STORAGE_KEYS.PATROL_SCANS, updatedAll);
  }

  return { syncedCount, remainingCount: remaining.length };
}

/**
 * Récupère la liste des pointages conservés dans le sas des scans rejetés.
 */
export function getRejectedScans(): ScanPointControle[] {
  return safeLoadFromStorage<ScanPointControle[]>(STORAGE_KEYS.REJECTED_SCANS, []).data;
}

/**
 * Exporte l'ensemble des pointages rejetés au format JSON pour transmission administrative.
 */
export function exportRejectedScansToJson(): string {
  const rejected = getRejectedScans();
  return JSON.stringify(rejected, null, 2);
}

// Gestion des observateurs réactifs pour la file d'attente hors-ligne
type QueueListener = (queue: ScanPointControle[]) => void;
const queueListeners: Set<QueueListener> = new Set();

export function getOfflineQueue(): ScanPointControle[] {
  return safeLoadFromStorage<ScanPointControle[]>(STORAGE_KEYS.OFFLINE_SCANS, []).data;
}

export function getOfflineQueueCount(): number {
  return getOfflineQueue().length;
}

export function subscribeToOfflineQueue(listener: QueueListener): () => void {
  queueListeners.add(listener);
  // Émission initiale immédiate
  try {
    listener(getOfflineQueue());
  } catch (e) {
    console.warn('[NIGER SÉCURITÉ Sync] Erreur émission initiale file:', e);
  }

  return () => {
    queueListeners.delete(listener);
  };
}

function notifyQueueChanged() {
  const currentQueue = getOfflineQueue();
  queueListeners.forEach((listener) => {
    try {
      listener(currentQueue);
    } catch (e) {
      console.warn('[NIGER SÉCURITÉ Sync] Erreur notification auditeur file:', e);
    }
  });
}

// Synchronisation automatique native au rétablissement de la connexion
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[NIGER SÉCURITÉ Sync] Connexion rétablie (online). Déclenchement de la synchronisation automatique...');
    flushOfflineScansQueue().catch((err) => {
      console.warn('[NIGER SÉCURITÉ Sync] Échec synchro automatique de reconnexion:', err);
    });
  });
}

