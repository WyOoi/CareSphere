import { Router, Request, Response } from 'express';
import { healthMemory } from '../rag/healthMemoryService';
import { runRiskAssessment } from '../flows/riskAssessmentFlow';
import { runEmergencyActions } from '../flows/emergencyActionFlow';
import { db } from '../lib/firebase';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    if (!db) return res.status(503).json({ success: false, error: 'Firestore unavailable' });
    const snap = await db.collection('devices').get();
    const devices = snap.docs.map((d) => {
      const info = d.data() as any;
      return {
        deviceId: d.id,
        ...info,
        patient: healthMemory.getPatient(info.patientId),
      };
    });
    res.json({ success: true, data: devices });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

router.post('/:deviceId/reading', async (req: Request, res: Response) => {
  try {
    if (!db) return res.status(503).json({ success: false, error: 'Firestore unavailable' });
    const { deviceId } = req.params;
    const deviceSnap = await db.collection('devices').doc(deviceId).get();
    if (!deviceSnap.exists) return res.status(404).json({ success: false, error: `Device '${deviceId}' not registered.` });

    const device = deviceSnap.data() as { patientId: string; deviceType: string; model: string; readingCount?: number };
    const patient = healthMemory.getPatient(device.patientId);
    if (!patient) return res.status(404).json({ success: false, error: 'Patient not found for this device.' });

    const incoming = req.body;
    const lastReading = healthMemory.getLatestReadings(device.patientId, 1)[0];
    const reading = {
      heartRate: incoming.heartRate ?? lastReading?.heartRate ?? 75,
      sleepHours: incoming.sleepHours ?? lastReading?.sleepHours ?? 7,
      movementScore: incoming.movementScore ?? lastReading?.movementScore ?? 50,
      bloodPressure: incoming.bloodPressure ?? lastReading?.bloodPressure ?? { systolic: 130, diastolic: 85 },
      oxygenSaturation: incoming.oxygenSaturation ?? lastReading?.oxygenSaturation ?? 97,
      temperature: incoming.temperature ?? lastReading?.temperature ?? 36.8,
      glucoseLevel: incoming.glucoseLevel ?? lastReading?.glucoseLevel,
    };

    await db.collection('devices').doc(deviceId).set({
      lastSeen: new Date().toISOString(),
      readingCount: (device.readingCount || 0) + 1,
      status: 'online',
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    const assessment = await runRiskAssessment(device.patientId, reading as any);
    const fullReadings = healthMemory.getLatestReadings(device.patientId, 1);
    const anomalies = fullReadings.length > 0 ? healthMemory.detectAnomalies(device.patientId, fullReadings[0]) : [];

    let agentActions = null;
    if (assessment.riskLevel === 'medium' || assessment.riskLevel === 'high') {
      agentActions = await runEmergencyActions(device.patientId, assessment.riskLevel, assessment.riskScore, assessment.reasons, assessment.recommendations);
    }

    res.json({
      success: true,
      data: {
        deviceId,
        deviceType: device.deviceType,
        model: device.model,
        patientName: patient.name,
        readingReceived: reading,
        assessment,
        anomalies,
        agentActionsTriggered: agentActions !== null,
        agentActions,
        processedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

router.post('/:deviceId/heartbeat', async (req: Request, res: Response) => {
  try {
    if (!db) return res.status(503).json({ success: false, error: 'Firestore unavailable' });
    const { deviceId } = req.params;
    const ref = db.collection('devices').doc(deviceId);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ success: false, error: 'Device not registered.' });

    const ts = new Date().toISOString();
    await ref.set({ lastSeen: ts, status: 'online', updatedAt: ts }, { merge: true });
    await ref.collection('heartbeats').doc(`hb-${Date.now()}`).set({ deviceId, timestamp: ts });
    res.json({ success: true, data: { deviceId, timestamp: ts, message: 'Heartbeat received' } });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

router.get('/:deviceId/status', async (req: Request, res: Response) => {
  try {
    if (!db) return res.status(503).json({ success: false, error: 'Firestore unavailable' });
    const { deviceId } = req.params;
    const snap = await db.collection('devices').doc(deviceId).get();
    if (!snap.exists) return res.status(404).json({ success: false, error: 'Device not found.' });

    const device = snap.data() as any;
    const lastSeen = device.lastSeen || null;
    const isOnline = lastSeen ? Date.now() - new Date(lastSeen).getTime() < 120000 : false;
    res.json({
      success: true,
      data: { deviceId, ...device, lastSeen, status: isOnline ? 'online' : lastSeen ? 'idle' : 'never_connected' },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

export default router;
