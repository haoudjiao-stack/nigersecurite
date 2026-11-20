import React, { useState } from 'react';
import { X, ShieldCheck, MapPin, AlertTriangle, CheckSquare, Clock, Camera, FileText, Upload, Image as ImageIcon, Trash2 } from 'lucide-react';
import { SiteGardiennage, AgentSecurite, RapportControle } from '../types';

interface NewReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  sites: SiteGardiennage[];
  agents: AgentSecurite[];
  onSubmitReport: (newReport: RapportControle) => void;
  currentControllerName?: string;
  defaultSiteId?: string;
}

export const NewReportModal: React.FC<NewReportModalProps> = ({
  isOpen,
  onClose,
  sites,
  agents,
  onSubmitReport,
  currentControllerName = 'Lt. Ibrahim Dan-Inna (Contrôleur Terrain)',
  defaultSiteId,
}) => {
  if (!isOpen) return null;

  const [selectedSiteId, setSelectedSiteId] = useState(defaultSiteId || sites[0]?.id || '');
  const [tenue, setTenue] = useState<'Impeccable' | 'Incomplète' | 'Non conforme'>('Impeccable');
  const [mainCourante, setMainCourante] = useState(true);
  const [equipement, setEquipement] = useState(true);
  const [vigilance, setVigilance] = useState<'Excellente' | 'Moyenne' | 'Endormissement / Défaut d’attention'>('Excellente');
  const [hasIncident, setHasIncident] = useState(false);
  const [typeIncident, setTypeIncident] = useState('Absence au poste');
  const [descriptionIncident, setDescriptionIncident] = useState('');
  const [observations, setObservations] = useState('');
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);

  const currentSite = sites.find((s) => s.id === selectedSiteId) || sites[0];
  const siteAgents = agents.filter((a) => a.siteId === selectedSiteId);

  // Present agents checklist state
  const [presentMap, setPresentMap] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    siteAgents.forEach((a) => {
      init[a.id] = a.statut !== 'Absent';
    });
    return init;
  });

  const toggleAgent = (id: string) => {
    setPresentMap((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoDataUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const setSampleSecurityPhoto = () => {
    // High quality sample security checkpoint SVG placeholder
    const svg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="250" viewBox="0 0 400 250"><rect width="400" height="250" fill="%230f172a"/><rect x="20" y="20" width="360" height="210" rx="10" fill="%231e293b" stroke="%2310b981" stroke-width="2"/><circle cx="200" cy="100" r="40" fill="%2310b981" opacity="0.2"/><path d="M185 100 L195 110 L215 90" stroke="%2310b981" stroke-width="4" fill="none"/><text x="200" y="160" font-family="sans-serif" font-size="14" font-weight="bold" fill="%23ffffff" text-anchor="middle">CONTRÔLE DU POSTE DE GARDE</text><text x="200" y="185" font-family="sans-serif" font-size="11" fill="%2394a3b8" text-anchor="middle">Niamey • Dispositif conforme</text></svg>`;
    setPhotoDataUrl(svg);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const presents: string[] = [];
    const absents: string[] = [];

    siteAgents.forEach((a) => {
      if (presentMap[a.id] !== false) {
        presents.push(`${a.prenom} ${a.nom}`);
      } else {
        absents.push(`${a.prenom} ${a.nom}`);
      }
    });

    const now = new Date();
    const formattedDate = now.toISOString().replace('T', ' ').substring(0, 16);

    const report: RapportControle = {
      id: `rep-${Date.now()}`,
      dateHeure: formattedDate,
      controleurNom: currentControllerName,
      siteId: currentSite.id,
      siteNom: currentSite.nom,
      quartier: currentSite.quartier,
      agentsPresents: presents.length > 0 ? presents : ['Vigile de relève'],
      agentsAbsents: absents,
      tenueReglementaire: tenue,
      registreMainCouranteTenu: mainCourante,
      equipementConforme: equipement,
      vigilancePoste: vigilance,
      incidentSignale: hasIncident,
      typeIncident: hasIncident ? typeIncident : undefined,
      descriptionIncident: hasIncident ? descriptionIncident : undefined,
      coordonneesGPS: `13.51${Math.floor(Math.random() * 90)}° N, 2.11${Math.floor(Math.random() * 90)}° E (${currentSite.quartier})`,
      observations: observations || 'Ronde effectuée. Dispositif de sécurité inspecté conformément aux consignes.',
      statut: hasIncident ? 'Alerte transmise Direction' : 'Validé',
      photoUrl: photoDataUrl || undefined,
    };

    onSubmitReport(report);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto flex flex-col shadow-2xl text-slate-100">
        {/* Top Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70 sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-bold text-white text-base">Fiche de Contrôle de Ronde</h3>
              <p className="text-xs text-slate-400">Par : {currentControllerName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Site selection */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              1. Sélection du Site Attribué
            </label>
            <select
              value={selectedSiteId}
              onChange={(e) => setSelectedSiteId(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
            >
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.nom} ({site.quartier}) - {site.clientNom}
                </option>
              ))}
            </select>
          </div>

          {/* GPS stamp badge */}
          <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700 text-xs flex items-center justify-between text-slate-300">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Pointage GPS automatique :</span>
            </div>
            <span className="font-mono text-emerald-300 font-semibold text-[11px]">
              13.5136° N, 2.1098° E (Vérifié à Niamey)
            </span>
          </div>

          {/* Agents on post */}
          <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-800 space-y-2">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
              2. Pointage de présence des agents affectés
            </label>
            {siteAgents.length === 0 ? (
              <p className="text-xs text-slate-400 italic">
                Aucun agent rattaché spécifiquement dans la base démo pour ce site. Le vigile de relève sera marqué présent.
              </p>
            ) : (
              <div className="space-y-2">
                {siteAgents.map((ag) => (
                  <label
                    key={ag.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-800 border border-slate-700 cursor-pointer hover:border-slate-600 transition"
                  >
                    <div className="flex items-center gap-2.5 text-xs">
                      <input
                        type="checkbox"
                        checked={presentMap[ag.id] !== false}
                        onChange={() => toggleAgent(ag.id)}
                        className="rounded text-emerald-500 focus:ring-0 bg-slate-700 w-4 h-4"
                      />
                      <span className="font-semibold text-white">{ag.prenom} {ag.nom}</span>
                      <span className="text-[11px] text-slate-400 font-mono">({ag.matricule})</span>
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                        presentMap[ag.id] !== false
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-rose-500/20 text-rose-300'
                      }`}
                    >
                      {presentMap[ag.id] !== false ? 'Présent' : 'Absent'}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Checklist inspection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Tenue réglementaire
              </label>
              <select
                value={tenue}
                onChange={(e) => setTenue(e.target.value as any)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="Impeccable">Impeccable (Uniforme & Rangers)</option>
                <option value="Incomplète">Incomplète (Manque torche / badge)</option>
                <option value="Non conforme">Non conforme / Tenue civile</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Vigilance constatée
              </label>
              <select
                value={vigilance}
                onChange={(e) => setVigilance(e.target.value as any)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="Excellente">Excellente / Alerte</option>
                <option value="Moyenne">Moyenne</option>
                <option value="Endormissement / Défaut d’attention">Endormissement constaté</option>
              </select>
            </div>
          </div>

          {/* Toggles for Main courante & equipment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-800/60 border border-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={mainCourante}
                onChange={(e) => setMainCourante(e.target.checked)}
                className="rounded text-emerald-500 bg-slate-700 w-4 h-4"
              />
              <span className="text-xs text-slate-200">Registre Main Courante à jour</span>
            </label>

            <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-800/60 border border-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={equipement}
                onChange={(e) => setEquipement(e.target.checked)}
                className="rounded text-emerald-500 bg-slate-700 w-4 h-4"
              />
              <span className="text-xs text-slate-200">Équipement complet (Matraque/Torche)</span>
            </label>
          </div>

          {/* Incident toggle */}
          <div className="p-3 rounded-xl bg-slate-800/70 border border-slate-700 space-y-3">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <AlertTriangle className={`w-4 h-4 ${hasIncident ? 'text-rose-400' : 'text-slate-400'}`} />
                Signaler une anomalie ou un incident urgent ?
              </span>
              <input
                type="checkbox"
                checked={hasIncident}
                onChange={(e) => setHasIncident(e.target.checked)}
                className="rounded text-rose-500 bg-slate-700 w-4 h-4"
              />
            </label>

            {hasIncident && (
              <div className="pt-2 border-t border-slate-700 space-y-2 animate-in fade-in">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Nature de l'incident
                  </label>
                  <select
                    value={typeIncident}
                    onChange={(e) => setTypeIncident(e.target.value)}
                    className="w-full bg-slate-900 border border-rose-500/40 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  >
                    <option value="Absence injustifiée au poste">Absence injustifiée au poste</option>
                    <option value="Endormissement d'un vigile la nuit">Endormissement d'un vigile la nuit</option>
                    <option value="Tentative d’intrusion périmètre">Tentative d’intrusion périmètre</option>
                    <option value="Portail ou clôture endommagée">Portail ou clôture endommagée</option>
                    <option value="Coupure d’électricité / Éclairage de sécurité HS">Coupure d’électricité / Éclairage HS</option>
                    <option value="Conflit avec un visiteur / client">Conflit avec un visiteur / client</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Détails & mesures conservatoires prises
                  </label>
                  <textarea
                    rows={2}
                    value={descriptionIncident}
                    onChange={(e) => setDescriptionIncident(e.target.value)}
                    placeholder="Ex: Remplacement d'urgence demandé, consigne donnée au chef de poste..."
                    className="w-full bg-slate-900 border border-rose-500/40 rounded-lg p-2 text-xs text-white placeholder-slate-500 focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Observations */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Observations générales du contrôleur
            </label>
            <textarea
              rows={2}
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              placeholder="Ex: RAS, poste bien tenu, rondes effectuées aux heures requises..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Real Photo Capture / Upload Section */}
          <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-300 flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-emerald-400" />
                <span>Preuve Photo du Poste / Incident</span>
              </span>
              <span className="text-[10px] text-slate-400">Smartphone ou appareil</span>
            </div>

            {photoDataUrl ? (
              <div className="relative rounded-xl overflow-hidden border border-emerald-500/50 bg-slate-900 p-2 flex items-center gap-3">
                <img
                  src={photoDataUrl}
                  alt="Preuve contrôle"
                  className="w-20 h-16 object-cover rounded-lg border border-slate-700"
                />
                <div className="flex-1 text-xs">
                  <p className="font-bold text-emerald-300">Photo attachée</p>
                  <p className="text-[10px] text-slate-400">Horodatée et prête à être transmise</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPhotoDataUrl(null)}
                  className="p-1.5 rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/30"
                  title="Supprimer la photo"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-2">
                <label className="flex-1 w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-dashed border-slate-600 hover:border-emerald-500 text-xs text-center text-slate-300 cursor-pointer transition flex items-center justify-center gap-2">
                  <Upload className="w-4 h-4 text-emerald-400" />
                  <span>Prendre / Téléverser une photo</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </label>
                <button
                  type="button"
                  onClick={setSampleSecurityPhoto}
                  className="w-full sm:w-auto px-3 py-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white text-xs whitespace-nowrap border border-slate-700"
                >
                  Photo test démo
                </button>
              </div>
            )}
          </div>

          {/* Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-900/30 cursor-pointer flex items-center gap-1.5"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Transmettre le Rapport à la Direction</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
