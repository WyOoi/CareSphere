import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';

/**
 * Firebase Web SDK configuration.
 *
 * Note: This backend project uses Firebase Admin SDK for Firestore writes.
 * The Web SDK config is kept here so project credentials are centralized and
 * available for any shared/server-side use that needs Firebase app metadata.
 *
 * Do not call browser-only SDKs (e.g. firebase/analytics) from Node runtime.
 */
export const firebaseWebConfig = {
  apiKey: process.env.FIREBASE_WEB_API_KEY || 'AIza',
  authDomain: process.env.FIREBASE_WEB_AUTH_DOMAIN || 'gen-lang-client-0404160735.firebaseapp.com',
  projectId: process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0404160735',
  storageBucket: process.env.FIREBASE_WEB_STORAGE_BUCKET || 'gen-lang-client-0404160735.firebasestorage.app',
  messagingSenderId: process.env.FIREBASE_WEB_MESSAGING_SENDER_ID || '619975700397',
  appId: process.env.FIREBASE_WEB_APP_ID || '1:619975700397:web:2b020e0a367aefbc4efb24',
  measurementId: process.env.FIREBASE_WEB_MEASUREMENT_ID || 'G-VW7D01SQMM-fbkey:SyA4YyhNtg8YUYMXKWP7Ml7YcqJZnKrRCfY',
};

export const firebaseWebApp: FirebaseApp =
  getApps().length > 0 ? getApps()[0]! : initializeApp(firebaseWebConfig);
