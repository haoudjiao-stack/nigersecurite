import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialisation sécurisée de l'application Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialisation du client Firestore avec la base dédiée de l'applet si définie
export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

export { app };
