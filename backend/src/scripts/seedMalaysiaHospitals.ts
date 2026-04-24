import { db } from '../lib/firebase';
import { MALAYSIA_HOSPITALS } from '../data/malaysiaHospitals';

async function main() {
  if (!db) {
    console.error('[seedMalaysiaHospitals] Firestore is unavailable.');
    process.exit(1);
  }

  console.log(`[seedMalaysiaHospitals] Seeding ${MALAYSIA_HOSPITALS.length} hospitals...`);

  for (const hospital of MALAYSIA_HOSPITALS) {
    await db.collection('hospitalsMY').doc(hospital.id).set(
      {
        ...hospital,
        country: 'Malaysia',
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  }

  console.log('[seedMalaysiaHospitals] Done. Collection: hospitalsMY');
}

main().catch((error) => {
  console.error('[seedMalaysiaHospitals] Failed:', error);
  process.exit(1);
});
