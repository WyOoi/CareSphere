'use client';

import { useState, useEffect, useCallback } from 'react';
import { Pill, Check, X, AlertTriangle, TrendingUp, ChevronRight, RefreshCw, Plus, Clock, Users } from 'lucide-react';
import { api, Patient, MedicationData } from '@/lib/api';

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.split(';').map(c => c.trim()).find(c => c.startsWith(name + '='));
  return match ? decodeURIComponent(match.split('=')[1]) : null;
}

interface PatientAdherence {
  patient: Patient;
  adherence: { total: number; taken: number; rate: number };
  medicationCount: number;
}

export default function MedicationsPage() {
  const [patientMode, setPatientMode] = useState(false);
  const [overview, setOverview] = useState<PatientAdherence[]>([]);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [selected, setSelected] = useState<Patient | null>(null);
  const [medData, setMedData] = useState<MedicationData | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMed, setNewMed] = useState({ name: '', dosage: '1 tablet', times: ['08:00'] });

  const today = new Date().toISOString().split('T')[0];

  // Load adherence overview for all monitored patients
  const loadOverview = useCallback(async () => {
    setLoadingOverview(true);
    try {
      const myId = readCookie('cs_patient_id');
      if (myId) {
        // Patient mode — fetch only own record, never the full patient list
        setPatientMode(true);
        const [me, data] = await Promise.all([
          api.getPatient(myId),
          api.getMedications(myId).catch(() => ({ medications: [], adherence: { total: 0, taken: 0, rate: 0 }, todayLogs: [] })),
        ]);
        setOverview([{ patient: me, adherence: data.adherence, medicationCount: data.medications.length }]);
        setSelected(me);
        setMedData(data);
        setLoadingOverview(false);
        return;
      }
      const patients = await api.getPatients();
      // Only load for first 30 to avoid hammering the backend
      const sample = patients.slice(0, 30);
      const rows = await Promise.all(
        sample.map(async (p) => {
          try {
            const data = await api.getMedications(p.id);
            return { patient: p, adherence: data.adherence, medicationCount: data.medications.length };
          } catch {
            return { patient: p, adherence: { total: 0, taken: 0, rate: 0 }, medicationCount: 0 };
          }
        })
      );
      // Sort: worst adherence first, then patients with meds before those without
      rows.sort((a, b) => {
        if (a.adherence.total === 0 && b.adherence.total === 0) return 0;
        if (a.adherence.total === 0) return 1;
        if (b.adherence.total === 0) return -1;
        return a.adherence.rate - b.adherence.rate;
      });
      setOverview(rows);
    } finally {
      setLoadingOverview(false);
    }
  }, []);

  useEffect(() => { loadOverview(); }, [loadOverview]);

  const openPatient = async (patient: Patient) => {
    setSelected(patient);
    setMedData(null);
    setLoadingDetail(true);
    try {
      const data = await api.getMedications(patient.id);
      setMedData(data);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleAddMed = async () => {
    if (!selected || !newMed.name) return;
    await api.addMedication(selected.id, {
      name: newMed.name,
      dosage: newMed.dosage,
      times: newMed.times.filter(Boolean),
    });
    setNewMed({ name: '', dosage: '1 tablet', times: ['08:00'] });
    setShowAddForm(false);
    const data = await api.getMedications(selected.id);
    setMedData(data);
  };

  const handleLog = async (medId: string, medName: string, time: string, taken: boolean) => {
    if (!selected) return;
    await api.logMedication(selected.id, { medicationId: medId, medicationName: medName, scheduledTime: time, date: today, taken });
    const data = await api.getMedications(selected.id);
    setMedData(data);
  };

  const isLogged = (medId: string, time: string): boolean | null => {
    const log = medData?.todayLogs.find((l) => l.medicationId === medId && l.scheduledTime === time);
    return log ? log.taken : null;
  };

  const criticalCount = overview.filter((r) => r.adherence.total > 0 && r.adherence.rate < 60).length;
  const warningCount  = overview.filter((r) => r.adherence.total > 0 && r.adherence.rate >= 60 && r.adherence.rate < 80).length;
  const goodCount     = overview.filter((r) => r.adherence.rate >= 80).length;

  return (
    <div className="space-y-5 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Pill className="w-6 h-6 text-brand-500" />
            {patientMode ? 'My Medications' : 'Medication Adherence'}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            {patientMode
              ? 'Your daily medication schedule and today\'s dose log'
              : 'Monitor which patients are missing their medications — flag and act on poor adherence'}
          </p>
        </div>
        <button onClick={loadOverview} className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-700 transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Summary cards — admin only */}
      {!patientMode && <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Poor Adherence',    value: criticalCount, sub: '< 60% — needs review', color: 'text-red-600',   bg: 'bg-red-50 dark:bg-red-900/20',    icon: AlertTriangle },
          { label: 'At Risk',           value: warningCount,  sub: '60–80% — monitor closely', color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20', icon: Clock },
          { label: 'Good Adherence',    value: goodCount,     sub: '≥ 80% — on track',     color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20', icon: Check },
        ].map(({ label, value, sub, color, bg, icon: Icon }) => (
          <div key={label} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-card p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
              <div className={`w-7 h-7 rounded-lg ${bg} flex items-center justify-center`}>
                <Icon className={`w-3.5 h-3.5 ${color}`} />
              </div>
            </div>
            <p className={`text-3xl font-bold ${color}`}>{value}</p>
            <p className="text-[11px] text-slate-400 mt-1">{sub}</p>
          </div>
        ))}
      </div>}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-5">

        {/* Patient adherence table — admin only */}
        {!patientMode && <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-card overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <h2 className="font-semibold text-slate-800 dark:text-slate-200 text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-brand-500" /> Patient Adherence Overview
            </h2>
            <span className="text-xs text-slate-400">{overview.length} patients</span>
          </div>

          {loadingOverview ? (
            <div className="text-center py-12 text-slate-400 text-sm">Loading adherence data…</div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700 max-h-[calc(100vh-24rem)] overflow-y-auto">
              {overview.map(({ patient, adherence, medicationCount }) => {
                const rate    = adherence.rate;
                const hasMeds = adherence.total > 0;
                const color   = !hasMeds ? 'text-slate-400' : rate >= 80 ? 'text-green-600' : rate >= 60 ? 'text-amber-600' : 'text-red-600';
                const barColor = !hasMeds ? 'bg-slate-200' : rate >= 80 ? 'bg-green-500' : rate >= 60 ? 'bg-amber-400' : 'bg-red-500';
                const isSelected = selected?.id === patient.id;

                return (
                  <button
                    key={patient.id}
                    onClick={() => openPatient(patient)}
                    className={`w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors ${isSelected ? 'bg-brand-50 dark:bg-brand-900/10' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {!hasMeds || rate < 60 ? (
                            <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                          ) : rate < 80 ? (
                            <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          ) : (
                            <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />
                          )}
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{patient.name}</p>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5 pl-5">
                          {patient.age}y · {patient.location.city} · {medicationCount} medication{medicationCount !== 1 ? 's' : ''}
                        </p>
                        {hasMeds && (
                          <div className="mt-1.5 pl-5">
                            <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden w-full max-w-[180px]">
                              <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${rate}%` }} />
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-bold ${color}`}>
                          {hasMeds ? `${rate}%` : 'No data'}
                        </p>
                        {hasMeds && (
                          <p className="text-[10px] text-slate-400">{adherence.taken}/{adherence.total} doses</p>
                        )}
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>}

        {/* Patient detail panel */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-card overflow-hidden flex flex-col">
          {!selected ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <Pill className="w-10 h-10 text-slate-200 dark:text-slate-600 mb-3" />
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Select a patient</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">to view their medication schedule and log today's doses</p>
            </div>
          ) : (
            <>
              {/* Detail header */}
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm">{selected.name}</p>
                    <p className="text-[11px] text-slate-400">{selected.age}y · {selected.conditions[0]}</p>
                  </div>
                  {medData && (
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                      medData.adherence.rate >= 80 ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' :
                      medData.adherence.rate >= 60 ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400' :
                      'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                    }`}>
                      {medData.adherence.rate}% adherence
                    </span>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {loadingDetail ? (
                  <p className="text-sm text-slate-400 text-center py-8">Loading…</p>
                ) : medData?.medications.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-8">No medications on record</p>
                ) : (
                  medData?.medications.map((med) => (
                    <div key={med.id} className="border border-slate-100 dark:border-slate-700 rounded-xl overflow-hidden">
                      <div className="bg-slate-50 dark:bg-slate-700/50 px-3 py-2 flex items-center gap-2">
                        <Pill className="w-3.5 h-3.5 text-brand-500" />
                        <div>
                          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{med.name}</p>
                          <p className="text-[10px] text-slate-400">{med.dosage}</p>
                        </div>
                      </div>
                      {med.times.map((time) => {
                        const status = isLogged(med.id, time);
                        return (
                          <div key={time} className="px-3 py-2 flex items-center gap-2 border-t border-slate-100 dark:border-slate-700">
                            <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="text-xs font-mono text-slate-600 dark:text-slate-300 flex-1">{time}</span>
                            {status === true  && <span className="text-[10px] text-green-600 font-medium">✓ Taken</span>}
                            {status === false && <span className="text-[10px] text-red-500 font-medium">✗ Missed</span>}
                            <div className="flex gap-1">
                              <button onClick={() => handleLog(med.id, med.name, time, true)}
                                disabled={status === true}
                                className="p-1 rounded bg-green-50 dark:bg-green-900/20 text-green-600 hover:bg-green-100 disabled:opacity-40 transition-colors">
                                <Check className="w-3 h-3" />
                              </button>
                              <button onClick={() => handleLog(med.id, med.name, time, false)}
                                disabled={status === false}
                                className="p-1 rounded bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-100 disabled:opacity-40 transition-colors">
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))
                )}

                {/* Add medication */}
                {!showAddForm ? (
                  <button onClick={() => setShowAddForm(true)}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-xs text-slate-400 hover:text-brand-600 hover:border-brand-300 transition-colors">
                    <Plus className="w-3.5 h-3.5" /> Add Medication
                  </button>
                ) : (
                  <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-200 dark:border-slate-700">
                    <input type="text" placeholder="Name (e.g. Metformin 500mg)" value={newMed.name}
                      onChange={(e) => setNewMed({ ...newMed, name: e.target.value })}
                      className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-2.5 py-1.5 text-xs bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-500" />
                    <input type="text" placeholder="Dosage (e.g. 1 tablet)" value={newMed.dosage}
                      onChange={(e) => setNewMed({ ...newMed, dosage: e.target.value })}
                      className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-2.5 py-1.5 text-xs bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-500" />
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Dose Times</p>
                      {newMed.times.map((t, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <input
                            type="time"
                            value={t}
                            onChange={(e) => {
                              const updated = [...newMed.times];
                              updated[i] = e.target.value;
                              setNewMed({ ...newMed, times: updated });
                            }}
                            className="flex-1 border border-slate-200 dark:border-slate-600 rounded-lg px-2.5 py-1.5 text-xs bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
                          />
                          {newMed.times.length > 1 && (
                            <button
                              onClick={() => setNewMed({ ...newMed, times: newMed.times.filter((_, j) => j !== i) })}
                              className="text-red-400 hover:text-red-600 p-1">
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      ))}
                      {newMed.times.length < 4 && (
                        <button
                          onClick={() => setNewMed({ ...newMed, times: [...newMed.times, '12:00'] })}
                          className="text-[10px] text-brand-600 hover:underline flex items-center gap-1">
                          <Plus className="w-3 h-3" /> Add another time
                        </button>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleAddMed} className="flex-1 py-1.5 bg-brand-600 text-white text-xs rounded-lg font-medium hover:bg-brand-700 transition-colors">Save</button>
                      <button onClick={() => setShowAddForm(false)} className="flex-1 py-1.5 border border-slate-200 dark:border-slate-600 text-slate-500 text-xs rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">Cancel</button>
                    </div>
                  </div>
                )}
              </div>

              {/* TrendingUp indicator */}
              {medData && medData.adherence.rate < 80 && (
                <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-700 bg-amber-50 dark:bg-amber-900/10">
                  <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-xs font-medium">
                    <TrendingUp className="w-3.5 h-3.5" />
                    Flag for medication review at next consultation
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
