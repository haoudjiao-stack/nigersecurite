/**
 * Utilitaires sécurisés de persistance locale pour la démonstration.
 * NIGER SÉCURITÉ - Niamey
 *
 * NOTE : localStorage convient exclusivement à la démonstration sur le même
 * navigateur et appareil. Il ne remplace pas une base de données de production.
 */

export const STORAGE_KEYS = {
  INVOICES: 'niger_securite_invoices_v1',
  CONTRACTS: 'niger_securite_contracts_v1',
  AGENT_CONTRACTS: 'niger_securite_agent_contracts_v1',
  PAYSLIPS: 'niger_securite_payslips_v1',
  SETTINGS: 'niger_securite_settings_v1',
} as const;

export interface StorageLoadResult<T> {
  data: T;
  error?: string;
  source: 'storage' | 'fallback';
}

/**
 * Charge une valeur depuis localStorage en toute sécurité.
 * En cas d'erreur de lecture ou de JSON corrompu :
 * - NE SUPPRIME JAMAIS les données existantes du navigateur (aucune action destructive).
 * - Retourne la valeur de repli (fallback) tout en signalant l'erreur pour affichage.
 */
export function safeLoadFromStorage<T>(key: string, fallback: T): StorageLoadResult<T> {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { data: fallback, source: 'fallback' };
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return { data: fallback, source: 'fallback' };
    }

    const parsed = JSON.parse(raw);

    // Contrôle d'intégrité : si le fallback est un tableau, le résultat doit être un tableau
    if (Array.isArray(fallback) && !Array.isArray(parsed)) {
      return {
        data: fallback,
        source: 'fallback',
        error: `Structure invalide pour la clé "${key}" : un tableau était attendu. Les données du navigateur ont été conservées intactes sans écrasement.`,
      };
    }

    // Contrôle d'intégrité : si le fallback est un objet non-tableau, le résultat doit être un objet non-tableau
    if (!Array.isArray(fallback) && typeof fallback === 'object' && fallback !== null) {
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return {
          data: fallback,
          source: 'fallback',
          error: `Structure invalide pour la clé "${key}" : un objet était attendu. Les données du navigateur ont été conservées intactes sans écrasement.`,
        };
      }
    }

    return { data: parsed as T, source: 'storage' };
  } catch (err: any) {
    console.error(`[NIGER SÉCURITÉ Storage] Erreur lecture ${key}:`, err);
    return {
      data: fallback,
      source: 'fallback',
      error: `Données locales illisibles pour "${key}" (${err?.message || 'erreur JSON'}). Les données existantes dans votre navigateur n'ont pas été effacées.`,
    };
  }
}

/**
 * Enregistre une valeur dans localStorage de manière sécurisée.
 * Intercepte les erreurs de quota ou de permission sans interrompre l'application.
 */
export function safeSaveToStorage<T>(key: string, data: T): boolean {
  if (typeof window === 'undefined' || !window.localStorage) {
    return false;
  }

  try {
    const serialized = JSON.stringify(data);
    window.localStorage.setItem(key, serialized);
    return true;
  } catch (err: any) {
    console.error(`[NIGER SÉCURITÉ Storage] Échec d'enregistrement pour ${key}:`, err);
    return false;
  }
}
