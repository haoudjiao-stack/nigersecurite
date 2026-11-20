import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Printer,
  Shield,
  QrCode,
  Download,
  FileDown,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { PointControleSite, SiteGardiennage, EnterpriseSettings } from '../types';
import { buildCheckpointQrPayload, generateQrCodeDataUrl } from '../utils/qrCodeUtils';
import {
  dataUrlToBlob,
  generateCheckpointA4PdfBlob,
  sanitizeFileSegment,
  triggerBlobDownload,
} from '../utils/checkpointExportUtils';

interface CheckpointPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  checkpoint: PointControleSite | null;
  site: SiteGardiennage | null;
  settings?: EnterpriseSettings;
}

type ActionFeedback = {
  type: 'success' | 'info' | 'error';
  message: string;
} | null;

export const CheckpointPrintModal: React.FC<CheckpointPrintModalProps> = ({
  isOpen,
  onClose,
  checkpoint,
  site,
  settings,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [isLoadingQr, setIsLoadingQr] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [feedback, setFeedback] = useState<ActionFeedback>(null);

  const effectivePayload =
    checkpoint && site
      ? checkpoint.qrPayload || buildCheckpointQrPayload(site.id, checkpoint.id)
      : '';

  const editionDate = React.useMemo(() => new Date().toLocaleDateString('fr-FR'), [checkpoint?.id]);

  useEffect(() => {
    let cancelled = false;
    if (!isOpen || !checkpoint || !site || !effectivePayload) {
      return;
    }

    setIsLoadingQr(true);
    setQrError(null);
    setFeedback(null);

    generateQrCodeDataUrl(effectivePayload)
      .then((url) => {
        if (!cancelled) {
          setQrDataUrl(url);
          setIsLoadingQr(false);
        }
      })
      .catch((err) => {
        console.error('[NIGER SÉCURITÉ Print] Échec génération QR-Code:', err);
        if (!cancelled) {
          setQrDataUrl(null);
          setQrError('Impossible de générer le QR-Code pour ce point de contrôle.');
          setIsLoadingQr(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, checkpoint, site, effectivePayload]);

  const ensureQrDataUrl = useCallback(async (): Promise<string> => {
    if (qrDataUrl) return qrDataUrl;
    if (!effectivePayload) {
      throw new Error('Données du point de contrôle manquantes.');
    }
    const generated = await generateQrCodeDataUrl(effectivePayload);
    setQrDataUrl(generated);
    setQrError(null);
    return generated;
  }, [qrDataUrl, effectivePayload]);

  const handleDownloadPdf = useCallback(
    async (triggeredAsFallback = false) => {
      if (!checkpoint || !site) return;
      setIsExportingPdf(true);
      try {
        const resolvedQr = await ensureQrDataUrl();
        const pdfBlob = await generateCheckpointA4PdfBlob({
          checkpoint,
          site,
          qrDataUrl: resolvedQr,
          settings,
          editionDate,
        });
        const filename = `Fiche_Ronde_A4_${sanitizeFileSegment(site.nom, 'Site')}_${sanitizeFileSegment(checkpoint.nom, 'Point')}.pdf`;
        triggerBlobDownload(pdfBlob, filename);
        setFeedback({
          type: triggeredAsFallback ? 'info' : 'success',
          message: triggeredAsFallback
            ? `La fenêtre d'impression du navigateur est bloquée par ce cadre d'aperçu : la fiche officielle A4 a été générée et téléchargée en PDF (${filename}). Pour utiliser la boîte d'impression système, ouvrez l'application dans un onglet dédié.`
            : `Fiche officielle A4 téléchargée en PDF (${filename}).`,
        });
      } catch (err: any) {
        console.error('[NIGER SÉCURITÉ Export PDF] Erreur:', err);
        setFeedback({
          type: 'error',
          message: err?.message || 'Erreur lors de la génération du PDF A4.',
        });
      } finally {
        setIsExportingPdf(false);
      }
    },
    [checkpoint, site, settings, editionDate, ensureQrDataUrl]
  );

  const handleDownloadImage = useCallback(async () => {
    if (!checkpoint || !site) return;
    try {
      const resolvedQr = await ensureQrDataUrl();
      const pngBlob = dataUrlToBlob(resolvedQr);
      const filename = `QR_${sanitizeFileSegment(site.nom, 'Site')}_${sanitizeFileSegment(checkpoint.nom, 'Point')}.png`;
      triggerBlobDownload(pngBlob, filename);
      setFeedback({
        type: 'success',
        message: `Image PNG du QR-Code téléchargée (${filename}).`,
      });
    } catch (err: any) {
      console.error('[NIGER SÉCURITÉ Export PNG] Erreur:', err);
      setFeedback({
        type: 'error',
        message: err?.message || "Impossible de télécharger l'image PNG du QR-Code.",
      });
    }
  }, [checkpoint, site, ensureQrDataUrl]);

  const handlePrint = useCallback(() => {
    if (!checkpoint || !site) return;

    if (!qrDataUrl) {
      setFeedback({
        type: 'info',
        message: 'Génération du QR-Code en cours, veuillez patienter un instant puis réessayer.',
      });
      ensureQrDataUrl().catch((err) => {
        setFeedback({
          type: 'error',
          message: err?.message || 'Impossible de préparer le QR-Code pour impression.',
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
        throw new Error('La fonction window.print() est indisponible dans ce navigateur.');
      }
      window.print();
    } catch (err) {
      console.error('[NIGER SÉCURITÉ Print] Erreur lors de window.print():', err);
      window.removeEventListener('beforeprint', onBeforePrint);
      void handleDownloadPdf(true);
      return;
    }

    // Si window.print() bloque le thread JS (> 250ms), c'est que la fenêtre d'impression s'est bien ouverte
    if (Date.now() - startTime > 250) {
      printDialogTriggered = true;
    }

    // Détection fiable d'un blocage silencieux (ex. iframe sandbox sans allow-modals)
    window.setTimeout(() => {
      window.removeEventListener('beforeprint', onBeforePrint);
      if (!printDialogTriggered) {
        void handleDownloadPdf(true);
      }
    }, 350);
  }, [checkpoint, site, qrDataUrl, ensureQrDataUrl, handleDownloadPdf]);

  if (!isOpen || !checkpoint || !site) return null;

  return (
    <div className="print-modal-backdrop fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in overflow-y-auto">
      <div className="print-modal-card bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[95vh] flex flex-col shadow-2xl text-slate-100 overflow-hidden relative my-auto">
        {/* Barre d'outils supérieure */}
        <div className="p-3.5 bg-slate-950 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 sticky top-0 z-10 print:hidden">
          <div className="flex items-center gap-2 min-w-0">
            <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 shrink-0">
              <Printer className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <h3 className="font-bold text-white text-xs sm:text-sm truncate">Fiche Officielle Point de Ronde</h3>
              <p className="text-[11px] text-slate-400 truncate">À plastifier et afficher sur le site de gardiennage</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadImage}
              disabled={isLoadingQr}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border border-slate-700"
              title="Télécharger l'image PNG du QR-Code"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline">Image PNG</span>
            </button>
            <button
              type="button"
              onClick={() => handleDownloadPdf(false)}
              disabled={isLoadingQr || isExportingPdf}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border border-slate-700"
              title="Télécharger directement la fiche complète au format PDF A4"
            >
              <FileDown className="w-4 h-4 text-blue-400" />
              <span className="hidden sm:inline">{isExportingPdf ? 'PDF...' : 'PDF A4'}</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              disabled={isLoadingQr}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-emerald-950/40"
              title="Ouvrir la fenêtre d'impression A4 du navigateur ou enregistrer en PDF"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimer A4</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
              title="Fermer la fenêtre"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Bandeau d'état / confirmation / erreur (jamais imprimé) */}
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

        {/* Fiche imprimable (Style A4 Professionnel) */}
        <div className="print-modal-scroll p-4 sm:p-6 bg-slate-950/60 overflow-y-auto flex-1 flex justify-center">
          <div className="print-sheet max-w-xl w-full">
            <div className="bg-white text-slate-900 rounded-xl print:rounded-none p-6 sm:p-8 print:p-5 shadow-2xl print:shadow-none w-full border-2 border-slate-800 font-sans text-xs space-y-5 print:space-y-4">
            {/* Entête officiel */}
            <div className="print-avoid-break print-keep-with-next flex items-start justify-between gap-3 pb-3 border-b-2 border-slate-900">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {settings?.logoUrl ? (
                  <div className="w-12 h-12 rounded-lg border border-slate-300 p-1 bg-white flex items-center justify-center overflow-hidden shrink-0">
                    <img src={settings.logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
                  </div>
                ) : (
                  <div className="p-2 rounded-lg bg-emerald-700 text-white shrink-0">
                    <Shield className="w-6 h-6" />
                  </div>
                )}
                <div className="min-w-0">
                  <h4 className="font-black text-sm sm:text-base uppercase tracking-tight text-slate-900">
                    {settings?.raisonSociale || 'NIGER SÉCURITÉ PRIVÉE'}
                  </h4>
                  <p className="text-[10px] text-slate-600 font-semibold">
                    Poste de Faction • Surveillance & Sécurité Physique
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {settings?.adresse || 'Niamey'} • {settings?.ville || 'République du Niger'}
                    {settings?.telephonePrincipal ? ` • Tél : ${settings.telephonePrincipal}` : ''}
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-800 border border-slate-400 px-2.5 py-1 rounded shrink-0">
                Point N° {checkpoint.ordre || 1}
              </span>
            </div>

            {/* Titre du point */}
            <div className="print-avoid-break print-keep-with-next text-center space-y-1">
              <span className="inline-block text-[10px] uppercase font-bold tracking-widest text-emerald-800 bg-emerald-50 px-3 py-0.5 rounded-full border border-emerald-300">
                POINT DE VÉRIFICATION RONDE OFFICIEL
              </span>
              <h2 className="text-lg sm:text-xl font-black text-slate-950 uppercase pt-1">
                {checkpoint.nom}
              </h2>
              <p className="text-xs text-slate-600 font-medium">
                Site : <strong className="text-slate-900">{site.nom}</strong> ({site.quartier}, {site.ville || 'Niamey'})
              </p>
            </div>

            {/* Cadre central avec le véritable QR-Code généré */}
            <div className="print-avoid-break flex flex-col items-center justify-center p-4 bg-slate-50 border-2 border-dashed border-slate-400 rounded-2xl text-center space-y-2.5">
              <div className="p-3 bg-white rounded-xl border border-slate-300 shadow-sm print:shadow-none inline-block">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt={`QR-Code ${checkpoint.nom}`}
                    className="w-48 h-48 sm:w-56 sm:h-56 print:w-52 print:h-52 object-contain"
                  />
                ) : (
                  <div className="w-48 h-48 flex items-center justify-center text-slate-400">
                    <QrCode className="w-12 h-12 animate-pulse" />
                  </div>
                )}
              </div>
              <div className="space-y-0.5">
                <p className="font-mono font-bold text-xs text-slate-900">{checkpoint.id}</p>
                <p className="text-[10px] text-slate-600 uppercase tracking-wider font-semibold">
                  Scannez via l'application mobile Contrôleur NIGER SÉCURITÉ
                </p>
              </div>
            </div>

            {/* Emplacement et Consignes */}
            <div className="print-avoid-break p-3.5 bg-slate-100 rounded-xl border border-slate-300 space-y-2 text-left text-[11px]">
              <div>
                <span className="font-bold text-slate-900 uppercase text-[10px] block">Emplacement fixe :</span>
                <p className="text-slate-700">{checkpoint.emplacement}</p>
              </div>
              <div>
                <span className="font-bold text-slate-900 uppercase text-[10px] block">Consignes de faction :</span>
                <p className="text-slate-700 leading-relaxed">
                  {checkpoint.consignes || 'Vérification complète du secteur et pointage obligatoire.'}
                </p>
              </div>
            </div>

            {/* Zones de cachet et signatures des deux responsables + pied de page officiel */}
            <div className="print-avoid-break pt-2 space-y-3">
              <div className="pt-3 border-t border-slate-300 grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-4 text-[11px] text-slate-700">
                <div className="border border-slate-400 rounded-lg p-3 min-h-[96px] print:h-24 flex flex-col justify-between bg-white">
                  <div>
                    <p className="font-bold text-slate-900 uppercase text-[10px]">
                      Pour le Responsable d'Exploitation :
                    </p>
                    <p className="text-[9.5px] text-slate-500 mt-0.5">Installation sur site, date & signature</p>
                  </div>
                  <p className="text-[9.5px] text-slate-500 italic border-t border-dashed border-slate-300 pt-1">
                    Signature et mention « Point vérifié et installé »
                  </p>
                </div>
                <div className="border border-slate-400 rounded-lg p-3 min-h-[96px] print:h-24 flex flex-col justify-between bg-white">
                  <div>
                    <p className="font-bold text-slate-900 uppercase text-[10px]">
                      Pour la Direction Générale :
                    </p>
                    <p className="text-[9.5px] text-slate-500 mt-0.5">Cachet officiel & approbation</p>
                  </div>
                  <p className="text-[9.5px] text-slate-500 italic border-t border-dashed border-slate-300 pt-1">
                    Visa, cachet officiel et approbation
                  </p>
                </div>
              </div>

              {/* Pied de page du document */}
              <div className="pt-2 border-t border-slate-300 flex flex-col sm:flex-row print:flex-row items-center justify-between gap-1 text-[10px] text-slate-600">
                <span>
                  NIF : {settings?.nif || '48291/S'} • RCCM : {settings?.rccm || 'NI-NIA-2021-B-890'} • Agrément Ministère de l'Intérieur
                </span>
                <span className="shrink-0 font-medium">Édition certifiée le {editionDate}</span>
              </div>
            </div>
            </div>
          </div>
        </div>

        {/* Pied de page modale */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs print:hidden">
          <span className="text-[11px] text-slate-500">
            Ce QR-Code est permanent et sécurisé par signature d'authenticité.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
