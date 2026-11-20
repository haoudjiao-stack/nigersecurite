import { AgentSecurite, EnterpriseSettings } from '../types';
import {
  dataUrlToUint8Array,
  sanitizeFileSegment,
  triggerBlobDownload,
} from './checkpointExportUtils';
import { getAgentBadgeVerificationCode } from './qrCodeUtils';

export type BadgePrintMode = 'recto_verso' | 'recto_seul' | 'verso_seul';

export interface PdfJpegPageInput {
  bytes: Uint8Array;
  width: number;
  height: number;
}

/**
 * Assemble 1 ou plusieurs pages JPEG dans un fichier PDF 1.4 strictement conforme au format A4 portrait
 * (595.28 x 841.89 pt = 210 x 297 mm), sans dépendance externe.
 * Utilisé pour l'export prêt à imprimer du badge agent (recto-verso sur 2 pages alignées ou face unique).
 */
export function buildA4MultiPagePdfFromJpegs(pages: PdfJpegPageInput[]): Blob {
  if (!pages.length) {
    throw new Error('Au moins une page est requise pour générer le PDF du badge.');
  }

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

  pushText('%PDF-1.4\n');
  pushBytes(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

  const offsets: number[] = [0]; // Objet 0 réservé

  // Objet 1 : Catalog
  offsets.push(currentOffset);
  pushText('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  // Calcul des numéros d'objets pour chaque page :
  // Pour la page i (0-based) : Page = 3 + i*3, Image = 4 + i*3, Content = 5 + i*3
  const kidsRefs = pages.map((_, i) => `${3 + i * 3} 0 R`).join(' ');

  // Objet 2 : Pages
  offsets.push(currentOffset);
  pushText(`2 0 obj\n<< /Type /Pages /Kids [${kidsRefs}] /Count ${pages.length} >>\nendobj\n`);

  pages.forEach((page, i) => {
    const pageObjId = 3 + i * 3;
    const imgObjId = 4 + i * 3;
    const contentObjId = 5 + i * 3;

    // Objet Page A4 portrait
    offsets.push(currentOffset);
    pushText(
      `${pageObjId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im${i} ${imgObjId} 0 R >> >> /Contents ${contentObjId} 0 R >>\nendobj\n`
    );

    // Objet Image JPEG
    offsets.push(currentOffset);
    pushText(
      `${imgObjId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.bytes.length} >>\nstream\n`
    );
    pushBytes(page.bytes);
    pushText('\nendstream\nendobj\n');

    // Objet Flux de rendu pleine page A4
    const contentStream = `q\n595.28 0 0 841.89 0 0 cm\n/Im${i} Do\nQ\n`;
    offsets.push(currentOffset);
    pushText(
      `${contentObjId} 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream}endstream\nendobj\n`
    );
  });

  const xrefOffset = currentOffset;
  pushText(`xref\n0 ${offsets.length}\n`);
  pushText('0000000000 65535 f \n');
  for (let i = 1; i < offsets.length; i++) {
    pushText(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  }

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

function loadImageSafe(src?: string | null): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
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

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number
) {
  const sw = img.naturalWidth || img.width;
  const sh = img.naturalHeight || img.height;
  if (!sw || !sh) return;
  const targetRatio = dw / dh;
  const srcRatio = sw / sh;
  let sx = 0;
  let sy = 0;
  let cw = sw;
  let ch = sh;
  if (srcRatio > targetRatio) {
    cw = sh * targetRatio;
    sx = (sw - cw) / 2;
  } else {
    ch = sw / targetRatio;
    sy = Math.max(0, (sh - ch) * 0.3);
  }
  ctx.drawImage(img, sx, sy, cw, ch, dx, dy, dw, dh);
}

function drawClippedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number
) {
  const clean = (text || '').trim();
  if (!clean) return;
  if (ctx.measureText(clean).width <= maxWidth) {
    ctx.fillText(clean, x, y);
    return;
  }
  let truncated = clean;
  while (truncated.length > 2 && ctx.measureText(`${truncated}…`).width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  ctx.fillText(`${truncated}…`, x, y);
}

function drawWrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number
): number {
  const words = (text || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return y;
  let line = words[0];
  let lineCount = 0;
  let cy = y;

  for (let i = 1; i < words.length; i++) {
    const candidate = `${line} ${words[i]}`;
    if (ctx.measureText(candidate).width <= maxWidth) {
      line = candidate;
    } else {
      lineCount += 1;
      if (lineCount >= maxLines) {
        drawClippedText(ctx, `${line} ${words.slice(i).join(' ')}`, x, cy, maxWidth);
        return cy + lineHeight;
      }
      ctx.fillText(line, x, cy);
      cy += lineHeight;
      line = words[i];
    }
  }
  ctx.fillText(line, x, cy);
  return cy + lineHeight;
}

function drawCropMarks(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const gap = 14;
  const len = 34;
  ctx.save();
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 1.5;

  // Haut gauche
  ctx.beginPath();
  ctx.moveTo(x - gap - len, y);
  ctx.lineTo(x - gap, y);
  ctx.moveTo(x, y - gap - len);
  ctx.lineTo(x, y - gap);
  // Haut droite
  ctx.moveTo(x + w + gap, y);
  ctx.lineTo(x + w + gap + len, y);
  ctx.moveTo(x + w, y - gap - len);
  ctx.lineTo(x + w, y - gap);
  // Bas gauche
  ctx.beginPath();
  ctx.moveTo(x - gap - len, y + h);
  ctx.lineTo(x - gap, y + h);
  ctx.moveTo(x, y + h + gap);
  ctx.lineTo(x, y + h + gap + len);
  // Bas droite
  ctx.moveTo(x + w + gap, y + h);
  ctx.lineTo(x + w + gap + len, y + h);
  ctx.moveTo(x + w, y + h + gap);
  ctx.lineTo(x + w, y + h + gap + len);
  ctx.stroke();

  // Redessiner les deux coins supérieurs (car beginPath() a été appelé au milieu)
  ctx.beginPath();
  ctx.moveTo(x - gap - len, y);
  ctx.lineTo(x - gap, y);
  ctx.moveTo(x, y - gap - len);
  ctx.lineTo(x, y - gap);
  ctx.moveTo(x + w + gap, y);
  ctx.lineTo(x + w + gap + len, y);
  ctx.moveTo(x + w, y - gap - len);
  ctx.lineTo(x + w, y - gap);
  ctx.stroke();
  ctx.restore();
}

export interface AgentBadgeRenderParams {
  agent: AgentSecurite;
  qrDataUrl: string;
  settings?: EnterpriseSettings;
  mode: BadgePrintMode;
  editionDate?: string;
}

/**
 * Rend une page A4 portrait à 200 DPI (1654 × 2339 px) contenant la carte PVC CR80
 * exactement aux dimensions physiques 85,60 mm × 53,98 mm (674 × 425 px),
 * parfaitement centrée horizontalement (62,2 mm gauche et droite) pour un alignement recto-verso millimétré.
 */
async function renderBadgeA4Page(
  face: 'recto' | 'verso',
  {
    agent,
    qrDataUrl,
    settings,
    editionDate = new Date().toLocaleDateString('fr-FR'),
  }: Omit<AgentBadgeRenderParams, 'mode'>,
  pageLabel: string
): Promise<PdfJpegPageInput> {
  // 200 DPI : 1 mm = 7.8740157 px -> A4 = 1654 x 2339 px, CR80 = 674 x 425 px
  const W = 1654;
  const H = 2339;
  const cardW = 674; // 85.60 mm
  const cardH = 425; // 53.98 mm
  const cardX = Math.round((W - cardW) / 2); // 490 px = 62.2 mm exact de chaque côté
  const cardY = 260; // ~33 mm du haut, identique Recto et Verso
  const radius = 24;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Impossible d’initialiser le contexte graphique pour le PDF du badge.');
  }

  // Fond blanc A4
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // Repères de coupe discrets autour de la carte PVC
  drawCropMarks(ctx, cardX, cardY, cardW, cardH);

  // Chargement des images utiles
  const [logoImg, photoImg, qrImg] = await Promise.all([
    loadImageSafe(settings?.logoUrl),
    face === 'recto' ? loadImageSafe(agent.photoUrl) : Promise.resolve(null),
    face === 'verso' ? loadImageSafe(qrDataUrl) : Promise.resolve(null),
  ]);

  const companyName = (settings?.raisonSociale || 'NIGER SÉCURITÉ PRIVÉE').toUpperCase();
  const companySigle = (settings?.sigle || 'NS').trim().slice(0, 4).toUpperCase();
  const verificationCode = getAgentBadgeVerificationCode(agent.id, agent.matricule);

  // Clip dans les coins arrondis de la carte PVC
  ctx.save();
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, radius);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.clip();

  if (face === 'recto') {
    // === FACE RECTO (85,60 × 53,98 mm) ===
    // Bandeau supérieur institutionnel sombre
    const headerH = 104;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(cardX, cardY, cardW, headerH);

    // Liseré tricolore / émeraude NigerSécurité
    ctx.fillStyle = '#059669';
    ctx.fillRect(cardX, cardY + headerH - 7, cardW, 7);

    // Logo entreprise
    const logoBox = 64;
    const logoX = cardX + 24;
    const logoY = cardY + 17;
    drawRoundedRect(ctx, logoX, logoY, logoBox, logoBox, 10);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    if (logoImg) {
      ctx.save();
      drawRoundedRect(ctx, logoX + 4, logoY + 4, logoBox - 8, logoBox - 8, 6);
      ctx.clip();
      const ratio = Math.min((logoBox - 10) / logoImg.width, (logoBox - 10) / logoImg.height);
      const dw = logoImg.width * ratio;
      const dh = logoImg.height * ratio;
      ctx.drawImage(logoImg, logoX + (logoBox - dw) / 2, logoY + (logoBox - dh) / 2, dw, dh);
      ctx.restore();
    } else {
      ctx.fillStyle = '#047857';
      ctx.font = 'bold 26px Arial, Helvetica, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(companySigle, logoX + logoBox / 2, logoY + logoBox / 2 + 1);
    }

    // Titre entreprise
    const titleX = logoX + logoBox + 18;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#34d399';
    ctx.font = 'bold 13px Arial, Helvetica, sans-serif';
    ctx.fillText('RÉPUBLIQUE DU NIGER  •  CARTE PROFESSIONNELLE AGENT', titleX, cardY + 18);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px Arial, Helvetica, sans-serif';
    drawClippedText(ctx, companyName, titleX, cardY + 38, cardW - (titleX - cardX) - 20);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '13px Arial, Helvetica, sans-serif';
    drawClippedText(
      ctx,
      settings?.agrementMinistere || 'Agrément Ministère de l’Intérieur & Sécurité Publique',
      titleX,
      cardY + 70,
      cardW - (titleX - cardX) - 20
    );

    // Zone Photo portrait (gauche, ratio 3:4 -> 162 x 216 px)
    const photoX = cardX + 26;
    const photoY = cardY + headerH + 24;
    const photoW = 162;
    const photoH = 216;

    ctx.save();
    drawRoundedRect(ctx, photoX, photoY, photoW, photoH, 12);
    ctx.fillStyle = '#f1f5f9';
    ctx.fill();
    ctx.clip();
    if (photoImg) {
      drawCoverImage(ctx, photoImg, photoX, photoY, photoW, photoH);
    } else {
      // Silhouette propre si aucune photo encore importée
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(photoX, photoY, photoW, photoH);
      ctx.fillStyle = '#94a3b8';
      ctx.beginPath();
      ctx.arc(photoX + photoW / 2, photoY + 78, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(photoX + photoW / 2, photoY + 196, 62, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 13px Arial, Helvetica, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('PHOTO AGENT', photoX + photoW / 2, photoY + photoH - 18);
    }
    ctx.restore();

    // Bordure nette autour de la photo
    drawRoundedRect(ctx, photoX, photoY, photoW, photoH, 12);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Badge groupe sanguin sous la photo
    const bloodY = photoY + photoH + 12;
    drawRoundedRect(ctx, photoX, bloodY, photoW, 30, 8);
    ctx.fillStyle = '#fff1f2';
    ctx.fill();
    ctx.strokeStyle = '#fda4af';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#be123c';
    ctx.font = 'bold 14px Arial, Helvetica, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`GROUPE SANGUIN : ${agent.groupeSanguin || 'N/C'}`, photoX + photoW / 2, bloodY + 15);

    // Bloc identité droite
    const infoX = photoX + photoW + 24;
    const infoMaxW = cardX + cardW - infoX - 24;
    let iy = cardY + headerH + 22;

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    // Nom & Prénom
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 12px Arial, Helvetica, sans-serif';
    ctx.fillText('NOM & PRÉNOM', infoX, iy);
    iy += 17;

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 26px Arial, Helvetica, sans-serif';
    drawClippedText(ctx, `${agent.nom.toUpperCase()}`, infoX, iy, infoMaxW);
    iy += 30;

    ctx.fillStyle = '#1e293b';
    ctx.font = '600 22px Arial, Helvetica, sans-serif';
    drawClippedText(ctx, agent.prenom, infoX, iy, infoMaxW);
    iy += 34;

    // Fonction / Poste dans cartouche émeraude
    drawRoundedRect(ctx, infoX, iy, infoMaxW, 34, 8);
    ctx.fillStyle = '#ecfdf5';
    ctx.fill();
    ctx.strokeStyle = '#6ee7b7';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#065f46';
    ctx.font = 'bold 16px Arial, Helvetica, sans-serif';
    ctx.textBaseline = 'middle';
    drawClippedText(ctx, (agent.poste || 'Agent de Sécurité').toUpperCase(), infoX + 12, iy + 17, infoMaxW - 24);
    ctx.textBaseline = 'top';
    iy += 46;

    // Matricule
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 12px Arial, Helvetica, sans-serif';
    ctx.fillText('MATRICULE OFFICIEL', infoX, iy);
    iy += 16;
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 22px "Courier New", Courier, monospace';
    drawClippedText(ctx, agent.matricule, infoX, iy, infoMaxW);
    iy += 30;

    // Ligne séparatrice
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(infoX, iy);
    ctx.lineTo(cardX + cardW - 24, iy);
    ctx.stroke();
    iy += 10;

    // Site d'affectation & Faction
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 11px Arial, Helvetica, sans-serif';
    ctx.fillText('SITE D’AFFECTATION', infoX, iy);
    iy += 15;
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 16px Arial, Helvetica, sans-serif';
    drawClippedText(ctx, agent.siteActuel || 'Non affecté', infoX, iy, infoMaxW);
    iy += 24;

    ctx.fillStyle = '#475569';
    ctx.font = '600 13px Arial, Helvetica, sans-serif';
    drawClippedText(ctx, `${agent.horaire}  •  ${agent.typeContrat}`, infoX, iy, infoMaxW);

    // Pied de carte Recto
    const footH = 30;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(cardX, cardY + cardH - footH, cardW, footH);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 12px Arial, Helvetica, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      'PORT DU BADGE OBLIGATOIRE EN SERVICE  •  DOCUMENT OFFICIEL PERSONNEL',
      cardX + cardW / 2,
      cardY + cardH - footH / 2
    );
  } else {
    // === FACE VERSO (85,60 × 53,98 mm) ===
    // Bandeau supérieur verso
    const headerH = 58;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(cardX, cardY, cardW, headerH);
    ctx.fillStyle = '#059669';
    ctx.fillRect(cardX, cardY + headerH - 5, cardW, 5);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 17px Arial, Helvetica, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    drawClippedText(ctx, `VÉRIFICATION & AUTHENTICITÉ — ${companyName}`, cardX + 24, cardY + 27, cardW - 48);

    // Zone QR Code à gauche (intégré directement sur le verso)
    const qrBoxX = cardX + 26;
    const qrBoxY = cardY + headerH + 22;
    const qrBoxW = 216;
    const qrBoxH = 216;

    drawRoundedRect(ctx, qrBoxX, qrBoxY, qrBoxW, qrBoxH, 14);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    if (qrImg) {
      const pad = 12;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(qrImg, qrBoxX + pad, qrBoxY + pad, qrBoxW - pad * 2, qrBoxH - pad * 2);
      ctx.imageSmoothingEnabled = true;
    }

    // Identifiant non sensible sous le QR code
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 17px "Courier New", Courier, monospace';
    ctx.fillText(agent.matricule, qrBoxX + qrBoxW / 2, qrBoxY + qrBoxH + 12);

    ctx.fillStyle = '#047857';
    ctx.font = 'bold 12px "Courier New", Courier, monospace';
    ctx.fillText(`CODE CONTRÔLE : ${verificationCode}`, qrBoxX + qrBoxW / 2, qrBoxY + qrBoxH + 34);

    ctx.fillStyle = '#64748b';
    ctx.font = '11px Arial, Helvetica, sans-serif';
    ctx.fillText('QR code non sensible • Identifiant seul', qrBoxX + qrBoxW / 2, qrBoxY + qrBoxH + 54);

    // Bloc vérification & informations légales à droite
    const rightX = qrBoxX + qrBoxW + 24;
    const rightMaxW = cardX + cardW - rightX - 24;
    let ry = cardY + headerH + 22;

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    // Encadré informations de contrôle
    drawRoundedRect(ctx, rightX, ry, rightMaxW, 118, 10);
    ctx.fillStyle = '#f8fafc';
    ctx.fill();
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    let boxY = ry + 12;
    const bx = rightX + 14;
    const bw = rightMaxW - 28;

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 13px Arial, Helvetica, sans-serif';
    ctx.fillText('CONTRÔLE D’IDENTITÉ & VALIDITÉ', bx, boxY);
    boxY += 22;

    ctx.fillStyle = '#334155';
    ctx.font = '13px Arial, Helvetica, sans-serif';
    drawClippedText(ctx, `Identifiant : ${agent.matricule} (${agent.id})`, bx, boxY, bw);
    boxY += 20;
    drawClippedText(ctx, `Entrée en service : ${agent.dateEmbauche || 'N/C'}`, bx, boxY, bw);
    boxY += 20;
    drawClippedText(ctx, `Édition du badge : ${editionDate}`, bx, boxY, bw);
    boxY += 20;
    drawClippedText(ctx, `Statut : ${agent.statut}`, bx, boxY, bw);

    ry += 132;

    // Urgence PC Opérations 24/7
    drawRoundedRect(ctx, rightX, ry, rightMaxW, 56, 10);
    ctx.fillStyle = '#ecfdf5';
    ctx.fill();
    ctx.strokeStyle = '#6ee7b7';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#065f46';
    ctx.font = 'bold 12px Arial, Helvetica, sans-serif';
    ctx.fillText('PC OPÉRATIONS & URGENCE 24H/24 — 7J/7', rightX + 14, ry + 10);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 17px Arial, Helvetica, sans-serif';
    drawClippedText(
      ctx,
      settings?.telephoneUrgence247 || settings?.telephonePrincipal || '+227 20 73 45 90',
      rightX + 14,
      ry + 28,
      rightMaxW - 28
    );

    ry += 68;

    // Mention restitution & propriété
    ctx.fillStyle = '#475569';
    ctx.font = '12px Arial, Helvetica, sans-serif';
    const notice = `Cette carte est la propriété exclusive de ${settings?.raisonSociale || 'Niger Sécurité Privée'}. En cas de perte ou découverte, la rapporter au siège (${settings?.adresse || 'Niamey'}, ${settings?.ville || 'Niger'}) ou contacter le PC 24/7.`;
    ry = drawWrapLines(ctx, notice, rightX, ry, rightMaxW, 16, 4);

    // Zone visa Direction en bas à droite
    const visaY = cardY + cardH - 58;
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rightX, visaY + 26);
    ctx.lineTo(cardX + cardW - 24, visaY + 26);
    ctx.stroke();
    ctx.fillStyle = '#64748b';
    ctx.font = 'italic 11px Arial, Helvetica, sans-serif';
    ctx.fillText('Visa & cachet Direction Générale', rightX, visaY + 30);

    // Pied de carte Verso
    const footH = 26;
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(cardX, cardY + cardH - footH, cardW, footH);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cardX, cardY + cardH - footH);
    ctx.lineTo(cardX + cardW, cardY + cardH - footH);
    ctx.stroke();

    ctx.fillStyle = '#475569';
    ctx.font = '11px Arial, Helvetica, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    drawClippedText(
      ctx,
      `RCCM : ${settings?.rccm || 'NI-NIA-2021-B-890'}  •  NIF : ${settings?.nif || '48291/S'}  •  ${settings?.ville || 'Niamey, Niger'}`,
      cardX + cardW / 2,
      cardY + cardH - footH / 2,
      cardW - 32
    );
  }

  ctx.restore();

  // Contour fin extérieur de la carte PVC
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, radius);
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Indication discrète d'alignement hors zone de découpe (haut + bas de la feuille A4)
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#475569';
  ctx.font = 'bold 20px Arial, Helvetica, sans-serif';
  ctx.fillText(
    `${pageLabel}  —  ${agent.prenom} ${agent.nom} (${agent.matricule})`,
    W / 2,
    120
  );

  ctx.fillStyle = '#64748b';
  ctx.font = '16px Arial, Helvetica, sans-serif';
  ctx.fillText(
    'Format carte PVC standard CR80 (85,6 × 53,98 mm) • Imprimer à 100 % (taille réelle) • Recto-verso : retournement bord long',
    W / 2,
    cardY + cardH + 78
  );

  const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.94);
  return {
    bytes: dataUrlToUint8Array(jpegDataUrl),
    width: W,
    height: H,
  };
}

/**
 * Génère le fichier PDF A4 prêt à imprimer du badge agent selon le mode choisi :
 * - 'recto_verso' : 2 pages A4 parfaitement alignées (Page 1 Recto, Page 2 Verso)
 * - 'recto_seul'  : 1 page A4 (Face Recto uniquement)
 * - 'verso_seul'  : 1 page A4 (Face Verso uniquement)
 */
export async function generateAgentBadgePdfBlob(params: AgentBadgeRenderParams): Promise<Blob> {
  const { mode, ...renderData } = params;
  const pages: PdfJpegPageInput[] = [];

  if (mode === 'recto_verso' || mode === 'recto_seul') {
    pages.push(
      await renderBadgeA4Page(
        'recto',
        renderData,
        mode === 'recto_verso' ? 'FACE 1 / 2 — RECTO DU BADGE AGENT' : 'FACE RECTO DU BADGE AGENT'
      )
    );
  }

  if (mode === 'recto_verso' || mode === 'verso_seul') {
    pages.push(
      await renderBadgeA4Page(
        'verso',
        renderData,
        mode === 'recto_verso' ? 'FACE 2 / 2 — VERSO DU BADGE AGENT' : 'FACE VERSO DU BADGE AGENT'
      )
    );
  }

  return buildA4MultiPagePdfFromJpegs(pages);
}

export function getAgentBadgePdfFilename(agent: AgentSecurite, mode: BadgePrintMode): string {
  const suffix =
    mode === 'recto_verso' ? 'RectoVerso' : mode === 'recto_seul' ? 'Recto' : 'Verso';
  return `Badge_PVC_${sanitizeFileSegment(agent.matricule, 'Agent')}_${sanitizeFileSegment(agent.nom, 'Nom')}_${suffix}.pdf`;
}

export { triggerBlobDownload };
