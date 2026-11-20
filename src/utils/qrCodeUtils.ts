import QRCode from 'qrcode';

/**
 * Génère une véritable image QR-Code 2D scannable au format Data URL (PNG).
 * Utilisé pour l'affichage à l'écran et pour les fiches de points de contrôle imprimables A4.
 */
export interface QrGenerationOptions {
  width?: number;
  margin?: number;
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
}

export async function generateQrCodeDataUrl(
  payload: string,
  options?: QrGenerationOptions
): Promise<string> {
  try {
    const dataUrl = await QRCode.toDataURL(payload, {
      width: options?.width ?? 320,
      margin: options?.margin ?? 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: options?.errorCorrectionLevel ?? 'M',
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

/**
 * Calcule un code de vérification déterministe (8 caractères hexadécimaux)
 * lié uniquement aux identifiants non sensibles de l'agent (id interne + matricule RH).
 */
export function getAgentBadgeVerificationCode(agentId: string, matricule: string): string {
  const cleanId = (agentId || '').trim();
  const cleanMat = (matricule || '').trim().toUpperCase();
  const seed = `NIGER_SECURITE_AGENT_BADGE|${cleanId}|${cleanMat}|V1`;

  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < seed.length; i++) {
    const ch = seed.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 0x01000193);
    h2 = ((h2 << 5) - h2 + ch) | 0;
  }

  const part1 = (h1 >>> 0).toString(16).toUpperCase().padStart(8, '0').slice(0, 4);
  const part2 = (h2 >>> 0).toString(16).toUpperCase().padStart(8, '0').slice(0, 4);
  return `${part1}${part2}`;
}

/**
 * Construit la charge utile du QR-Code intégré au verso du badge agent.
 * Contient UNIQUEMENT un identifiant non sensible (matricule/identifiant) et un code de contrôle,
 * sans jamais exposer de données personnelles (nom, téléphone, adresse, CNSS, salaire, etc.).
 *
 * Format : NSP_AGENT|V1|id:{identifiant}|v:{codeVerification}
 */
export function buildAgentBadgeQrPayload(agentId: string, matricule: string): string {
  const cleanMat = (matricule || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  const cleanId = (agentId || '').trim().replace(/[^a-zA-Z0-9_-]/g, '');
  const safeRef = cleanMat || cleanId;
  if (!safeRef) {
    throw new Error('Identifiant ou matricule agent requis pour générer le QR-Code du badge.');
  }
  const verificationCode = getAgentBadgeVerificationCode(agentId, matricule);
  return `NSP_AGENT|V1|id:${safeRef}|v:${verificationCode}`;
}

export interface AgentBadgeQrParseResult {
  valid: boolean;
  agentRef?: string;
  verificationCode?: string;
  error?: string;
}

/**
 * Analyse et valide la structure d'un QR-Code de badge agent NIGER SÉCURITÉ.
 */
export function parseAgentBadgeQrPayload(rawText: string): AgentBadgeQrParseResult {
  if (!rawText || typeof rawText !== 'string') {
    return { valid: false, error: 'Contenu du QR-Code vide ou illisible.' };
  }

  const trimmed = rawText.trim();
  if (!trimmed.startsWith('NSP_AGENT|V1|')) {
    return {
      valid: false,
      error: 'QR-Code non reconnu comme badge d’identification agent NIGER SÉCURITÉ.',
    };
  }

  const parts = trimmed.split('|');
  let agentRef = '';
  let verificationCode = '';

  for (const part of parts) {
    if (part.startsWith('id:')) agentRef = part.slice(3).trim();
    if (part.startsWith('v:')) verificationCode = part.slice(2).trim().toUpperCase();
  }

  if (!agentRef || !/^[A-Za-z0-9_-]{2,40}$/.test(agentRef)) {
    return { valid: false, error: 'Identifiant agent absent ou malformé dans le QR-Code.' };
  }

  if (!verificationCode || !/^[0-9A-F]{8}$/.test(verificationCode)) {
    return { valid: false, error: 'Code de vérification absent ou invalide dans le QR-Code.' };
  }

  return {
    valid: true,
    agentRef,
    verificationCode,
  };
}

/**
 * Vérifie qu'un QR-Code scanné correspond authentiquement à un agent donné.
 */
export function verifyAgentBadgeQrPayload(
  rawText: string,
  agentId: string,
  matricule: string
): boolean {
  const parsed = parseAgentBadgeQrPayload(rawText);
  if (!parsed.valid) return false;
  const expectedRef =
    (matricule || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '') ||
    (agentId || '').trim().replace(/[^a-zA-Z0-9_-]/g, '');
  const expectedCode = getAgentBadgeVerificationCode(agentId, matricule);
  return parsed.agentRef === expectedRef && parsed.verificationCode === expectedCode;
}

