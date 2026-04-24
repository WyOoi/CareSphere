import 'dotenv/config';
import { db } from '../lib/firebase';
import { firebaseWebApp } from '../config/firebaseWeb';
import { collection, getDocs, getFirestore, limit, query } from 'firebase/firestore';

async function main() {
  console.log('[testFirestoreRead] Discovering Firestore collections...');
  const hasServiceAccountPath = Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS);

  // 1) Preferred path: Firebase Admin SDK (service account / ADC)
  // Admin SDK can list root collections directly.
  if (db && hasServiceAccountPath) {
    try {
      const rootCollections = await db.listCollections();
      const names = rootCollections.map((c) => c.id).sort();
      console.log(`[testFirestoreRead] (admin) Root collections found: ${names.length}`);

      if (names.length === 0) {
        console.log('[testFirestoreRead] No root collections found.');
        return;
      }

      for (const name of names) {
        console.log(`- ${name}`);
      }
      return;
    } catch (error) {
      console.warn('[testFirestoreRead] Admin collection discovery failed, trying web SDK fallback...');
      console.warn(String(error));
    }
  } else {
    console.log('[testFirestoreRead] Skipping admin collection listing (no GOOGLE_APPLICATION_CREDENTIALS set).');
  }

  // 2) Fallback path: Firebase Web SDK
  // Web SDK cannot list unknown collections. Probe common collection names.
  try {
    const webDb = getFirestore(firebaseWebApp);
    const candidates = ['patients', 'patientAccounts', 'devices', 'alerts'];
    const discovered: string[] = [];

    for (const name of candidates) {
      try {
        const snap = await getDocs(query(collection(webDb, name), limit(1)));
        if (!snap.empty) discovered.push(name);
      } catch {
        // Ignore rules/network errors per collection probe
      }
    }

    if (discovered.length > 0) {
      console.log('[testFirestoreRead] (web-sdk) Detected non-empty candidate collections:');
      for (const name of discovered) {
        console.log(`- ${name}`);
      }
      return;
    }

    console.log('[testFirestoreRead] (web-sdk) Could not confirm any non-empty candidate collections.');
    console.log('Note: Web SDK cannot enumerate all root collections.');
  } catch (error) {
    console.error('[testFirestoreRead] Web SDK fallback failed:', error);
    console.error('If this fails, configure one of:');
    console.error('1) GOOGLE_APPLICATION_CREDENTIALS (service account) for admin collection listing, or');
    console.error('2) Firestore security rules that allow candidate collection reads for web SDK.');
    process.exit(1);
  }
}

main();
