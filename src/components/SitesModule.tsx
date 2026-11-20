import React, { useState } from 'react';
import {
  Building,
  MapPin,
  Phone,
  ShieldCheck,
  AlertTriangle,
  Plus,
  Users,
  QrCode,
  Printer,
  X,
  CheckCircle2,
  Sliders,
  FileText,
  Clock,
  Eye,
  Trash2,
} from 'lucide-react';
import { SiteGardiennage, Client, PointControleSite, EnterpriseSettings } from '../types';
import { buildCheckpointQrPayload } from '../utils/qrCodeUtils';
import { CheckpointPrintModal } from './CheckpointPrintModal';

interface SitesModuleProps {
  sites: SiteGardiennage[];
  clients: Client[];
  onAddSite: (site: SiteGardiennage) => void;
  onSelectSiteToInspect?: (site: SiteGardiennage) => void;
  onUpdateSite?: (site: SiteGardiennage) => void;
  settings?: EnterpriseSettings;
}

export const SitesModule: React.FC<SitesModuleProps> = ({
  sites,
  clients,
  onAddSite,
  onSelectSiteToInspect,
  onUpdateSite,
  settings,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Checkpoints management modal state
  const [activeSiteForCheckpoints, setActiveSiteForCheckpoints] = useState<SiteGardiennage | null>(null);
  const [isAddingCheckpoint, setIsAddingCheckpoint] = useState(false);
  const [selectedCheckpointToPrint, setSelectedCheckpointToPrint] = useState<PointControleSite | null>(null);

  // New checkpoint form
  const [cpNom, setCpNom] = useState('');
  const [cpEmplacement, setCpEmplacement] = useState('');
  const [cpConsignes, setCpConsignes] = useState('');
  const [cpOrdre, setCpOrdre] = useState(1);

  // Form state for new site
  const [nom, setNom] = useState('');
  const [clientId, setClientId] = useState(clients[0]?.id || '');
  const [quartier, setQuartier] = useState('Plateau');
  const [postesRequis, setPostesRequis] = useState(4);
  const [niveauRisque, setNiveauRisque] = useState<SiteGardiennage['niveauRisque']>('Standard');
  const [responsable, setResponsable] = useState('');
  const [telephone, setTelephone] = useState('+227 ');
  const [consignes, setConsignes] = useState('');

  const filteredSites = sites.filter((s) => {
    return (
      s.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.quartier.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.clientNom.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const handleCreateSite = (e: React.FormEvent) => {
    e.preventDefault();
    const selClient = clients.find((c) => c.id === clientId) || clients[0];

    const newSiteId = `site-${Date.now()}`;
    const defaultCheckpoints: PointControleSite[] = [
      {
        id: `ckp-${Date.now()}-1`,
        siteId: newSiteId,
        siteNom: nom || 'Nouveau Site Surveillé',
        nom: 'Guérite Principale & Accès',
        emplacement: 'Entrée principale du poste',
        consignes: 'Vérifier la main courante et le filtrage des entrées.',
        ordre: 1,
        qrPayload: buildCheckpointQrPayload(newSiteId, `ckp-${Date.now()}-1`),
        estActif: true,
        creeLe: new Date().toISOString(),
      },
    ];

    const newSite: SiteGardiennage = {
      id: newSiteId,
      nom: nom || 'Nouveau Site Surveillé',
      clientId: selClient.id,
      clientNom: selClient.nom,
      quartier: quartier || 'Plateau',
      ville: 'Niamey',
      postesRequis: Number(postesRequis) || 4,
      effectifActuel: Number(postesRequis) || 4,
      niveauRisque,
      responsableSite: responsable || 'Chef de poste',
      telephoneResponsable: telephone || '+227 90 00 00 00',
      consignesParticulieres: consignes || 'Contrôle des accès et rondes régulières.',
      derniereVisiteControle: 'Non contrôlé aujourd’hui',
      statutConformite: 'Conforme',
      pointsControle: defaultCheckpoints,
    };

    onAddSite(newSite);
    setIsModalOpen(false);
    setNom('');
  };

  // Add new checkpoint to the current site
  const handleSaveCheckpoint = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSiteForCheckpoints || !cpNom.trim()) return;

    const newCpId = `ckp-${activeSiteForCheckpoints.id}-${Date.now()}`;
    const newCheckpoint: PointControleSite = {
      id: newCpId,
      siteId: activeSiteForCheckpoints.id,
      siteNom: activeSiteForCheckpoints.nom,
      nom: cpNom.trim(),
      emplacement: cpEmplacement.trim() || 'Emplacement standard',
      consignes: cpConsignes.trim() || 'Vérification visuelle et contrôle périmétrique.',
      ordre: Number(cpOrdre) || ((activeSiteForCheckpoints.pointsControle?.length || 0) + 1),
      qrPayload: buildCheckpointQrPayload(activeSiteForCheckpoints.id, newCpId),
      estActif: true,
      creeLe: new Date().toISOString(),
    };

    const updatedCheckpoints = [...(activeSiteForCheckpoints.pointsControle || []), newCheckpoint];
    const updatedSite: SiteGardiennage = {
      ...activeSiteForCheckpoints,
      pointsControle: updatedCheckpoints,
    };

    if (onUpdateSite) {
      onUpdateSite(updatedSite);
    }
    setActiveSiteForCheckpoints(updatedSite);
    setIsAddingCheckpoint(false);
    setCpNom('');
    setCpEmplacement('');
    setCpConsignes('');
  };

  const handleToggleCheckpointStatus = (pointId: string) => {
    if (!activeSiteForCheckpoints) return;
    const updated = (activeSiteForCheckpoints.pointsControle || []).map((p) =>
      p.id === pointId ? { ...p, estActif: !p.estActif } : p
    );
    const updatedSite = { ...activeSiteForCheckpoints, pointsControle: updated };
    if (onUpdateSite) onUpdateSite(updatedSite);
    setActiveSiteForCheckpoints(updatedSite);
  };

  const handleDeleteCheckpoint = (pointId: string) => {
    if (!activeSiteForCheckpoints) return;
    if (!window.confirm('Voulez-vous vraiment supprimer ce point de contrôle de la ronde ?')) return;
    const updated = (activeSiteForCheckpoints.pointsControle || []).filter((p) => p.id !== pointId);
    const updatedSite = { ...activeSiteForCheckpoints, pointsControle: updated };
    if (onUpdateSite) onUpdateSite(updatedSite);
    setActiveSiteForCheckpoints(updatedSite);
  };

  return (
    <div className="space-y-6 animate-in fade-in print:space-y-0">
      <div className={selectedCheckpointToPrint ? 'space-y-6 print:hidden' : 'space-y-6'}>
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
              <Building className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold text-white">Sites de Gardiennage Sécurisés</h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Localisation des postes de faction à Niamey, effectifs déployés, points de ronde et QR-Codes certifiés.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-lg shadow-emerald-900/30"
        >
          <Plus className="w-4 h-4" />
          <span>Ajouter un Site</span>
        </button>
      </div>

      {/* Search */}
      <div className="w-full sm:w-80">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Rechercher par quartier (Plateau, Yantala...), nom..."
          className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
        />
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSites.map((site) => {
          const checkpointCount = site.pointsControle?.length || 0;

          return (
            <div
              key={site.id}
              className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between gap-4"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase bg-slate-800 text-slate-300 border border-slate-700">
                        {site.quartier}
                      </span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                          site.niveauRisque === 'Sensible / VIP'
                            ? 'bg-rose-500/20 text-rose-300'
                            : site.niveauRisque === 'Élevé'
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-blue-500/20 text-blue-300'
                        }`}
                      >
                        {site.niveauRisque}
                      </span>
                    </div>
                    <h3 className="font-bold text-white text-base mt-2 leading-snug">{site.nom}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Client : <span className="text-slate-200">{site.clientNom}</span>
                    </p>
                  </div>

                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap border ${
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

                {/* Responsable & phone */}
                <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-800 text-xs space-y-1">
                  <p className="text-slate-400">Responsable / Chef de poste :</p>
                  <p className="font-semibold text-white flex items-center justify-between">
                    <span>{site.responsableSite}</span>
                    <span className="text-emerald-400 font-mono text-[11px]">{site.telephoneResponsable}</span>
                  </p>
                </div>

                {/* Consignes */}
                <div className="text-xs text-slate-300">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Consignes spécifiques :
                  </p>
                  <p className="line-clamp-2 italic text-slate-400 text-[11px]">"{site.consignesParticulieres}"</p>
                </div>

                {/* Rubrique Points de Contrôle & QR-Codes */}
                <div className="p-3 rounded-xl bg-slate-800/30 border border-slate-700/60 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="p-1 rounded bg-emerald-500/20 text-emerald-400">
                      <QrCode className="w-4 h-4" />
                    </span>
                    <div>
                      <p className="font-semibold text-white">Points de Ronde QR</p>
                      <p className="text-[10px] text-slate-400">
                        {checkpointCount} repère{checkpointCount > 1 ? 's' : ''} configuré{checkpointCount > 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setActiveSiteForCheckpoints(site);
                      setIsAddingCheckpoint(false);
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white font-semibold text-[11px] transition cursor-pointer flex items-center gap-1 border border-emerald-500/30"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Gérer & Imprimer</span>
                  </button>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <p className="text-slate-400 text-[11px]">Effectif Vigiles</p>
                  <p className="font-bold text-white">
                    {site.effectifActuel} <span className="text-slate-400 font-normal">/ {site.postesRequis} requis</span>
                  </p>
                </div>

                <div className="text-right text-[11px]">
                  <p className="text-slate-400">Dernier contrôle</p>
                  <p className="font-medium text-slate-300">{site.derniereVisiteControle}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      </div>

      {/* Modal Points de Contrôle & QR-Codes d'un site */}
      {activeSiteForCheckpoints && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in overflow-y-auto print:hidden">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl text-slate-100 overflow-hidden my-auto">
            {/* Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950 sticky top-0 z-10">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <QrCode className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-white text-base">Points de Contrôle & QR-Codes</h3>
                  <p className="text-xs text-slate-400">
                    {activeSiteForCheckpoints.nom} • {activeSiteForCheckpoints.quartier}
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  setActiveSiteForCheckpoints(null);
                  setIsAddingCheckpoint(false);
                }}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-5 overflow-y-auto flex-1">
              {/* Notice informative */}
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-200 text-xs flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-emerald-300">Procédure d'installation physique :</p>
                  <p className="mt-0.5 text-emerald-200/90 text-[11px] leading-relaxed">
                    Chaque point de contrôle possède un QR-Code cryptographique unique infalsifiable. Imprimez la fiche
                    A4 officielle et fixez-la sous pochette transparente étanche à l'emplacement indiqué (portail, groupe,
                    coffre-fort, clôture). Les contrôleurs scanneront ce code avec leur smartphone lors de chaque ronde.
                  </p>
                </div>
              </div>

              {/* Bar d'actions */}
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-slate-300 font-semibold">
                  Points enregistrés ({activeSiteForCheckpoints.pointsControle?.length || 0}) :
                </p>

                <button
                  onClick={() => setIsAddingCheckpoint(!isAddingCheckpoint)}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-emerald-950/40"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isAddingCheckpoint ? 'Annuler l’ajout' : 'Ajouter un Point de Contrôle'}</span>
                </button>
              </div>

              {/* Formulaire d'ajout de point */}
              {isAddingCheckpoint && (
                <form
                  onSubmit={handleSaveCheckpoint}
                  className="p-4 rounded-xl bg-slate-800/80 border border-emerald-500/40 space-y-3 text-xs animate-in slide-in-from-top-2"
                >
                  <h4 className="font-bold text-white text-sm flex items-center gap-1.5">
                    <Plus className="w-4 h-4 text-emerald-400" />
                    <span>Nouveau repère de ronde pour ce site</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-slate-300 font-semibold mb-1">
                        Nom du repère / Point de passage *
                      </label>
                      <input
                        type="text"
                        required
                        value={cpNom}
                        onChange={(e) => setCpNom(e.target.value)}
                        placeholder="Ex: Porte Accès Coffre-Fort, Guérite Sud, Cuve..."
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Ordre de passage</label>
                      <input
                        type="number"
                        min="1"
                        value={cpOrdre}
                        onChange={(e) => setCpOrdre(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      Emplacement physique exact *
                    </label>
                    <input
                      type="text"
                      required
                      value={cpEmplacement}
                      onChange={(e) => setCpEmplacement(e.target.value)}
                      placeholder="Ex: Sous-sol côté transformateur électrique, au mur droit"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      Consigne de sécurité spécifique lors du pointage
                    </label>
                    <input
                      type="text"
                      value={cpConsignes}
                      onChange={(e) => setCpConsignes(e.target.value)}
                      placeholder="Ex: Vérifier le cadenas, tester l'extincteur, inspecter la clôture..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsAddingCheckpoint(false)}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-md shadow-emerald-950/40"
                    >
                      Enregistrer et Générer le QR-Code
                    </button>
                  </div>
                </form>
              )}

              {/* Liste des checkpoints */}
              {(!activeSiteForCheckpoints.pointsControle ||
                activeSiteForCheckpoints.pointsControle.length === 0) && (
                <div className="p-8 text-center bg-slate-800/30 rounded-2xl border border-dashed border-slate-700 text-slate-400 text-xs">
                  <QrCode className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                  <p className="font-semibold text-slate-300">Aucun point de contrôle configuré</p>
                  <p className="mt-1 text-slate-500">
                    Cliquez sur « Ajouter un Point de Contrôle » pour créer votre premier repère à flasher.
                  </p>
                </div>
              )}

              <div className="space-y-3">
                {activeSiteForCheckpoints.pointsControle?.map((cp) => (
                  <div
                    key={cp.id}
                    className={`p-4 rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      cp.estActif
                        ? 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                        : 'bg-slate-900/50 border-slate-800 opacity-60'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold text-xs shrink-0">
                        #{cp.ordre}
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-white text-sm">{cp.nom}</h4>
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                              cp.estActif
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-rose-500/20 text-rose-300'
                            }`}
                          >
                            {cp.estActif ? 'Actif' : 'Désactivé'}
                          </span>
                        </div>

                        <p className="text-xs text-slate-300 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{cp.emplacement}</span>
                        </p>

                        {cp.consignes && (
                          <p className="text-[11px] text-slate-400 italic">
                            Consigne : "{cp.consignes}"
                          </p>
                        )}

                        <p className="text-[10px] text-slate-500 font-mono">ID : {cp.id}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <button
                        onClick={() => setSelectedCheckpointToPrint(cp)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-emerald-950/40"
                        title="Afficher et imprimer la fiche A4"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Fiche A4</span>
                      </button>

                      <button
                        onClick={() => handleToggleCheckpointStatus(cp.id)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                        title={cp.estActif ? 'Désactiver temporairement ce point' : 'Réactiver ce point'}
                      >
                        {cp.estActif ? 'Désactiver' : 'Activer'}
                      </button>

                      <button
                        onClick={() => handleDeleteCheckpoint(cp.id)}
                        className="p-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300"
                        title="Supprimer ce point"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="p-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs">
              <span className="text-[11px] text-slate-500">
                Format cryptographique NSP_PATROL • Anti-falsification certifié
              </span>

              <button
                onClick={() => {
                  setActiveSiteForCheckpoints(null);
                  setIsAddingCheckpoint(false);
                }}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Checkpoint Modal */}
      {selectedCheckpointToPrint && activeSiteForCheckpoints && (
        <CheckpointPrintModal
          isOpen={Boolean(selectedCheckpointToPrint)}
          onClose={() => setSelectedCheckpointToPrint(null)}
          checkpoint={selectedCheckpointToPrint}
          site={activeSiteForCheckpoints}
          settings={settings}
        />
      )}

      {/* Modal Add Site */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm print:hidden">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base">Nouveau Site de Gardiennage</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSite} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Nom du Site</label>
                <input
                  type="text"
                  required
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  placeholder="Ex: Agence Recasement, Base Logistique..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Client Rattaché</label>
                  <select
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  >
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nom}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Quartier (Niamey)</label>
                  <input
                    type="text"
                    value={quartier}
                    onChange={(e) => setQuartier(e.target.value)}
                    placeholder="Ex: Plateau, Yantala, Koubia..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Effectif Requis (Vigiles)</label>
                  <input
                    type="number"
                    min="1"
                    value={postesRequis}
                    onChange={(e) => setPostesRequis(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Niveau de Risque</label>
                  <select
                    value={niveauRisque}
                    onChange={(e) => setNiveauRisque(e.target.value as any)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="Standard">Standard</option>
                    <option value="Élevé">Élevé</option>
                    <option value="Sensible / VIP">Sensible / VIP</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Responsable / Chef de Poste</label>
                  <input
                    type="text"
                    value={responsable}
                    onChange={(e) => setResponsable(e.target.value)}
                    placeholder="M. Ibrahim Dan-Inna"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Téléphone Responsable</label>
                  <input
                    type="text"
                    value={telephone}
                    onChange={(e) => setTelephone(e.target.value)}
                    placeholder="+227 96 00 00 00"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Consignes Particulières</label>
                <textarea
                  rows={2}
                  value={consignes}
                  onChange={(e) => setConsignes(e.target.value)}
                  placeholder="Ex: Filtrage armé, vérification ronde nocturne toutes les heures..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2 text-white"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-md shadow-emerald-950/40"
                >
                  Créer le Site & Point de Ronde
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
