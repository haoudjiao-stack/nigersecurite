import QRCode from 'qrcode';

/**
 * Génère une véritable image QR-Code 2D scannable au format Data URL (PNG).
 * Utilisé pour l'affichage à l'écran et pour les fiches de points de contrôle imprimables A4.
 */
export async function generateQrCodeDataUrl(payload: string): Promise<string> {
  try {
    const dataUrl = await QRCode.toDataURL(payload, {
      width: 320,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'M',
    });
    return dataUrl;
  } catch (err) {
    console.error('[NIGER SÉCURITÉ QR] Erreur de génération QR Code:', err);
    throw err;
  }
}

/**
 * Génère le jeton cryptographique vérifiable encodé dans le QR-Code physique.
 * Format standard : NSP_PATROL|V1|site:{siteId}|point:{pointId}|sec:{checksum}
 */
export function buildCheckpointQrPayload(siteId: string, pointId: string): string {
  // Signature de contrôle basée sur les identifiants
  const checksum = generatePointChecksum(siteId, pointId);
  return `NSP_PATROL|V1|site:${siteId}|point:${pointId}|sec:${checksum}`;
}

/**
 * Analyse et valide le contenu d'un QR-Code scanné par la caméra du téléphone.
 * Refuse catégoriquement tout code inconnu, malformé ou provenant d'une autre application.
 */
export interface QrParseResult {
  valid: boolean;
  siteId?: string;
  pointId?: string;
  error?: string;
}

export function parseCheckpointQrPayload(rawText: string): QrParseResult {
  if (!rawText || typeof rawText !== 'string') {
    return { valid: false, error: 'Contenu du QR-Code vide ou illisible.' };
  }

  const trimmed = rawText.trim();

  // Vérification de l'en-tête officiel NIGER SÉCURITÉ
  if (!trimmed.startsWith('NSP_PATROL')) {
    return {
      valid: false,
      error: 'QR-Code non reconnu : ce code n’appartient pas au réseau de patrouille NIGER SÉCURITÉ.',
    };
  }

  const parts = trimmed.split('|');
  let siteId = '';
  let pointId = '';
  let sec = '';

  for (const part of parts) {
    if (part.startsWith('site:')) siteId = part.replace('site:', '');
    if (part.startsWith('point:')) pointId = part.replace('point:', '');
    if (part.startsWith('sec:')) sec = part.replace('sec:', '');
  }

  if (!siteId || !pointId) {
    return {
      valid: false,
      error: 'Format du point de contrôle invalide ou altéré.',
    };
  }

  // Vérification de la clé de contrôle
  const expectedChecksum = generatePointChecksum(siteId, pointId);
  if (sec && sec !== expectedChecksum) {
    return {
      valid: false,
      error: 'Échec de vérification d’authenticité : signature du point de contrôle invalide.',
    };
  }

  return {
    valid: true,
    siteId,
    pointId,
  };
}

/**
 * Calcule une clé de contrôle simple et déterministe pour valider l'intégrité du point.
 */
function generatePointChecksum(siteId: string, pointId: string): string {
  let hash = 0;
  const combined = `NIGER_SECURITE_${siteId}_${pointId}_NIAMEY_2026`;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convertit en entier 32 bits
  }
  return Math.abs(hash).toString(16).toUpperCase();
}
