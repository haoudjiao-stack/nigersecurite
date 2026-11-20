import { describe, it, expect } from 'vitest';
import { buildCheckpointQrPayload, generateQrCodeDataUrl } from '../src/utils/qrCodeUtils';
import {
  buildA4PdfFromJpegBytes,
  dataUrlToBlob,
  sanitizeFileSegment,
} from '../src/utils/checkpointExportUtils';

describe('Fiche Officielle Point de Ronde — Export PNG & PDF A4', () => {
  it('1. Génère un QR-Code PNG valide et le convertit en Blob image/png (signature PNG)', async () => {
    const payload = buildCheckpointQrPayload('site-1', 'ckp-1');
    const dataUrl = await generateQrCodeDataUrl(payload);

    expect(dataUrl.startsWith('data:image/png;base64,')).toBe(true);

    const blob = dataUrlToBlob(dataUrl);
    expect(blob.type).toBe('image/png');
    expect(blob.size).toBeGreaterThan(200);

    const bytes = new Uint8Array(await blob.arrayBuffer());
    // Signature magique PNG : 89 50 4E 47 0D 0A 1A 0A
    expect(Array.from(bytes.slice(0, 8))).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  });

  it('2. Nettoie correctement les noms de fichiers (accents, espaces, slashs)', () => {
    expect(sanitizeFileSegment('Siège BSIC / Plateau: Niamey')).toBe('Siege_BSIC_Plateau_Niamey');
    expect(sanitizeFileSegment('Guérite Entrée Principale #1')).toBe('Guerite_Entree_Principale_1');
    expect(sanitizeFileSegment('   ', 'Point')).toBe('Point');
  });

  it('3. Construit un fichier PDF 1.4 A4 valide avec offsets xref exacts', async () => {
    // Flux JPEG minimal de test (SOI + EOI)
    const sampleJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0xff, 0xd9]);
    const pdfBlob = buildA4PdfFromJpegBytes(sampleJpeg, 1240, 1754);

    expect(pdfBlob.type).toBe('application/pdf');
    const pdfBytes = new Uint8Array(await pdfBlob.arrayBuffer());
    const pdfText = new TextDecoder('latin1').decode(pdfBytes);

    expect(pdfText.startsWith('%PDF-1.4\n')).toBe(true);
    expect(pdfText).toContain('/MediaBox [0 0 595.28 841.89]');
    expect(pdfText).toContain('/Width 1240 /Height 1754');
    expect(pdfText).toContain('/Filter /DCTDecode');
    expect(pdfText.trimEnd().endsWith('%%EOF')).toBe(true);

    // Vérification stricte de startxref et de chaque offset dans la table xref
    const startXrefMatch = pdfText.match(/startxref\n(\d+)\n%%EOF/);
    expect(startXrefMatch).not.toBeNull();
    const declaredXrefOffset = Number(startXrefMatch![1]);
    expect(pdfText.slice(declaredXrefOffset, declaredXrefOffset + 4)).toBe('xref');

    const xrefBlock = pdfText.slice(declaredXrefOffset);
    const objOffsets = [...xrefBlock.matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
    expect(objOffsets).toHaveLength(5);

    objOffsets.forEach((offset, idx) => {
      const objNumber = idx + 1;
      expect(pdfText.slice(offset, offset + `${objNumber} 0 obj`.length)).toBe(`${objNumber} 0 obj`);
    });
  });
});
