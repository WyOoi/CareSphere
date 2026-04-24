/**
 * Firebase Admin SDK initialization for backend Firestore access.
 *
 * Priority:
 * 1) Explicit project id from FIREBASE_PROJECT_ID
 * 2) GCP runtime defaults (GOOGLE_CLOUD_PROJECT / GCLOUD_PROJECT)
 * 3) ADC/service account credentials from environment
 */

import * as admin from 'firebase-admin';

let db: admin.firestore.Firestore | null = null;

function resolveProjectId(): string | undefined {
  return (
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    'gen-lang-client-0404160735'
  );
}

try {
  if (!admin.apps.length) {
    const projectId = resolveProjectId();
    admin.initializeApp(projectId ? { projectId } : undefined);
  }

  db = admin.firestore();
  console.log(`[Firebase] Firestore connected${resolveProjectId() ? ` (${resolveProjectId()})` : ''}`);
} catch (err) {
  db = null;
  const msg = (err as Error).message;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`[Firebase] Firestore unavailable in production: ${msg}`);
  }
  console.warn('[Firebase] Firestore unavailable (non-production):', msg);
}

export { db };
