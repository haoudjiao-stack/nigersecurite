import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  X,
  Shield,
  QrCode,
  User,
  ArrowLeft,
  Printer,
  FileDown,
  Camera,
  CheckCircle2,
  AlertCircle,
  Layers,
  CreditCard,
  Info,
} from 'lucide-react';
import { AgentSecurite, EnterpriseSettings } from '../types';
import {
  buildAgentBadgeQrPayload,
  generateQrCodeDataUrl,
  getAgentBadgeVerificationCode,
} from '../utils/qrCodeUtils';
import {
  BadgePrintMode,
  generateAgentBadgePdfBlob,
  getAgentBadgePdfFilename,
  triggerBlobDownload,
} from '../utils/agentBadgeExportUtils';

interface AgentBadgeModalProps {
  agent: AgentSecurite | null;
  settings?: EnterpriseSettings;
  canPrintBadge?: boolean;
  onEditAgentPhoto?: (agent: AgentSecurite) => void;
  onClose: () => void;
}

type BadgeFeedback = {
  type: 'success' | 'info' | 'error';
  message: string;
} | null;

const CropMarksOverlay: React.FC = () => (
  <div className="hidden print:block pointer-events-none absolute -inset-[5mm]">
    {/* Haut gauche */}
    <span className="absolute top-[5mm] left-0 w-[3.5mm] border-t border-slate-500" />
    <span className="absolute top-0 left-[5mm] h-[3.5mm] border-l border-slate-500" />
    {/* Haut droite */}
    <span className="absolute top-[5mm] right-0 w-[3.5mm] border-t border-slate-500" />
    <span className="absolute top-0 right-[5mm] h-[3.5mm] border-r border-slate-500" />
    {/* Bas gauche */}
    <span className="absolute bottom-[5mm] left-0 w-[3.5mm] border-t border-slate-500" />
    <span className="absolute bottom-0 left-[5mm] h-[3.5mm] border-l border-slate-500" />
    {/* Bas droite */}
    <span className="absolute bottom-[5mm] right-0 w-[3.5mm] border-t border-slate-500" />
    <span className="absolute bottom-0 right-[5mm] h-[3.5mm] border-r border-slate-500" />
  </div>
);

export const AgentBadgeModal: React.FC<AgentBadgeModalProps> = ({
  agent,
  settings,
  canPrintBadge = false,
  onEditAgentPhoto,
  onClose,
}) => {
  const [printMode, setPrintMode] = useState<BadgePrintMode>('recto_verso');
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [isLoadingQr, setIsLoadingQr] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [feedback, setFeedback] = useState<BadgeFeedback>(null);

  const editionDate = useMemo(() => new Date().toLocaleDateString('fr-FR'), [agent?.id]);

  const qrPayload = useMemo(() => {
    if (!agent) return '';
    try {
      return buildAgentBadgeQrPayload(agent.id, agent.matricule);
    } catch {
      return '';
    }
  }, [agent?.id, agent?.matricule]);

  const verificationCode = useMemo(() => {
    if (!agent) return '';
    return getAgentBadgeVerificationCode(agent.id, agent.matricule);
  }, [agent?.id, agent?.matricule]);

  // Fermeture automatique à la touche Échap
  useEffect(() => {
    if (!agent) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [agent, onClose]);

  // Génération automatique du QR code unique non sensible dès l'ouverture
  useEffect(() => {
    let cancelled = false;
    if (!agent || !qrPayload) {
      setQrDataUrl(null);
      return;
    }

    setIsLoadingQr(true);
    setQrError(null);
    setFeedback(null);

    generateQrCodeDataUrl(qrPayload, {
      width: 420,
      margin: 1,
      errorCorrectionLevel: 'Q',
    })
      .then((url) => {
        if (!cancelled) {
          setQrDataUrl(url);
          setIsLoadingQr(false);
        }
      })
      .catch((err) => {
        console.error('[NIGER SÉCURITÉ Badge] Échec génération QR-Code:', err);
        if (!cancelled) {
          setQrDataUrl(null);
          setQrError('Impossible de générer le QR-Code d’identification pour cet agent.');
          setIsLoadingQr(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [agent, qrPayload]);

  const ensureQrDataUrl = useCallback(async (): Promise<string> => {
    if (qrDataUrl) return qrDataUrl;
    if (!qrPayload) {
      throw new Error('Identifiant de l’agent manquant pour générer le QR-Code.');
    }
    const generated = await generateQrCodeDataUrl(qrPayload, {
      width: 420,
      margin: 1,
      errorCorrectionLevel: 'Q',
    });
    setQrDataUrl(generated);
    setQrError(null);
    return generated;
  }, [qrDataUrl, qrPayload]);

  const handleDownloadPdf = useCallback(
    async (triggeredAsFallback = false) => {
      if (!agent) return;
      setIsExportingPdf(true);
      try {
        const resolvedQr = await ensureQrDataUrl();
        const pdfBlob = await generateAgentBadgePdfBlob({
          agent,
          qrDataUrl: resolvedQr,
          settings,
          mode: printMode,
          editionDate,
        });
        const filename = getAgentBadgePdfFilename(agent, printMode);
        triggerBlobDownload(pdfBlob, filename);

        const modeLabel =
          printMode === 'recto_verso'
            ? 'Recto-Verso aligné (2 pages A4)'
            : printMode === 'recto_seul'
            ? 'Face Recto seule'
            : 'Face Verso seule';

        setFeedback({
          type: triggeredAsFallback ? 'info' : 'success',
          message: triggeredAsFallback
            ? `La fenêtre d’impression du navigateur est bloquée dans ce cadre d’aperçu : le PDF prêt à imprimer (${modeLabel}) a été téléchargé (${filename}). Imprimez-le à 100 % (taille réelle).`
            : `PDF badge PVC (${modeLabel}) téléchargé : ${filename}. Imprimez à l’échelle 100 % sans redimensionnement.`,
        });
      } catch (err: any) {
        console.error('[NIGER SÉCURITÉ Badge PDF] Erreur:', err);
        setFeedback({
          type: 'error',
          message: err?.message || 'Erreur lors de la génération du PDF du badge.',
        });
      } finally {
        setIsExportingPdf(false);
      }
    },
    [agent, settings, printMode, editionDate, ensureQrDataUrl]
  );

  const handlePrint = useCallback(() => {
    if (!agent || !canPrintBadge) return;

    if (!qrDataUrl && (printMode === 'recto_verso' || printMode === 'verso_seul')) {
      setFeedback({
        type: 'info',
        message: 'Génération du QR-Code en cours, patientez un instant puis relancez l’impression.',
      });
      ensureQrDataUrl().catch((err) => {
        setFeedback({
          type: 'error',
          message: err?.message || 'Impossible de préparer le QR-Code du badge.',
        });
      });
      return;
    }

    setFeedback(null);

    let printDialogTriggered = false;
    const onBeforePrint = () => {
      printDialogTriggered = true;
    };
    window.addEventListener('beforeprint', onBeforePrint, { once: true });

    const startTime = Date.now();
    try {
      if (typeof window.print !== 'function') {
        throw new Error('window.print indisponible');
      }
      window.print();
    } catch {
      window.removeEventListener('beforeprint', onBeforePrint);
      void handleDownloadPdf(true);
      return;
    }

    if (Date.now() - startTime > 250) {
      printDialogTriggered = true;
    }

    window.setTimeout(() => {
      window.removeEventListener('beforeprint', onBeforePrint);
      if (!printDialogTriggered) {
        void handleDownloadPdf(true);
      }
    }, 350);
  }, [agent, canPrintBadge, printMode, qrDataUrl, ensureQrDataUrl, handleDownloadPdf]);

  if (!agent) return null;

  const companyName = settings?.raisonSociale || 'NIGER SÉCURITÉ PRIVÉE';
  const companySigle = (settings?.sigle || 'NS').trim().slice(0, 4).toUpperCase();
  const showRectoInPrint = printMode === 'recto_verso' || printMode === 'recto_seul';
  const showVersoInPrint = printMode === 'recto_verso' || printMode === 'verso_seul';

  const printActionLabel =
    printMode === 'recto_verso'
      ? 'Imprimer Recto-Verso'
      : printMode === 'recto_seul'
      ? 'Imprimer Recto seul'
      : 'Imprimer Verso seul';

  return (
    <div
      className="print-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Badge professionnel PVC de l'agent"
    >
      <div className="print-modal-card bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-5xl max-h-[94vh] flex flex-col shadow-2xl text-slate-100 overflow-hidden relative my-auto">
        {/* Barre supérieure (masquée à l'impression) */}
        <div className="p-3.5 sm:p-4 bg-slate-950/95 backdrop-blur-sm flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-800 sticky top-0 z-20 print:hidden">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0">
              <CreditCard className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-white truncate">
                {canPrintBadge ? 'Création & Impression Badge PVC Agent' : 'Badge Professionnel Agent'}
              </h3>
              <p className="text-[11px] text-slate-400 truncate">
                Format carte PVC CR80 (85,6 × 53,98 mm) • {agent.prenom} {agent.nom} ({agent.matricule})
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canPrintBadge && (
              <>
                <button
                  type="button"
                  onClick={() => handleDownloadPdf(false)}
                  disabled={isLoadingQr || isExportingPdf}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-100 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border border-slate-700"
                  title="Télécharger le PDF prêt à imprimer selon le mode choisi"
                >
                  <FileDown className="w-4 h-4 text-blue-400" />
                  <span>{isExportingPdf ? 'Génération PDF...' : 'PDF prêt à imprimer'}</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  disabled={isLoadingQr}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-emerald-950/40"
                  title="Ouvrir l'aperçu d'impression du navigateur"
                >
                  <Printer className="w-4 h-4" />
                  <span>{printActionLabel}</span>
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold flex items-center gap-1 transition cursor-pointer border border-slate-700"
              title="Fermer (Échap)"
              aria-label="Fermer le badge"
            >
              <X className="w-4 h-4 text-slate-300" />
              <span className="hidden sm:inline">Fermer</span>
            </button>
          </div>
        </div>

        {/* Barre de sélection du mode d'impression pour la Direction (masquée à l'impression) */}
        {canPrintBadge && (
          <div className="px-4 py-3 bg-slate-900/95 border-b border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3 print:hidden">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mr-1">
                <Layers className="w-3.5 h-3.5 text-emerald-400" />
                <span>Mode d’impression :</span>
              </span>

              <button
                type="button"
                onClick={() => setPrintMode('recto_verso')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer border ${
                  printMode === 'recto_verso'
                    ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/60 shadow-sm'
                    : 'bg-slate-800/80 text-slate-400 hover:text-white border-slate-700'
                }`}
              >
                Recto-Verso aligné (2 pages)
              </button>

              <button
                type="button"
                onClick={() => setPrintMode('recto_seul')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer border ${
                  printMode === 'recto_seul'
                    ? 'bg-blue-600/20 text-blue-300 border-blue-500/60 shadow-sm'
                    : 'bg-slate-800/80 text-slate-400 hover:text-white border-slate-700'
                }`}
              >
                Recto seul (Face 1)
              </button>

              <button
                type="button"
                onClick={() => setPrintMode('verso_seul')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer border ${
                  printMode === 'verso_seul'
                    ? 'bg-blue-600/20 text-blue-300 border-blue-500/60 shadow-sm'
                    : 'bg-slate-800/80 text-slate-400 hover:text-white border-slate-700'
                }`}
              >
                Verso seul (Face 2)
              </button>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <Info className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>
                {printMode === 'recto_verso'
                  ? 'Imprimez à 100 % (taille réelle), recto-verso bord long : les 2 faces sont centrées à l’identique.'
                  : 'Idéal si votre imprimante ne gère pas le recto-verso automatique : imprimez chaque face séparément.'}
              </span>
            </div>
          </div>
        )}

        {/* Alerte photo manquante (raccourci pour la Direction) */}
        {canPrintBadge && !agent.photoUrl && (
          <div className="px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/25 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-200 print:hidden">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                Cet agent n’a pas encore de photo d’identité. Vous pouvez en prendre une par caméra ou en importer une depuis sa fiche.
              </span>
            </div>
            {onEditAgentPhoto && (
              <button
                type="button"
                onClick={() => onEditAgentPhoto(agent)}
                className="px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-100 font-semibold text-xs border border-amber-400/40 transition cursor-pointer"
              >
                Ajouter une photo
              </button>
            )}
          </div>
        )}

        {/* Retour d'action / erreur (masqué à l'impression) */}
        {(feedback || qrError) && (
          <div
            className={`px-4 py-2.5 text-xs flex items-start justify-between gap-2 border-b print:hidden ${
              qrError || feedback?.type === 'error'
                ? 'bg-rose-500/15 border-rose-500/30 text-rose-200'
                : feedback?.type === 'info'
                ? 'bg-blue-500/15 border-blue-500/30 text-blue-200'
                : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-200'
            }`}
          >
            <div className="flex items-start gap-2">
              {qrError || feedback?.type === 'error' ? (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
              )}
              <span>{qrError || feedback?.message}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setFeedback(null);
                setQrError(null);
              }}
              className="text-slate-300 hover:text-white text-[11px] font-semibold shrink-0 cursor-pointer"
            >
              OK
            </button>
          </div>
        )}

        {/* Zone Aperçu Avant Impression & Zone Imprimable CR80 */}
        <div className="print-modal-scroll p-4 sm:p-6 bg-slate-950/70 overflow-y-auto flex-1">
          <div className="badge-print-container grid grid-cols-1 lg:grid-cols-2 gap-6 items-start justify-items-center max-w-4xl mx-auto">
            {/* ==================== PAGE 1 : RECTO ==================== */}
            <div
              className={`badge-print-page w-full flex flex-col items-center space-y-2.5 ${
                showRectoInPrint && showVersoInPrint ? 'badge-print-page-break' : ''
              } ${!showRectoInPrint ? 'print:hidden opacity-45' : ''}`}
            >
              {/* Libellé aperçu écran */}
              <div className="w-full max-w-[420px] flex items-center justify-between text-xs print:hidden">
                <span className="font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>Face 1 — Recto (Identité)</span>
                </span>
                <span className="text-[11px] text-slate-400 font-mono">85,6 × 53,98 mm</span>
              </div>

              {/* Libellé imprimé discret hors carte */}
              <p className="hidden print:block text-[9pt] font-semibold text-slate-600 mb-[8mm] text-center">
                {printMode === 'recto_verso'
                  ? `FACE 1 / 2 — RECTO • ${agent.prenom} ${agent.nom} (${agent.matricule})`
                  : `FACE RECTO • ${agent.prenom} ${agent.nom} (${agent.matricule})`}
              </p>

              {/* Conteneur carte PVC CR80 avec repères de coupe */}
              <div className="relative w-full max-w-[420px] print:w-auto print:max-w-none">
                <CropMarksOverlay />

                <div className="badge-pvc-card w-full aspect-[85.6/53.98] bg-white text-slate-900 rounded-xl shadow-2xl border border-slate-300 overflow-hidden flex flex-col justify-between select-none">
                  {/* Bandeau supérieur institutionnel */}
                  <div className="bg-slate-900 text-white px-3 py-2 border-b-[3px] border-emerald-500 flex items-center gap-2.5 shrink-0">
                    <div className="w-9 h-9 print:w-[9.5mm] print:h-[9.5mm] rounded-lg bg-white flex items-center justify-center p-1 overflow-hidden shrink-0 border border-slate-200">
                      {settings?.logoUrl ? (
                        <img
                          src={settings.logoUrl}
                          alt="Logo entreprise"
                          className="max-w-full max-h-full object-contain"
                        />
                      ) : (
                        <span className="font-black text-emerald-700 text-xs leading-none">
                          {companySigle}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 leading-tight">
                      <p className="text-[7px] print:text-[5.5pt] font-extrabold tracking-widest uppercase text-emerald-400 truncate">
                        République du Niger • Carte Professionnelle Agent
                      </p>
                      <h4 className="text-xs sm:text-[13px] print:text-[9.5pt] font-black tracking-tight uppercase text-white truncate">
                        {companyName}
                      </h4>
                      <p className="text-[7.5px] print:text-[5.5pt] text-slate-300 truncate">
                        {settings?.agrementMinistere || 'Agrément Ministère de l’Intérieur & Sécurité Publique'}
                      </p>
                    </div>
                  </div>

                  {/* Corps Recto : Photo 3:4 à gauche + Identité & Affectation à droite */}
                  <div className="flex-1 px-3 py-2.5 print:px-[3.2mm] print:py-[2.2mm] flex items-stretch gap-3 print:gap-[3mm] min-h-0 bg-white">
                    {/* Colonne Photo + Groupe Sanguin */}
                    <div className="w-[27%] flex flex-col justify-between gap-1.5 shrink-0">
                      <div className="w-full aspect-[3/4] rounded-lg border-2 border-slate-900 bg-slate-100 overflow-hidden flex items-center justify-center">
                        {agent.photoUrl ? (
                          <img
                            src={agent.photoUrl}
                            alt={`Photo ${agent.prenom} ${agent.nom}`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-slate-400 p-1 text-center">
                            <User className="w-8 h-8 print:w-6 print:h-6 text-slate-400" />
                            <span className="text-[7px] print:text-[5pt] font-bold uppercase mt-0.5">
                              Photo Agent
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="rounded bg-rose-50 border border-rose-300 px-1 py-0.5 text-center">
                        <span className="text-[7.5px] print:text-[5.5pt] font-extrabold text-rose-700 uppercase tracking-tight block leading-none">
                          Grp : {agent.groupeSanguin || 'N/C'}
                        </span>
                      </div>
                    </div>

                    {/* Colonne Identité */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between text-left">
                      <div className="space-y-1">
                        <div>
                          <p className="text-[7px] print:text-[5.2pt] font-bold uppercase tracking-wider text-slate-500 leading-none">
                            Nom & Prénom
                          </p>
                          <p className="text-sm sm:text-[15px] print:text-[10pt] font-black text-slate-950 uppercase leading-tight truncate mt-0.5">
                            {agent.nom}
                          </p>
                          <p className="text-xs sm:text-[13px] print:text-[8.5pt] font-bold text-slate-800 leading-tight truncate">
                            {agent.prenom}
                          </p>
                        </div>

                        <div className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-300">
                          <p className="text-[9px] print:text-[6.5pt] font-extrabold uppercase text-emerald-900 truncate">
                            {agent.poste || 'Agent de Sécurité'}
                          </p>
                        </div>

                        <div className="pt-0.5">
                          <p className="text-[7px] print:text-[5.2pt] font-bold uppercase tracking-wider text-slate-500 leading-none">
                            Matricule officiel
                          </p>
                          <p className="text-xs sm:text-[13px] print:text-[8.5pt] font-mono font-black text-slate-950 tracking-wider leading-tight">
                            {agent.matricule}
                          </p>
                        </div>
                      </div>

                      <div className="pt-1 border-t border-slate-200 space-y-0.5">
                        <p className="text-[7px] print:text-[5pt] font-bold uppercase text-slate-500 leading-none">
                          Site d’affectation
                        </p>
                        <p className="text-[10px] print:text-[6.8pt] font-bold text-slate-900 truncate leading-tight">
                          {agent.siteActuel || 'Non affecté'}
                        </p>
                        <p className="text-[8.5px] print:text-[5.8pt] text-slate-600 truncate leading-tight">
                          {agent.horaire} • {agent.typeContrat}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Bandeau pied de carte Recto */}
                  <div className="bg-slate-900 text-slate-200 px-2 py-1 text-center shrink-0">
                    <p className="text-[7px] print:text-[5pt] font-bold uppercase tracking-wider truncate">
                      Port du badge obligatoire en service • Document officiel personnel
                    </p>
                  </div>
                </div>
              </div>

              <p className="hidden print:block text-[7.5pt] text-slate-500 mt-[8mm] text-center">
                Format PVC CR80 (85,6 × 53,98 mm) • Imprimer à 100 % (taille réelle) • Recto-verso : bord long
              </p>
            </div>

            {/* ==================== PAGE 2 : VERSO ==================== */}
            <div
              className={`badge-print-page w-full flex flex-col items-center space-y-2.5 ${
                !showVersoInPrint ? 'print:hidden opacity-45' : ''
              }`}
            >
              {/* Libellé aperçu écran */}
              <div className="w-full max-w-[420px] flex items-center justify-between text-xs print:hidden">
                <span className="font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-400" />
                  <span>Face 2 — Verso (QR Code & Vérification)</span>
                </span>
                <span className="text-[11px] text-slate-400 font-mono">QR intégré</span>
              </div>

              {/* Libellé imprimé discret hors carte */}
              <p className="hidden print:block text-[9pt] font-semibold text-slate-600 mb-[8mm] text-center">
                {printMode === 'recto_verso'
                  ? `FACE 2 / 2 — VERSO • ${agent.prenom} ${agent.nom} (${agent.matricule})`
                  : `FACE VERSO • ${agent.prenom} ${agent.nom} (${agent.matricule})`}
              </p>

              {/* Conteneur carte PVC CR80 Verso avec repères de coupe identiques */}
              <div className="relative w-full max-w-[420px] print:w-auto print:max-w-none">
                <CropMarksOverlay />

                <div className="badge-pvc-card w-full aspect-[85.6/53.98] bg-white text-slate-900 rounded-xl shadow-2xl border border-slate-300 overflow-hidden flex flex-col justify-between select-none">
                  {/* Bandeau supérieur Verso */}
                  <div className="bg-slate-900 text-white px-3 py-1.5 border-b-[2.5px] border-emerald-500 flex items-center justify-between shrink-0">
                    <span className="text-[8.5px] print:text-[6.2pt] font-extrabold uppercase tracking-wider truncate">
                      Vérification & Authenticité — {companyName}
                    </span>
                    <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0 ml-1" />
                  </div>

                  {/* Corps Verso : QR Code intégré à gauche + Infos vérification à droite */}
                  <div className="flex-1 px-3 py-2 print:px-[3.2mm] print:py-[2mm] flex items-stretch gap-3 print:gap-[3mm] min-h-0 bg-white">
                    {/* Colonne QR Code unique (identifiant non sensible uniquement) */}
                    <div className="w-[36%] flex flex-col items-center justify-center text-center shrink-0">
                      <div className="w-full max-w-[118px] print:w-[25.5mm] print:h-[25.5mm] aspect-square p-1.5 bg-white rounded-lg border-2 border-slate-900 flex items-center justify-center">
                        {qrDataUrl ? (
                          <img
                            src={qrDataUrl}
                            alt={`QR Code badge ${agent.matricule}`}
                            className="w-full h-full object-contain"
                            style={{ imageRendering: 'pixelated' }}
                          />
                        ) : (
                          <QrCode className="w-10 h-10 text-slate-400 animate-pulse" />
                        )}
                      </div>
                      <p className="text-[9.5px] print:text-[6.8pt] font-mono font-black text-slate-950 mt-1 leading-tight">
                        {agent.matricule}
                      </p>
                      <p className="text-[7.5px] print:text-[5.2pt] font-mono font-bold text-emerald-800 leading-tight">
                        CODE : {verificationCode}
                      </p>
                      <p className="text-[6.5px] print:text-[4.8pt] text-slate-500 leading-tight mt-0.5">
                        Identifiant non sensible seul
                      </p>
                    </div>

                    {/* Colonne Informations de Vérification & Restitution */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between text-left">
                      <div className="p-2 print:p-[1.6mm] rounded-lg bg-slate-50 border border-slate-200 space-y-0.5">
                        <p className="text-[7.5px] print:text-[5.5pt] font-extrabold uppercase text-slate-900 tracking-wide">
                          Contrôle d’identité & validité
                        </p>
                        <p className="text-[8.5px] print:text-[5.8pt] text-slate-700 truncate">
                          <span className="font-semibold">Réf. :</span> {agent.matricule} ({agent.id})
                        </p>
                        <p className="text-[8.5px] print:text-[5.8pt] text-slate-700 truncate">
                          <span className="font-semibold">Entrée :</span> {agent.dateEmbauche || 'N/C'}
                        </p>
                        <p className="text-[8.5px] print:text-[5.8pt] text-slate-700 truncate">
                          <span className="font-semibold">Édition :</span> {editionDate} • {agent.statut}
                        </p>
                      </div>

                      <div className="p-1.5 print:p-[1.4mm] rounded-lg bg-emerald-50 border border-emerald-300">
                        <p className="text-[6.8px] print:text-[5pt] font-extrabold uppercase text-emerald-800 leading-none">
                          PC Opérations & Urgence 24/7
                        </p>
                        <p className="text-[10.5px] print:text-[7.2pt] font-black text-slate-950 mt-0.5 leading-tight truncate">
                          {settings?.telephoneUrgence247 || settings?.telephonePrincipal || '+227 20 73 45 90'}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <p className="text-[7px] print:text-[4.8pt] text-slate-600 leading-snug">
                          Propriété de {companyName}. En cas de perte, rapporter au siège (
                          {settings?.adresse || 'Niamey'}, {settings?.ville || 'Niger'}) ou appeler le PC 24/7.
                        </p>
                        <div className="pt-2 border-b border-slate-400">
                          <span className="text-[6.5px] print:text-[4.6pt] italic text-slate-500 block">
                            Visa & cachet Direction Générale
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bandeau pied de carte Verso */}
                  <div className="bg-slate-100 border-t border-slate-200 px-2 py-1 text-center shrink-0">
                    <p className="text-[6.8px] print:text-[4.8pt] font-medium text-slate-600 truncate">
                      RCCM : {settings?.rccm || 'NI-NIA-2021-B-890'} • NIF : {settings?.nif || '48291/S'} • {settings?.ville || 'Niamey, Niger'}
                    </p>
                  </div>
                </div>
              </div>

              <p className="hidden print:block text-[7.5pt] text-slate-500 mt-[8mm] text-center">
                Format PVC CR80 (85,6 × 53,98 mm) • Imprimer à 100 % (taille réelle) • Recto-verso : bord long
              </p>
            </div>
          </div>

          {/* Note confidentialité QR code (masquée à l'impression) */}
          <div className="max-w-4xl mx-auto mt-5 p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-[11px] text-slate-400 flex flex-col sm:flex-row sm:items-center justify-between gap-2 print:hidden">
            <div className="flex items-start gap-2">
              <QrCode className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong className="text-slate-200">Sécurité du QR-Code :</strong> contient uniquement l’identifiant non sensible et la clé de vérification (<code className="text-emerald-300 font-mono">{qrPayload}</code>), sans aucune donnée personnelle (nom, téléphone, adresse, CNSS ou salaire).
              </span>
            </div>
          </div>
        </div>

        {/* Pied de page modale (masqué à l'impression) */}
        <div className="p-3 bg-slate-950/95 backdrop-blur-sm border-t border-slate-800 flex items-center justify-between gap-3 sticky bottom-0 z-20 print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-bold flex items-center gap-2 transition cursor-pointer border border-slate-700"
          >
            <ArrowLeft className="w-4 h-4 text-emerald-400" />
            <span>Retour</span>
          </button>

          {canPrintBadge && (
            <div className="flex items-center gap-2">
              {onEditAgentPhoto && (
                <button
                  type="button"
                  onClick={() => onEditAgentPhoto(agent)}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border border-slate-700"
                >
                  <Camera className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{agent.photoUrl ? 'Changer la photo' : 'Ajouter une photo'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={handlePrint}
                disabled={isLoadingQr}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-md"
              >
                <Printer className="w-4 h-4" />
                <span>{printActionLabel}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
