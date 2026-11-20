/**
 * Utilitaires purs de gestion et validation des identifiants de connexion
 * NIGER SÉCURITÉ - Niamey
 *
 * Conventions officielles :
 * - Direction   : adresse e-mail professionnelle + mot de passe
 * - Comptable   : CPT-AAAA-XXX (ex: CPT-2026-001) + code secret personnel (>= 6 caractères)
 * - Contrôleur  : CTR-AAAA-XXX (ex: CTR-2026-001) + code secret personnel (>= 6 caractères)
 *
 * Ces identifiants de connexion sont strictement distincts des matricules RH des agents
 * de sécurité (NS-2026-XXXX) utilisés pour les badges et bulletins de paie.
 */

import { StaffAccountRole } from '../types';

export const INTERNAL_LOGIN_DOMAIN = 'acces.nigersecurite.ne';

export const STAFF_LOGIN_ID_REGEX = /^(CPT|CTR)-[0-9]{4}-[0-9]{3,4}$/;
export const COMPTABLE_LOGIN_ID_REGEX = /^CPT-[0-9]{4}-[0-9]{3,4}$/;
export const CONTROLEUR_LOGIN_ID_REGEX = /^CTR-[0-9]{4}-[0-9]{3,4}$/;

const WEAK_SECRET_CODES = new Set([
  '000000',
  '111111',
  '222222',
  '333333',
  '444444',
  '555555',
  '666666',
  '777777',
  '888888',
  '999999',
  '123456',
  '654321',
  '12345678',
  '123123',
  '012345',
  'abcdef',
  'azerty',
  'qwerty',
  'password',
  'motdepasse',
  'nigersecurite',
  'admin123',
]);

export function normalizeLoginIdentifier(raw: string): string {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

export function getPrefixForStaffRole(role: StaffAccountRole): 'CPT' | 'CTR' {
  return role === 'comptabilite' ? 'CPT' : 'CTR';
}

export function getRoleFromLoginIdentifier(rawLoginId: string): StaffAccountRole | null {
  const normalized = normalizeLoginIdentifier(rawLoginId);
  if (COMPTABLE_LOGIN_ID_REGEX.test(normalized)) return 'comptabilite';
  if (CONTROLEUR_LOGIN_ID_REGEX.test(normalized)) return 'controleur';
  return null;
}

export function validateLoginIdentifierForRole(
  rawLoginId: string,
  role: StaffAccountRole
): { valid: boolean; normalized: string; error?: string } {
  const normalized = normalizeLoginIdentifier(rawLoginId);
  const expectedPrefix = getPrefixForStaffRole(role);

  if (!normalized) {
    return {
      valid: false,
      normalized,
      error: `Veuillez saisir un identifiant au format ${expectedPrefix}-2026-001.`,
    };
  }

  const regex = role === 'comptabilite' ? COMPTABLE_LOGIN_ID_REGEX : CONTROLEUR_LOGIN_ID_REGEX;
  if (!regex.test(normalized)) {
    return {
      valid: false,
      normalized,
      error:
        role === 'comptabilite'
          ? 'Format invalide pour un Comptable. Exemple attendu : CPT-2026-001.'
          : 'Format invalide pour un Contrôleur. Exemple attendu : CTR-2026-001.',
    };
  }

  return { valid: true, normalized };
}

/**
 * Conversion déterministe d'un identifiant CPT-/CTR- vers son identifiant technique Firebase Auth.
 * Aucune lecture Firestore non authentifiée n'est requise avant la connexion.
 */
export function loginIdentifierToAuthEmail(rawLoginId: string): string {
  const normalized = normalizeLoginIdentifier(rawLoginId);
  if (!STAFF_LOGIN_ID_REGEX.test(normalized)) {
    throw new Error('Identifiant de connexion invalide pour la conversion technique.');
  }
  return `${normalized.toLowerCase()}@${INTERNAL_LOGIN_DOMAIN}`;
}

export interface ResolvedLoginInput {
  valid: boolean;
  inputType?: 'email' | 'login_id';
  authEmail?: string;
  loginId?: string;
  expectedRole?: StaffAccountRole;
  error?: string;
}

/**
 * Résout la saisie du formulaire de connexion :
 * - Contient '@' -> connexion par e-mail (Direction)
 * - Format CPT-AAAA-XXX ou CTR-AAAA-XXX -> connexion Comptable / Contrôleur
 */
export function resolveLoginInputToAuthEmail(rawInput: string): ResolvedLoginInput {
  const trimmed = String(rawInput || '').trim();
  if (!trimmed) {
    return {
      valid: false,
      error: 'Veuillez saisir votre adresse e-mail (Direction) ou votre identifiant unique (CPT-2026-XXX / CTR-2026-XXX).',
    };
  }

  if (trimmed.includes('@')) {
    const email = trimmed.toLowerCase();
    // Validation minimale de format d'e-mail
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return {
        valid: false,
        error: 'Adresse e-mail invalide. Veuillez vérifier votre saisie.',
      };
    }
    return {
      valid: true,
      inputType: 'email',
      authEmail: email,
    };
  }

  const normalized = normalizeLoginIdentifier(trimmed);
  const expectedRole = getRoleFromLoginIdentifier(normalized);
  if (!expectedRole) {
    return {
      valid: false,
      error:
        'Format d’identifiant non reconnu. Utilisez une adresse e-mail (Direction) ou un identifiant attribué du type CPT-2026-001 ou CTR-2026-001.',
    };
  }

  return {
    valid: true,
    inputType: 'login_id',
    loginId: normalized,
    expectedRole,
    authEmail: `${normalized.toLowerCase()}@${INTERNAL_LOGIN_DOMAIN}`,
  };
}

/**
 * Valide un code secret personnel (Comptable / Contrôleur) :
 * - Minimum 6 caractères, maximum 64 caractères
 * - Pas d'espaces en début/fin
 * - Rejette les suites triviales ou répétitives
 */
export function validateSecretCode(secret: string): { valid: boolean; error?: string } {
  if (typeof secret !== 'string' || secret.length === 0) {
    return { valid: false, error: 'Veuillez saisir un code secret personnel.' };
  }

  if (secret !== secret.trim()) {
    return {
      valid: false,
      error: 'Le code secret ne doit pas commencer ni se terminer par un espace.',
    };
  }

  if (secret.length < 6) {
    return {
      valid: false,
      error: 'Le code secret doit comporter au moins 6 caractères.',
    };
  }

  if (secret.length > 64) {
    return {
      valid: false,
      error: 'Le code secret ne doit pas dépasser 64 caractères.',
    };
  }

  const lower = secret.toLowerCase();
  if (WEAK_SECRET_CODES.has(lower)) {
    return {
      valid: false,
      error: 'Ce code secret est trop prévisible. Choisissez une combinaison plus sécurisée.',
    };
  }

  // Rejeter les codes composés d'un seul caractère répété (ex: aaaaaa, 777777)
  if (/^(.)\1+$/.test(lower)) {
    return {
      valid: false,
      error: 'Le code secret ne peut pas être composé d’un seul caractère répété.',
    };
  }

  return { valid: true };
}

/**
 * Suggère le prochain identifiant séquentiel libre pour le rôle demandé (ex: CPT-2026-001, CTR-2026-001).
 */
export function suggestNextLoginIdentifier(
  role: StaffAccountRole,
  existingLoginIds: string[],
  year: number = new Date().getFullYear()
): string {
  const prefix = getPrefixForStaffRole(role);
  const pattern = new RegExp(`^${prefix}-${year}-([0-9]{3,4})$`);

  let maxNum = 0;
  for (const raw of existingLoginIds) {
    const normalized = normalizeLoginIdentifier(raw);
    const match = normalized.match(pattern);
    if (match) {
      const parsed = parseInt(match[1], 10);
      if (Number.isFinite(parsed) && parsed > maxNum) {
        maxNum = parsed;
      }
    }
  }

  const nextNum = maxNum + 1;
  const padded = nextNum >= 1000 ? String(nextNum) : String(nextNum).padStart(3, '0');
  return `${prefix}-${year}-${padded}`;
}

/**
 * Génère un code secret initial robuste (alphanumérique sans caractères ambigus) côté client uniquement.
 * Jamais enregistré dans Firestore.
 */
export function generateStrongSecretCode(length: number = 8): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const all = upper + lower + digits;
  const targetLen = Math.max(6, Math.min(24, length));

  const randomIndex = (max: number): number => {
    if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
      const arr = new Uint32Array(1);
      globalThis.crypto.getRandomValues(arr);
      return arr[0] % max;
    }
    return Math.floor(Math.random() * max);
  };

  // Garantit au moins 1 majuscule, 1 minuscule et 2 chiffres
  const chars: string[] = [
    upper[randomIndex(upper.length)],
    lower[randomIndex(lower.length)],
    digits[randomIndex(digits.length)],
    digits[randomIndex(digits.length)],
  ];

  while (chars.length < targetLen) {
    chars.push(all[randomIndex(all.length)]);
  }

  // Mélange Fisher-Yates
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    const tmp = chars[i];
    chars[i] = chars[j];
    chars[j] = tmp;
  }

  return chars.join('');
}
