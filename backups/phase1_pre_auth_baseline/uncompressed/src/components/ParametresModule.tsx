import React, { useState, useEffect, useRef } from 'react';
import {
  Building2,
  Save,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  FileText,
  Phone,
  Mail,
  Landmark,
  Image as ImageIcon,
  Upload,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { EnterpriseSettings } from '../types';

interface ParametresModuleProps {
  settings: EnterpriseSettings;
  onSaveSettings: (newSettings: EnterpriseSettings) => boolean | void;
}

export const ParametresModule: React.FC<ParametresModuleProps> = ({
  settings,
  onSaveSettings,
}) => {
  const [formData, setFormData] = useState<EnterpriseSettings>({ ...settings });
  const [isSaved, setIsSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Logo state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(settings.logoUrl || null);
  const [logoNotice, setLogoNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  useEffect(() => {
    setFormData({ ...settings });
    setLogoPreview(settings.logoUrl || null);
  }, [settings]);

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLogoNotice(null);

    // 1. Validation du type MIME et de l'extension (PNG, JPG, JPEG)
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    const validExtensions = /\.(png|jpe?g)$/i;
    const isMimeValid = validTypes.includes(file.type.toLowerCase());
    const isExtValid = validExtensions.test(file.name);

    if (!isMimeValid && !isExtValid) {
      setLogoNotice({
        type: 'error',
        message: 'Format non supporté. Veuillez sélectionner une image au format PNG, JPG ou JPEG.',
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // 2. Limite de taille stricte : 500 Ko max (512 000 octets)
    const maxSizeBytes = 500 * 1024;
    const fileSizeKo = Number((file.size / 1024).toFixed(1));
    if (file.size > maxSizeBytes) {
      setLogoNotice({
        type: 'error',
        message: `Fichier trop volumineux (${fileSizeKo} Ko). La taille maximale autorisée est de 500 Ko. Le logo précédent a été conservé sans modification.`,
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // 3. Lecture du fichier en Data URL Base64
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const result = uploadEvent.target?.result as string;
      if (result) {
        setLogoPreview(result);
        setLogoNotice({
          type: 'success',
          message: `Image « ${file.name} » (${fileSizeKo} Ko) chargée. Cliquez sur « Enregistrer le logo » pour confirmer.`,
        });
      }
    };
    reader.onerror = () => {
      setLogoNotice({
        type: 'error',
        message: "Erreur de lecture du fichier image. Veuillez réessayer.",
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSaveLogo = () => {
    if (!logoPreview) return;
    setLogoNotice(null);
    const updatedSettings: EnterpriseSettings = {
      ...formData,
      logoUrl: logoPreview,
    };
    const success = onSaveSettings(updatedSettings);
    if (success !== false) {
      setFormData(updatedSettings);
      setLogoNotice({
        type: 'success',
        message: 'Logo de l’entreprise enregistré avec succès dans les paramètres persistants.',
      });
      setTimeout(() => {
        setLogoNotice((prev) => (prev?.type === 'success' ? null : prev));
      }, 4000);
    } else {
      setLogoNotice({
        type: 'error',
        message: "Échec de l'enregistrement du logo dans le stockage local du navigateur.",
      });
    }
  };

  const handleDeleteLogo = () => {
    setLogoNotice(null);
    const updatedSettings: EnterpriseSettings = {
      ...formData,
      logoUrl: undefined,
    };
    const success = onSaveSettings(updatedSettings);
    if (success !== false) {
      setLogoPreview(null);
      setFormData(updatedSettings);
      setIsConfirmingDelete(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setLogoNotice({
        type: 'success',
        message: 'Logo supprimé. Les initiales et écussons par défaut ont été rétablis sur l’ensemble des documents.',
      });
      setTimeout(() => {
        setLogoNotice((prev) => (prev?.type === 'success' ? null : prev));
      }, 4000);
    } else {
      setLogoNotice({
        type: 'error',
        message: "Échec de la suppression du logo dans le stockage local du navigateur.",
      });
      setIsConfirmingDelete(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedSettings: EnterpriseSettings = {
      ...formData,
      logoUrl: logoPreview || undefined,
    };
    const result = onSaveSettings(updatedSettings);
    if (result !== false) {
      setFormData(updatedSettings);
      setIsSaved(true);
      setSaveError(null);
      setTimeout(() => setIsSaved(false), 3000);
    } else {
      setIsSaved(false);
      setSaveError("Échec de l'enregistrement dans le stockage local du navigateur. Vos modifications n'ont pas pu être persistées.");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Banner */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
              <Building2 className="w-5 h-5" />
            </span>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white">Paramétrage Officiel de l’Entreprise</h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Accès Réservé Direction
              </span>
            </div>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Mentions légales, agrément ministériel de sécurité privée au Niger, fiscalité (NIF, TVA), logo et coordonnées bancaires.
          </p>
        </div>

        {isSaved && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-semibold animate-in fade-in">
            <CheckCircle2 className="w-4 h-4" />
            <span>Paramètres enregistrés avec succès</span>
          </div>
        )}

        {saveError && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-semibold animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{saveError}</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* RUBRIQUE : LOGO DE L'ENTREPRISE */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-emerald-400" />
              <span>Logo Officiel de l’Entreprise</span>
            </h3>
            <span className="text-[11px] text-slate-400">
              Formats acceptés : PNG, JPG, JPEG (Max 500 Ko)
            </span>
          </div>

          {/* Messages de statut du logo */}
          {logoNotice && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-center gap-2.5 animate-in fade-in ${
                logoNotice.type === 'success'
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
              }`}
            >
              {logoNotice.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              )}
              <span className="flex-1">{logoNotice.message}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            {/* Cadre d'aperçu du logo */}
            <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Aperçu du logo
              </span>
              <div className="w-32 h-32 rounded-xl bg-slate-900 border border-slate-700/80 flex items-center justify-center p-2 overflow-hidden shadow-inner relative">
                {logoPreview ? (
                  <img
                    src={logoPreview}
                    alt="Aperçu logo entreprise"
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-500 gap-1.5 p-2">
                    <ShieldCheck className="w-8 h-8 text-slate-600" />
                    <span className="text-[10px] leading-tight">Aucun logo personnalisé</span>
                    <span className="text-[9px] text-slate-600">(Initiales / écusson par défaut)</span>
                  </div>
                )}
              </div>
              <p className="text-[10px] text-slate-400 mt-2">
                {logoPreview ? (
                  <span className="text-emerald-400 font-semibold flex items-center gap-1 justify-center">
                    <CheckCircle2 className="w-3 h-3" />
                    {logoPreview === settings.logoUrl ? 'Logo actif enregistré' : 'Nouvel aperçu à enregistrer'}
                  </span>
                ) : (
                  'Initiales ou écusson affichés'
                )}
              </p>
            </div>

            {/* Actions et contrôles du logo */}
            <div className="md:col-span-2 space-y-4">
              <div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Le logo choisi sera automatiquement intégré sur l'en-tête général de l'application, les factures clients imprimables, les bulletins de salaire des vigiles et les aperçus des documents comptables.
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Les dimensions et proportions de votre image sont strictement conservées sans aucune déformation.
                </p>
              </div>

              {/* Champ fichier masqué */}
              <input
                type="file"
                ref={fileInputRef}
                accept="image/png,image/jpeg,image/jpg,.png,.jpg,.jpeg"
                onChange={handleLogoSelect}
                className="hidden"
              />

              <div className="flex flex-wrap items-center gap-3">
                {/* Bouton Choisir un logo */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-2 transition cursor-pointer"
                >
                  <Upload className="w-4 h-4 text-emerald-400" />
                  <span>{logoPreview ? 'Changer de logo' : 'Choisir un logo'}</span>
                </button>

                {/* Bouton Enregistrer le logo */}
                {logoPreview && logoPreview !== settings.logoUrl && (
                  <button
                    type="button"
                    onClick={handleSaveLogo}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-emerald-950/40"
                  >
                    <Save className="w-4 h-4" />
                    <span>Enregistrer le logo</span>
                  </button>
                )}

                {/* Bouton Supprimer le logo */}
                {(logoPreview || settings.logoUrl) && !isConfirmingDelete && (
                  <button
                    type="button"
                    onClick={() => setIsConfirmingDelete(true)}
                    className="px-3.5 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Supprimer le logo</span>
                  </button>
                )}
              </div>

              {/* Confirmation avant suppression */}
              {isConfirmingDelete && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 space-y-2 animate-in fade-in">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <div className="text-xs text-rose-200">
                      <p className="font-bold">Confirmer la suppression du logo ?</p>
                      <p className="text-[11px] text-rose-300/80 mt-0.5">
                        L'application et tous les documents imprimables rétabliront automatiquement les initiales et écussons par défaut.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleDeleteLogo}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs cursor-pointer transition shadow-sm"
                    >
                      Confirmer la suppression
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsConfirmingDelete(false)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer transition"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Identité légale */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="font-bold text-white text-base flex items-center gap-2 border-b border-slate-800 pb-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>1. Identité & Agrément Ministériel (Niger)</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Raison Sociale Officielle</label>
              <input
                type="text"
                value={formData.raisonSociale}
                onChange={(e) => setFormData({ ...formData, raisonSociale: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Sigle / Nom commercial</label>
              <input
                type="text"
                value={formData.sigle}
                onChange={(e) => setFormData({ ...formData, sigle: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-slate-300 font-semibold mb-1">
                Arrêté d'Agrément Ministère de l'Intérieur
              </label>
              <input
                type="text"
                value={formData.agrementMinistere}
                onChange={(e) => setFormData({ ...formData, agrementMinistere: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Fiscalité et Immatriculations */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="font-bold text-white text-base flex items-center gap-2 border-b border-slate-800 pb-2">
            <FileText className="w-4 h-4 text-blue-400" />
            <span>2. Immatriculations Fiscales & Sociales (DGI & CNSS)</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Numéro d’Identification Fiscale (NIF)</label>
              <input
                type="text"
                value={formData.nif}
                onChange={(e) => setFormData({ ...formData, nif: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Registre du Commerce (RCCM)</label>
              <input
                type="text"
                value={formData.rccm}
                onChange={(e) => setFormData({ ...formData, rccm: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">N° Affiliation CNSS Employeur</label>
              <input
                type="text"
                value={formData.numeroCNSS}
                onChange={(e) => setFormData({ ...formData, numeroCNSS: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Taux TVA Standard Niger (%)</label>
              <input
                type="number"
                value={formData.tauxTVA}
                onChange={(e) => setFormData({ ...formData, tauxTVA: Number(e.target.value) })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Taux CNSS Part Ouvrière Vigiles (%)</label>
              <input
                type="number"
                step="0.05"
                value={formData.tauxCNSSOuvrier}
                onChange={(e) => setFormData({ ...formData, tauxCNSSOuvrier: Number(e.target.value) })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Siège social & Coordonnées bancaires */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="font-bold text-white text-base flex items-center gap-2 border-b border-slate-800 pb-2">
            <Landmark className="w-4 h-4 text-purple-400" />
            <span>3. Coordonnées & Données Bancaires</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Adresse Siège à Niamey</label>
              <input
                type="text"
                value={formData.adresse}
                onChange={(e) => setFormData({ ...formData, adresse: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Ville / Pays</label>
              <input
                type="text"
                value={formData.ville}
                onChange={(e) => setFormData({ ...formData, ville: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Téléphone Principal Siège</label>
              <input
                type="text"
                value={formData.telephonePrincipal}
                onChange={(e) => setFormData({ ...formData, telephonePrincipal: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Ligne Urgence Opérationnelle 24/7</label>
              <input
                type="text"
                value={formData.telephoneUrgence247}
                onChange={(e) => setFormData({ ...formData, telephoneUrgence247: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Banque Partenaire (Niamey)</label>
              <input
                type="text"
                value={formData.banquePrincipale}
                onChange={(e) => setFormData({ ...formData, banquePrincipale: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">RIB / Numéro de compte</label>
              <input
                type="text"
                value={formData.ribBancaire}
                onChange={(e) => setFormData({ ...formData, ribBancaire: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-900/40 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Enregistrer les paramètres d'entreprise</span>
          </button>
        </div>
      </form>
    </div>
  );
};
