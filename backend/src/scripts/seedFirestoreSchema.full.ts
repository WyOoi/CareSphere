import 'dotenv/config';
import { db } from '../lib/firebase';

type Gender = 'male' | 'female';
type RiskLevel = 'low' | 'medium' | 'high';

type PatientSeed = {
  id: string;
  name: string;
  age: number;
  gender: Gender;
  conditions: string[];
  medications: string[];
  caregiver: { name: string; phone: string; email: string; relationship: string };
  location: { address: string; city: string; state: string; lat: number; lng: number };
};

const HERO_PATIENTS: PatientSeed[] = [
  {
    id: 'patient-001',
    name: 'Ahmad bin Razali',
    age: 73,
    gender: 'male',
    conditions: ['Type 2 Diabetes', 'Hypertension', 'Mild Arthritis'],
    medications: ['Metformin 500mg', 'Amlodipine 5mg', 'Aspirin 100mg'],
    caregiver: { name: 'Siti binti Ahmad', phone: '+60123456789', email: 'siti.ahmad@email.com', relationship: 'Daughter' },
    location: { address: 'No. 12, Jalan Mawar', city: 'Johor Bahru', state: 'Johor', lat: 1.4927, lng: 103.7414 },
  },
  {
    id: 'patient-002',
    name: 'Meenakshi a/p Krishnan',
    age: 68,
    gender: 'female',
    conditions: ['Heart Disease', 'Osteoporosis'],
    medications: ['Atorvastatin 40mg', 'Calcium + Vitamin D', 'Warfarin 5mg'],
    caregiver: { name: 'Rajan s/o Krishnan', phone: '+60198765432', email: 'rajan.krishnan@email.com', relationship: 'Son' },
    location: { address: 'No. 45, Taman Melati', city: 'Kuala Lumpur', state: 'Wilayah Persekutuan', lat: 3.139, lng: 101.6869 },
  },
  {
    id: 'patient-003',
    name: 'Lim Ah Kow',
    age: 80,
    gender: 'male',
    conditions: ['COPD', 'Atrial Fibrillation', 'Cognitive Decline'],
    medications: ['Salbutamol inhaler', 'Digoxin 0.25mg', 'Rivastigmine 6mg'],
    caregiver: { name: 'Lim Wei Ming', phone: '+60167891234', email: 'weiming.lim@email.com', relationship: 'Son' },
    location: { address: 'No. 8, Jalan Perdana', city: 'George Town', state: 'Pulau Pinang', lat: 5.4141, lng: 100.3288 },
  },
  {
    id: 'patient-004',
    name: 'Dayang binti Musa',
    age: 65,
    gender: 'female',
    conditions: ['Type 2 Diabetes', 'Chronic Kidney Disease Stage 3', 'Mild Depression'],
    medications: ['Insulin Glargine 20 units', 'Amlodipine 5mg', 'Sertraline 50mg', 'Calcium Carbonate 500mg'],
    caregiver: { name: 'Azman bin Musa', phone: '+60198887766', email: 'azman.musa@email.com', relationship: 'Husband' },
    location: { address: 'Taman Sri Sarawak, Jalan Bako', city: 'Kuching', state: 'Sarawak', lat: 1.5497, lng: 110.3592 },
  },
];

const DEMO_ACCOUNTS = [
  { accountNumber: 'CS-2024-001', patientId: 'patient-001', fullName: 'Ahmad bin Hassan' },
  { accountNumber: 'CS-2024-002', patientId: 'patient-002', fullName: 'Mei Ling Tan' },
  { accountNumber: 'CS-2024-003', patientId: 'patient-003', fullName: 'Raju Krishnamurthy' },
];

const DEVICE_REGISTRY: Record<string, { patientId: string; deviceType: string; model: string }> = {
  'WATCH-AHM-001': { patientId: 'patient-001', deviceType: 'smartwatch', model: 'Garmin Venu 3' },
  'BPCUFF-AHM-001': { patientId: 'patient-001', deviceType: 'bp_cuff', model: 'Omron HEM-7156' },
  'WATCH-MEE-001': { patientId: 'patient-002', deviceType: 'smartwatch', model: 'Samsung Galaxy Watch 6' },
  'OXI-MEE-001': { patientId: 'patient-002', deviceType: 'pulse_oximeter', model: 'Contec CMS50D' },
  'WATCH-LIM-001': { patientId: 'patient-003', deviceType: 'smartwatch', model: 'Apple Watch Series 9' },
  'OXI-LIM-001': { patientId: 'patient-003', deviceType: 'pulse_oximeter', model: 'Contec CMS50D' },
  'GLUCO-AHM-001': { patientId: 'patient-001', deviceType: 'glucose_meter', model: 'Accu-Chek Guide' },
  'MOBILE-AHM': { patientId: 'patient-001', deviceType: 'mobile_app', model: 'CareSphere Patient App' },
  'MOBILE-MEE': { patientId: 'patient-002', deviceType: 'mobile_app', model: 'CareSphere Patient App' },
  'MOBILE-LIM': { patientId: 'patient-003', deviceType: 'mobile_app', model: 'CareSphere Patient App' },
};

const PATIENT_PROFILES = [
  { hr: 82, sys: 158, dia: 96, sleep: 5, move: 35, o2: 96, glucose: 10.2, riskLevel: 'medium' as RiskLevel, riskScore: 58 },
  { hr: 78, sys: 132, dia: 84, sleep: 6.5, move: 45, o2: 96, glucose: undefined, riskLevel: 'low' as RiskLevel, riskScore: 30 },
  { hr: 98, sys: 128, dia: 80, sleep: 5.5, move: 22, o2: 92, glucose: undefined, riskLevel: 'high' as RiskLevel, riskScore: 74 },
  { hr: 74, sys: 138, dia: 88, sleep: 7, move: 50, o2: 97, glucose: 9.1, riskLevel: 'medium' as RiskLevel, riskScore: 44 },
];

function now() {
  return new Date();
}

async function seedPatientCore(patient: PatientSeed, idx: number) {
  if (!db) throw new Error('Firestore is not initialized');
  const p = PATIENT_PROFILES[idx] || PATIENT_PROFILES[0];
  const patientRef = db.collection('patients').doc(patient.id);

  await patientRef.set({
    ...patient,
    createdAt: now(),
    updatedAt: now(),
    carePoints: 25,
    streakDays: 3,
    level: 1,
    nudges: [{ type: 'support', sender: 'Care Team', timestamp: now() }],
  }, { merge: true });

  const readingId = `reading-${patient.id}-seed-001`;
  const reading = {
    id: readingId,
    patientId: patient.id,
    timestamp: now(),
    heartRate: p.hr,
    sleepHours: p.sleep,
    movementScore: p.move,
    bloodPressure: { systolic: p.sys, diastolic: p.dia },
    oxygenSaturation: p.o2,
    temperature: 36.8,
    ...(p.glucose !== undefined ? { glucoseLevel: p.glucose } : {}),
  };
  await patientRef.collection('readings').doc(readingId).set(reading, { merge: true });

  const assessmentId = `assessment-${patient.id}-seed-001`;
  await patientRef.collection('assessments').doc(assessmentId).set({
    id: assessmentId,
    patientId: patient.id,
    timestamp: now(),
    riskLevel: p.riskLevel,
    riskScore: p.riskScore,
    reasons: p.riskLevel === 'high' ? ['Low oxygen saturation', 'Low movement score'] : ['Vitals monitored'],
    recommendations: p.riskLevel === 'high' ? ['Urgent caregiver review'] : ['Continue monitoring'],
    geminiReasoning: `Seeded assessment for ${patient.name}`,
    actions: p.riskLevel !== 'low' ? [{ type: 'caregiver_alert', status: 'completed', executedAt: now(), result: { smsStatus: 'sent' } }] : [],
    healthReading: reading,
  }, { merge: true });

  await patientRef.collection('conversations').doc(`msg-${patient.id}-seed-001`).set({
    id: `msg-${patient.id}-seed-001`,
    patientId: patient.id,
    role: 'user',
    content: 'I feel okay today.',
    timestamp: now(),
  }, { merge: true });

  const meds = patient.medications.slice(0, 2);
  for (let m = 0; m < meds.length; m++) {
    const medId = `med-${patient.id}-${m}`;
    const medTimes = m === 0 ? ['08:00', '20:00'] : ['12:00'];
    await patientRef.collection('medications').doc(medId).set({
      id: medId,
      patientId: patient.id,
      name: meds[m],
      dosage: '1 tablet',
      times: medTimes,
      createdAt: now(),
    }, { merge: true });

    for (const t of medTimes) {
      const logId = `log-${patient.id}-${m}-${t.replace(':', '')}`;
      await patientRef.collection('medicationLogs').doc(logId).set({
        id: logId,
        patientId: patient.id,
        medicationId: medId,
        medicationName: meds[m],
        scheduledTime: t,
        date: now().toISOString().split('T')[0],
        taken: true,
        takenAt: now(),
      }, { merge: true });
    }
  }

  await patientRef.collection('baseline').doc('current').set({
    patientId: patient.id,
    avgHeartRate: p.hr,
    avgSystolic: p.sys,
    avgDiastolic: p.dia,
    avgOxygenSaturation: p.o2,
    avgTemperature: 36.7,
    avgSleepHours: p.sleep,
    avgMovementScore: p.move,
    computedAt: now(),
  }, { merge: true });

  return assessmentId;
}

async function main() {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('[seedFirestoreSchema.full] GOOGLE_APPLICATION_CREDENTIALS is required.');
    process.exit(1);
  }
  if (!db) {
    console.error('[seedFirestoreSchema.full] Firestore is not initialized.');
    process.exit(1);
  }

  console.log('[seedFirestoreSchema.full] Seeding full Firestore schema from mock data...');

  const assessments: Array<{ patientId: string; assessmentId: string; riskLevel: RiskLevel; riskScore: number }> = [];
  for (let i = 0; i < HERO_PATIENTS.length; i++) {
    const assessmentId = await seedPatientCore(HERO_PATIENTS[i], i);
    const profile = PATIENT_PROFILES[i] || PATIENT_PROFILES[0];
    assessments.push({ patientId: HERO_PATIENTS[i].id, assessmentId, riskLevel: profile.riskLevel, riskScore: profile.riskScore });
  }

  for (const acc of DEMO_ACCOUNTS) {
    await db.collection('patientAccounts').doc(acc.accountNumber).set({
      accountNumber: acc.accountNumber,
      patientId: acc.patientId,
      fullName: acc.fullName,
      passwordHash: 'REPLACE_WITH_BCRYPT_HASH',
      createdAt: now(),
      updatedAt: now(),
      status: 'active',
    }, { merge: true });

    await db.collection('authSessions').doc(`session-${acc.accountNumber}`).set({
      id: `session-${acc.accountNumber}`,
      patientId: acc.patientId,
      accountNumber: acc.accountNumber,
      token: `seed-token-${acc.accountNumber}`,
      createdAt: now(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      lastSeenAt: now(),
      revoked: false,
    }, { merge: true });
  }

  for (const [deviceId, info] of Object.entries(DEVICE_REGISTRY)) {
    await db.collection('devices').doc(deviceId).set({
      deviceId,
      patientId: info.patientId,
      deviceType: info.deviceType,
      model: info.model,
      status: 'online',
      lastSeen: now(),
      readingCount: 1,
      createdAt: now(),
      updatedAt: now(),
    }, { merge: true });

    await db.collection('devices').doc(deviceId).collection('heartbeats').doc('hb-seed-001').set({
      id: 'hb-seed-001',
      deviceId,
      timestamp: now(),
    }, { merge: true });
  }

  for (const a of assessments) {
    if (a.riskLevel === 'low') continue;
    await db.collection('alerts').doc(`alert-${a.patientId}-seed-001`).set({
      id: `alert-${a.patientId}-seed-001`,
      patientId: a.patientId,
      assessmentId: a.assessmentId,
      riskLevel: a.riskLevel,
      riskScore: a.riskScore,
      reasons: ['Seeded from mock assessment'],
      urgencyMessage: 'Please check in soon.',
      smsStatus: 'sent',
      emailStatus: 'sent',
      dispatchedAt: now(),
    }, { merge: true });
  }

  for (const p of HERO_PATIENTS) {
    await db.collection('weeklyReports').doc(`weekly-${p.id}-seed-001`).set({
      id: `weekly-${p.id}-seed-001`,
      patientId: p.id,
      generatedAt: now(),
      periodCovered: `${new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]} to ${new Date().toISOString().split('T')[0]}`,
      overallStatus: 'Requires Attention',
      summary: `Weekly summary for ${p.name}`,
      keyFindings: ['Seeded report', 'Monitor trends'],
      recommendations: ['Continue monitoring', 'Follow care plan'],
    }, { merge: true });

    await db.collection('auditEvents').doc(`audit-${p.id}-seed-001`).set({
      id: `audit-${p.id}-seed-001`,
      timestamp: now(),
      type: 'patient_registered',
      patientId: p.id,
      patientName: p.name,
      severity: 'info',
      description: `Seeded patient ${p.name}`,
      metadata: { source: 'seedFirestoreSchema.full' },
    }, { merge: true });

    await db.collection('hospitalsCache').doc(`cache-${p.id}-seed-001`).set({
      id: `cache-${p.id}-seed-001`,
      patientId: p.id,
      city: p.location.city,
      state: p.location.state,
      hospitals: [
        { id: `hsp-${p.id}-001`, name: 'Hospital Sultanah Aminah', address: 'Jalan Persiaran Abu Bakar Sultan', phone: '+6072257000', type: 'government_hospital', emergencyAvailable: true },
      ],
      cachedAt: now(),
    }, { merge: true });
  }

  console.log('[seedFirestoreSchema.full] Done. Full schema + mock data seeded to Firestore.');
}

main().catch((error) => {
  console.error('[seedFirestoreSchema.full] Failed:', error);
  process.exit(1);
});
