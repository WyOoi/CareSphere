/**
 * CareSphere AI - Backend Server
 * Firebase Genkit + Gemini 2.5 Flash for elderly health monitoring
 * Track 3: Vital Signs (Healthcare & Wellbeing) — Project 2030 MyAI Future Hackathon
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import './config/firebaseWeb';
import { errorHandler, notFound } from './middleware/errorHandler';
import healthRoutes from './routes/healthRoutes';
import companionRoutes from './routes/companionRoutes';
import deviceRoutes from './routes/deviceRoutes';
import authRoutes from './routes/authRoutes';
import { seedDemoData } from './rag/healthMemoryService';

const app = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = (process.env.FRONTEND_URL || '*').split(',').map((o) => o.trim());
app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logger
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    service: 'CareSphere AI Backend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    aiStack: {
      gemini: !!process.env.GOOGLE_GENAI_API_KEY,
      genkit: true,
      rag: true,
    },
  });
});

app.get('/', (_req, res) => {
  res.json({
    name: 'CareSphere AI API',
    description: 'AI-powered elderly health monitoring system',
    track: 'Track 3: Vital Signs (Healthcare & Wellbeing)',
    hackathon: 'Project 2030: MyAI Future Hackathon',
    endpoints: {
      health: 'GET /health',
      patients: 'GET /api/health/patients',
      assess: 'POST /api/health/patients/:id/assess',
      simulate: 'POST /api/health/simulate/:id',
      dashboard: 'GET /api/health/dashboard/stats',
      chat: 'POST /api/companion/chat',
      checkin: 'POST /api/companion/daily-checkin/:id',
      devices: 'GET /api/devices',
      deviceReading: 'POST /api/devices/:deviceId/reading',
      signup: 'POST /api/auth/signup',
      login: 'POST /api/auth/login',
    },
  });
});

app.use('/api/health', healthRoutes);
app.use('/api/companion', companionRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/auth', authRoutes);

app.use(notFound);
app.use(errorHandler);

// Seed demo data on startup (async — loads from Firestore if available)
seedDemoData()
  .then(() => console.log('[CareSphere AI] Patient data ready (Firestore or seed)'))
  .catch((err) => console.error('[CareSphere AI] Seed error:', err));

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════╗
║          CareSphere AI Backend Started            ║
║  Project 2030: MyAI Future Hackathon              ║
║  Track 3: Vital Signs - Healthcare & Wellbeing    ║
╠═══════════════════════════════════════════════════╣
║  Server:   http://localhost:${PORT}                  ║
║  Gemini:   ${process.env.GOOGLE_GENAI_API_KEY ? '✓ Connected' : '⚠ No API key (demo mode)'}          ║
║  Genkit:   ✓ Agentic flows ready                  ║
║  RAG:      ✓ Health memory initialized            ║
╚═══════════════════════════════════════════════════╝
  `);
});

export default app;
