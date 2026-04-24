import 'dotenv/config';
import { db } from '../lib/firebase';

async function main() {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('[listFirestoreCollections] GOOGLE_APPLICATION_CREDENTIALS is required for admin listing.');
    console.error('Example (PowerShell):');
    console.error('$env:GOOGLE_APPLICATION_CREDENTIALS="E:\\path\\to\\service-account.json"');
    process.exit(1);
  }

  if (!db) {
    console.error('[listFirestoreCollections] Firestore Admin SDK is not initialized.');
    process.exit(1);
  }

  try {
    console.log('[listFirestoreCollections] Discovering root collections...');
    const rootCollections = await db.listCollections();
    const names = rootCollections.map((c) => c.id).sort();

    if (names.length === 0) {
      console.log('[listFirestoreCollections] No root collections found.');
      return;
    }

    console.log(`[listFirestoreCollections] Found ${names.length} root collection(s):`);
    for (const name of names) {
      // Count documents by reading all docs in the collection.
      // Fine for testing/inspection; avoid for very large production collections.
      const snap = await db.collection(name).get();
      const firstDocId = snap.empty ? '(none)' : snap.docs[0].id;
      console.log(`- ${name} | docs=${snap.size} | firstDocId=${firstDocId}`);
    }
  } catch (error) {
    console.error('[listFirestoreCollections] Failed:', error);
    process.exit(1);
  }
}

main();
