import { EnterpriseSettings, PointControleSite, SiteGardiennage } from '../types';

/**
 * Nettoie un segment de nom de fichier pour éviter les caractères invalides
 * (accents, slashs, deux-points, espaces) sur Windows, macOS, Linux et Android.
 */
export function sanitizeFileSegment(value: string, fallback = 'document'): string {
  const cleaned = (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
  return cleaned || fallback;
}

/**
 * Convertit une Data URL (PNG ou JPEG) en Blob binaire fiable pour le téléchargement.
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex === -1) {
    throw new Error('Format Data URL invalide.');
  }
  const header = dataUrl.slice(0, commaIndex);
  const base64 = dataUrl.slice(commaIndex + 1);
  const mimeMatch = header.match(/data:([^;]+);base64/i);
  const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

/**
 * Convertit une Data URL base64 en tableau d'octets Uint8Array.
 */
export function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex === -1) {
    throw new Error('Format Data URL invalide.');
  }
  const base64 = dataUrl.slice(commaIndex + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Déclenche un téléchargement fiable via Blob URL et balise <a> attachée au DOM
 * (compatible Chrome, Edge, Firefox, Safari et contextes iframe).
 */
export function triggerBlobDownload(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Révocation différée pour laisser le temps au navigateur d'amorcer le téléchargement
  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 4000);
}

/**
 * Encapsule des octets JPEG dans un document PDF 1.4 strictement conforme au format A4 portrait
 * (595.28 x 841.89 pt = 210 x 297 mm), sans dépendance externe.
 */
export function buildA4PdfFromJpegBytes(
  jpegBytes: Uint8Array,
  imageWidthPx: number,
  imageHeightPx: number
): Blob {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  let currentOffset = 0;

  const pushBytes = (bytes: Uint8Array) => {
    chunks.push(bytes);
    currentOffset += bytes.length;
  };

  const pushText = (text: string) => {
    pushBytes(encoder.encode(text));
  };

  // En-tête PDF 1.4 avec marqueur binaire recommandé par la spécification ISO 32000
  pushText('%PDF-1.4\n');
  pushBytes(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

  const offsets: number[] = [0]; // Objet 0 réservé

  // Objet 1 : Catalog
  offsets.push(currentOffset);
  pushText('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  // Objet 2 : Pages
  offsets.push(currentOffset);
  pushText('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');

  // Objet 3 : Page A4 portrait (595.28 x 841.89 pt)
  offsets.push(currentOffset);
  pushText(
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n'
  );

  // Objet 4 : Image JPEG (DCTDecode)
  offsets.push(currentOffset);
  pushText(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imageWidthPx} /Height ${imageHeightPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`
  );
  pushBytes(jpegBytes);
  pushText('\nendstream\nendobj\n');

  // Objet 5 : Flux d'affichage pleine page A4
  const contentStream = 'q\n595.28 0 0 841.89 0 0 cm\n/Im0 Do\nQ\n';
  offsets.push(currentOffset);
  pushText(`5 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream}endstream\nendobj\n`);

  // Table des références croisées (xref)
  const xrefOffset = currentOffset;
  pushText(`xref\n0 ${offsets.length}\n`);
  pushText('0000000000 65535 f \n');
  for (let i = 1; i < offsets.length; i++) {
    pushText(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  }

  // Trailer et fin de fichier
  pushText(`trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
  const merged = new Uint8Array(totalLength);
  let pos = 0;
  for (const chunk of chunks) {
    merged.set(chunk, pos);
    pos += chunk.length;
  }

  return new Blob([merged], { type: 'application/pdf' });
}

function loadImageSafe(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    if (!src.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines = 4
): string[] {
  const words = (text || '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];

  const lines: string[] = [];
  let current = words[0];

  for (let i = 1; i < words.length; i++) {
    const candidate = `${current} ${words[i]}`;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = words[i];
      if (lines.length === maxLines - 1) {
        const rest = [current, ...words.slice(i + 1)].join(' ');
        let clipped = rest;
        while (ctx.measureText(clipped + '…').width > maxWidth && clipped.length > 3) {
          clipped = clipped.slice(0, -1);
        }
        lines.push(clipped === rest ? clipped : `${clipped}…`);
        return lines;
      }
    }
  }
  lines.push(current);
  return lines;
}

export interface CheckpointA4RenderParams {
  checkpoint: PointControleSite;
  site: SiteGardiennage;
  qrDataUrl: string;
  settings?: EnterpriseSettings;
  editionDate?: string;
}

/**
 * Génère un fichier PDF A4 portrait complet de la « Fiche Officielle Point de Ronde »
 * incluant : en-tête officiel, logo, titre, QR-Code scannable, emplacement, consignes,
 * zones de cachet et signatures des deux responsables, et mentions légales de bas de page.
 */
export async function generateCheckpointA4PdfBlob({
  checkpoint,
  site,
  qrDataUrl,
  settings,
  editionDate = new Date().toLocaleDateString('fr-FR'),
}: CheckpointA4RenderParams): Promise<Blob> {
  // Format A4 à 150 DPI : 1240 x 1754 px
  const W = 1240;
  const H = 1754;
  const M = 76; // Marges A4 ~13mm
  const CW = W - M * 2;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Impossible d’initialiser le contexte graphique pour la génération PDF.');
  }

  // Fond blanc papier A4
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // Cadre extérieur officiel discret
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 3;
  drawRoundedRect(ctx, M - 16, M - 16, CW + 32, H - (M - 16) * 2, 18);
  ctx.stroke();

  let y = M + 12;

  // === 1. EN-TÊTE OFFICIEL ===
  const logoSize = 86;
  let logoDrawn = false;
  if (settings?.logoUrl) {
    const logoImg = await loadImageSafe(settings.logoUrl);
    if (logoImg) {
      ctx.save();
      drawRoundedRect(ctx, M, y, logoSize, logoSize, 12);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.clip();
      const ratio = Math.min((logoSize - 10) / logoImg.width, (logoSize - 10) / logoImg.height);
      const dw = logoImg.width * ratio;
      const dh = logoImg.height * ratio;
      ctx.drawImage(logoImg, M + (logoSize - dw) / 2, y + (logoSize - dh) / 2, dw, dh);
      ctx.restore();
      logoDrawn = true;
    }
  }
  if (!logoDrawn) {
    drawRoundedRect(ctx, M, y, logoSize, logoSize, 14);
    ctx.fillStyle = '#047857';
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 30px Arial, Helvetica, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const sigle = (settings?.sigle || 'NS').trim().slice(0, 3).toUpperCase();
    ctx.fillText(sigle, M + logoSize / 2, y + logoSize / 2);
  }

  const headerTextX = M + logoSize + 22;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 32px Arial, Helvetica, sans-serif';
  ctx.fillText((settings?.raisonSociale || 'NIGER SÉCURITÉ PRIVÉE').toUpperCase(), headerTextX, y + 4);

  ctx.fillStyle = '#475569';
  ctx.font = '600 18px Arial, Helvetica, sans-serif';
  ctx.fillText('Poste de Faction • Surveillance & Sécurité Physique', headerTextX, y + 44);

  ctx.fillStyle = '#64748b';
  ctx.font = '16px Arial, Helvetica, sans-serif';
  const adresseLine = [
    settings?.adresse || 'Niamey',
    settings?.ville || 'République du Niger',
    settings?.telephonePrincipal ? `Tél : ${settings.telephonePrincipal}` : '',
  ]
    .filter(Boolean)
    .join(' • ');
  ctx.fillText(adresseLine, headerTextX, y + 70);

  // Badge Point N° à droite
  const badgeText = `POINT N° ${checkpoint.ordre || 1}`;
  ctx.font = 'bold 18px Arial, Helvetica, sans-serif';
  const badgeW = Math.max(155, ctx.measureText(badgeText).width + 36);
  const badgeH = 42;
  const badgeX = W - M - badgeW;
  drawRoundedRect(ctx, badgeX, y + 8, badgeW, badgeH, 10);
  ctx.fillStyle = '#f1f5f9';
  ctx.fill();
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#0f172a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(badgeText, badgeX + badgeW / 2, y + 8 + badgeH / 2);

  y += 116;

  // Filet de séparation épais
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(M, y);
  ctx.lineTo(W - M, y);
  ctx.stroke();

  y += 34;

  // === 2. TITRE OFFICIEL DU POINT DE RONDE ===
  const pillText = 'POINT DE VÉRIFICATION RONDE OFFICIEL';
  ctx.font = 'bold 18px Arial, Helvetica, sans-serif';
  const pillW = ctx.measureText(pillText).width + 48;
  const pillH = 38;
  drawRoundedRect(ctx, (W - pillW) / 2, y, pillW, pillH, 19);
  ctx.fillStyle = '#ecfdf5';
  ctx.fill();
  ctx.strokeStyle = '#6ee7b7';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#065f46';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(pillText, W / 2, y + pillH / 2);

  y += 62;

  ctx.fillStyle = '#020617';
  ctx.font = 'bold 40px Arial, Helvetica, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const titleLines = wrapTextLines(ctx, checkpoint.nom.toUpperCase(), CW - 40, 2);
  for (const line of titleLines) {
    ctx.fillText(line, W / 2, y);
    y += 48;
  }

  y += 6;
  ctx.fillStyle = '#334155';
  ctx.font = '600 23px Arial, Helvetica, sans-serif';
  ctx.fillText(`Site : ${site.nom} (${site.quartier || 'Niamey'}, ${site.ville || 'Niamey'})`, W / 2, y);
  y += 52;

  // === 3. CADRE CENTRAL DU QR-CODE ===
  const qrBoxH = 580;
  drawRoundedRect(ctx, M + 40, y, CW - 80, qrBoxH, 24);
  ctx.fillStyle = '#f8fafc';
  ctx.fill();
  ctx.save();
  ctx.setLineDash([12, 8]);
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();

  const qrCardSize = 440;
  const qrCardX = (W - qrCardSize) / 2;
  const qrCardY = y + 32;
  drawRoundedRect(ctx, qrCardX, qrCardY, qrCardSize, qrCardSize, 18);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2;
  ctx.stroke();

  const qrImg = await loadImageSafe(qrDataUrl);
  if (qrImg) {
    const pad = 22;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(qrImg, qrCardX + pad, qrCardY + pad, qrCardSize - pad * 2, qrCardSize - pad * 2);
    ctx.imageSmoothingEnabled = true;
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 24px "Courier New", Courier, monospace';
  ctx.fillText(checkpoint.id, W / 2, qrCardY + qrCardSize + 24);

  ctx.fillStyle = '#475569';
  ctx.font = 'bold 17px Arial, Helvetica, sans-serif';
  ctx.fillText(
    "SCANNEZ VIA L'APPLICATION MOBILE CONTRÔLEUR NIGER SÉCURITÉ",
    W / 2,
    qrCardY + qrCardSize + 60
  );

  y += qrBoxH + 34;

  // === 4. EMPLACEMENT FIXE & CONSIGNES ===
  const infoBoxH = 220;
  drawRoundedRect(ctx, M, y, CW, infoBoxH, 16);
  ctx.fillStyle = '#f1f5f9';
  ctx.fill();
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2;
  ctx.stroke();

  const infoX = M + 28;
  const infoW = CW - 56;
  let iy = y + 24;

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 18px Arial, Helvetica, sans-serif';
  ctx.fillText('EMPLACEMENT FIXE :', infoX, iy);
  iy += 28;

  ctx.fillStyle = '#334155';
  ctx.font = '20px Arial, Helvetica, sans-serif';
  const empLines = wrapTextLines(ctx, checkpoint.emplacement || 'Emplacement standard', infoW, 2);
  for (const line of empLines) {
    ctx.fillText(line, infoX, iy);
    iy += 28;
  }

  iy += 14;
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 18px Arial, Helvetica, sans-serif';
  ctx.fillText('CONSIGNES DE FACTION :', infoX, iy);
  iy += 28;

  ctx.fillStyle = '#334155';
  ctx.font = '20px Arial, Helvetica, sans-serif';
  const consigneLines = wrapTextLines(
    ctx,
    checkpoint.consignes || 'Vérification complète du secteur et pointage obligatoire.',
    infoW,
    3
  );
  for (const line of consigneLines) {
    ctx.fillText(line, infoX, iy);
    iy += 28;
  }

  // === 5. ZONES DE CACHET ET SIGNATURES DES DEUX RESPONSABLES ===
  const footerY = H - M - 48;
  const sigBoxH = 195;
  const sigY = footerY - sigBoxH - 28;
  const sigGap = 34;
  const sigW = (CW - sigGap) / 2;

  // Ligne de séparation au-dessus des signatures
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(M, sigY - 22);
  ctx.lineTo(W - M, sigY - 22);
  ctx.stroke();

  const drawSignatureBox = (bx: number, title: string, subtitle: string, footerHint: string) => {
    drawRoundedRect(ctx, bx, sigY, sigW, sigBoxH, 14);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 17px Arial, Helvetica, sans-serif';
    ctx.fillText(title, bx + 20, sigY + 18);

    ctx.fillStyle = '#64748b';
    ctx.font = '15px Arial, Helvetica, sans-serif';
    ctx.fillText(subtitle, bx + 20, sigY + 44);

    // Ligne pointillée en bas du cadre
    ctx.save();
    ctx.setLineDash([6, 5]);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(bx + 20, sigY + sigBoxH - 46);
    ctx.lineTo(bx + sigW - 20, sigY + sigBoxH - 46);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = '#64748b';
    ctx.font = 'italic 15px Arial, Helvetica, sans-serif';
    ctx.fillText(footerHint, bx + 20, sigY + sigBoxH - 34);
  };

  drawSignatureBox(
    M,
    'POUR LE RESPONSABLE D’EXPLOITATION :',
    'Installation sur site, date & signature',
    'Signature et mention « Point vérifié et installé »'
  );
  drawSignatureBox(
    M + sigW + sigGap,
    'POUR LA DIRECTION GÉNÉRALE :',
    'Cachet officiel & approbation',
    'Visa, cachet officiel et approbation'
  );

  // === 6. PIED DE PAGE OFFICIEL ===
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(M, footerY - 8);
  ctx.lineTo(W - M, footerY - 8);
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#475569';
  ctx.font = '16px Arial, Helvetica, sans-serif';
  ctx.fillText(
    `NIF : ${settings?.nif || '48291/S'} • RCCM : ${settings?.rccm || 'NI-NIA-2021-B-890'} • Agrément Ministère de l'Intérieur`,
    M,
    footerY + 6
  );

  ctx.textAlign = 'right';
  ctx.fillText(`Édition certifiée le ${editionDate}`, W - M, footerY + 6);

  // Encodage JPEG haute qualité puis emballage PDF 1.4
  const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.94);
  const jpegBytes = dataUrlToUint8Array(jpegDataUrl);
  return buildA4PdfFromJpegBytes(jpegBytes, W, H);
}
