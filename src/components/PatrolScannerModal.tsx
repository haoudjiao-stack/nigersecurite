import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Camera,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Clock,
  UserCheck,
  RefreshCw,
  QrCode,
  Volume2,
  VolumeX,
  Upload,
  FileImage,
  Check,
} from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import {
  SiteGardiennage,
  PointControleSite,
  ScanPointControle,
  ControleurProfile,
  StatutScanConformite,
} from '../types';
import { parseCheckpointQrPayload } from '../utils/qrCodeUtils';
import { STORAGE_KEYS, safeLoadFromStorage } from '../utils/storageUtils';

interface PatrolScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  site: SiteGardiennage;
  activeController: ControleurProfile;
  recentScans: ScanPointControle[];
  onConfirmScan: (scan: ScanPointControle) => Promise<boolean>;
}

export const PatrolScannerModal: React.FC<PatrolScannerModalProps> = ({
  isOpen,
  onClose,
  site,
  activeController,
  recentScans,
  onConfirmScan,
}) => {
  const [cameraState, setCameraState] = useState<'idle' | 'starting' | 'scanning' | 'error' | 'success'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<{
    point: PointControleSite;
    statut: StatutScanConformite;
    message: string;
    isDuplicate?: boolean;
    dateScan?: string;
    horaireScan?: string;
    isServerConfirmed?: boolean;
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFileScanning, setIsFileScanning] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isStartingRef = useRef<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const elementId = 'patrol-qr-reader-viewport';
  const hasScannedRef = useRef(false);

  const audioCtxRef = useRef<AudioContext | null>(null);

  // Initialisation et déverrouillage de l'AudioContext dès le premier geste utilisateur
  const getOrCreateAudioContext = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return null;
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new AudioContextClass();
      }
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {});
      }
      return audioCtxRef.current;
    } catch {
      return null;
    }
  };

  // Émission d'un bip sonore de confirmation court, clair et audible (Web Audio API natif, 0 fichier externe, 100% hors-ligne)
  // Déclenché UNIQUEMENT après reconnaissance correcte et enregistrement validé du pointage.
  const playSuccessBeep = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = getOrCreateAudioContext();
      if (!audioCtx) return;

      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      const now = audioCtx.currentTime;
      // Bip court (220ms), audible et clair (La5 880Hz glissant vers Do6 1046.5Hz)
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1046.5, now + 0.12);
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);

      osc.start(now);
      osc.stop(now + 0.22);
    } catch {
      // AudioContext non supporté ou bloqué
    }
  };

  // Arrêt et libération propre de l'instance scanner existante
  const stopAndCleanScanner = async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        // 2 = SCANNING, 3 = PAUSED
        if (state === 2 || state === 3 || scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
      } catch (stopErr) {
        // En cas d'erreur lors du stop, continuer le nettoyage
        console.warn('[NIGER SÉCURITÉ Scanner] Arrêt partiel du flux caméra:', stopErr);
      }

      try {
        scannerRef.current.clear();
      } catch (clearErr) {
        // Ignorer si déjà nettoyé
      }
      scannerRef.current = null;
    }

    // Nettoyage manuel préventif du conteneur DOM pour éviter les conflits
    const container = document.getElementById(elementId);
    if (container) {
      container.innerHTML = '';
    }
  };

  // Démarrage de la caméra physique
  const startCamera = async () => {
    if (isStartingRef.current) return;
    isStartingRef.current = true;

    setErrorMessage(null);
    setScanResult(null);
    setCameraState('starting');
    hasScannedRef.current = false;

    // 1. Arrêt complet et propre de toute session précédente
    await stopAndCleanScanner();

    // 2. Vérification de la présence du conteneur dans le DOM
    const container = document.getElementById(elementId);
    if (!container) {
      console.warn('[NIGER SÉCURITÉ Scanner] Conteneur DOM non disponible');
      setCameraState('error');
      setErrorMessage("Le conteneur du viseur caméra n'est pas encore prêt. Veuillez réessayer.");
      isStartingRef.current = false;
      return;
    }

    // 3. Vérification des API de capture du navigateur
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraState('error');
      setErrorMessage(
        "Votre navigateur ne supporte pas ou restreint l'accès à la caméra dans ce contexte (une connexion HTTPS est requise)."
      );
      isStartingRef.current = false;
      return;
    }

    try {
      const html5QrCode = new Html5Qrcode(elementId, {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false,
        useBarCodeDetectorIfSupported: false, // FORCE LE MOTEUR LOCAL ZXING EMBARQUÉ (100% Hors-Ligne, 0 requête réseau)
      });
      scannerRef.current = html5QrCode;

      const config = {
        fps: 12,
        qrbox: { width: 240, height: 240 },
        aspectRatio: 1.0,
      };

      // 4. Détection intelligente des caméras disponibles
      let cameras: any[] = [];
      try {
        cameras = await Html5Qrcode.getCameras();
      } catch (camEnumErr) {
        console.warn('[NIGER SÉCURITÉ Scanner] Énumération des caméras impossible:', camEnumErr);
      }

      if (cameras && cameras.length > 0) {
        // Chercher en priorité la caméra arrière pour smartphone
        const backCamera = cameras.find((c) =>
          c.label && /back|rear|arri[eè]re|environment/i.test(c.label)
        );
        const selectedCameraId = backCamera ? backCamera.id : cameras[0].id;

        await html5QrCode.start(
          selectedCameraId,
          config,
          handleScanSuccess,
          () => {} // Ignorer les frames sans QR
        );
      } else {
        // Repli standard par contraintes de facingMode
        try {
          await html5QrCode.start(
            { facingMode: { ideal: 'environment' } },
            config,
            handleScanSuccess,
            () => {}
          );
        } catch {
          // Repli ultime sur webcam par défaut
          await html5QrCode.start(
            { facingMode: 'user' },
            config,
            handleScanSuccess,
            () => {}
          );
        }
      }

      setCameraState('scanning');
    } catch (err: any) {
      console.error('[NIGER SÉCURITÉ Scanner] Erreur démarrage caméra:', err);
      setCameraState('error');

      let msg = "Impossible d'accéder à la caméra.";
      const errorStr = (err?.name || err?.message || String(err)).toLowerCase();

      if (errorStr.includes('notallowed') || errorStr.includes('permission') || errorStr.includes('denied')) {
        msg = "Autorisation caméra refusée. Veuillez autoriser l'accès à la caméra dans votre navigateur (icône cadenas ou caméra dans la barre d'adresse).";
      } else if (errorStr.includes('notfound') || errorStr.includes('device')) {
        msg = "Aucune caméra active n'a été détectée sur cet appareil.";
      } else if (errorStr.includes('notreadable') || errorStr.includes('trackstart') || errorStr.includes('busy')) {
        msg = "La caméra est déjà sollicitée par une autre application ou un autre onglet.";
      } else if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
        msg = "L'accès à la caméra requiert une connexion sécurisée HTTPS.";
      }

      setErrorMessage(msg);
    } finally {
      isStartingRef.current = false;
    }
  };

  // Traitement d'un scan détecté (caméra ou fichier)
  const handleScanSuccess = async (decodedText: string) => {
    if (hasScannedRef.current || isProcessing) return;
    hasScannedRef.current = true;
    setIsProcessing(true);

    // 1. Analyse et validation du contenu du QR-Code
    const parseRes = parseCheckpointQrPayload(decodedText);
    if (!parseRes.valid || !parseRes.siteId || !parseRes.pointId) {
      setErrorMessage(parseRes.error || "QR-Code non reconnu : ce code n'appartient pas au réseau officiel NIGER SÉCURITÉ.");
      setIsProcessing(false);
      setTimeout(() => {
        hasScannedRef.current = false;
        setErrorMessage(null);
      }, 3500);
      return;
    }

    // 2. Vérification de la correspondance avec le site en cours de contrôle
    if (parseRes.siteId !== site.id) {
      setErrorMessage(
        `Erreur de site : ce point de contrôle est configuré pour un autre site (ID: ${parseRes.siteId}). Vous êtes actuellement sur le site « ${site.nom} » (ID: ${site.id}).`
      );
      setIsProcessing(false);
      setTimeout(() => {
        hasScannedRef.current = false;
        setErrorMessage(null);
      }, 4000);
      return;
    }

    // 3. Recherche du point de contrôle dans le référentiel du site
    const point = site.pointsControle?.find((p) => p.id === parseRes.pointId);
    if (!point) {
      setErrorMessage(
        `Point de contrôle inconnu : le point « ${parseRes.pointId} » n'est plus répertorié ou a été supprimé sur ce site.`
      );
      setIsProcessing(false);
      setTimeout(() => {
        hasScannedRef.current = false;
        setErrorMessage(null);
      }, 3500);
      return;
    }

    if (!point.estActif) {
      setErrorMessage(`Point de contrôle désactivé : le repère « ${point.nom} » a été mis hors service par la Direction.`);
      setIsProcessing(false);
      setTimeout(() => {
        hasScannedRef.current = false;
        setErrorMessage(null);
      }, 3500);
      return;
    }

    // 4. Détection des scans répétés (Anti-doublon dans les 10 dernières minutes)
    const now = new Date();
    const tenMinutesAgoMs = now.getTime() - 10 * 60 * 1000;
    const recentDuplicate = recentScans.find(
      (s) => s.pointId === point.id && new Date(s.scanneLe).getTime() > tenMinutesAgoMs
    );

    let statutConformite: StatutScanConformite = 'Conforme';
    let noticeMessage = `Point de contrôle « ${point.nom} » validé avec succès.`;

    if (recentDuplicate) {
      const minutesEcoulees = Math.round(
        (now.getTime() - new Date(recentDuplicate.scanneLe).getTime()) / (60 * 1000)
      );
      statutConformite = 'Point répété';
      noticeMessage = `Attention : ce point a déjà été scanné il y a ${minutesEcoulees || 1} minute(s) à ${recentDuplicate.horaireScan}. Scan consigné avec la mention « Point répété ».`;
    }

    // 5. Création de l'enregistrement certifié et horodaté
    const formattedHour = now.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const formattedDate = now.toISOString().split('T')[0];

    const newScan: ScanPointControle = {
      id: `SCAN_${site.id}_${point.id}_${now.getTime()}`,
      siteId: site.id,
      siteNom: site.nom,
      pointId: point.id,
      pointNom: point.nom,
      controleurId: activeController.id,
      controleurNom: activeController.nom,
      controleurGrade: activeController.grade,
      scanneLe: now.toISOString(),
      horaireScan: formattedHour,
      dateScan: formattedDate,
      statutConformite,
      observations: `Scan optique validé par ${activeController.nom} (${activeController.grade}) sur ${site.nom}.`,
      statutSynchro: 'en_attente',
      creeLe: now.toISOString(),
    };

    // 6. Enregistrement sécurisé
    const saved = await onConfirmScan(newScan);
    if (saved) {
      // Déterminer avec certitude si le pointage est déjà synchronisé ou conservé en attente locale
      const isDeviceOnline = typeof navigator !== 'undefined' ? navigator.onLine : false;
      const offlineQueue = safeLoadFromStorage<ScanPointControle[]>(STORAGE_KEYS.OFFLINE_SCANS, []).data;
      const isPendingInOfflineQueue = offlineQueue.some((s) => s.id === newScan.id);
      const isServerConfirmed = isDeviceOnline && !isPendingInOfflineQueue;

      // Déclencher le bip court et audible uniquement après enregistrement validé
      playSuccessBeep();
      setCameraState('success');
      setScanResult({
        point,
        statut: statutConformite,
        message: noticeMessage,
        isDuplicate: Boolean(recentDuplicate),
        dateScan: formattedDate,
        horaireScan: formattedHour,
        isServerConfirmed,
      });

      // Mettre la caméra en pause propre
      await stopAndCleanScanner();
    } else {
      setErrorMessage("Échec de l'enregistrement du scan dans la mémoire sécurisée. Veuillez réessayer.");
      hasScannedRef.current = false;
    }

    setIsProcessing(false);
  };

  // Analyse d'une image de QR-Code téléversée (scanFile)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsFileScanning(true);
    setErrorMessage(null);

    try {
      // Créer une instance temporaire dédiée au décodage de fichier
      const tempScanner = new Html5Qrcode('patrol-qr-reader-file-temp', {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false,
        useBarCodeDetectorIfSupported: false, // 100% Hors-Ligne
      });

      const decodedText = await tempScanner.scanFile(file, false);
      try {
        tempScanner.clear();
      } catch {}

      if (decodedText) {
        await handleScanSuccess(decodedText);
      }
    } catch (scanErr: any) {
      console.warn('[NIGER SÉCURITÉ Scanner] Décodage fichier QR échoué:', scanErr);
      setErrorMessage("Aucun QR-Code valide n'a été détecté dans l'image sélectionnée. Assurez-vous que l'image est nette et bien cadrée.");
    } finally {
      setIsFileScanning(false);
      // Réinitialiser la valeur de l'input pour permettre de resélectionner le même fichier si besoin
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
      // Déverrouillage précoce de l'AudioContext dès l'interaction d'ouverture
      getOrCreateAudioContext();

      const unlockAudio = () => {
        getOrCreateAudioContext();
      };
      window.addEventListener('touchstart', unlockAudio, { passive: true });
      window.addEventListener('click', unlockAudio, { passive: true });

      // Laisser le temps au modal d'être affiché dans le DOM avant d'initialiser
      const timer = setTimeout(() => {
        startCamera();
      }, 100);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('touchstart', unlockAudio);
        window.removeEventListener('click', unlockAudio);
        stopAndCleanScanner();
      };
    } else {
      stopAndCleanScanner();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg max-h-[94vh] flex flex-col shadow-2xl text-slate-100 overflow-hidden relative my-auto">
        {/* En-tête de la modale */}
        <div className="p-3.5 bg-slate-950 flex items-center justify-between border-b border-slate-800 sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
              <QrCode className="w-4 h-4" />
            </span>
            <div>
              <h3 className="font-bold text-white text-xs sm:text-sm">Scanner de Ronde • Point de Contrôle</h3>
              <p className="text-[11px] text-slate-400">{site.nom} • {activeController.nom}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-1.5 rounded-lg border text-xs cursor-pointer transition ${
                soundEnabled
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                  : 'bg-slate-800 border-slate-700 text-slate-500'
              }`}
              title={soundEnabled ? 'Son activé' : 'Son désactivé'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Corps principal */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
          {/* Identité du contrôleur actif certifiée */}
          <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/80 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-400" />
              <div>
                <p className="font-bold text-white">{activeController.nom}</p>
                <p className="text-[10px] text-slate-400">{activeController.grade}</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                Contrôleur Officiel
              </span>
              <p className="text-[10px] text-slate-400 mt-0.5">{site.quartier}, Niamey</p>
            </div>
          </div>

          {/* Viseur Caméra (toujours présent dans le DOM pour éviter tout crash de libération) */}
          <div className={cameraState === 'success' ? 'hidden' : 'space-y-3'}>
            <div className="relative rounded-2xl overflow-hidden bg-black border-2 border-slate-700 aspect-square max-w-[340px] mx-auto flex items-center justify-center shadow-inner">
              {/* Conteneur HTML5 QR Code */}
              <div id={elementId} className="w-full h-full" />

              {/* Cadre de visée laser superposé pendant le scan actif */}
              {cameraState === 'scanning' && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-8">
                  <div className="w-full h-full border-2 border-emerald-400/70 rounded-xl relative animate-pulse shadow-lg shadow-emerald-500/20">
                    <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-emerald-400" />
                    <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-emerald-400" />
                    <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-emerald-400" />
                    <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-emerald-400" />
                    <div className="absolute inset-x-2 top-1/2 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_8px_#10b981]" />
                  </div>
                </div>
              )}

              {cameraState === 'starting' && (
                <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs z-10">
                  <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
                  <span>Démarrage de la caméra...</span>
                </div>
              )}
            </div>

            <p className="text-center text-[11px] text-slate-400">
              Pointez la caméra vers le QR-Code du point de contrôle fixé sur le site.
            </p>
          </div>

          {/* Écran de confirmation de scan réussi (Très grand, lisible, fond vert contrasté) */}
          {cameraState === 'success' && (
            <div className="p-4 sm:p-6 rounded-2xl bg-emerald-950/60 border-2 border-emerald-500 text-center space-y-4 animate-in zoom-in-95 shadow-2xl shadow-emerald-950/80">
              {/* Grand cercle de confirmation visuelle */}
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-emerald-500/25 text-emerald-300 flex items-center justify-center mx-auto border-2 border-emerald-400 shadow-xl shadow-emerald-950/70">
                <CheckCircle2 className="w-10 h-10 sm:w-12 sm:h-12 text-emerald-400" />
              </div>

              {/* Message principal vert obligatoire */}
              <div className="space-y-2">
                <h3 className="text-lg sm:text-2xl font-black text-emerald-300 uppercase tracking-wide leading-tight">
                  POINTAGE ENREGISTRÉ AVEC SUCCÈS
                </h3>

                {/* Statut de synchronisation selon connectivité et confirmation serveur */}
                {scanResult?.isServerConfirmed ? (
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-400/50 text-emerald-200 text-xs sm:text-sm font-bold shadow-sm">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Pointage enregistré – Synchronisation effectuée</span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-200 text-xs sm:text-sm font-semibold shadow-sm">
                    <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Enregistré sur cet appareil – En attente de synchronisation</span>
                  </div>
                )}
              </div>

              {/* Fiche récapitulative claire et très lisible sur smartphone */}
              <div className="p-3.5 sm:p-4 rounded-xl bg-slate-900/90 border border-slate-700/80 text-xs sm:text-sm text-left space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-400 font-medium">Site :</span>
                  <span className="font-bold text-white text-right text-xs sm:text-sm">{site.nom}</span>
                </div>

                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-400 font-medium">Point de contrôle :</span>
                  <span className="font-bold text-emerald-300 text-right text-xs sm:text-sm">{scanResult?.point.nom}</span>
                </div>

                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-400 font-medium">Date du pointage :</span>
                  <span className="font-mono font-bold text-slate-200 text-right">{scanResult?.dateScan}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-medium">Heure du pointage :</span>
                  <span className="font-mono font-black text-emerald-400 text-base sm:text-lg text-right">{scanResult?.horaireScan}</span>
                </div>
              </div>

              {scanResult?.isDuplicate && (
                <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs">
                  ⚠️ Point déjà scanné récemment. Consigné avec la mention « Point répété ».
                </div>
              )}

              {/* Boutons d'action pour le contrôleur */}
              <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
                <button
                  onClick={startCamera}
                  className="w-full sm:w-1/2 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer border border-slate-700"
                >
                  <Camera className="w-4 h-4 text-emerald-400" />
                  <span>Scanner un autre point</span>
                </button>
                <button
                  onClick={onClose}
                  className="w-full sm:w-1/2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-black transition cursor-pointer shadow-lg shadow-emerald-950/50"
                >
                  Fermer
                </button>
              </div>
            </div>
          )}

          {/* Message d'erreur explicite avec bouton de nouvelle tentative */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs flex items-start gap-2.5 animate-in shake">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1 flex-1">
                <p className="font-bold text-rose-300">Information du scanner :</p>
                <p className="leading-relaxed text-rose-200/90">{errorMessage}</p>
                {cameraState === 'error' && (
                  <div className="pt-2 flex flex-wrap items-center gap-2">
                    <button
                      onClick={startCamera}
                      className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 font-semibold text-[11px] cursor-pointer inline-flex items-center gap-1 border border-rose-500/40"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Réessayer la caméra</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Option alternative : Téléversement d'une photo / fichier QR-Code */}
          <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <FileImage className="w-4 h-4 text-emerald-400" />
                <span>Tester via une image QR-Code (Fichier)</span>
              </span>
              <span className="text-[10px] text-slate-500">Option de secours</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Vous pouvez sélectionner une photo ou une capture d'écran du QR-Code enregistré pour tester la validation du point sans activer la caméra physique.
            </p>

            <label className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-dashed border-slate-600 hover:border-emerald-500 text-xs text-center text-slate-200 cursor-pointer transition flex items-center justify-center gap-2">
              {isFileScanning ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
                  <span>Analyse du fichier QR en cours...</span>
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Choisir une image de QR-Code (PNG, JPG)</span>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                disabled={isFileScanning}
                className="hidden"
              />
            </label>
          </div>

          {/* Conteneur invisible pour l'analyse de fichier image QR */}
          <div id="patrol-qr-reader-file-temp" className="hidden" />
        </div>

        {/* Pied de page */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs">
          <span className="text-[11px] text-slate-500">
            NIGER SÉCURITÉ • Système certifié anti-fraude
          </span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
