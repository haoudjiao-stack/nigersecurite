import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Upload,
  Trash2,
  User,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  X,
  SwitchCamera,
} from 'lucide-react';
import {
  captureVideoFrameToPortraitDataUrl,
  processAgentPhotoFile,
} from '../utils/agentPhotoUtils';

interface AgentPhotoFieldProps {
  value?: string;
  onChange: (photoDataUrl: string | undefined) => void;
  agentName?: string;
}

export const AgentPhotoField: React.FC<AgentPhotoFieldProps> = ({
  value,
  onChange,
  agentName,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isProcessing, setIsProcessing] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraReady(false);
  };

  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, []);

  const startCamera = async (requestedFacing: 'user' | 'environment' = facingMode) => {
    setNotice(null);
    stopCameraStream();

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== 'function'
    ) {
      setNotice({
        type: 'error',
        message:
          'La caméra n’est pas accessible dans ce navigateur. Utilisez « Importer depuis l’appareil ».',
      });
      return;
    }

    setIsCameraOpen(true);
    setIsCameraReady(false);

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: requestedFacing },
            width: { ideal: 720 },
            height: { ideal: 960 },
          },
          audio: false,
        });
      } catch {
        // Repli générique si le navigateur refuse la contrainte facingMode
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setFacingMode(requestedFacing);
      setIsCameraReady(true);
    } catch (err: any) {
      stopCameraStream();
      setIsCameraOpen(false);
      const errName = err?.name || '';
      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
        setNotice({
          type: 'error',
          message:
            'Accès à la caméra refusé. Autorisez la caméra dans votre navigateur ou importez une photo depuis l’appareil.',
        });
      } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
        setNotice({
          type: 'error',
          message:
            'Aucune caméra détectée sur cet appareil. Utilisez « Importer depuis l’appareil ».',
        });
      } else {
        setNotice({
          type: 'error',
          message:
            'Impossible de démarrer la caméra. Vous pouvez importer une photo depuis votre appareil.',
        });
      }
    }
  };

  const handleCloseCamera = () => {
    stopCameraStream();
    setIsCameraOpen(false);
  };

  const handleCaptureFromCamera = () => {
    if (!videoRef.current) return;
    setNotice(null);
    try {
      const portraitDataUrl = captureVideoFrameToPortraitDataUrl(videoRef.current);
      onChange(portraitDataUrl);
      stopCameraStream();
      setIsCameraOpen(false);
      setNotice({
        type: 'success',
        message: 'Photo capturée et recadrée automatiquement au format badge PVC (3:4).',
      });
    } catch (err: any) {
      setNotice({
        type: 'error',
        message: err?.message || 'Échec de capture photo depuis la caméra.',
      });
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setNotice(null);
    setIsProcessing(true);

    try {
      const portraitDataUrl = await processAgentPhotoFile(file);
      onChange(portraitDataUrl);
      setNotice({
        type: 'success',
        message: `Photo « ${file.name} » importée et ajustée pour le badge PVC.`,
      });
    } catch (err: any) {
      setNotice({
        type: 'error',
        message: err?.message || 'Impossible de charger cette image.',
      });
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemovePhoto = () => {
    onChange(undefined);
    setNotice(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/80 space-y-3">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        {/* Aperçu portrait 3:4 */}
        <div className="relative w-24 h-32 rounded-xl bg-slate-900 border-2 border-slate-700 overflow-hidden flex items-center justify-center shrink-0 shadow-inner">
          {value ? (
            <img
              src={value}
              alt={agentName ? `Photo de ${agentName}` : 'Photo de l’agent'}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-slate-500 p-2 text-center">
              <User className="w-9 h-9 mb-1 text-slate-500" />
              <span className="text-[10px] leading-tight">Aucune photo</span>
            </div>
          )}
          {value && (
            <span
              className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-emerald-600/95 text-[9px] font-bold text-white shadow"
              title="Photo prête pour le badge PVC"
            >
              Badge
            </span>
          )}
        </div>

        {/* Contrôles photo */}
        <div className="flex-1 space-y-2 min-w-0">
          <div>
            <p className="text-xs font-bold text-white">
              Photo d’identité de l’agent (Badge PVC)
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Prenez une photo via la caméra ou importez une image JPG/PNG/WebP. Recadrage automatique au format portrait 3:4.
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <button
              type="button"
              onClick={() => startCamera('user')}
              disabled={isProcessing}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-sm"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>{value ? 'Reprendre (Caméra)' : 'Prendre une photo'}</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-100 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border border-slate-600"
            >
              {value ? <RefreshCw className="w-3.5 h-3.5 text-blue-400" /> : <Upload className="w-3.5 h-3.5 text-blue-400" />}
              <span>{isProcessing ? 'Traitement...' : value ? 'Remplacer (Appareil)' : 'Importer (Appareil)'}</span>
            </button>

            {value && (
              <button
                type="button"
                onClick={handleRemovePhoto}
                disabled={isProcessing}
                className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-semibold flex items-center gap-1 transition cursor-pointer border border-rose-500/30"
                title="Retirer la photo de l’agent"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Supprimer</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Viseur caméra intégré */}
      {isCameraOpen && (
        <div className="p-3 rounded-xl bg-slate-950 border border-emerald-500/40 space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
              <Camera className="w-4 h-4" />
              <span>Caméra active — Centrez le visage dans le cadre</span>
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => startCamera(facingMode === 'user' ? 'environment' : 'user')}
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium flex items-center gap-1 transition cursor-pointer border border-slate-700"
                title="Basculer caméra avant / arrière"
              >
                <SwitchCamera className="w-3.5 h-3.5" />
                <span>Inverser</span>
              </button>
              <button
                type="button"
                onClick={handleCloseCamera}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
                title="Fermer la caméra"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[260px] aspect-[3/4] rounded-xl overflow-hidden bg-black border border-slate-700">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {/* Guide visuel de cadrage portrait */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="w-36 h-48 rounded-full border-2 border-dashed border-emerald-400/70 shadow-[0_0_0_999px_rgba(2,6,23,0.32)]" />
            </div>
            {!isCameraReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 text-xs text-slate-300">
                Activation de la caméra...
              </div>
            )}
          </div>

          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={handleCloseCamera}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleCaptureFromCamera}
              disabled={!isCameraReady}
              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <Camera className="w-4 h-4" />
              <span>Capturer la photo</span>
            </button>
          </div>
        </div>
      )}

      {/* Retour d'état / erreur */}
      {notice && (
        <div
          className={`p-2.5 rounded-lg text-[11px] flex items-start gap-2 border ${
            notice.type === 'error'
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-200'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
          }`}
        >
          {notice.type === 'error' ? (
            <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
          )}
          <span>{notice.message}</span>
        </div>
      )}
    </div>
  );
};
