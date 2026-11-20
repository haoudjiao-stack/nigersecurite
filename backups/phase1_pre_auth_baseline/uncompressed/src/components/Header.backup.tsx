import React from 'react';
import {
  Shield,
  Briefcase,
  Calculator,
  Compass,
  Smartphone,
  Monitor,
  HelpCircle,
  Menu,
  X,
  Users,
  Building,
  FileText,
  DollarSign,
  AlertOctagon,
  LayoutDashboard,
  Settings,
  FileSpreadsheet,
  MapPin,
  Lock,
} from 'lucide-react';
import { UserSpace, MainNavModule } from '../types';

interface HeaderProps {
  currentSpace: UserSpace;
  onSelectSpace: (space: UserSpace) => void;
  currentModule: MainNavModule;
  onSelectModule: (mod: MainNavModule) => void;
  onOpenRoadmap: () => void;
  isMobilePreview: boolean;
  onToggleMobilePreview: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentSpace,
  onSelectSpace,
  currentModule,
  onSelectModule,
  onOpenRoadmap,
  isMobilePreview,
  onToggleMobilePreview,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const spaces: { id: UserSpace; label: string; icon: any; roleBadge: string }[] = [
    {
      id: 'direction',
      label: 'Direction',
      icon: Briefcase,
      roleBadge: 'Supervision & Validation',
    },
    {
      id: 'comptabilite',
      label: 'Comptabilité',
      icon: Calculator,
      roleBadge: 'Factures & Salaires',
    },
    {
      id: 'controleur',
      label: 'Contrôleur terrain',
      icon: Compass,
      roleBadge: 'Patrouille & Sites attribués',
    },
  ];

  // STRICT ROLE-BASED NAVIGATION ITEMS
  const getModulesForRole = (): { id: MainNavModule; label: string; icon: any; badge?: string }[] => {
    switch (currentSpace) {
      case 'direction':
        return [
          { id: 'tableau_de_bord', label: 'Tableau de bord', icon: LayoutDashboard },
          { id: 'clients', label: 'Clients', icon: Users },
          { id: 'contrats', label: 'Contrats', icon: FileText },
          { id: 'sites', label: 'Sites', icon: Building },
          { id: 'agents', label: 'Agents', icon: Shield },
          { id: 'factures', label: 'Factures (Consultation)', icon: FileText },
          { id: 'paie', label: 'Paie & Validation', icon: DollarSign },
          { id: 'rapports', label: 'Rapports Rondes', icon: AlertOctagon },
          { id: 'parametres', label: 'Paramètres Entreprise', icon: Settings },
        ];

      case 'comptabilite':
        return [
          { id: 'factures', label: 'Facturation Clients & Encaissements', icon: FileText },
          { id: 'paie', label: 'Préparation & Calculs de Paie', icon: DollarSign },
          { id: 'documents_comptables', label: 'Bordereaux & Documents Comptables', icon: FileSpreadsheet },
        ];

      case 'controleur':
        return [
          { id: 'mes_sites', label: 'Mes Sites Attribués', icon: MapPin },
          { id: 'rapports', label: 'Historique des Rondes Transmises', icon: AlertOctagon },
        ];

      default:
        return [];
    }
  };

  const activeModules = getModulesForRole();

  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 text-slate-100 shadow-md">
      {/* Top corporate bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-emerald-600 to-emerald-400 text-white shadow-md shadow-emerald-900/40">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-white text-base tracking-tight">NIGER SÉCURITÉ</span>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  NIAMEY
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Gardiennage & Surveillance Physique • Niger</p>
            </div>
          </div>
        </div>

        {/* Global actions: Preview switcher & roadmap */}
        <div className="flex items-center gap-2">
          {/* Mobile frame toggle */}
          <button
            onClick={onToggleMobilePreview}
            className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition cursor-pointer ${
              isMobilePreview
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700'
            }`}
            title="Simuler l'affichage sur smartphone Android"
          >
            {isMobilePreview ? <Smartphone className="w-4 h-4 text-emerald-400" /> : <Monitor className="w-4 h-4 text-slate-400" />}
            <span>{isMobilePreview ? 'Vue Smartphone (Active)' : 'Simulateur Mobile'}</span>
          </button>

          <button
            onClick={onOpenRoadmap}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium transition cursor-pointer"
          >
            <HelpCircle className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">Feuille de Route</span>
          </button>

          {/* Mobile menu trigger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Role / Space Switcher */}
      <div className="bg-slate-950/70 border-b border-slate-800 px-4 sm:px-6 py-2">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
            <span>Rôle sélectionné :</span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {spaces.map((sp) => {
              const Icon = sp.icon;
              const isActive = currentSpace === sp.id;
              return (
                <button
                  key={sp.id}
                  onClick={() => onSelectSpace(sp.id)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer border ${
                    isActive
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-900/30'
                      : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700/80 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{sp.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-normal ${
                      isActive ? 'bg-emerald-700/60 text-emerald-100' : 'bg-slate-700 text-slate-300'
                    }`}
                  >
                    {sp.roleBadge}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Dedicated Module Navigation for the Active Role (Desktop) */}
      <div className="hidden md:block bg-slate-900 px-4 sm:px-6 border-b border-slate-800/50">
        <div className="max-w-7xl mx-auto flex items-center justify-between py-1.5">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
            {activeModules.map((m) => {
              const Icon = m.icon;
              const isModActive = currentModule === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => onSelectModule(m.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer whitespace-nowrap ${
                    isModActive
                      ? 'bg-slate-800 text-emerald-400 border border-slate-700 font-bold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isModActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>

          <div className="text-[11px] text-slate-400 font-medium hidden lg:flex items-center gap-1.5">
            <Lock className="w-3 h-3 text-emerald-400" />
            <span>Pages autorisées pour : <strong className="text-slate-200 capitalize">{currentSpace}</strong></span>
          </div>
        </div>
      </div>

      {/* Mobile drawer if open */}
      {mobileMenuOpen && (
        <div className="md:hidden p-4 bg-slate-900 border-b border-slate-800 space-y-3">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Navigation autorisée ({currentSpace}) :
          </p>
          <div className="space-y-1.5">
            {activeModules.map((m) => {
              const Icon = m.icon;
              const isModActive = currentModule === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    onSelectModule(m.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl text-xs font-medium border text-left ${
                    isModActive
                      ? 'bg-slate-800 border-emerald-500/50 text-emerald-400 font-bold'
                      : 'bg-slate-800/40 border-slate-800 text-slate-300'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
};
