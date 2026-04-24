'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Heart, Activity, Wind, Moon, Zap, Thermometer,
  User, MapPin, Phone, Pill,
  AlertTriangle, CheckCircle2,
  Brain, Edit3, Save, X, Shield,
  PhoneCall,
  ChevronDown, Sparkles, Clock3, CircleCheckBig,
} from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { api, Patient, HealthReading, RiskAssessment, MedicationData } from '@/lib/api';

/* ─── cookie helper ─────────────────────────────────────────── */
function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.split(';').map(c => c.trim()).find(c => c.startsWith(name + '='));
  return match ? decodeURIComponent(match.split('=')[1]) : null;
}

/* ─── vital helpers ─────────────────────────────────────────── */
const isAbnormalHR    = (v: number) => v > 100 || v < 55;
const isAbnormalBP    = (v: number) => v > 160;
const isAbnormalO2    = (v: number) => v < 95;
const isAbnormalSleep = (v: number) => v < 5;
const isAbnormalTemp  = (v: number) => v > 37.8;

/* ─── medication time helper ────────────────────────────────── */
function getMedStatus(scheduledTime: string): 'due' | 'upcoming' | 'passed' {
  const [h, m] = scheduledTime.split(':').map(Number);
  const now = new Date();
  const doseMin = h * 60 + m;
  const nowMin  = now.getHours() * 60 + now.getMinutes();
  if (doseMin <= nowMin && nowMin <= doseMin + 60) return 'due';
  if (doseMin > nowMin) return 'upcoming';
  return 'passed';
}

/* ─── VitalCard ─────────────────────────────────────────────── */
function VitalCard({ icon: Icon, label, value, unit, alert, tip, friendlyLabel }: {
  icon: React.ElementType; label: string; value: string; unit: string;
  alert?: boolean; tip?: string; friendlyLabel?: string;
}) {
  return (
    <div className={`rounded-2xl p-5 flex flex-col gap-2 border-2 ${
      alert ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700'
            : 'bg-slate-50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600'
    }`}>
      <div className="flex items-center gap-2">
        <Icon className={`w-5 h-5 ${alert ? 'text-red-500' : 'text-brand-500'}`} />
        <span className={`text-sm font-semibold ${alert ? 'text-red-700 dark:text-red-400' : 'text-slate-600 dark:text-slate-400'}`}>{label}</span>
      </div>
      <p className={`text-3xl font-bold leading-none ${alert ? 'text-red-700 dark:text-red-400' : 'text-slate-900 dark:text-slate-100'}`}>
        {value}<span className="text-base font-normal ml-1.5 text-slate-400">{unit}</span>
      </p>
      {friendlyLabel && (
        <p className={`text-sm font-bold ${alert ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>{friendlyLabel}</p>
      )}
      {tip && <p className="text-xs text-slate-400 leading-snug mt-0.5">{tip}</p>}
    </div>
  );
}

/* ─── ConditionPill ─────────────────────────────────────────── */
function ConditionPill({ children, color = 'teal' }: { children: React.ReactNode; color?: 'teal' | 'slate' | 'purple' }) {
  const cls = {
    teal:   'bg-brand-50 text-brand-700 border-brand-200',
    slate:  'bg-slate-100 text-slate-600 border-slate-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
  }[color];
  return <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${cls}`}>{children}</span>;
}

/* ══════════════════════════════════════════════════════════════ */
export default function PatientProfilePage() {
  const params  = useParams();
  const router  = useRouter();
  const id      = Array.isArray(params.id) ? params.id[0] : params.id as string;

  /* ── data ── */
  const [patient,     setPatient]     = useState<Patient | null>(null);
  const [readings,    setReadings]    = useState<HealthReading[]>([]);
  const [assessments, setAssessments] = useState<RiskAssessment[]>([]);
  const [medData,     setMedData]     = useState<MedicationData | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);

  /* ── edit biodata ── */
  const [editing,     setEditing]    = useState(false);
  const [editName,    setEditName]   = useState('');
  const [editAge,     setEditAge]    = useState('');
  const [editGender,  setEditGender] = useState('');
  const [editCity,    setEditCity]   = useState('');
  const [editState,   setEditState]  = useState('');
  const [editCgName,  setEditCgName] = useState('');
  const [editCgPhone, setEditCgPhone]= useState('');
  const [editCgRel,   setEditCgRel]  = useState('');
  const [saving,      setSaving]     = useState(false);
  const [saveMsg,     setSaveMsg]    = useState('');

  /* ── UX confirmations ── */
  const [sosConfirm,  setSosConfirm]  = useState(false);
  const [skipConfirm, setSkipConfirm] = useState<{ medId: string; medName: string; time: string } | null>(null);
  const [showTimeline, setShowTimeline] = useState(false);
  const [selectedReadingIdx, setSelectedReadingIdx] = useState(0);
  const [medFilter, setMedFilter] = useState<'all' | 'due' | 'pending'>('all');
  const [dailyChecklist, setDailyChecklist] = useState({
    hydration: false,
    walk: false,
    breathing: false,
  });

  /* ── tick for med time status ── */
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(iv);
  }, []);

  const today = new Date().toISOString().split('T')[0];

  /* ── load data ── */
  useEffect(() => {
    if (!id) return;

    // Guard: patient must only see their own page
    const myId = readCookie('cs_patient_id');
    if (myId && myId !== id) {
      router.replace(`/patients/${myId}`);
      return;
    }

    setLoading(true);
    Promise.all([api.getPatient(id), api.getReadings(id, 20), api.getAssessments(id, 10)])
      .then(([p, r, a]) => { setPatient(p); setReadings(r); setAssessments(a); })
      .catch((e) => setError(e?.message || 'Failed to load'))
      .finally(() => setLoading(false));

    api.getMedications(id).then(setMedData).catch(() => {});
  }, [id, router]);

  /* ── edit helpers ── */
  function openEdit() {
    if (!patient) return;
    setEditName(patient.name); setEditAge(String(patient.age)); setEditGender(patient.gender);
    setEditCity(patient.location.city); setEditState(patient.location.state);
    setEditCgName(patient.caregiver.name); setEditCgPhone(patient.caregiver.phone); setEditCgRel(patient.caregiver.relationship);
    setEditing(true);
  }

  async function saveEdit() {
    if (!patient) return;
    setSaving(true);
    try {
      const updated = await api.updatePatient(id, {
        name: editName, age: parseInt(editAge), gender: editGender as 'male' | 'female',
        location: { ...patient.location, city: editCity, state: editState },
        caregiver: { ...patient.caregiver, name: editCgName, phone: editCgPhone, relationship: editCgRel },
      });
      setPatient(updated); setEditing(false); setSaveMsg('Saved!');
      setTimeout(() => setSaveMsg(''), 3000);
    } catch { setSaveMsg('Failed. Try again.'); }
    finally { setSaving(false); }
  }

  /* ── medication helpers ── */
  const handleLogMed = async (medId: string, medName: string, time: string, taken: boolean) => {
    await api.logMedication(id, { medicationId: medId, medicationName: medName, scheduledTime: time, date: today, taken });
    const fresh = await api.getMedications(id);
    setMedData(fresh);
  };

  const isLogged = (medId: string, time: string): boolean | null => {
    const log = medData?.todayLogs.find(l => l.medicationId === medId && l.scheduledTime === time);
    return log ? log.taken : null;
  };

  /* ── loading / error ── */
  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="w-14 h-14 border-4 border-brand-200 border-t-brand-500 rounded-full animate-spin" />
      <p className="text-slate-500 text-base font-medium">Loading your health profile…</p>
    </div>
  );

  if (error || !patient) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <div className="bg-red-50 border border-red-200 rounded-2xl p-8 max-w-md text-center">
        <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-red-700 mb-2">Profile Not Found</h2>
        <p className="text-sm text-red-500 mb-4">{error}</p>
        <button onClick={() => router.push('/')} className="px-4 py-2 bg-brand-500 text-white rounded-lg text-sm font-medium">Go Back</button>
      </div>
    </div>
  );

  const latestReading    = readings[0] ?? null;
  const activeReading    = readings[selectedReadingIdx] ?? latestReading;
  const latestAssessment = assessments[0] ?? null;
  const firstName        = patient.name.split(' ')[0];
  const riskScore        = latestAssessment?.riskScore ?? 0;
  const riskLevel        = latestAssessment?.riskLevel ?? 'low';
  const wellnessScore    = Math.max(0, 100 - riskScore);
  const hour             = new Date().getHours();
  const greeting         = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="space-y-6 animate-fade-in pb-16 max-w-2xl mx-auto">

      {/* ── GREETING ─────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-brand-500 to-teal-500 rounded-3xl p-7 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="absolute rounded-full border-2 border-white"
              style={{ width: `${(i+1)*180}px`, height:`${(i+1)*180}px`, top:'-40%', right:'-5%' }} />
          ))}
        </div>
        <div className="relative flex items-center justify-between gap-4">
          <div>
            <p className="text-white/80 text-base">{greeting},</p>
            <h1 className="text-3xl font-bold mt-0.5">{firstName}</h1>
            <p className="text-white/80 text-base mt-2 leading-snug">
              {riskLevel === 'low'
                ? 'Your health looks great today!'
                : riskLevel === 'medium'
                ? 'Some things need your attention.'
                : 'Please call your doctor or caregiver.'}
            </p>
          </div>
          <div className="text-center shrink-0">
            <div className="w-20 h-20 rounded-full bg-white/20 border-2 border-white/50 flex flex-col items-center justify-center">
              <p className="text-2xl font-bold leading-none">{wellnessScore}</p>
              <p className="text-xs text-white/70 mt-0.5">wellness</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── DAILY CARE CHECKLIST (interactive) ───────────────── */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-200 dark:border-slate-700 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-amber-500" />
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Today's Self-Care Checklist</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {[
            { key: 'hydration', label: 'Drank enough water' },
            { key: 'walk', label: '10-30 min walk' },
            { key: 'breathing', label: 'Breathing exercise' },
          ].map((item) => {
            const checked = dailyChecklist[item.key as keyof typeof dailyChecklist];
            return (
              <button
                key={item.key}
                onClick={() =>
                  setDailyChecklist((prev) => ({ ...prev, [item.key]: !prev[item.key as keyof typeof prev] }))
                }
                className={`text-left rounded-xl px-3 py-3 border transition-all ${
                  checked
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700'
                    : 'bg-slate-50 dark:bg-slate-700/40 border-slate-200 dark:border-slate-600 hover:border-brand-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <CircleCheckBig className={`w-4 h-4 ${checked ? 'text-green-600' : 'text-slate-400'}`} />
                  <span className={`text-sm font-medium ${checked ? 'text-green-700 dark:text-green-300' : 'text-slate-700 dark:text-slate-300'}`}>
                    {item.label}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── EMERGENCY SOS ─────────────────────────────────────── */}
      {!sosConfirm ? (
        <button
          onClick={() => setSosConfirm(true)}
          className="flex items-center justify-center gap-3 w-full py-5 rounded-2xl bg-red-500 hover:bg-red-600 active:scale-95 text-white font-bold text-xl transition-all shadow-lg shadow-red-200 dark:shadow-red-900/40">
          <PhoneCall className="w-7 h-7" />
          Emergency — Call {patient.caregiver.name}
        </button>
      ) : (
        <div className="rounded-2xl border-2 border-red-400 bg-red-50 dark:bg-red-900/20 p-5 space-y-3">
          <p className="text-center text-lg font-bold text-red-700 dark:text-red-300">
            Call {patient.caregiver.name}?
          </p>
          <p className="text-center text-base text-red-500">{patient.caregiver.phone} · {patient.caregiver.relationship}</p>
          <div className="flex gap-3">
            <a href={`tel:${patient.caregiver.phone}`}
              onClick={() => setSosConfirm(false)}
              className="flex-1 flex items-center justify-center gap-2 py-4 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-lg transition-all active:scale-95">
              <PhoneCall className="w-6 h-6" /> Yes, Call Now
            </a>
            <button onClick={() => setSosConfirm(false)}
              className="flex-1 py-4 rounded-xl border-2 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-semibold text-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-all">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── AI COMPANION SHORTCUT ─────────────────────────────── */}
      <Link href="/companion"
        className="flex items-center gap-4 w-full p-5 rounded-2xl bg-violet-50 dark:bg-violet-900/20 border-2 border-violet-200 dark:border-violet-700 hover:bg-violet-100 dark:hover:bg-violet-900/30 active:scale-95 transition-all">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0">
          <Brain className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1">
          <p className="text-lg font-bold text-violet-800 dark:text-violet-300">Chat with AI Companion</p>
          <p className="text-sm text-violet-600 dark:text-violet-400">Ask about your health, get reminders &amp; advice</p>
        </div>
        <span className="text-violet-400 text-2xl">›</span>
      </Link>

      {/* ── TODAY'S MEDICATIONS ───────────────────────────────── */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-6 py-4 border-b-2 border-slate-100 dark:border-slate-700 flex items-center gap-3">
          <Pill className="w-6 h-6 text-brand-500" />
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">Today's Medications</h2>
        </div>

        {!medData || medData.medications.length === 0 ? (
          <div className="p-8 text-center">
            <Pill className="w-12 h-12 text-slate-200 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-base text-slate-400">No medications scheduled</p>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setMedFilter('all')}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  medFilter === 'all'
                    ? 'bg-brand-500 text-white border-brand-500'
                    : 'border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-300'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setMedFilter('due')}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  medFilter === 'due'
                    ? 'bg-amber-500 text-white border-amber-500'
                    : 'border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-300'
                }`}
              >
                Due now
              </button>
              <button
                onClick={() => setMedFilter('pending')}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  medFilter === 'pending'
                    ? 'bg-violet-500 text-white border-violet-500'
                    : 'border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-300'
                }`}
              >
                Pending
              </button>
            </div>
            {medData.medications.map(med => (
              <div key={med.id} className="rounded-xl border-2 border-slate-100 dark:border-slate-700 overflow-hidden">
                {/* Med header */}
                <div className="bg-slate-50 dark:bg-slate-700/50 px-4 py-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center shrink-0">
                    <Pill className="w-5 h-5 text-brand-600" />
                  </div>
                  <div>
                    <p className="text-base font-bold text-slate-800 dark:text-slate-200">{med.name}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{med.dosage}</p>
                  </div>
                </div>

                {/* Dose times */}
                {med.times.map(time => {
                  const status     = isLogged(med.id, time);
                  const timeStatus = getMedStatus(time);
                  const isDue      = timeStatus === 'due';
                  const showDose =
                    medFilter === 'all' ||
                    (medFilter === 'due' && isDue && status === null) ||
                    (medFilter === 'pending' && status === null);

                  if (!showDose) return null;

                  return (
                    <div key={time} className={`px-4 py-3 flex items-center gap-3 border-t-2 border-slate-100 dark:border-slate-700 ${isDue && status === null ? 'bg-amber-50 dark:bg-amber-900/10' : ''}`}>
                      {/* Time label */}
                      <div className="text-center w-14 shrink-0">
                        <p className="text-lg font-bold text-slate-700 dark:text-slate-300 font-mono">{time}</p>
                        {isDue && status === null && (
                          <span className="text-[10px] font-bold text-amber-600 bg-amber-100 dark:bg-amber-900/30 px-1 rounded">DUE NOW</span>
                        )}
                        {timeStatus === 'upcoming' && status === null && (
                          <span className="text-[10px] text-slate-400">upcoming</span>
                        )}
                      </div>

                      {/* Status text */}
                      <div className="flex-1">
                        {status === true  && <p className="text-base font-semibold text-green-600">Taken</p>}
                        {status === false && <p className="text-base font-semibold text-red-500">Skipped</p>}
                        {status === null && isDue            && <p className="text-base font-semibold text-amber-600">Time to take!</p>}
                        {status === null && timeStatus === 'upcoming' && <p className="text-base text-slate-400">Upcoming</p>}
                        {status === null && timeStatus === 'passed'   && <p className="text-base text-slate-400">Missed</p>}
                      </div>

                      {/* Action buttons */}
                      {status === null && skipConfirm?.medId === med.id && skipConfirm?.time === time ? (
                        <div className="flex gap-2 shrink-0 items-center">
                          <p className="text-xs text-slate-500 dark:text-slate-400">Skip this dose?</p>
                          <button onClick={() => { handleLogMed(med.id, med.name, time, false); setSkipConfirm(null); }}
                            className="px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm font-bold hover:bg-red-200 active:scale-95 transition-all">
                            Yes, Skip
                          </button>
                          <button onClick={() => setSkipConfirm(null)}
                            className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-bold hover:bg-slate-200 active:scale-95 transition-all">
                            No
                          </button>
                        </div>
                      ) : status === null ? (
                        <div className="flex gap-2 shrink-0">
                          <button onClick={() => handleLogMed(med.id, med.name, time, true)}
                            className="px-4 py-2.5 rounded-xl bg-green-500 text-white text-sm font-bold hover:bg-green-600 active:scale-95 transition-all min-w-[80px]">
                            Taken
                          </button>
                          <button onClick={() => setSkipConfirm({ medId: med.id, medName: med.name, time })}
                            className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-95 transition-all">
                            Skip
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => handleLogMed(med.id, med.name, time, !status)}
                          className="text-xs text-slate-400 hover:text-slate-600 underline shrink-0 py-1 px-2">Undo</button>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}

            {/* Today's summary */}
            {medData.adherence.total > 0 && (
              <div className={`rounded-xl p-4 text-center ${
                medData.adherence.rate >= 80
                  ? 'bg-green-50 dark:bg-green-900/20 border-2 border-green-200'
                  : 'bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-200'
              }`}>
                <p className={`text-2xl font-bold ${medData.adherence.rate >= 80 ? 'text-green-700' : 'text-amber-700'}`}>
                  {medData.adherence.taken}/{medData.adherence.total} doses today
                </p>
                <p className={`text-sm mt-0.5 ${medData.adherence.rate >= 80 ? 'text-green-600' : 'text-amber-600'}`}>
                  {medData.adherence.rate >= 80 ? 'Great job today!' : 'Please take your remaining medications'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── MY VITALS ─────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-200 dark:border-slate-700 p-5">
        <div className="flex items-center gap-3 mb-5">
          <Activity className="w-6 h-6 text-brand-500" />
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">My Vitals</h2>
          {activeReading && (
            <span className="ml-auto text-sm text-slate-400">{format(new Date(activeReading.timestamp), 'MMM d, HH:mm')}</span>
          )}
        </div>
        {activeReading ? (
          <div className="grid grid-cols-2 gap-3">
            <VitalCard icon={Heart}       label="Heart Rate"     value={`${activeReading.heartRate}`} unit="bpm"
              alert={isAbnormalHR(activeReading.heartRate)}
              friendlyLabel={isAbnormalHR(activeReading.heartRate) ? 'Irregular — rest now' : 'Normal'}
              tip={isAbnormalHR(activeReading.heartRate) ? 'Rest and avoid stress' : 'Heart rate is healthy'} />
            <VitalCard icon={Activity}    label="Blood Pressure" value={`${activeReading.bloodPressure.systolic}/${activeReading.bloodPressure.diastolic}`} unit="mmHg"
              alert={isAbnormalBP(activeReading.bloodPressure.systolic)}
              friendlyLabel={isAbnormalBP(activeReading.bloodPressure.systolic) ? 'High — reduce salt' : 'Normal'}
              tip={isAbnormalBP(activeReading.bloodPressure.systolic) ? 'Rest and drink water' : 'Under control'} />
            <VitalCard icon={Wind}        label="Blood Oxygen"   value={`${activeReading.oxygenSaturation.toFixed(1)}`} unit="%"
              alert={isAbnormalO2(activeReading.oxygenSaturation)}
              friendlyLabel={isAbnormalO2(activeReading.oxygenSaturation) ? 'Low — breathe slowly' : 'Normal'} />
            <VitalCard icon={Moon}        label="Last Sleep"     value={`${activeReading.sleepHours.toFixed(1)}`} unit="hrs"
              alert={isAbnormalSleep(activeReading.sleepHours)}
              friendlyLabel={isAbnormalSleep(activeReading.sleepHours) ? 'Too little sleep' : 'Good sleep'} />
            <VitalCard icon={Thermometer} label="Temperature"    value={`${activeReading.temperature.toFixed(1)}`} unit="°C"
              alert={isAbnormalTemp(activeReading.temperature)}
              friendlyLabel={isAbnormalTemp(activeReading.temperature) ? 'Slight fever — rest' : 'Normal'} />
            <VitalCard icon={Zap}         label="Activity"       value={`${activeReading.movementScore.toFixed(0)}`} unit="/100"
              alert={false}
              friendlyLabel={activeReading.movementScore >= 50 ? 'Active — good job' : 'Try a short walk'}
              tip="Aim for a 30 min walk daily" />
          </div>
        ) : (
          <div className="text-center py-10 text-slate-400 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
            <Activity className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p className="text-base">No readings yet — your device will sync automatically</p>
          </div>
        )}
        {readings.length > 1 && (
          <div className="mt-4 border-t border-slate-100 dark:border-slate-700 pt-3">
            <button
              onClick={() => setShowTimeline((v) => !v)}
              className="w-full flex items-center justify-between text-sm font-semibold text-slate-600 dark:text-slate-300"
            >
              <span className="flex items-center gap-2"><Clock3 className="w-4 h-4" /> View recent vitals timeline</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${showTimeline ? 'rotate-180' : ''}`} />
            </button>
            {showTimeline && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {readings.slice(0, 8).map((r, idx) => (
                  <button
                    key={r.id}
                    onClick={() => setSelectedReadingIdx(idx)}
                    className={`text-left rounded-xl border px-3 py-2 transition-colors ${
                      idx === selectedReadingIdx
                        ? 'border-brand-400 bg-brand-50 dark:bg-brand-900/20'
                        : 'border-slate-200 dark:border-slate-600 hover:border-brand-300'
                    }`}
                  >
                    <p className="text-xs text-slate-500 dark:text-slate-400">{format(new Date(r.timestamp), 'MMM d, HH:mm')}</p>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mt-0.5">
                      HR {r.heartRate} bpm · O2 {r.oxygenSaturation.toFixed(1)}%
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── HEALTH STATUS ─────────────────────────────────────── */}
      {latestAssessment && (
        <div className={`rounded-2xl border-2 p-5 ${
          riskLevel === 'high'   ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700' :
          riskLevel === 'medium' ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700' :
          'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700'
        }`}>
          <div className="flex items-center gap-3 mb-4">
            <Shield className={`w-6 h-6 ${riskLevel === 'high' ? 'text-red-500' : riskLevel === 'medium' ? 'text-amber-500' : 'text-green-500'}`} />
            <h2 className={`text-xl font-bold ${riskLevel === 'high' ? 'text-red-700 dark:text-red-300' : riskLevel === 'medium' ? 'text-amber-700 dark:text-amber-300' : 'text-green-700 dark:text-green-300'}`}>
              {riskLevel === 'high' ? 'Health Alert' : riskLevel === 'medium' ? 'Watch These' : 'All Looking Good'}
            </h2>
          </div>
          {latestAssessment.recommendations.length > 0 && (
            <ul className="space-y-2">
              {latestAssessment.recommendations.map((r, i) => (
                <li key={i} className={`text-base flex items-start gap-2 ${riskLevel === 'high' ? 'text-red-700 dark:text-red-300' : riskLevel === 'medium' ? 'text-amber-700 dark:text-amber-300' : 'text-green-700 dark:text-green-300'}`}>
                  <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0" /> {r}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── MY PROFILE (editable) ─────────────────────────────── */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-200 dark:border-slate-700 p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <User className="w-6 h-6 text-brand-500" />
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">My Profile</h2>
          </div>
          {!editing ? (
            <button onClick={openEdit}
              className="flex items-center gap-2 text-sm font-semibold text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-800/50 px-4 py-2 rounded-xl hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors">
              <Edit3 className="w-4 h-4" /> Edit
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => setEditing(false)} className="flex items-center gap-1 text-sm text-slate-500 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 hover:bg-slate-50">
                <X className="w-4 h-4" /> Cancel
              </button>
              <button onClick={saveEdit} disabled={saving}
                className="flex items-center gap-1 text-sm text-white bg-brand-500 hover:bg-brand-600 disabled:opacity-60 px-4 py-2 rounded-xl">
                <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          )}
        </div>

        {saveMsg && (
          <div className={`mb-4 text-sm px-4 py-2.5 rounded-xl ${saveMsg.includes('Failed') ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
            {saveMsg}
          </div>
        )}

        {!editing ? (
          <div className="space-y-5">
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-500 to-teal-400 flex items-center justify-center text-white text-3xl font-bold shrink-0">
                {patient.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">{patient.name}</h3>
                <p className="text-base text-slate-500 mt-1">{patient.age} years old · {patient.gender}</p>
                <p className="text-base text-slate-500 flex items-center gap-1.5 mt-0.5">
                  <MapPin className="w-4 h-4 text-brand-400" /> {patient.location.city}, {patient.location.state}
                </p>
              </div>
            </div>

            {patient.conditions.length > 0 && (
              <div>
                <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">My Conditions</p>
                <div className="flex flex-wrap gap-2">{patient.conditions.map(c => <ConditionPill key={c} color="teal">{c}</ConditionPill>)}</div>
              </div>
            )}

            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 border-2 border-slate-100 dark:border-slate-600">
              <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <PhoneCall className="w-4 h-4" /> Emergency Contact
              </p>
              <p className="text-lg font-bold text-slate-800 dark:text-slate-200">{patient.caregiver.name}</p>
              <p className="text-base text-slate-500 mt-0.5">{patient.caregiver.relationship}</p>
              <a href={`tel:${patient.caregiver.phone}`}
                className="mt-2 inline-flex items-center gap-2 text-base text-brand-600 dark:text-brand-400 font-semibold">
                <Phone className="w-4 h-4" /> {patient.caregiver.phone}
              </a>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { label: 'Full Name', val: editName,  set: setEditName,  type: 'text'   },
                { label: 'Age',       val: editAge,   set: setEditAge,   type: 'number' },
                { label: 'City',      val: editCity,  set: setEditCity,  type: 'text'   },
                { label: 'State',     val: editState, set: setEditState, type: 'text'   },
              ].map(({ label, val, set, type }) => (
                <div key={label}>
                  <label className="text-sm font-bold text-slate-600 dark:text-slate-400 block mb-1.5">{label}</label>
                  <input type={type} value={val} onChange={e => set(e.target.value)}
                    className="w-full border-2 border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 text-base bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand-500" />
                </div>
              ))}
              <div>
                <label className="text-sm font-bold text-slate-600 dark:text-slate-400 block mb-1.5">Gender</label>
                <select value={editGender} onChange={e => setEditGender(e.target.value)}
                  className="w-full border-2 border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 text-base bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand-500">
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
            </div>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider pt-2 border-t-2 border-slate-100 dark:border-slate-700">Emergency Contact</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: 'Name',         val: editCgName,  set: setEditCgName  },
                { label: 'Phone',        val: editCgPhone, set: setEditCgPhone },
                { label: 'Relationship', val: editCgRel,   set: setEditCgRel   },
              ].map(({ label, val, set }) => (
                <div key={label}>
                  <label className="text-sm font-bold text-slate-600 dark:text-slate-400 block mb-1.5">{label}</label>
                  <input value={val} onChange={e => set(e.target.value)}
                    className="w-full border-2 border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 text-base bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand-500" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── QUICK LINKS ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4">
        <Link href="/hospitals"
          className="flex flex-col items-center gap-2 p-5 rounded-2xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 hover:border-brand-300 hover:bg-brand-50 dark:hover:bg-brand-900/20 active:scale-95 transition-all text-center">
          <MapPin className="w-8 h-8 text-brand-500" />
          <p className="text-base font-bold text-slate-700 dark:text-slate-300">Nearby Hospitals</p>
        </Link>
        <Link href="/medications"
          className="flex flex-col items-center gap-2 p-5 rounded-2xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 hover:border-brand-300 hover:bg-brand-50 dark:hover:bg-brand-900/20 active:scale-95 transition-all text-center">
          <Pill className="w-8 h-8 text-brand-500" />
          <p className="text-base font-bold text-slate-700 dark:text-slate-300">Medications</p>
        </Link>
      </div>

    </div>
  );
}
