import { describe, it, expect } from 'vitest';
import {
  buildAgentBadgeQrPayload,
  generateQrCodeDataUrl,
  getAgentBadgeVerificationCode,
  parseAgentBadgeQrPayload,
  verifyAgentBadgeQrPayload,
} from '../src/utils/qrCodeUtils';
import {
  buildA4MultiPagePdfFromJpegs,
  getAgentBadgePdfFilename,
} from '../src/utils/agentBadgeExportUtils';
import { AgentSecurite } from '../src/types';

const sampleAgent: AgentSecurite = {
  id: 'ag-101',
  matricule: 'NS-2026-0142',
  nom: 'MAMANE',
  prenom: 'Ibrahim Dan-Ladi',
  dateNaissance: '1991-04-18',
  telephone: '+227 96 12 34 56',
  quartier: 'Lazaret, Niamey',
  contactUrgenceNom: 'Aichatou Mamane',
  contactUrgenceTelephone: '+227 90 11 22 33',
  groupeSanguin: 'O+',
  numeroCNSS: 'NE-CNSS-9876543',
  dateEmbauche: '2024-02-01',
  poste: 'Chef de Poste',
  typeContrat: 'CDI',
  siteActuel: 'Siège BSIC Niamey',
  siteId: 'site-bsic',
  horaire: 'Poste Jour (06h-18h)',
  statut: 'En poste',
  equipement: {
    tenueComplete: true,
    rangers: true,
    badge: true,
    tonfaOuMatraque: true,
    torche: true,
    sifflet: true,
  },
  salaireBase: 125000,
  primeNuit: 0,
  primeAssiduite: 15000,
  indemnitePanier: 20000,
  retenuesOuAvances: 0,
  modePaiement: 'Virement bancaire',
  referencePaiement: 'NE05 2010 0000 1234',
};

describe('Badge Agent PVC — QR Code non sensible & export PDF recto-verso', () => {
  it('1. Génère un QR code unique lié à l’identifiant agent sans exposer aucune donnée personnelle', () => {
    const payload = buildAgentBadgeQrPayload(sampleAgent.id, sampleAgent.matricule);
    const parsed = parseAgentBadgeQrPayload(payload);

    expect(parsed.valid).toBe(true);
    expect(parsed.agentRef).toBe('NS-2026-0142');
    expect(parsed.verificationCode).toMatch(/^[0-9A-F]{8}$/);
    expect(verifyAgentBadgeQrPayload(payload, sampleAgent.id, sampleAgent.matricule)).toBe(true);

    // Vérification stricte : aucune donnée personnelle sensible exposée dans le QR code
    const forbiddenValues = [
      sampleAgent.nom,
      sampleAgent.prenom,
      'Ibrahim',
      sampleAgent.dateNaissance,
      sampleAgent.telephone,
      '96 12 34 56',
      sampleAgent.quartier,
      'Lazaret',
      sampleAgent.numeroCNSS,
      sampleAgent.contactUrgenceNom || '',
      sampleAgent.contactUrgenceTelephone || '',
      sampleAgent.groupeSanguin,
      String(sampleAgent.salaireBase),
      sampleAgent.referencePaiement || '',
    ];

    for (const sensitive of forbiddenValues) {
      expect(payload.toLowerCase()).not.toContain(sensitive.toLowerCase());
    }
  });

  it('2. Produit des codes uniques et déterministes distincts entre deux agents', () => {
    const payloadA = buildAgentBadgeQrPayload('ag-101', 'NS-2026-0142');
    const payloadA2 = buildAgentBadgeQrPayload('ag-101', 'NS-2026-0142');
    const payloadB = buildAgentBadgeQrPayload('ag-102', 'NS-2026-0143');

    expect(payloadA).toBe(payloadA2);
    expect(payloadA).not.toBe(payloadB);
    expect(getAgentBadgeVerificationCode('ag-101', 'NS-2026-0142')).not.toBe(
      getAgentBadgeVerificationCode('ag-102', 'NS-2026-0143')
    );
    expect(verifyAgentBadgeQrPayload(payloadA, 'ag-102', 'NS-2026-0143')).toBe(false);
  });

  it('3. Rejette les QR codes altérés ou appartenant aux points de ronde', () => {
    const valid = buildAgentBadgeQrPayload(sampleAgent.id, sampleAgent.matricule);
    const tampered = valid.slice(0, -1) + (valid.endsWith('A') ? 'B' : 'A');

    expect(verifyAgentBadgeQrPayload(tampered, sampleAgent.id, sampleAgent.matricule)).toBe(false);
    expect(parseAgentBadgeQrPayload('NSP_PATROL|V1|site:s1|point:p1|sec:ABCD').valid).toBe(false);
    expect(parseAgentBadgeQrPayload('').valid).toBe(false);
  });

  it('4. Génère réellement une image PNG Data URL de QR code scannable pour le verso', async () => {
    const payload = buildAgentBadgeQrPayload(sampleAgent.id, sampleAgent.matricule);
    const dataUrl = await generateQrCodeDataUrl(payload, {
      width: 420,
      margin: 1,
      errorCorrectionLevel: 'Q',
    });

    expect(dataUrl.startsWith('data:image/png;base64,')).toBe(true);
    expect(dataUrl.length).toBeGreaterThan(500);
  });

  it('5. Assemble un PDF 2 pages valide pour Recto-Verso et 1 page pour impression séparée', async () => {
    const fakeJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0xff, 0xd9]);

    const duplexBlob = buildA4MultiPagePdfFromJpegs([
      { bytes: fakeJpeg, width: 1654, height: 2339 },
      { bytes: fakeJpeg, width: 1654, height: 2339 },
    ]);
    const duplexText = await duplexBlob.text();
    expect(duplexBlob.type).toBe('application/pdf');
    expect(duplexText.startsWith('%PDF-1.4')).toBe(true);
    expect(duplexText).toContain('/Count 2');
    expect(duplexText).toContain('/Im0');
    expect(duplexText).toContain('/Im1');
    expect(duplexText).toContain('%%EOF');

    const singleFaceBlob = buildA4MultiPagePdfFromJpegs([
      { bytes: fakeJpeg, width: 1654, height: 2339 },
    ]);
    const singleText = await singleFaceBlob.text();
    expect(singleText).toContain('/Count 1');
    expect(singleText).toContain('/Im0');
    expect(singleText).not.toContain('/Im1');

    expect(getAgentBadgePdfFilename(sampleAgent, 'recto_verso')).toBe(
      'Badge_PVC_NS-2026-0142_MAMANE_RectoVerso.pdf'
    );
    expect(getAgentBadgePdfFilename(sampleAgent, 'recto_seul')).toBe(
      'Badge_PVC_NS-2026-0142_MAMANE_Recto.pdf'
    );
    expect(getAgentBadgePdfFilename(sampleAgent, 'verso_seul')).toBe(
      'Badge_PVC_NS-2026-0142_MAMANE_Verso.pdf'
    );
  });
});
