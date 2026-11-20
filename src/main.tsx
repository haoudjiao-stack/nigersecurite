import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Enregistrement immédiat du Service Worker pour fonctionnement hors connexion total
registerSW({
  immediate: true,
  onNeedRefresh() {
    console.log('[NigerSécurité PWA] Mise à jour disponible.');
  },
  onOfflineReady() {
    console.log('[NigerSécurité PWA] L\'application est complètement prête pour le fonctionnement hors ligne.');
  },
  onRegisterError(error) {
    console.warn('[NigerSécurité PWA] Erreur enregistrement Service Worker:', error);
  },
});

createRoot(document.getElementById('root')!).render(<App />);
