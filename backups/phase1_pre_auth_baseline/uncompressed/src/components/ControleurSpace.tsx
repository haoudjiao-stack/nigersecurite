import React, { useState, useEffect } from 'react';
import {
  Compass,
  MapPin,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Camera,
  Plus,
  Radio,
  UserCheck,
  Building,
  Smartphone,
  Shield,
  QrCode,
  Wifi,
  WifiOff,
  Flame,
  Check,
  RefreshCw,
  Database,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  SiteGardiennage,
  AgentSecurite,
  RapportControle,
  ControleurProfile,
  ScanPointControle,
} from '../types';
import { CONTROLEURS_LIST } from '../mockData';
import { PatrolScannerModal } from './PatrolScannerModal';
import {
  subscribeToOfflineQueue,
  flushOfflineScansQueue,
  getOfflineQueue,
} from '../services/patrolSyncService';

interface ControleurSpaceProps {
  sites: SiteGardiennage[];
  agents: AgentSecurite[];
  reports: RapportControle[];
  onOpenNewReport: (defaultSiteId?: string) => void;
  activeController: ControleurProfile;
  onChangeController: (ctrl: ControleurProfile) => void;
  patrolScans?: ScanPointControle[];
  onRecordPatrolScan?: (scan: ScanPointControle) => Promise<boolean>;
}

export const ControleurSpace: React.FC<ControleurSpaceProps> = ({
  sites,
  agents,
  reports,
  onOpenNewReport,
  activeController,
  onChangeController,
  patrolScans = [],
  onRecordPatrolScan,
}) => {
  // Scanner state
  const [selectedSiteToScan, setSelectedSiteToScan] = useState<SiteGardiennage | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // État de la connectivité réseau et file d'attente hors-ligne
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [offlineQueue, setOfflineQueue] = useState<ScanPointControle[]>(getOfflineQueue());
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncFeedback, setSyncFeedback] = useState<{
    text: string;
    isError?: boolean;
  } | null>(null);
  const [isQueueExpanded, setIsQueueExpanded] = useState<boolean>(false);

  // Écoute de l'état réseau et abonnement réactif à la file d'attente
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const unsubscribeQueue = subscribeToOfflineQueue((queue) => {
      setOfflineQueue(queue);
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribeQueue();
    };
  }, []);

  // Déclenchement manuel de la synchronisation par le contrôleur
  const handleManualSync = async () => {
    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      const res = await flushOfflineScansQueue();
      if (res.syncedCount > 0) {
        setSyncFeedback({
          text: `Succès : ${res.syncedCount} pointage(s) transmis et confirmés par le serveur Firebase !`,
          isError: false,
        });
      } else if (res.remainingCount > 0) {
        setSyncFeedback({
          text: `Réseau indisponible. ${res.remainingCount} pointage(s) restent conservés en toute sécurité sur votre téléphone.`,
          isError: true,
        });
      } else {
        setSyncFeedback({
          text: "Tous vos pointages sont déjà synchronisés avec le serveur.",
          isError: false,
        });
      }
    } catch (err) {
      setSyncFeedback({
        text: "Échec de la synchronisation réseau. Les données locales sont protégées.",
        isError: true,
      });
    } finally {
      setIsSyncing(false);
      setTimeout(() => {
        setSyncFeedback(null);
      }, 5000);
    }
  };

  // CRITICAL: Filter sites strictly assigned to this controller
  const assignedSites = sites.filter((s) =>
    activeController.sitesAssignesIds.includes(s.id)
  );

  // Scans performed by this controller
  const controllerScans = patrolScans.filter((s) => s.controleurId === activeController.id);

  // Scans performed today
  const todayStr = new Date().toISOString().split('T')[0];
  const todayControllerScans = controllerScans.filter(
    (s) => s.dateScan === todayStr || s.scanneLe.startsWith(todayStr)
  );

  // Filter reports submitted by this controller or for his sites
  const controllerReports = reports.filter(
    (r) =>
      r.controleurNom.toLowerCase().includes(activeController.nom.toLowerCase()) ||
      activeController.sitesAssignesIds.includes(r.siteId)
  );

  const compliantCount = assignedSites.filter((s) => s.statutConformite === 'Conforme').length;
  const pendingCount = assignedSites.filter((s) => s.statutConformite === 'Non contrôlé aujourd’hui').length;
  const anomalyCount = assignedSites.filter((s) => s.statutConformite === 'Anomalie signalée').length;

  const handleOpenScannerForSite = (site: SiteGardiennage) => {
    setSelectedSiteToScan(site);
    setIsScannerOpen(true);
  };

  const handleQuickScan = () => {
    if (assignedSites.length > 0) {
      handleOpenScannerForSite(assignedSites[0]);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Simulation & Security Notice */}
      <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2.5">
        <Shield className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-amber-300">
            Espace Contrôleur Terrain (Cloisonnement des accès strict) :
          </p>
          <p className="mt-0.5 text-amber-200/90 leading-relaxed">
            Cet espace n'a accès <strong>qu'aux {assignedSites.length} sites attribués</strong> à votre secteur de patrouille.
            Tout accès aux salaires des agents, factures clients, trésorerie et paramètres de l'entreprise est strictement masqué et verrouillé.
          </p>
        </div>
      </div>

      {/* Controller Profile Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 border border-emerald-500/30 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
              <Compass className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Patrouille & Contrôle Terrain
                </span>
                <span className="text-xs text-slate-400 flex items-center gap-1 font-mono">
                  <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
                  Niamey
                </span>
                {isOnline ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 font-medium">
                    <Wifi className="w-3 h-3 text-emerald-400" />
                    <span>En ligne (Serveur Firebase accessible)</span>
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1 font-bold animate-pulse">
                    <WifiOff className="w-3 h-3 text-amber-400" />
                    <span>Hors-ligne (Stockage local sécurisé)</span>
                  </span>
                )}
              </div>
              <h2 className="text-lg sm:text-xl font-black text-white mt-1">
                {activeController.nom}
              </h2>
              <p className="text-xs text-slate-300">
                {activeController.grade} • Zone : <span className="text-emerald-400 font-semibold">{activeController.zonePatrouille}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
            {/* Quick controller selector */}
            <div className="w-full sm:w-auto">
              <label className="block text-[10px] text-slate-400 mb-1">Changer de contrôleur :</label>
              <select
                value={activeController.id}
                onChange={(e) => {
                  const found = CONTROLEURS_LIST.find((c) => c.id === e.target.value);
                  if (found) onChangeController(found);
                }}
                className="w-full sm:w-auto bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
              >
                {CONTROLEURS_LIST.map((ctrl) => (
                  <option key={ctrl.id} value={ctrl.id}>
                    {ctrl.nom} ({ctrl.zonePatrouille})
                  </option>
                ))}
              </select>
            </div>

            {/* Quick Action: Start Scan */}
            <button
              onClick={handleQuickScan}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-xs shadow-lg shadow-emerald-950/60 flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <QrCode className="w-4 h-4" />
              <span>Scanner un Point QR</span>
            </button>

            <button
              onClick={() => onOpenNewReport()}
              className="w-full sm:w-auto px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Plus className="w-4 h-4 text-emerald-400" />
              <span>Fiche Contrôle</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats for Assigned Sites & Today's Scans */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-center">
          <p className="text-xs font-semibold text-slate-400">Sites Attribués</p>
          <p className="text-xl sm:text-2xl font-black text-white mt-1">{assignedSites.length}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Dans votre secteur</p>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-center">
          <p className="text-xs font-semibold text-slate-400">Mes Scans Aujourd'hui</p>
          <p className="text-xl sm:text-2xl font-black text-emerald-400 mt-1">{todayControllerScans.length}</p>
          <p className="text-[10px] text-emerald-400/80 mt-0.5">Points QR vérifiés</p>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-center">
          <p className="text-xs font-semibold text-slate-400">Sites Conformes</p>
          <p className="text-xl sm:text-2xl font-black text-emerald-400 mt-1">{compliantCount}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Ronde validée</p>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-center">
          <p className="text-xs font-semibold text-slate-400">Anomalies / À visiter</p>
          <p className="text-xl sm:text-2xl font-black text-amber-400 mt-1">{anomalyCount + pendingCount}</p>
          <p className="text-[10px] text-amber-300 mt-0.5">À surveiller</p>
        </div>
      </div>

      {/* File d'attente de synchronisation et statut réseau (100% Offline-First) */}
      <div
        className={`p-4 sm:p-5 rounded-2xl border transition-all ${
          offlineQueue.length > 0
            ? 'bg-amber-950/20 border-amber-500/40'
            : 'bg-slate-900 border-slate-800'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className={`p-2.5 rounded-xl border shrink-0 mt-0.5 ${
                offlineQueue.length > 0
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-sm sm:text-base">
                  File d'attente de synchronisation des rondes
                </h3>
                {offlineQueue.length > 0 ? (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/25 text-amber-300 border border-amber-500/40 animate-pulse">
                    {offlineQueue.length} pointage{offlineQueue.length > 1 ? 's' : ''} en attente
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                    <Check className="w-3 h-3" /> À jour
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                {offlineQueue.length > 0
                  ? `Vous avez ${offlineQueue.length} pointage(s) certifié(s) conservé(s) en mémoire locale. Ils seront transmis automatiquement dès reconnexion, ou manuellement ci-dessous.`
                  : "Tous les pointages de vos rondes sont confirmés et enregistrés sur le serveur Firebase."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 w-full sm:w-auto">
            {offlineQueue.length > 0 && (
              <button
                onClick={() => setIsQueueExpanded(!isQueueExpanded)}
                className="flex-1 sm:flex-initial px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                {isQueueExpanded ? (
                  <>
                    <ChevronUp className="w-3.5 h-3.5" />
                    <span>Masquer</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5" />
                    <span>Voir la file ({offlineQueue.length})</span>
                  </>
                )}
              </button>
            )}

            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-md ${
                isSyncing
                  ? 'bg-slate-800 text-slate-400 cursor-not-allowed'
                  : offlineQueue.length > 0
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-950/40'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-emerald-400' : ''}`} />
              <span>{isSyncing ? 'Synchronisation...' : 'Synchroniser maintenant'}</span>
            </button>
          </div>
        </div>

        {/* Message de confirmation ou d'erreur de synchro */}
        {syncFeedback && (
          <div
            className={`mt-3 p-3 rounded-xl text-xs flex items-start gap-2 border animate-in fade-in ${
              syncFeedback.isError
                ? 'bg-rose-500/15 border-rose-500/30 text-rose-200'
                : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-200'
            }`}
          >
            {syncFeedback.isError ? (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            )}
            <p className="leading-relaxed">{syncFeedback.text}</p>
          </div>
        )}

        {/* Liste détaillée des scans dans la file d'attente hors-ligne */}
        {offlineQueue.length > 0 && isQueueExpanded && (
          <div className="mt-4 pt-4 border-t border-slate-800 space-y-2">
            <p className="text-xs font-semibold text-slate-400 mb-2">
              Détail des pointages enregistrés hors-ligne sur votre appareil :
            </p>
            <div className="divide-y divide-slate-800/80 bg-slate-950/60 rounded-xl border border-slate-800 overflow-hidden">
              {offlineQueue.map((item) => (
                <div
                  key={item.id}
                  className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div className="flex items-start gap-2.5">
                    <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-300 shrink-0 mt-0.5">
                      <Clock className="w-3.5 h-3.5" />
                    </span>
                    <div>
                      <p className="font-bold text-white text-sm">{item.pointNom}</p>
                      <p className="text-[11px] text-slate-400">{item.siteNom}</p>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">ID: {item.id}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 self-end sm:self-auto">
                    <div className="text-right">
                      <span className="font-mono text-slate-200 text-xs font-semibold">
                        {item.dateScan} à {item.horaireScan}
                      </span>
                      <p className="text-[10px] text-slate-400">Par {item.controleurNom}</p>
                    </div>
                    <span className="text-[10px] px-2.5 py-1 rounded-full font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1 shrink-0">
                      <Clock className="w-3 h-3" />
                      <span>En attente de synchronisation</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sites List with Checkpoints and Direct QR Scanner */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-white text-base">Mes Sites Attribués & Points de Ronde ({assignedSites.length})</h3>
            <p className="text-xs text-slate-400">Sélectionnez un site pour flasher ses points de contrôle ou rédiger une inspection</p>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-slate-800 text-slate-300 border border-slate-700 self-start sm:self-auto">
            {activeController.zonePatrouille}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {assignedSites.map((site) => {
            const pointsCount = site.pointsControle?.length || 0;
            // Checkpoints scanned today for this site
            const siteScansToday = patrolScans.filter(
              (s) => s.siteId === site.id && (s.dateScan === todayStr || s.scanneLe.startsWith(todayStr))
            );
            const scannedPointIds = new Set(siteScansToday.map((s) => s.pointId));
            const distinctScannedCount = scannedPointIds.size;

            return (
              <div
                key={site.id}
                className="p-4 rounded-xl bg-slate-800/50 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-bold text-white text-sm">{site.nom}</h4>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase border ${
                        site.statutConformite === 'Conforme'
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                          : site.statutConformite === 'Anomalie signalée'
                          ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                          : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                      }`}
                    >
                      {site.statutConformite}
                    </span>
                  </div>

                  <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{site.quartier}, {site.ville}</span>
                  </div>

                  {/* Checkpoints status badge */}
                  <div className="mt-2.5 p-2.5 rounded-lg bg-slate-900/80 border border-slate-700/60 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <QrCode className="w-4 h-4 text-emerald-400" />
                      <span className="text-slate-300 font-semibold">Progression Ronde :</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white font-mono">
                        {distinctScannedCount} / {pointsCount} point{pointsCount > 1 ? 's' : ''}
                      </span>
                      {pointsCount > 0 && distinctScannedCount >= pointsCount && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold flex items-center gap-0.5">
                          <Check className="w-3 h-3" /> Ronde complète
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 mt-2 line-clamp-2">
                    <span className="text-slate-400 font-medium">Consignes :</span> {site.consignesParticulieres}
                  </p>
                </div>

                {/* Action buttons */}
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleOpenScannerForSite(site)}
                    className="flex-1 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950/40"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Scanner QR-Code</span>
                  </button>

                  <button
                    onClick={() => onOpenNewReport(site.id)}
                    className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs transition cursor-pointer flex items-center gap-1 border border-slate-700"
                    title="Rédiger une fiche de contrôle"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Rapport</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Scans récents effectués par le contrôleur */}
      {todayControllerScans.length > 0 && (
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-white text-base">Mes Scans Récents d'Aujourd'hui ({todayControllerScans.length})</h3>
              <p className="text-xs text-slate-400">Preuves électroniques horodatées transmises en direct à la Direction</p>
            </div>
            <span className="text-[11px] font-mono text-emerald-400">Direct Cloud</span>
          </div>

          <div className="divide-y divide-slate-800">
            {todayControllerScans.slice(0, 5).map((scan) => (
              <div key={scan.id} className="py-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                    <QrCode className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="font-bold text-white">{scan.pointNom}</p>
                    <p className="text-[11px] text-slate-400">{scan.siteNom}</p>
                  </div>
                </div>

                <div className="text-right flex flex-col items-end gap-1">
                  <span className="font-mono text-emerald-300 font-semibold">{scan.horaireScan}</span>
                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    {scan.statutConformite === 'Conforme' ? (
                      <span className="text-emerald-400 font-semibold text-[10px]">Conforme</span>
                    ) : (
                      <span className="text-amber-400 font-semibold text-[10px]">{scan.statutConformite}</span>
                    )}
                    <span className="text-slate-600 text-[10px]">•</span>
                    {scan.statutSynchro === 'synchronise' ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold flex items-center gap-0.5">
                        <Check className="w-2.5 h-2.5" />
                        <span>Synchronisé</span>
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold flex items-center gap-0.5 animate-pulse">
                        <Clock className="w-2.5 h-2.5" />
                        <span>En attente de réseau</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reports Transmitted by Controller to Direction */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-white text-base">Rapports Transmis à la Direction</h3>
            <p className="text-xs text-slate-400">Historique de vos passages et photos jointes</p>
          </div>
          <span className="text-xs text-slate-400">{controllerReports.length} rapports transmis</span>
        </div>

        <div className="space-y-3">
          {controllerReports.map((rep) => (
            <div
              key={rep.id}
              className={`p-4 rounded-xl border space-y-2.5 ${
                rep.incidentSignale
                  ? 'bg-rose-950/20 border-rose-500/40 text-rose-100'
                  : 'bg-slate-800/40 border-slate-800 text-slate-300'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-sm">{rep.siteNom}</span>
                  <span className="text-[11px] text-slate-400">({rep.quartier})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 font-mono text-[11px]">{rep.dateHeure}</span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                      rep.incidentSignale
                        ? 'bg-rose-500/20 text-rose-300'
                        : 'bg-emerald-500/20 text-emerald-300'
                    }`}
                  >
                    {rep.statut}
                  </span>
                </div>
              </div>

              {/* Photo attached if any */}
              {rep.photoUrl && (
                <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-700/80 flex items-center gap-3">
                  <img
                    src={rep.photoUrl}
                    alt="Preuve photo"
                    className="w-16 h-12 object-cover rounded-lg border border-slate-600"
                  />
                  <div className="text-xs">
                    <span className="font-semibold text-emerald-300 flex items-center gap-1">
                      <Camera className="w-3.5 h-3.5" />
                      <span>Photo de contrôle transmise à la Direction</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">Position GPS : {rep.coordonneesGPS}</span>
                  </div>
                </div>
              )}

              {/* Attendance and gear */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] pt-1">
                <div>
                  <span className="text-slate-400">Agents présents : </span>
                  <span className="font-bold text-slate-200">{rep.agentsPresents.join(', ')}</span>
                </div>
                <div>
                  <span className="text-slate-400">Tenue : </span>
                  <span className="font-bold text-slate-200">{rep.tenueReglementaire}</span>
                </div>
                <div>
                  <span className="text-slate-400">Main courante : </span>
                  <span className="font-bold text-slate-200">
                    {rep.registreMainCouranteTenu ? 'Émargée' : 'Non tenue'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Vigilance : </span>
                  <span className="font-bold text-slate-200">{rep.vigilancePoste}</span>
                </div>
              </div>

              {/* Observations */}
              <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-xs text-slate-300">
                <p>
                  <span className="font-semibold text-slate-400">Observations :</span> {rep.observations}
                </p>
                {rep.incidentSignale && (
                  <p className="mt-1 text-rose-300 font-semibold">
                    🚨 {rep.typeIncident} : {rep.descriptionIncident}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal Scanner de Ronde */}
      {selectedSiteToScan && isScannerOpen && (
        <PatrolScannerModal
          isOpen={isScannerOpen}
          onClose={() => {
            setIsScannerOpen(false);
            setSelectedSiteToScan(null);
          }}
          site={selectedSiteToScan}
          activeController={activeController}
          recentScans={patrolScans}
          onConfirmScan={onRecordPatrolScan || (async () => true)}
        />
      )}
    </div>
  );
};
