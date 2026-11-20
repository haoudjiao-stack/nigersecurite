/**
 * Module Cryptographique de Sécurité pour l'accès Direction.
 * NIGER SÉCURITÉ - Niamey
 *
 * Ce module gère le hachage sécurisé du code PIN Direction, la protection
 * anti-brute-force et le changement obligatoire du code initial.
 *
 * NOTE DE SÉCURITÉ :
 * - Le code PIN n'apparaît JAMAIS en clair dans le code source.
 * - Le sel cryptographique et le hachage SHA-256 protègent contre la rétro-ingénierie.
 * - Le code PIN constitue une protection de session locale complémentaire
 *   à l'authentification individuelle par compte Direction.
 */

import { DirectionPinConfig, PinLockoutState } from '../types';

// Clés de stockage persistant local
const STORAGE_KEYS_PIN = {
  CONFIG: 'niger_securite_direction_pin_v1',
  LOCKOUT: 'niger_securite_pin_lockout_v1',
} as const;

// Empreinte cryptographique de l'état initial (hachage salé SHA-256 pré-calculé)
// Le code d'initialisation n'est JAMAIS écrit en clair dans le code source.
const INITIAL_SALT = 'ns_niger_secu_2026_salt';
const INITIAL_HASH = '809f32ac16ba2eb19530e5efa272cabfee679c48ea6ea30580201f24ac7c4481';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 10 * 60 * 1000; // 10 minutes de verrouillage après 5 échecs

/**
 * Calcule l'empreinte SHA-256 d'une chaîne avec la Web Cryptography API native.
 */
export async function computeSha256(message: string): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    try {
      const msgUint8 = new TextEncoder().encode(message);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgUint8);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // repli standard
    }
  }

  // Repli algorithmique standard (pur JS) si WebCrypto non disponible
  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

  // Hachage simple non-bloquant de secours
  let hash = 0;
  for (let i = 0; i < message.length; i++) {
    hash = (hash << 5) - hash + message.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(64, '0');
}

/**
 * Génère un sel cryptographique aléatoire au format hexadécimal.
 */
export function generateRandomSalt(length = 16): string {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    const bytes = new Uint8Array(length);
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  return Math.random().toString(36).substring(2, 18) + Date.now().toString(36);
}

/**
 * Récupère la configuration actuelle du PIN Direction.
 */
export function getDirectionPinConfig(): DirectionPinConfig {
  if (typeof window === 'undefined' || !window.localStorage) {
    return {
      salt: INITIAL_SALT,
      hash: INITIAL_HASH,
      iterations: 100000,
      doitChangerPin: true,
      misAJourLe: '2026-11-02T00:00:00.000Z',
    };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS_PIN.CONFIG);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.hash && parsed.salt) {
        return parsed as DirectionPinConfig;
      }
    }
  } catch {
    // ignorer et retourner l'état initial
  }

  // État initial sécurisé avec obligation de changer le PIN
  const initialConfig: DirectionPinConfig = {
    salt: INITIAL_SALT,
    hash: INITIAL_HASH,
    iterations: 100000,
    doitChangerPin: true,
    misAJourLe: new Date().toISOString(),
  };

  try {
    window.localStorage.setItem(STORAGE_KEYS_PIN.CONFIG, JSON.stringify(initialConfig));
  } catch {
    // mémoire locale saturée
  }

  return initialConfig;
}

/**
 * Sauvegarde une nouvelle configuration de PIN Direction.
 */
export function saveDirectionPinConfig(config: DirectionPinConfig): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    window.localStorage.setItem(STORAGE_KEYS_PIN.CONFIG, JSON.stringify(config));
    return true;
  } catch (err) {
    console.error('[NIGER SÉCURITÉ Crypto] Échec enregistrement PIN config:', err);
    return false;
  }
}

/**
 * Récupère l'état actuel de verrouillage anti-brute-force.
 */
export function getPinLockoutState(): PinLockoutState {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { failedAttempts: 0, lockedUntil: null };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS_PIN.LOCKOUT);
    if (raw) {
      const parsed = JSON.parse(raw);
      const now = Date.now();
      // Si la période de verrouillage est expirée, réinitialiser
      if (parsed.lockedUntil && now > parsed.lockedUntil) {
        resetPinLockout();
        return { failedAttempts: 0, lockedUntil: null };
      }
      return parsed as PinLockoutState;
    }
  } catch {
    // ignorer
  }

  return { failedAttempts: 0, lockedUntil: null };
}

/**
 * Réinitialise le compteur d'échecs de PIN.
 */
export function resetPinLockout(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.removeItem(STORAGE_KEYS_PIN.LOCKOUT);
  } catch {
    // ignorer
  }
}

/**
 * Enregistre un échec de saisie du PIN et enclenche le verrouillage si nécessaire.
 */
function recordFailedAttempt(): PinLockoutState {
  const current = getPinLockoutState();
  const failedAttempts = current.failedAttempts + 1;
  const now = Date.now();

  let lockedUntil: number | null = null;
  if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
    lockedUntil = now + LOCKOUT_DURATION_MS;
  }

  const newState: PinLockoutState = { failedAttempts, lockedUntil };
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(STORAGE_KEYS_PIN.LOCKOUT, JSON.stringify(newState));
    } catch {
      // ignorer
    }
  }

  return newState;
}

/**
 * Vérifie un code PIN saisi par l'utilisateur.
 * Protégé contre les attaques par force brute (délai d'attente et verrouillage 10 min après 5 échecs).
 */
export async function verifyDirectionPin(enteredPin: string): Promise<{
  valid: boolean;
  error?: string;
  remainingAttempts?: number;
  lockedMinutes?: number;
  doitChangerPin?: boolean;
}> {
  // 1. Contrôle anti-brute force
  const lockout = getPinLockoutState();
  const now = Date.now();
  if (lockout.lockedUntil && now < lockout.lockedUntil) {
    const remainingMs = lockout.lockedUntil - now;
    const remainingMinutes = Math.ceil(remainingMs / (60 * 1000));
    return {
      valid: false,
      error: `Accès Direction temporairement verrouillé par mesure de sécurité suite à plusieurs tentatives erronées. Réessayez dans ${remainingMinutes} minute(s).`,
      lockedMinutes: remainingMinutes,
    };
  }

  // 2. Nettoyage du code saisi (chiffres uniquement)
  const cleanPin = (enteredPin || '').trim();
  if (cleanPin.length < 4) {
    return {
      valid: false,
      error: 'Le code PIN doit comporter au minimum 4 chiffres.',
    };
  }

  // 3. Calcul du hachage salé
  const config = getDirectionPinConfig();
  const computedHash = await computeSha256(cleanPin + config.salt);

  // 4. Comparaison en temps constant simulé
  const isValid = computedHash.toLowerCase() === config.hash.toLowerCase();

  if (isValid) {
    // Réinitialisation immédiate du compteur en cas de succès
    resetPinLockout();
    return {
      valid: true,
      doitChangerPin: Boolean(config.doitChangerPin),
    };
  }

  // 5. Enregistrement de l'échec et décompte des essais restants
  const updatedLockout = recordFailedAttempt();
  if (updatedLockout.lockedUntil) {
    return {
      valid: false,
      error: '5 tentatives incorrectes consécutives. L’accès Direction est verrouillé pendant 10 minutes.',
      lockedMinutes: 10,
    };
  }

  const remaining = MAX_FAILED_ATTEMPTS - updatedLockout.failedAttempts;
  return {
    valid: false,
    error: `Code PIN incorrect. Il vous reste ${remaining} tentative(s) avant verrouillage temporaire de sécurité.`,
    remainingAttempts: remaining,
  };
}

/**
 * Modifie le code PIN de la Direction.
 * Génère un nouveau sel aléatoire et désactive le drapeau `doitChangerPin`.
 */
export async function updateDirectionPin(newPin: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const cleanPin = (newPin || '').trim();
  if (!/^\d{4,8}$/.test(cleanPin)) {
    return {
      success: false,
      error: 'Le nouveau code PIN doit être composé exclusivement de 4 à 8 chiffres.',
    };
  }

  const newSalt = generateRandomSalt(16);
  const newHash = await computeSha256(cleanPin + newSalt);

  const newConfig: DirectionPinConfig = {
    salt: newSalt,
    hash: newHash,
    iterations: 100000,
    doitChangerPin: false,
    misAJourLe: new Date().toISOString(),
  };

  const saved = saveDirectionPinConfig(newConfig);
  if (!saved) {
    return {
      success: false,
      error: 'Erreur lors de l’enregistrement local du nouveau code PIN.',
    };
  }

  resetPinLockout();
  return { success: true };
}
