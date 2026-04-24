import { Router, Request, Response } from 'express';
import { healthMemory } from '../rag/healthMemoryService';
import { db } from '../lib/firebase';
import crypto from 'crypto';

const router = Router();

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

router.post('/signup', async (req: Request, res: Response) => {
  try {
    const { username, fullName, password, ...rest } = req.body;
    const normalizedUsername = username?.toString().trim().toUpperCase();

    if (!normalizedUsername || !fullName || !password) {
      return res.status(400).json({ success: false, error: 'username, fullName, and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
    }
    if (!db) {
      return res.status(503).json({ success: false, error: 'Firestore unavailable' });
    }

    const accountRef = db.collection('patientAccounts').doc(normalizedUsername);
    const existing = await accountRef.get();
    if (existing.exists) {
      return res.status(409).json({ success: false, error: 'Username already registered' });
    }

    const patientId = `patient-${Date.now()}`;
    const newPatient = {
      id: patientId,
      name: fullName.trim(),
      age: 65,
      gender: 'male' as const,
      conditions: [],
      medications: [],
      caregiver: { name: 'Family Member', phone: '012-000 0000', email: '', relationship: 'Family' },
      location: { address: 'Malaysia', city: 'Kuala Lumpur', state: 'Wilayah Persekutuan', lat: 3.139, lng: 101.6869 },
      createdAt: new Date().toISOString(),
    };
    healthMemory.storePatient(newPatient);

    const token = generateToken();
    const sanitizedSignupProfile = Object.fromEntries(
      Object.entries(rest).filter(([key]) => !key.toLowerCase().includes('password'))
    );

    await accountRef.set({
      username: normalizedUsername,
      fullName: fullName.trim(),
      passwordHash: hashPassword(password),
      patientId,
      signupProfile: {
        username: normalizedUsername,
        fullName: fullName.trim(),
        ...sanitizedSignupProfile,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'active',
    });

    await db.collection('authSessions').doc(`session-${token.slice(0, 12)}`).set({
      patientId,
      username: normalizedUsername,
      token,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      revoked: false,
    });

    res.status(201).json({
      success: true,
      data: { patientId, patientName: fullName, token, username: normalizedUsername, message: 'Account created successfully' },
    });
  } catch (err) {
    console.error('[auth/signup] Error:', err);
    res.status(500).json({ success: false, error: 'Signup failed' });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    const normalizedUsername = username?.toString().trim().toUpperCase();

    if (!normalizedUsername || !password) {
      return res.status(400).json({ success: false, error: 'username and password are required' });
    }
    if (!db) {
      return res.status(503).json({ success: false, error: 'Firestore unavailable' });
    }

    const accountSnap = await db.collection('patientAccounts').doc(normalizedUsername).get();
    if (!accountSnap.exists) {
      return res.status(401).json({ success: false, error: 'Invalid username or password' });
    }

    const account = accountSnap.data() as { patientId: string; fullName: string; passwordHash: string; username: string };
    if (account.passwordHash !== hashPassword(password)) {
      return res.status(401).json({ success: false, error: 'Invalid username or password' });
    }

    const token = generateToken();
    await db.collection('authSessions').doc(`session-${token.slice(0, 12)}`).set({
      patientId: account.patientId,
      username: normalizedUsername,
      token,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      revoked: false,
    });

    res.json({
      success: true,
      data: { patientId: account.patientId, patientName: account.fullName, token, username: normalizedUsername },
    });
  } catch (err) {
    console.error('[auth/login] Error:', err);
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

router.get('/verify', async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, error: 'No token provided' });
    if (!db) return res.status(503).json({ success: false, error: 'Firestore unavailable' });

    const snap = await db.collection('authSessions').where('token', '==', token).where('revoked', '==', false).limit(1).get();
    if (snap.empty) return res.status(401).json({ success: false, error: 'Invalid token' });
    res.json({ success: true, data: { valid: true } });
  } catch {
    res.status(500).json({ success: false, error: 'Verification failed' });
  }
});

export default router;
