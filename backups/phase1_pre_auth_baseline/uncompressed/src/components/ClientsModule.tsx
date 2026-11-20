import React, { useState } from 'react';
import { Users, Search, Building2, Phone, Mail, MapPin, Plus, Shield, ArrowUpRight } from 'lucide-react';
import { Client } from '../types';

interface ClientsModuleProps {
  clients: Client[];
  onAddClient: (client: Client) => void;
}

export const ClientsModule: React.FC<ClientsModuleProps> = ({ clients, onAddClient }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sectorFilter, setSectorFilter] = useState<string>('tous');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New client form state
  const [nom, setNom] = useState('');
  const [secteur, setSecteur] = useState<Client['secteur']>('Banque');
  const [adresse, setAdresse] = useState('');
  const [contactNom, setContactNom] = useState('');
  const [contactTelephone, setContactTelephone] = useState('+227 ');
  const [email, setEmail] = useState('');
  const [montant, setMontant] = useState(1200000);

  const formatFCFA = (val: number) => new Intl.NumberFormat('fr-FR').format(val) + ' FCFA';

  const filteredClients = clients.filter((c) => {
    const matchesSearch =
      c.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.adresse.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.contactNom.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSector = sectorFilter === 'tous' || c.secteur === sectorFilter;
    return matchesSearch && matchesSector;
  });

  const handleCreateClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nom) return;

    const newCli: Client = {
      id: `cli-${Date.now()}`,
      nom,
      secteur,
      ville: 'Niamey',
      adresse: adresse || 'Quartier Plateau, Niamey',
      contactNom: contactNom || 'Responsable Sécurité',
      contactTelephone: contactTelephone || '+227 90 00 00 00',
      email: email || 'contact@client-demo.ne',
      statut: 'Actif',
      nbSites: 1,
      montantMensuelTotalFCFA: Number(montant) || 1000000,
    };

    onAddClient(newCli);
    setIsModalOpen(false);
    setNom('');
    setAdresse('');
    setContactNom('');
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Banner */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
              <Users className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold text-white">Gestion des Clients & Donneurs d'Ordres</h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Banques, Ambassades, ONGs internationales, Usines et Commerces protégés à Niamey et régions.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-lg shadow-emerald-900/30"
        >
          <Plus className="w-4 h-4" />
          <span>Nouveau Client</span>
        </button>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Rechercher un client, contact, quartier..."
            className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {['tous', 'Banque', 'ONG', 'Industrie', 'Commerce', 'Diplomatique'].map((sec) => (
            <button
              key={sec}
              onClick={() => setSectorFilter(sec)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition cursor-pointer whitespace-nowrap ${
                sectorFilter === sec
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {sec === 'tous' ? 'Tous les secteurs' : sec}
            </button>
          ))}
        </div>
      </div>

      {/* Clients Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredClients.map((client) => (
          <div
            key={client.id}
            className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between gap-4"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase bg-slate-800 text-emerald-400 border border-slate-700">
                    {client.secteur}
                  </span>
                  <h3 className="font-bold text-white text-base mt-1.5 leading-snug">{client.nom}</h3>
                </div>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    client.statut === 'Actif'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-amber-500/20 text-amber-300'
                  }`}
                >
                  {client.statut}
                </span>
              </div>

              <div className="space-y-1.5 text-xs text-slate-300">
                <div className="flex items-center gap-2 text-slate-400">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <span>{client.adresse}, {client.ville}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="font-medium">{client.contactTelephone}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <Users className="w-3.5 h-3.5 shrink-0" />
                  <span>{client.contactNom}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <Mail className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{client.email}</span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
              <div>
                <p className="text-[11px] text-slate-400">Facturation mensuelle</p>
                <p className="font-bold text-emerald-400">{formatFCFA(client.montantMensuelTotalFCFA)}</p>
              </div>
              <div className="text-right">
                <span className="text-slate-400">Sites gardés : </span>
                <span className="font-bold text-white">{client.nbSites}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Client Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base">Ajouter un Client Partenaire (Démo)</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateClient} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Raison sociale du client</label>
                <input
                  type="text"
                  required
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  placeholder="Ex: Ambassade, Banque, Siège de société..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Secteur d'activité</label>
                  <select
                    value={secteur}
                    onChange={(e) => setSecteur(e.target.value as any)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="Banque">Banque</option>
                    <option value="ONG">ONG</option>
                    <option value="Industrie">Industrie</option>
                    <option value="Commerce">Commerce</option>
                    <option value="Diplomatique">Diplomatique</option>
                    <option value="Résidence VIP">Résidence VIP</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Budget Mensuel HT (FCFA)</label>
                  <input
                    type="number"
                    value={montant}
                    onChange={(e) => setMontant(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Adresse à Niamey</label>
                <input
                  type="text"
                  value={adresse}
                  onChange={(e) => setAdresse(e.target.value)}
                  placeholder="Ex: Quartier Plateau, Niamey"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Nom du Contact</label>
                  <input
                    type="text"
                    value={contactNom}
                    onChange={(e) => setContactNom(e.target.value)}
                    placeholder="Ex: M. Amadou Sani"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Téléphone (+227)</label>
                  <input
                    type="text"
                    value={contactTelephone}
                    onChange={(e) => setContactTelephone(e.target.value)}
                    placeholder="+227 9X XX XX XX"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
