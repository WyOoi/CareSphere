import { Router, Request, Response } from 'express';
import { healthMemory } from '../rag/healthMemoryService';
import { runRiskAssessment } from '../flows/riskAssessmentFlow';
import { runEmergencyActions } from '../flows/emergencyActionFlow';
import { generateWeeklyReport } from '../flows/weeklyReportFlow';
import { findNearbyHospitals } from '../tools/hospitalFinderTool';
import { sendCaregiverAlert } from '../tools/caregiverAlertTool';
import { HealthReading } from '../types/health.types';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../lib/firebase';

const router = Router();

type FirestoreLikeTimestamp = {
  toDate?: () => Date;
  _seconds?: number;
  seconds?: number;
  _nanoseconds?: number;
  nanoseconds?: number;
};

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'object') {
    const ts = value as FirestoreLikeTimestamp;
    if (typeof ts.toDate === 'function') {
      const d = ts.toDate();
      return Number.isNaN(d.getTime()) ? null : d;
    }
    const seconds = ts._seconds ?? ts.seconds;
    const nanos = ts._nanoseconds ?? ts.nanoseconds ?? 0;
    if (typeof seconds === 'number') {
      const d = new Date(seconds * 1000 + Math.floor(nanos / 1e6));
      return Number.isNaN(d.getTime()) ? null : d;
    }
  }
  return null;
}

function toIso(value: unknown): string {
  const d = toDate(value);
  return d ? d.toISOString() : new Date(0).toISOString();
}

// ─── PATIENTS ───────────────────────────────────────────────────────────────

router.get('/patients', (_req: Request, res: Response) => {
  const patients = healthMemory.getAllPatients();
  res.json({ success: true, data: patients });
});

// ─── CREATE PATIENT (Onboarding) ─────────────────────────────────────────────
router.post('/patients', (req: Request, res: Response) => {
  try {
    const { name, age, gender, conditions, medications, caregiver, location } = req.body;
    if (!name || !age) {
      return res.status(400).json({ success: false, error: 'name and age are required' });
    }

    const patientId = `patient-${Date.now()}`;
    const newPatient = {
      id: patientId,
      name: name.trim(),
      age: parseInt(age),
      gender: gender || 'male',
      conditions: Array.isArray(conditions) ? conditions : (conditions ? [conditions] : []),
      medications: Array.isArray(medications) ? medications : (medications ? [medications] : []),
      caregiver: {
        name: caregiver?.name || 'Waris / Family Member',
        phone: caregiver?.phone || '012-000 0000',
        email: caregiver?.email || '',
        relationship: caregiver?.relationship || 'Family',
      },
      location: {
        address: location?.address || 'Malaysia',
        city: location?.city || 'Kuala Lumpur',
        state: location?.state || 'Wilayah Persekutuan',
        lat: location?.lat || 3.1390,
        lng: location?.lng || 101.6869,
      },
      createdAt: new Date().toISOString(),
    };

    healthMemory.storePatient(newPatient);

    // Seed 3 baseline readings with normal values so RAG has context
    const baseReadings = [
      { heartRate: 72, sleepHours: 7, movementScore: 45, bloodPressure: { systolic: 130, diastolic: 80 }, oxygenSaturation: 97, temperature: 36.8 },
      { heartRate: 75, sleepHours: 6.5, movementScore: 40, bloodPressure: { systolic: 128, diastolic: 78 }, oxygenSaturation: 97.5, temperature: 36.7 },
      { heartRate: 70, sleepHours: 7.5, movementScore: 50, bloodPressure: { systolic: 132, diastolic: 82 }, oxygenSaturation: 96.8, temperature: 36.9 },
    ];

    baseReadings.forEach((r, i) => {
      healthMemory.storeReading({
        id: `${patientId}-seed-${i}`,
        patientId,
        timestamp: new Date(Date.now() - (i + 1) * 3600000).toISOString(),
        ...r,
      });
    });

    healthMemory.computeBaseline(patientId);
    console.log(`[healthRoutes] New patient registered: ${name} (${patientId})`);
    res.status(201).json({ success: true, data: newPatient });
  } catch (err) {
    console.error('[POST /patients] Error:', err);
    res.status(500).json({ success: false, error: String(err) });
  }
});

router.get('/patients/:id', (req: Request, res: Response) => {
  const patient = healthMemory.getPatient(req.params.id);
  if (!patient) return res.status(404).json({ success: false, error: 'Patient not found' });
  res.json({ success: true, data: patient });
});

// ─── UPDATE PATIENT (Patient self-edit biodata) ──────────────────────────────
router.patch('/patients/:id', (req: Request, res: Response) => {
  try {
    const patient = healthMemory.getPatient(req.params.id);
    if (!patient) return res.status(404).json({ success: false, error: 'Patient not found' });

    const { name, age, gender, location, caregiver } = req.body;
    const updated = {
      ...patient,
      ...(name       && { name: String(name).trim() }),
      ...(age        && { age: parseInt(age) }),
      ...(gender     && { gender }),
      ...(location   && { location: { ...patient.location, ...location } }),
      ...(caregiver  && { caregiver: { ...patient.caregiver, ...caregiver } }),
    };
    healthMemory.storePatient(updated);
    console.log(`[healthRoutes] Patient updated: ${updated.name} (${req.params.id})`);
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

router.get('/patients/:id/readings', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 10;
  const readings = healthMemory.getLatestReadings(req.params.id, limit);
  res.json({ success: true, data: readings });
});

router.get('/patients/:id/assessments', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 5;
  const assessments = healthMemory.getLatestAssessments(req.params.id, limit);
  res.json({ success: true, data: assessments });
});

router.get('/patients/:id/baseline', (req: Request, res: Response) => {
  const baseline = healthMemory.getBaseline(req.params.id);
  if (!baseline) return res.status(404).json({ success: false, error: 'Baseline not yet computed (need 5+ readings)' });
  res.json({ success: true, data: baseline });
});

// ─── TREND ANALYSIS ─────────────────────────────────────────────────────────

router.get('/patients/:id/trend', (req: Request, res: Response) => {
  const hours = parseInt(req.query.hours as string) || 24;
  const patient = healthMemory.getPatient(req.params.id);
  if (!patient) return res.status(404).json({ success: false, error: 'Patient not found' });

  const trendData = healthMemory.getTrendData(req.params.id, hours);
  const baseline = healthMemory.getBaseline(req.params.id);
  const assessments = healthMemory.getLatestAssessments(req.params.id, 10);

  res.json({
    success: true,
    data: {
      patient,
      ...trendData,
      baseline,
      recentAssessments: assessments,
    },
  });
});

// ─── WEEKLY REPORT ──────────────────────────────────────────────────────────

router.get('/patients/:id/report/weekly', async (req: Request, res: Response) => {
  try {
    const patient = healthMemory.getPatient(req.params.id);
    if (!patient) return res.status(404).json({ success: false, error: 'Patient not found' });

    const report = await generateWeeklyReport(req.params.id);
    res.json({ success: true, data: report });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

// ─── MEDICATIONS ─────────────────────────────────────────────────────────────

router.get('/patients/:id/medications', (req: Request, res: Response) => {
  const patient = healthMemory.getPatient(req.params.id);
  if (!patient) return res.status(404).json({ success: false, error: 'Patient not found' });

  const medications = healthMemory.getMedications(req.params.id);
  const today = new Date().toISOString().split('T')[0];
  const todayLogs = healthMemory.getMedicationLogs(req.params.id, today);
  const adherence = healthMemory.getMedicationAdherence(req.params.id);

  res.json({ success: true, data: { medications, todayLogs, adherence } });
});

router.post('/patients/:id/medications', (req: Request, res: Response) => {
  const patient = healthMemory.getPatient(req.params.id);
  if (!patient) return res.status(404).json({ success: false, error: 'Patient not found' });

  const { name, dosage, times } = req.body;
  if (!name || !times) return res.status(400).json({ success: false, error: 'Missing name or times' });

  const med = {
    id: uuidv4(),
    patientId: req.params.id,
    name,
    dosage: dosage || '1 tablet',
    times: Array.isArray(times) ? times : [times],
    createdAt: new Date().toISOString(),
  };
  healthMemory.storeMedication(med);
  res.json({ success: true, data: med });
});

router.post('/patients/:id/medications/log', (req: Request, res: Response) => {
  const patient = healthMemory.getPatient(req.params.id);
  if (!patient) return res.status(404).json({ success: false, error: 'Patient not found' });

  const { medicationId, medicationName, scheduledTime, date, taken, notes } = req.body;
  const log = {
    id: uuidv4(),
    patientId: req.params.id,
    medicationId,
    medicationName,
    scheduledTime,
    date: date || new Date().toISOString().split('T')[0],
    taken: Boolean(taken),
    takenAt: taken ? new Date().toISOString() : undefined,
    notes,
  };
  healthMemory.storeMedicationLog(log);
  res.json({ success: true, data: log });
});

// ─── SOCIAL / GAMIFICATION ────────────────────────────────────────────────────

router.post('/patients/:id/nudge', (req: Request, res: Response) => {
  try {
    const patient = healthMemory.getPatient(req.params.id);
    if (!patient) return res.status(404).json({ success: false, error: 'Patient not found' });

    const { type, sender } = req.body as { type?: 'heart' | 'highfive' | 'support'; sender?: string };
    const validTypes = new Set(['heart', 'highfive', 'support']);
    if (!type || !validTypes.has(type)) {
      return res.status(400).json({ success: false, error: 'Invalid nudge type' });
    }

    const nudges = Array.isArray(patient.nudges) ? [...patient.nudges] : [];
    nudges.push({
      type,
      sender: sender?.trim() || 'Care Team',
      timestamp: new Date().toISOString(),
    });

    const updated = { ...patient, nudges };
    healthMemory.storePatient(updated);
    res.json({ success: true, data: { success: true, nudgesCount: nudges.length } });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

router.post('/patients/:id/points', (req: Request, res: Response) => {
  try {
    const patient = healthMemory.getPatient(req.params.id);
    if (!patient) return res.status(404).json({ success: false, error: 'Patient not found' });

    const pointsInput = Number(req.body?.points ?? 0);
    if (!Number.isFinite(pointsInput) || pointsInput <= 0) {
      return res.status(400).json({ success: false, error: 'points must be a positive number' });
    }

    const currentPoints = Number(patient.carePoints ?? 0);
    const nextPoints = currentPoints + Math.round(pointsInput);
    const nextLevel = Math.max(1, Math.floor(nextPoints / 100) + 1);
    const nextStreak = Number(patient.streakDays ?? 0) + 1;

    const updated = {
      ...patient,
      carePoints: nextPoints,
      level: nextLevel,
      streakDays: nextStreak,
    };
    healthMemory.storePatient(updated);
    res.json({ success: true, data: { success: true, carePoints: nextPoints, level: nextLevel, streakDays: nextStreak } });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

// ─── HOSPITALS ───────────────────────────────────────────────────────────────

router.get('/patients/:id/hospitals', async (req: Request, res: Response) => {
  try {
    const patient = healthMemory.getPatient(req.params.id);
    if (!patient) return res.status(404).json({ success: false, error: 'Patient not found' });

    const result = await findNearbyHospitals({ patientId: req.params.id, urgency: 'medium' });
    res.json({
      success: true,
      data: {
        ...result,
        patientCity: patient.location.city,
        patientState: patient.location.state,
        patientLocation: {
          lat: patient.location.lat,
          lng: patient.location.lng,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

// ─── ASSESSMENT ──────────────────────────────────────────────────────────────

// Validate health reading values are within physiologically plausible ranges
function validateReading(r: Partial<HealthReading>): string | null {
  if (r.heartRate !== undefined && (r.heartRate < 20 || r.heartRate > 300))
    return 'heartRate out of range (20–300)';
  if (r.oxygenSaturation !== undefined && (r.oxygenSaturation < 50 || r.oxygenSaturation > 100))
    return 'oxygenSaturation out of range (50–100)';
  if (r.temperature !== undefined && (r.temperature < 30 || r.temperature > 45))
    return 'temperature out of range (30–45 °C)';
  if (r.bloodPressure) {
    if (r.bloodPressure.systolic < 50 || r.bloodPressure.systolic > 300)
      return 'bloodPressure.systolic out of range (50–300)';
    if (r.bloodPressure.diastolic < 20 || r.bloodPressure.diastolic > 200)
      return 'bloodPressure.diastolic out of range (20–200)';
  }
  if (r.sleepHours !== undefined && (r.sleepHours < 0 || r.sleepHours > 24))
    return 'sleepHours out of range (0–24)';
  if (r.movementScore !== undefined && (r.movementScore < 0 || r.movementScore > 100))
    return 'movementScore out of range (0–100)';
  return null;
}

router.post('/patients/:id/assess', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const reading = req.body as Omit<HealthReading, 'id' | 'patientId' | 'timestamp'>;

    if (!reading.heartRate || !reading.bloodPressure) {
      return res.status(400).json({ success: false, error: 'Missing required health reading fields' });
    }

    const validationError = validateReading(reading);
    if (validationError) {
      return res.status(400).json({ success: false, error: `Invalid reading: ${validationError}` });
    }

    const assessment = await runRiskAssessment(id, reading);

    // Detect anomalies vs personal baseline
    const fullReadings = healthMemory.getLatestReadings(id, 1);
    const anomalies = fullReadings.length > 0 ? healthMemory.detectAnomalies(id, fullReadings[0]) : [];

    let agentActions = null;
    if (assessment.riskLevel === 'medium' || assessment.riskLevel === 'high') {
      agentActions = await runEmergencyActions(
        id,
        assessment.riskLevel,
        assessment.riskScore,
        assessment.reasons,
        assessment.recommendations
      );
    }

    res.json({ success: true, data: { assessment, agentActions, anomalies } });
  } catch (err) {
    console.error('[POST /assess] Error:', err);
    res.status(500).json({ success: false, error: 'Risk assessment failed', details: String(err) });
  }
});

// ─── ASSESSMENTS LIST ────────────────────────────────────────────────────────

router.get('/assessments', (_req: Request, res: Response) => {
  const all = healthMemory.getAllAssessments();
  res.json({ success: true, data: all.slice(0, 20) });
});

// ─── SIMULATE ────────────────────────────────────────────────────────────────

router.post('/simulate/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { scenario } = req.body as { scenario?: 'normal' | 'warning' | 'critical' };

    const scenarios = {
      normal: { heartRate: 72, sleepHours: 7, movementScore: 65, bloodPressure: { systolic: 125, diastolic: 82 }, oxygenSaturation: 97, temperature: 36.8 },
      warning: { heartRate: 105, sleepHours: 4.5, movementScore: 28, bloodPressure: { systolic: 158, diastolic: 98 }, oxygenSaturation: 94, temperature: 37.4 },
      critical: { heartRate: 128, sleepHours: 2.5, movementScore: 8, bloodPressure: { systolic: 178, diastolic: 112 }, oxygenSaturation: 88, temperature: 38.2 },
    };

    const reading = scenarios[scenario || 'normal'];
    const assessment = await runRiskAssessment(id, reading);

    // Detect anomalies
    const fullReadings = healthMemory.getLatestReadings(id, 1);
    const anomalies = fullReadings.length > 0 ? healthMemory.detectAnomalies(id, fullReadings[0]) : [];

    let agentActions = null;
    if (assessment.riskLevel === 'medium' || assessment.riskLevel === 'high') {
      agentActions = await runEmergencyActions(id, assessment.riskLevel, assessment.riskScore, assessment.reasons, assessment.recommendations);
    }

    res.json({ success: true, data: { scenario: scenario || 'normal', assessment, agentActions, anomalies } });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

// ─── AUTO-SIMULATE ───────────────────────────────────────────────────────────
//
// Picks a small random batch of patients every tick (NOT all 1000) and runs
// risk assessment + emergency actions on medium/high. This keeps Gemini usage
// sustainable and lets caregiver alerts (Twilio/SendGrid) fire organically
// during the live demo.
//
// Tuning knobs (conservative defaults — must leave quota headroom for user chat):
//   AUTO_SIM_BATCH_SIZE    — patients processed per tick (default 3)
//   AUTO_SIM_INTERVAL_MS   — tick interval (default 30s)
//
// Gemini 2.5 Flash free tier is ~10 RPM. 3 patients / 30s = 6 RPM for auto-sim,
// leaving ~4 RPM for user-facing companion chat + manual risk assessments.
// If auto-sim is too aggressive, Gemini returns 429 and the chat falls back
// to template responses — which is exactly the bug we're preventing here.

let autoSimInterval: ReturnType<typeof setInterval> | null = null;
let autoSimEnabled = false;
let autoSimBusy = false; // prevents overlapping ticks

const AUTO_SIM_BATCH_SIZE = Number(process.env.AUTO_SIM_BATCH_SIZE || 3);
const AUTO_SIM_INTERVAL_MS = Number(process.env.AUTO_SIM_INTERVAL_MS || 30_000);

function pickRandomPatients(pool: ReturnType<typeof healthMemory.getAllPatients>, n: number) {
  if (pool.length <= n) return pool;
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

router.post('/auto-simulate/start', (_req: Request, res: Response) => {
  if (autoSimEnabled) return res.json({ success: true, data: { status: 'already running' } });

  autoSimEnabled = true;
  console.log(`[auto-sim] ▶ starting — batch=${AUTO_SIM_BATCH_SIZE} interval=${AUTO_SIM_INTERVAL_MS}ms`);

  const tick = async () => {
    if (autoSimBusy) {
      console.log('[auto-sim] ⏭ skipping tick (previous still running)');
      return;
    }
    autoSimBusy = true;
    try {
      const pool = healthMemory.getAllPatients();
      const batch = pickRandomPatients(pool, AUTO_SIM_BATCH_SIZE);

      for (const patient of batch) {
        const roll = Math.random();
        const scenario = roll < 0.7 ? 'normal' : roll < 0.9 ? 'warning' : 'critical';
        const scenarios = {
          normal:   { heartRate: 68 + Math.random() * 20,  sleepHours: 6 + Math.random() * 2,   movementScore: 50 + Math.random() * 30, bloodPressure: { systolic: 120 + Math.random() * 20, diastolic: 78 + Math.random() * 10 },  oxygenSaturation: 96 + Math.random() * 3, temperature: 36.4 + Math.random() * 0.8 },
          warning:  { heartRate: 100 + Math.random() * 15, sleepHours: 3 + Math.random() * 2,   movementScore: 15 + Math.random() * 20, bloodPressure: { systolic: 150 + Math.random() * 20, diastolic: 92 + Math.random() * 10 },  oxygenSaturation: 92 + Math.random() * 3, temperature: 37.2 + Math.random() * 0.8 },
          critical: { heartRate: 125 + Math.random() * 20, sleepHours: 1 + Math.random() * 2,   movementScore: 5  + Math.random() * 10, bloodPressure: { systolic: 170 + Math.random() * 20, diastolic: 105 + Math.random() * 10 }, oxygenSaturation: 86 + Math.random() * 4, temperature: 38   + Math.random() * 0.8 },
        };

        try {
          const assessment = await runRiskAssessment(patient.id, scenarios[scenario] as any);

          // Fire the autonomous agent on medium/high — this is what causes the
          // Twilio SMS / SendGrid email to actually dispatch during auto-sim.
          if (assessment.riskLevel === 'medium' || assessment.riskLevel === 'high') {
            await runEmergencyActions(
              patient.id,
              assessment.riskLevel,
              assessment.riskScore,
              assessment.reasons,
              assessment.recommendations,
            );
          }
        } catch (err) {
          console.warn(`[auto-sim] patient ${patient.id} failed:`, String(err).substring(0, 80));
        }
      }
    } finally {
      autoSimBusy = false;
    }
  };

  // Fire one immediately so the dashboard updates without waiting for the first tick
  tick().catch(() => { /* already logged inside */ });
  autoSimInterval = setInterval(tick, AUTO_SIM_INTERVAL_MS);

  res.json({
    success: true,
    data: {
      status: 'started',
      batchSize: AUTO_SIM_BATCH_SIZE,
      intervalMs: AUTO_SIM_INTERVAL_MS,
      note: `Processes ${AUTO_SIM_BATCH_SIZE} random patients every ${AUTO_SIM_INTERVAL_MS / 1000}s. Emergency agent fires on medium/high.`,
    },
  });
});

router.post('/auto-simulate/stop', (_req: Request, res: Response) => {
  if (autoSimInterval) {
    clearInterval(autoSimInterval);
    autoSimInterval = null;
  }
  autoSimEnabled = false;
  res.json({ success: true, data: { status: 'stopped' } });
});

router.get('/auto-simulate/status', (_req: Request, res: Response) => {
  res.json({ success: true, data: { enabled: autoSimEnabled } });
});

// ─── DASHBOARD STATS ─────────────────────────────────────────────────────────

router.get('/dashboard/stats', (req: Request, res: Response) => {
  const allPatients = healthMemory.getAllPatients();
  const allAssessments = healthMemory.getAllAssessments();
  const recent = allAssessments.slice(0, 50);

  // Dashboard shows only patients with at least 1 risk assessment (actively monitored).
  // The full 1000-patient list is available via GET /patients and the navbar search.
  const limit = Math.min(parseInt((req.query.limit as string) || '50', 10), 200);
  const page  = Math.max(parseInt((req.query.page  as string) || '1',  10), 1);

  // Build monitored list: patients that have at least one assessment, sorted most-recent first
  type PatientRow = {
    patient: ReturnType<typeof healthMemory.getPatient>;
    latestReading: ReturnType<typeof healthMemory.getLatestReadings>[0] | null;
    latestAssessment: ReturnType<typeof healthMemory.getLatestAssessments>[0] | null;
    adherenceRate: number;
    lastActivity: number;
  };

  const monitored: PatientRow[] = [];
  for (const p of allPatients) {
    const assessments = healthMemory.getLatestAssessments(p.id, 1);
    if (assessments.length === 0) continue; // skip patients with no assessments yet
    const readings  = healthMemory.getLatestReadings(p.id, 1);
    const adherence = healthMemory.getMedicationAdherence(p.id);
    monitored.push({
      patient:          p,
      latestReading:    readings[0]    || null,
      latestAssessment: assessments[0] || null,
      adherenceRate:    adherence.rate,
      lastActivity:     new Date(assessments[0].timestamp).getTime(),
    });
  }

  // Sort most-recently assessed first
  monitored.sort((a, b) => b.lastActivity - a.lastActivity);

  const totalMonitored = monitored.length;
  const start = (page - 1) * limit;
  const pageSlice = monitored.slice(start, start + limit).map(({ lastActivity: _la, ...rest }) => rest);

  const stats = {
    totalPatients:    allPatients.length,       // all 1000
    monitoredPatients: totalMonitored,           // patients with ≥1 assessment
    totalPages:       Math.ceil(totalMonitored / limit),
    currentPage:      page,
    highRiskCount:    recent.filter((a) => a.riskLevel === 'high').length,
    mediumRiskCount:  recent.filter((a) => a.riskLevel === 'medium').length,
    lowRiskCount:     recent.filter((a) => a.riskLevel === 'low').length,
    totalAssessments: allAssessments.length,
    alertsToday: recent.filter((a) => {
      const d = new Date(a.timestamp);
      return d.toDateString() === new Date().toDateString();
    }).length,
    autoSimEnabled,
    patientsWithReadings: pageSlice,
  };

  res.json({ success: true, data: stats });
});

// ─── SSE LIVE STREAM ─────────────────────────────────────────────────────────
// Clients connect with EventSource. Sends stats every 15s + heartbeat every 30s.
router.get('/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  const sendStats = () => {
    try {
      const allAssessments = healthMemory.getAllAssessments ? healthMemory.getAllAssessments() : [];
      const highRiskCount   = allAssessments.filter((a: any) => a.riskLevel === 'high').length;
      const mediumRiskCount = allAssessments.filter((a: any) => a.riskLevel === 'medium').length;
      const lowRiskCount    = allAssessments.filter((a: any) => a.riskLevel === 'low').length;
      const today = new Date().toISOString().split('T')[0];
      const alertsToday     = allAssessments.filter((a: any) => a.timestamp?.startsWith(today)).length;

      const payload = {
        type: 'stats',
        highRiskCount,
        mediumRiskCount,
        lowRiskCount,
        totalAssessments: allAssessments.length,
        alertsToday,
        timestamp: new Date().toISOString(),
      };
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    } catch {
      res.write(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() })}\n\n`);
    }
  };

  // Send immediately on connect
  sendStats();

  // Then every 15 seconds
  const statsInterval = setInterval(sendStats, 15000);

  // Heartbeat every 30s to prevent proxy timeouts
  const heartbeatInterval = setInterval(() => {
    res.write(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() })}\n\n`);
  }, 30000);

  req.on('close', () => {
    clearInterval(statsInterval);
    clearInterval(heartbeatInterval);
    console.log('[SSE] Client disconnected');
  });
});

// ─── DEMO ALERT (hackathon demo button) ──────────────────────────────────────
router.post('/demo-alert', async (req: Request, res: Response) => {
  try {
    const patients = healthMemory.getAllPatients();
    // Prefer a patient named Ahmad, fallback to first patient
    const target = patients.find((p) => p.name.toLowerCase().includes('ahmad')) || patients[0];
    if (!target) return res.status(404).json({ success: false, error: 'No patients in system' });

    const criticalVitals = {
      heartRate: 138,
      sleepHours: 1.5,
      movementScore: 4,
      bloodPressure: { systolic: 182, diastolic: 112 },
      oxygenSaturation: 87,
      temperature: 38.6,
    };

    const assessment = await runRiskAssessment(target.id, criticalVitals as any);

    if (assessment.riskLevel === 'medium' || assessment.riskLevel === 'high') {
      await runEmergencyActions(
        target.id,
        assessment.riskLevel,
        assessment.riskScore,
        assessment.reasons,
        assessment.recommendations,
      );
    }

    res.json({
      success: true,
      data: {
        patient: { name: target.name, id: target.id },
        assessment,
        message: `Demo alert triggered for ${target.name} — caregiver notified via SMS + Email`,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

// ─── ALERTS (Demo/Test) ─────────────────────────────────────────────────────
/**
 * Fire a test caregiver alert for any patient — proves Twilio/SendGrid is live.
 * POST /api/health/alerts/test
 * body: { patientId?: string, riskLevel?: 'medium'|'high' }
 *
 * If patientId is omitted, uses patient-001 (Ahmad). Useful for demo day to
 * trigger a real SMS + email without running the full simulation pipeline.
 */
router.post('/alerts/test', async (req: Request, res: Response) => {
  try {
    const patientId = req.body?.patientId || 'patient-001';
    const riskLevel = (req.body?.riskLevel === 'medium' ? 'medium' : 'high') as 'medium' | 'high';

    const patient = healthMemory.getPatient(patientId);
    if (!patient) {
      return res.status(404).json({ success: false, error: `Patient ${patientId} not found` });
    }

    const reasons =
      riskLevel === 'high'
        ? ['SpO₂ 88% (critical hypoxaemia)', 'HR 128bpm (severe tachycardia)', 'BP 186/112mmHg (hypertensive crisis)']
        : ['Blood pressure elevated (158/96)', 'Sleep 4.2h (below baseline)', 'Movement score declining'];

    const urgencyMessage =
      riskLevel === 'high'
        ? `🚨 URGENT: CareSphere AI has detected CRITICAL health risk for ${patient.name}. Immediate medical attention required. This is a TEST alert triggered manually for system verification.`
        : `⚠️ ATTENTION: CareSphere AI has detected elevated health risk for ${patient.name}. Please check in within 30 minutes. This is a TEST alert triggered manually.`;

    const result = await sendCaregiverAlert({
      patientId,
      riskLevel,
      riskReasons: reasons,
      urgencyMessage,
    });

    res.json({
      success: true,
      data: {
        testAlert: true,
        patient: { id: patient.id, name: patient.name, caregiver: patient.caregiver },
        dispatchResult: result,
        hint:
          result.smsStatus === 'skipped' && result.emailStatus === 'skipped'
            ? 'Running in SIMULATION mode — set TWILIO_* and SENDGRID_* env vars in Cloud Run to enable real dispatch.'
            : undefined,
      },
    });
  } catch (err) {
    console.error('[alerts/test] Error:', err);
    res.status(500).json({ success: false, error: String(err) });
  }
});

// ─── ADMIN: ANALYTICS ────────────────────────────────────────────────────────

router.get('/admin/analytics', async (_req: Request, res: Response) => {
  try {
    if (!db) return res.status(503).json({ success: false, error: 'Firestore unavailable' });

    const [patientsSnap, assessmentsSnap, medLogsSnap, convsSnap] = await Promise.all([
      db.collection('patients').get(),
      db.collectionGroup('assessments').get(),
      db.collectionGroup('medicationLogs').get(),
      db.collectionGroup('conversations').get(),
    ]);

    const allAssessments = assessmentsSnap.docs.map((d) => d.data() as any);
    const allMedicationLogs = medLogsSnap.docs.map((d) => d.data() as any);
    const allQueryMessages = convsSnap.docs.reduce((count, d) => {
      const msg = d.data() as any;
      return count + (msg.role === 'user' ? 1 : 0);
    }, 0);

    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 86400000).getTime();

    const todayAssessments = allAssessments.filter((a) => toIso(a.timestamp).startsWith(today));
    const yesterdayAssessments = allAssessments.filter((a) => toIso(a.timestamp).startsWith(yesterday));
    const weekAssessments = allAssessments.filter((a) => {
      const t = toDate(a.timestamp);
      return t ? t.getTime() >= weekAgo : false;
    });

    const monitoredPatientIds = new Set(allAssessments.map((a) => String(a.patientId)));

    const medByPatient = new Map<string, { total: number; taken: number }>();
    for (const log of allMedicationLogs) {
      const pid = String(log.patientId || '');
      if (!pid) continue;
      const prev = medByPatient.get(pid) || { total: 0, taken: 0 };
      prev.total += 1;
      if (Boolean(log.taken)) prev.taken += 1;
      medByPatient.set(pid, prev);
    }
    let totalAdherence = 0;
    let adherenceCount = 0;
    for (const [, entry] of medByPatient) {
      if (entry.total > 0) {
        totalAdherence += Math.round((entry.taken / entry.total) * 100);
        adherenceCount += 1;
      }
    }
    const avgAdherence = adherenceCount > 0 ? Math.round(totalAdherence / adherenceCount) : 0;

    const analytics = {
      patients: {
        total: patientsSnap.size,
        monitored: monitoredPatientIds.size,
        unmonitored: Math.max(0, patientsSnap.size - monitoredPatientIds.size),
      },
      risk: {
        high: allAssessments.filter((a) => a.riskLevel === 'high').length,
        medium: allAssessments.filter((a) => a.riskLevel === 'medium').length,
        low: allAssessments.filter((a) => a.riskLevel === 'low').length,
        highToday: todayAssessments.filter((a) => a.riskLevel === 'high').length,
        mediumToday: todayAssessments.filter((a) => a.riskLevel === 'medium').length,
      },
      assessments: {
        total: allAssessments.length,
        today: todayAssessments.length,
        yesterday: yesterdayAssessments.length,
        thisWeek: weekAssessments.length,
      },
      alerts: {
        total: allAssessments.filter((a) => a.riskLevel === 'high' || a.riskLevel === 'medium').length,
        today: todayAssessments.filter((a) => a.riskLevel === 'high' || a.riskLevel === 'medium').length,
        critical: allAssessments.filter((a) => a.riskLevel === 'high').length,
      },
      medications: {
        avgAdherence,
        patientsTracked: adherenceCount,
      },
      aiQueries: {
        total: allQueryMessages,
      },
      system: {
        autoSimEnabled,
        batchSize: AUTO_SIM_BATCH_SIZE,
        intervalMs: AUTO_SIM_INTERVAL_MS,
        uptime: process.uptime(),
      },
      generatedAt: new Date().toISOString(),
    };

    res.json({ success: true, data: analytics });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

// ─── ADMIN: AUDIT LOG ────────────────────────────────────────────────────────

router.get('/admin/audit', async (req: Request, res: Response) => {
  const limit = Math.min(parseInt((req.query.limit as string) || '100', 10), 500);
  const type = req.query.type as string | undefined;

  if (!db) return res.status(503).json({ success: false, error: 'Firestore unavailable' });

  type AuditEvent = {
    id: string;
    timestamp: string;
    type: 'risk_assessment' | 'caregiver_alert' | 'ai_query' | 'patient_registered';
    patientId: string;
    patientName: string;
    severity: 'info' | 'warning' | 'critical';
    description: string;
    metadata?: Record<string, unknown>;
  };

  try {
    const [patientsSnap, assessmentsSnap, convsSnap] = await Promise.all([
      db.collection('patients').get(),
      db.collectionGroup('assessments').get(),
      db.collectionGroup('conversations').get(),
    ]);

    const patientById = new Map<string, any>();
    for (const p of patientsSnap.docs) {
      patientById.set(p.id, p.data());
    }

    const events: AuditEvent[] = [];

    for (const doc of assessmentsSnap.docs) {
      const a = doc.data() as any;
      const patient = patientById.get(String(a.patientId));
      const name = patient?.name ?? String(a.patientId);
      const ts = toIso(a.timestamp);

      events.push({
        id: `assess-${a.id || doc.id}`,
        timestamp: ts,
        type: 'risk_assessment',
        patientId: String(a.patientId),
        patientName: name,
        severity: a.riskLevel === 'high' ? 'critical' : a.riskLevel === 'medium' ? 'warning' : 'info',
        description: `Risk assessment: ${String(a.riskLevel || '').toUpperCase()} (score ${a.riskScore}/100) — ${String(a.geminiReasoning || '').substring(0, 100)}`,
        metadata: { riskLevel: a.riskLevel, riskScore: a.riskScore, reasons: a.reasons },
      });

      if (a.riskLevel === 'high' || a.riskLevel === 'medium') {
        events.push({
          id: `alert-${a.id || doc.id}`,
          timestamp: ts,
          type: 'caregiver_alert',
          patientId: String(a.patientId),
          patientName: name,
          severity: a.riskLevel === 'high' ? 'critical' : 'warning',
          description: `Caregiver alert dispatched (SMS + Email) for ${name} — ${a.riskLevel} risk detected`,
          metadata: { caregiver: patient?.caregiver, riskLevel: a.riskLevel },
        });
      }
    }

    for (const doc of convsSnap.docs) {
      const msg = doc.data() as any;
      if (msg.role !== 'user') continue;
      const patient = patientById.get(String(msg.patientId));
      events.push({
        id: `query-${msg.id || doc.id}`,
        timestamp: toIso(msg.timestamp),
        type: 'ai_query',
        patientId: String(msg.patientId),
        patientName: patient?.name ?? String(msg.patientId),
        severity: 'info',
        description: `Clinical query: "${String(msg.content || '').substring(0, 100)}"`,
        metadata: { query: msg.content },
      });
    }

    for (const p of patientsSnap.docs) {
      const data = p.data() as any;
      if (data.createdAt) {
        events.push({
          id: `reg-${p.id}`,
          timestamp: toIso(data.createdAt),
          type: 'patient_registered',
          patientId: p.id,
          patientName: data.name || p.id,
          severity: 'info',
          description: `Patient registered: ${data.name || p.id}, ${data.age ?? '-'}y — conditions: ${(data.conditions || []).join(', ') || 'none'}`,
          metadata: { age: data.age, gender: data.gender, conditions: data.conditions },
        });
      }
    }

    let result = events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    if (type) result = result.filter((e) => e.type === type);
    result = result.slice(0, limit);

    res.json({ success: true, data: result, total: events.length });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

// ─── ADMIN: BULK SIMULATE ────────────────────────────────────────────────────

router.post('/admin/simulate-bulk', async (req: Request, res: Response) => {
  try {
    const count    = Math.min(parseInt(req.body?.count || '10', 10), 50);
    const scenario = (req.body?.scenario as 'normal' | 'warning' | 'critical' | 'mixed') || 'mixed';

    const patients = healthMemory.getAllPatients();
    const shuffled = [...patients].sort(() => Math.random() - 0.5).slice(0, count);

    const scenarios = {
      normal:   { heartRate: 72, sleepHours: 7, movementScore: 65, bloodPressure: { systolic: 125, diastolic: 82 }, oxygenSaturation: 97,   temperature: 36.8 },
      warning:  { heartRate: 105, sleepHours: 4.5, movementScore: 28, bloodPressure: { systolic: 158, diastolic: 98 }, oxygenSaturation: 94, temperature: 37.4 },
      critical: { heartRate: 128, sleepHours: 2.5, movementScore: 8, bloodPressure: { systolic: 178, diastolic: 112 }, oxygenSaturation: 88, temperature: 38.2 },
    };

    const results: Array<{ patientId: string; patientName: string; scenario: string; riskLevel: string; riskScore: number }> = [];

    for (const p of shuffled) {
      try {
        const pickedScenario = scenario === 'mixed'
          ? (['normal', 'normal', 'warning', 'critical'] as const)[Math.floor(Math.random() * 4)]
          : scenario;
        const reading = scenarios[pickedScenario];
        const assessment = await runRiskAssessment(p.id, reading);
        if (assessment.riskLevel === 'medium' || assessment.riskLevel === 'high') {
          await runEmergencyActions(p.id, assessment.riskLevel, assessment.riskScore, assessment.reasons, assessment.recommendations);
        }
        results.push({ patientId: p.id, patientName: p.name, scenario: pickedScenario, riskLevel: assessment.riskLevel, riskScore: assessment.riskScore });
      } catch {
        // skip individual failures
      }
    }

    res.json({
      success: true,
      data: {
        processed: results.length,
        requested: count,
        results,
        highCount: results.filter((r) => r.riskLevel === 'high').length,
        mediumCount: results.filter((r) => r.riskLevel === 'medium').length,
        lowCount: results.filter((r) => r.riskLevel === 'low').length,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

export default router;

