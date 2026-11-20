import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, browserLocalPersistence, setPersistence } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

// Initialisation sécurisée de l'application Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialisation du client Firestore avec la base dédiée de l'applet si définie
export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

// Initialisation de Firebase Authentication avec persistance locale sécurisée (IndexedDB / LocalStorage)
export const auth = getAuth(app);
if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence).catch((err) => {
    console.warn('[NIGER SÉCURITÉ Auth] Avertissement persistance auth:', err);
  });
}

export { app };
