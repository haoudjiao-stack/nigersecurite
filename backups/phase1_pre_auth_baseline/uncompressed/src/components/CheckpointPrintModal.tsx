import React, { useState, useEffect } from 'react';
import { X, Printer, Shield, QrCode, MapPin, AlertCircle, Building2, Download } from 'lucide-react';
import { PointControleSite, SiteGardiennage, EnterpriseSettings } from '../types';
import { generateQrCodeDataUrl } from '../utils/qrCodeUtils';

interface CheckpointPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  checkpoint: PointControleSite | null;
  site: SiteGardiennage | null;
  settings?: EnterpriseSettings;
}

export const CheckpointPrintModal: React.FC<CheckpointPrintModalProps> = ({
  isOpen,
  onClose,
  checkpoint,
  site,
  settings,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (checkpoint) {
      setIsLoading(true);
      generateQrCodeDataUrl(checkpoint.qrPayload)
        .then((url) => {
          setQrDataUrl(url);
          setIsLoading(false);
        })
        .catch(() => {
          setIsLoading(false);
        });
    }
  }, [checkpoint]);

  if (!isOpen || !checkpoint || !site) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadImage = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `QR_${site.nom.replace(/\s+/g, '_')}_${checkpoint.nom.replace(/\s+/g, '_')}.png`;
    a.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl max-h-[95vh] flex flex-col shadow-2xl text-slate-100 overflow-hidden relative my-auto">
        {/* Barre d'outils supérieure */}
        <div className="p-3.5 bg-slate-950 flex items-center justify-between border-b border-slate-800 sticky top-0 z-10 print:hidden">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
              <Printer className="w-4 h-4" />
            </span>
            <div>
              <h3 className="font-bold text-white text-xs sm:text-sm">Fiche Officielle Point de Ronde</h3>
              <p className="text-[11px] text-slate-400">À plastifier et afficher sur le site de gardiennage</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadImage}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border border-slate-700"
              title="Télécharger l'image du QR-Code"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline">Image PNG</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-emerald-950/40"
              title="Imprimer ou exporter en PDF"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimer A4</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Fiche imprimable (Style A4 Professionnel) */}
        <div className="p-4 sm:p-8 bg-slate-950/60 overflow-y-auto flex-1 flex justify-center">
          <div className="bg-white text-slate-900 rounded-xl p-6 sm:p-8 shadow-2xl max-w-md w-full border-2 border-slate-800 font-sans text-xs space-y-5 print:border-none print:shadow-none print:p-0 print:max-w-none">
            {/* Entête officiel */}
            <div className="flex items-center justify-between pb-3 border-b-2 border-slate-900">
              <div className="flex items-center gap-2.5">
                {settings?.logoUrl ? (
                  <div className="w-10 h-10 rounded border border-slate-300 p-0.5 bg-white flex items-center justify-center overflow-hidden shrink-0">
                    <img src={settings.logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
                  </div>
                ) : (
                  <div className="p-1.5 rounded-lg bg-emerald-700 text-white">
                    <Shield className="w-5 h-5" />
                  </div>
                )}
                <div>
                  <h4 className="font-black text-sm uppercase tracking-tight text-slate-900">
                    {settings?.raisonSociale || 'NIGER SÉCURITÉ PRIVÉE'}
                  </h4>
                  <p className="text-[10px] text-slate-600 font-medium">
                    Poste de Faction • Surveillance & Sécurité Physique
                  </p>
                </div>
              </div>
              <span className="text-[9px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-300 px-2 py-0.5 rounded">
                Point N° {checkpoint.ordre || 1}
              </span>
            </div>

            {/* Titre du point */}
            <div className="text-center space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                POINT DE VÉRIFICATION RONDE OFFICIEL
              </span>
              <h2 className="text-lg font-black text-slate-950 uppercase pt-1">
                {checkpoint.nom}
              </h2>
              <p className="text-xs text-slate-600 font-medium">
                Site : <strong className="text-slate-900">{site.nom}</strong> ({site.quartier}, Niamey)
              </p>
            </div>

            {/* Cadre central avec le véritable QR-Code généré */}
            <div className="flex flex-col items-center justify-center p-4 bg-slate-50 border-2 border-dashed border-slate-400 rounded-2xl text-center space-y-2">
              <div className="p-3 bg-white rounded-xl border border-slate-300 shadow-md inline-block">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt={`QR-Code ${checkpoint.nom}`}
                    className="w-48 h-48 sm:w-56 sm:h-56 object-contain"
                  />
                ) : (
                  <div className="w-48 h-48 flex items-center justify-center text-slate-400">
                    <QrCode className="w-12 h-12 animate-pulse" />
                  </div>
                )}
              </div>
              <div className="space-y-0.5">
                <p className="font-mono font-bold text-xs text-slate-900">{checkpoint.id}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                  Scannez via l'application mobile Contrôleur NIGER SÉCURITÉ
                </p>
              </div>
            </div>

            {/* Emplacement et Consignes */}
            <div className="p-3.5 bg-slate-100/90 rounded-xl border border-slate-300 space-y-2 text-left text-[11px]">
              <div>
                <span className="font-bold text-slate-800 uppercase text-[10px] block">Emplacement fixe :</span>
                <p className="text-slate-700">{checkpoint.emplacement}</p>
              </div>
              <div>
                <span className="font-bold text-slate-800 uppercase text-[10px] block">Consignes de faction :</span>
                <p className="text-slate-700 leading-relaxed">{checkpoint.consignes || 'Vérification complète du secteur et pointage obligatoire.'}</p>
              </div>
            </div>

            {/* Pied de page du document */}
            <div className="pt-2 border-t border-slate-300 flex items-center justify-between text-[10px] text-slate-500">
              <span>NIF: {settings?.nif || '48291/S'} • RCCM: {settings?.rccm || 'NI-NIA-2021-B-890'}</span>
              <span>Édition certifiée le {new Date().toLocaleDateString('fr-FR')}</span>
            </div>
          </div>
        </div>

        {/* Pied de page modale */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs print:hidden">
          <span className="text-[11px] text-slate-500">
            Ce QR-Code est permanent et sécurisé par signature d'authenticité.
          </span>
          <button
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
