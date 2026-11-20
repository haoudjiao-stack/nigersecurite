/**
 * Utilitaires d'identification et de compatibilité multi-entreprises (étape préparatoire).
 * NIGER SÉCURITÉ - Niamey
 *
 * - Identifiant interne officiel du premier client : `NIGERSECURITE-001`.
 * - Assure la rétrocompatibilité sans blocage de connexion pour les comptes existants
 *   qui ne disposent pas encore du champ `entrepriseId` dans Firestore.
 */

export const DEFAULT_ENTREPRISE_ID = 'NIGERSECURITE-001' as const;

export const ENTREPRISE_ID_REGEX = /^[A-Z0-9][A-Z0-9_-]{2,63}$/;

/**
 * Normalise et valide un identifiant interne d'entreprise (majuscules, 3 à 64 caractères).
 * Retourne `undefined` si la valeur est absente ou invalide.
 */
export function normalizeEntrepriseId(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim().toUpperCase();
  if (!trimmed || !ENTREPRISE_ID_REGEX.test(trimmed)) {
    return undefined;
  }
  return trimmed;
}

/**
 * Indique si une valeur correspond à un identifiant interne d'entreprise valide.
 */
export function isValidEntrepriseId(raw: unknown): boolean {
  return Boolean(normalizeEntrepriseId(raw));
}

/**
 * Indique si un document/profil porte déjà explicitement un `entrepriseId` valide.
 */
export function hasExplicitEntrepriseId(raw: unknown): boolean {
  return isValidEntrepriseId(raw);
}

/**
 * Résout l'identifiant d'entreprise effectif d'un compte ou d'un document.
 * Si le champ est absent (compte historique antérieur à la migration), retourne
 * `DEFAULT_ENTREPRISE_ID` (`NIGERSECURITE-001`) sans modifier les données distantes.
 */
export function resolveEffectiveEntrepriseId(
  raw: unknown,
  fallback: string = DEFAULT_ENTREPRISE_ID
): string {
  return normalizeEntrepriseId(raw) || fallback;
}
