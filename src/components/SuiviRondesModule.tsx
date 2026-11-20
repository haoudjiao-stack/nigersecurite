import React, { useState, useMemo } from 'react';
import {
  QrCode,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Printer,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Building,
  UserCheck,
  Calendar,
  Radio,
  Flame,
  Download,
  MapPin,
  Check,
} from 'lucide-react';
import {
  SiteGardiennage,
  ScanPointControle,
  StatutScanConformite,
  ControleurProfile,
  EnterpriseSettings,
} from '../types';
import { flushOfflineScansQueue, getOfflineQueueCount } from '../services/patrolSyncService';

interface SuiviRondesModuleProps {
  sites: SiteGardiennage[];
  scans: ScanPointControle[];
  settings?: EnterpriseSettings;
  activeController?: ControleurProfile;
  onRefreshScans?: () => void;
}

export const SuiviRondesModule: React.FC<SuiviRondesModuleProps> = ({
  sites,
  scans,
  settings,
  activeController,
  onRefreshScans,
}) => {
  // Filters
  const [selectedSiteId, setSelectedSiteId] = useState<string>('all');
  const [selectedControllerId, setSelectedControllerId] = useState<string>('all');
  const [selectedStatut, setSelectedStatut] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'all'>('today');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  const todayStr = new Date().toISOString().split('T')[0];

  // Manual sync trigger
  const handleForceSync = async () => {
    setIsSyncing(true);
    try {
      const res = await flushOfflineScansQueue();
      if (res.syncedCount > 0) {
        setSyncNotice(`${res.syncedCount} scan(s) localement en attente ont été synchronisés avec succès vers Firestore.`);
      } else {
        setSyncNotice('Tous les scans sont déjà synchronisés en temps réel avec Firebase Cloud.');
      }
      if (onRefreshScans) onRefreshScans();
    } catch {
      setSyncNotice('Erreur lors de la synchronisation réseau.');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncNotice(null), 4000);
    }
  };

  // Filtered scans
  const filteredScans = useMemo(() => {
    return scans.filter((s) => {
      // Date filter
      if (dateFilter === 'today') {
        const isToday = s.dateScan === todayStr || s.scanneLe.startsWith(todayStr);
        if (!isToday) return false;
      } else if (dateFilter === 'week') {
        const scanTime = new Date(s.scanneLe).getTime();
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        if (scanTime < sevenDaysAgo) return false;
      }

      // Site filter
      if (selectedSiteId !== 'all' && s.siteId !== selectedSiteId) {
        return false;
      }

      // Controller filter
      if (selectedControllerId !== 'all' && s.controleurId !== selectedControllerId) {
        return false;
      }

      // Status filter
      if (selectedStatut !== 'all' && s.statutConformite !== selectedStatut) {
        return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const match =
          s.siteNom.toLowerCase().includes(term) ||
          s.pointNom.toLowerCase().includes(term) ||
          s.controleurNom.toLowerCase().includes(term);
        if (!match) return false;
      }

      return true;
    });
  }, [scans, dateFilter, selectedSiteId, selectedControllerId, selectedStatut, searchTerm, todayStr]);

  // KPIs
  const todayScans = scans.filter((s) => s.dateScan === todayStr || s.scanneLe.startsWith(todayStr));
  const conformesCount = todayScans.filter((s) => s.statutConformite === 'Conforme').length;
  const anomaliesCount = todayScans.filter((s) => s.statutConformite !== 'Conforme').length;
  const repeatCount = todayScans.filter((s) => s.statutConformite === 'Point répété').length;

  const sitesWithScansToday = new Set(todayScans.map((s) => s.siteId)).size;
  const coveragePercent = sites.length > 0 ? Math.round((sitesWithScansToday / sites.length) * 100) : 0;

  const offlinePendingCount = getOfflineQueueCount();

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Header bar */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
              <QrCode className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold text-white">Supervision des Rondes & Scans QR-Code</h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
              <Flame className="w-3 h-3 text-emerald-400" />
              <span>Firebase Spark Synchro</span>
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Traçabilité électronique des contrôles physiques de rondes sur l’ensemble des postes de garde à Niamey.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleForceSync}
            disabled={isSyncing}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            title="Vérifier la synchronisation avec Firestore"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Synchronisation...' : 'Actualiser / Synchro'}</span>
          </button>

          <button
            onClick={handlePrint}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-lg shadow-emerald-950/40"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimer Registre d'Audit</span>
          </button>
        </div>
      </div>

      {/* Sync notification toast */}
      {syncNotice && (
        <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-xs flex items-center gap-2 animate-in fade-in print:hidden">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{syncNotice}</span>
        </div>
      )}

      {/* Offline pending badge if any */}
      {offlinePendingCount > 0 && (
        <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs flex items-center justify-between gap-2 print:hidden">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>{offlinePendingCount} scan(s)</strong> stocké(s) localement en attente de synchronisation réseau.
            </span>
          </div>
          <button
            onClick={handleForceSync}
            className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-100 font-bold text-[11px]"
          >
            Synchroniser maintenant
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 print:hidden">
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <p className="text-xs font-semibold text-slate-400">Total Scans Aujourd'hui</p>
          <p className="text-2xl font-black text-white mt-1">{todayScans.length}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Points de ronde flashés</p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <p className="text-xs font-semibold text-slate-400">Scans Conformes</p>
          <p className="text-2xl font-black text-emerald-400 mt-1">{conformesCount}</p>
          <p className="text-[10px] text-emerald-400/80 mt-0.5">Points et horaires respectés</p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <p className="text-xs font-semibold text-slate-400">Anomalies / Hors Plage</p>
          <p className="text-2xl font-black text-amber-400 mt-1">{anomaliesCount}</p>
          <p className="text-[10px] text-amber-400/80 mt-0.5">Écarts constatés</p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <p className="text-xs font-semibold text-slate-400">Points Répétés (&lt;10m)</p>
          <p className="text-2xl font-black text-rose-400 mt-1">{repeatCount}</p>
          <p className="text-[10px] text-rose-400/80 mt-0.5">Tentatives de scan double</p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 col-span-2 lg:col-span-1">
          <p className="text-xs font-semibold text-slate-400">Couverture des Sites</p>
          <p className="text-2xl font-black text-cyan-400 mt-1">{coveragePercent}%</p>
          <p className="text-[10px] text-cyan-400/80 mt-0.5">
            {sitesWithScansToday} / {sites.length} sites inspectés
          </p>
        </div>
      </div>

      {/* Progression des rondes par site (Vue synthétique en direct) */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 print:hidden">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-white text-base">État d'Avancement des Rondes par Poste</h3>
            <p className="text-xs text-slate-400">
              Vérification des points de passage obligatoires pour chaque site aujourd'hui
            </p>
          </div>
          <span className="text-xs font-mono text-emerald-400">{todayStr}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {sites.map((site) => {
            const sitePoints = site.pointsControle || [];
            const siteScansToday = todayScans.filter((s) => s.siteId === site.id);
            const scannedPointIds = new Set(siteScansToday.map((s) => s.pointId));
            const distinctScannedCount = scannedPointIds.size;
            const isFullyScanned = sitePoints.length > 0 && distinctScannedCount >= sitePoints.length;

            return (
              <div
                key={site.id}
                className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/60 flex flex-col justify-between gap-2.5"
              >
                <div>
                  <div className="flex items-center justify-between gap-1.5">
                    <h4 className="font-bold text-white text-xs sm:text-sm line-clamp-1">{site.nom}</h4>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                        isFullyScanned
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : distinctScannedCount > 0
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-slate-700 text-slate-400'
                      }`}
                    >
                      {isFullyScanned ? 'Complète' : distinctScannedCount > 0 ? 'En cours' : 'Non scannée'}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-400 mt-0.5">{site.quartier}</p>

                  {/* Points breakdown list */}
                  <div className="mt-2.5 space-y-1">
                    {sitePoints.map((pt) => {
                      const wasScanned = scannedPointIds.has(pt.id);
                      const scanRecord = siteScansToday.find((s) => s.pointId === pt.id);

                      return (
                        <div
                          key={pt.id}
                          className="flex items-center justify-between text-[11px] px-2 py-1 rounded bg-slate-900/60 border border-slate-800"
                        >
                          <div className="flex items-center gap-1.5 line-clamp-1">
                            {wasScanned ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            ) : (
                              <div className="w-3.5 h-3.5 rounded-full border border-slate-600 shrink-0" />
                            )}
                            <span className={wasScanned ? 'text-slate-200' : 'text-slate-400'}>
                              #{pt.ordre} {pt.nom}
                            </span>
                          </div>

                          <span className="font-mono text-[10px] text-slate-400 shrink-0 ml-1">
                            {scanRecord ? scanRecord.horaireScan : 'En attente'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Score : {distinctScannedCount}/{sitePoints.length} points</span>
                  <button
                    onClick={() => {
                      setSelectedSiteId(site.id);
                      setDateFilter('today');
                    }}
                    className="text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer"
                  >
                    Filtrer ces scans
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Printable Report Header (Visible only when printing) */}
      <div className="hidden print:block p-4 border-b-2 border-slate-900 text-black space-y-2 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black uppercase tracking-wide">
              {settings?.raisonSociale || 'NIGER SÉCURITÉ PRIVÉE & GARDIENNAGE S.A.R.L'}
            </h1>
            <p className="text-xs font-semibold text-slate-700">
              REGISTRE D'AUDIT ÉLECTRONIQUE DES RONDES DE SURVEILLANCE
            </p>
            <p className="text-[10px] text-slate-600">
              Niamey (Niger) • Certification par QR-Code physique et horodatage certifié
            </p>
          </div>
          <div className="text-right text-xs">
            <p className="font-bold">Date d'édition : {new Date().toLocaleDateString('fr-FR')}</p>
            <p className="text-[10px]">Heure : {new Date().toLocaleTimeString('fr-FR')}</p>
            <p className="text-[10px]">Page 1 / 1</p>
          </div>
        </div>
      </div>

      {/* Filters and search toolbar */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3 print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Date filter pills */}
            <div className="inline-flex rounded-xl bg-slate-800 p-1 text-xs">
              <button
                onClick={() => setDateFilter('today')}
                className={`px-3 py-1 rounded-lg font-semibold transition cursor-pointer ${
                  dateFilter === 'today'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Aujourd'hui
              </button>
              <button
                onClick={() => setDateFilter('week')}
                className={`px-3 py-1 rounded-lg font-semibold transition cursor-pointer ${
                  dateFilter === 'week'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                7 derniers jours
              </button>
              <button
                onClick={() => setDateFilter('all')}
                className={`px-3 py-1 rounded-lg font-semibold transition cursor-pointer ${
                  dateFilter === 'all'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Tout l'historique
              </button>
            </div>

            {/* Site selector */}
            <select
              value={selectedSiteId}
              onChange={(e) => setSelectedSiteId(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
            >
              <option value="all">Tous les sites ({sites.length})</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nom} ({s.quartier})
                </option>
              ))}
            </select>

            {/* Status selector */}
            <select
              value={selectedStatut}
              onChange={(e) => setSelectedStatut(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
            >
              <option value="all">Tous les statuts</option>
              <option value="Conforme">Conforme uniquement</option>
              <option value="Point répété">Point répété (&lt;10m)</option>
              <option value="En retard">En retard</option>
              <option value="Hors plage horaire">Hors plage horaire</option>
            </select>
          </div>

          {/* Search box */}
          <div className="w-full sm:w-64">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Rechercher agent, point..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Table of Scans */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl print:border-none print:shadow-none">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between print:hidden">
          <div>
            <h3 className="font-bold text-white text-base">Journal Certifié des Scans</h3>
            <p className="text-xs text-slate-400">
              {filteredScans.length} enregistrement{filteredScans.length > 1 ? 's' : ''} correspondant aux filtres
            </p>
          </div>
          <span className="text-[11px] text-slate-400">
            Anti-effacement garanti par les règles de sécurité Firestore
          </span>
        </div>

        {filteredScans.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <QrCode className="w-12 h-12 text-slate-600 mx-auto" />
            <p className="font-bold text-slate-300 text-sm">Aucun scan enregistré pour cette sélection</p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Basculez sur l'espace « Contrôleur terrain » pour lancer le scanner de ronde par caméra, ou sélectionnez une autre plage de date.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300 print:text-black">
              <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800 print:bg-slate-100 print:text-slate-800">
                <tr>
                  <th className="py-3 px-4">Date & Heure</th>
                  <th className="py-3 px-4">Site de Gardiennage</th>
                  <th className="py-3 px-4">Point de Contrôle</th>
                  <th className="py-3 px-4">Contrôleur Terrain</th>
                  <th className="py-3 px-4">Statut Conformité</th>
                  <th className="py-3 px-4 text-center">Synchro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 print:divide-slate-300">
                {filteredScans.map((scan) => (
                  <tr key={scan.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-mono font-bold text-white print:text-black">{scan.horaireScan}</div>
                      <div className="text-[10px] text-slate-500 print:text-slate-600">{scan.dateScan}</div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-semibold text-white print:text-black">{scan.siteNom}</div>
                      <div className="text-[10px] text-slate-400 print:text-slate-600">ID: {scan.siteId}</div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-semibold text-emerald-300 print:text-slate-900">{scan.pointNom}</div>
                      <div className="text-[10px] text-slate-400 print:text-slate-600">Réf: {scan.pointId}</div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-200 print:text-black">{scan.controleurNom}</div>
                      <div className="text-[10px] text-slate-400 print:text-slate-600">{scan.controleurGrade}</div>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                          scan.statutConformite === 'Conforme'
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            : scan.statutConformite === 'Point répété'
                            ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                            : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                        }`}
                      >
                        {scan.statutConformite === 'Conforme' ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <AlertTriangle className="w-3 h-3" />
                        )}
                        <span>{scan.statutConformite}</span>
                      </span>
                    </td>

                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      {scan.statutSynchro === 'synchronise' ? (
                        <span className="text-[10px] text-emerald-400 font-semibold flex items-center justify-center gap-1">
                          <Flame className="w-3 h-3 text-emerald-400" />
                          <span>Cloud</span>
                        </span>
                      ) : (
                        <span className="text-[10px] text-amber-400 font-semibold flex items-center justify-center gap-1">
                          <Clock className="w-3 h-3 text-amber-400" />
                          <span>Local</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
