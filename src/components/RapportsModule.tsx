import React, { useState } from 'react';
import { ShieldCheck, AlertTriangle, MapPin, Clock, Search, Filter, Plus } from 'lucide-react';
import { RapportControle } from '../types';

interface RapportsModuleProps {
  reports: RapportControle[];
  onOpenNewReport: () => void;
}

export const RapportsModule: React.FC<RapportsModuleProps> = ({
  reports,
  onOpenNewReport,
}) => {
  const [filter, setFilter] = useState<'tous' | 'incident' | 'valide'>('tous');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredReports = reports.filter((r) => {
    const matchesSearch =
      r.siteNom.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.controleurNom.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.quartier.toLowerCase().includes(searchTerm.toLowerCase());
    if (filter === 'incident') return matchesSearch && r.incidentSignale;
    if (filter === 'valide') return matchesSearch && !r.incidentSignale;
    return matchesSearch;
  });

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold text-white">Journal des Rapports de Contrôle & Rondes</h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Traçabilité des passages inopinés des contrôleurs terrain sur les sites à Niamey avec coordonnées GPS.
          </p>
        </div>

        <button
          onClick={onOpenNewReport}
          className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-lg shadow-emerald-900/30"
        >
          <Plus className="w-4 h-4" />
          <span>Nouveau Contrôle Terrain</span>
        </button>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="w-full sm:w-80">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Rechercher par site, contrôleur..."
            className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setFilter('tous')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${
              filter === 'tous' ? 'bg-slate-700 text-white' : 'bg-slate-800 text-slate-400'
            }`}
          >
            Tous ({reports.length})
          </button>
          <button
            onClick={() => setFilter('incident')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${
              filter === 'incident' ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-400'
            }`}
          >
            Anomalies & Incidents ({reports.filter((r) => r.incidentSignale).length})
          </button>
          <button
            onClick={() => setFilter('valide')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${
              filter === 'valide' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'
            }`}
          >
            Conformes ({reports.filter((r) => !r.incidentSignale).length})
          </button>
        </div>
      </div>

      {/* Reports Feed */}
      <div className="space-y-3">
        {filteredReports.map((rep) => (
          <div
            key={rep.id}
            className={`p-4 rounded-2xl border space-y-2.5 transition ${
              rep.incidentSignale
                ? 'bg-rose-950/20 border-rose-500/40 text-rose-100'
                : 'bg-slate-900 border-slate-800 text-slate-300'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-base">{rep.siteNom}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  {rep.quartier}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400 font-mono">{rep.dateHeure}</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full font-bold ${
                    rep.incidentSignale
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}
                >
                  {rep.statut}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-400">Contrôleur : <strong className="text-slate-200">{rep.controleurNom}</strong></span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-400">Position GPS : <strong className="text-emerald-400 font-mono text-[11px]">{rep.coordonneesGPS}</strong></span>
            </div>

            {/* Attendance & gear */}
            <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">Vigiles au poste :</span>
                <span className="font-semibold text-slate-200">{rep.agentsPresents.join(', ')}</span>
                {rep.agentsAbsents.length > 0 && (
                  <span className="text-rose-400 font-bold block text-[11px]">
                    Absents : {rep.agentsAbsents.join(', ')}
                  </span>
                )}
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Tenue & Équipement :</span>
                <span className="font-semibold text-slate-200">
                  {rep.tenueReglementaire} • {rep.equipementConforme ? 'Matériel OK' : 'Manquement matériel'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Vigilance & Main Courante :</span>
                <span className="font-semibold text-slate-200">
                  {rep.vigilancePoste} • {rep.registreMainCouranteTenu ? 'Registre émargé' : 'Non émargé'}
                </span>
              </div>
            </div>

            {/* Notes */}
            <div className="text-xs">
              <p className="text-slate-300">
                <span className="font-semibold text-slate-400">Constat :</span> {rep.observations}
              </p>
              {rep.incidentSignale && (
                <div className="mt-2 p-2.5 rounded-lg bg-rose-900/30 border border-rose-500/40 text-rose-200">
                  <p className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    <span>Alerte : {rep.typeIncident}</span>
                  </p>
                  <p className="text-xs mt-0.5">{rep.descriptionIncident}</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
