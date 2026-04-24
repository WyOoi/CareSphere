'use client';

import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, CheckCircle, Clock, Zap, FileText, MapPin, Phone, RefreshCw } from 'lucide-react';
import { api, RiskAssessment } from '@/lib/api';
import RiskBadge from '@/components/ui/RiskBadge';
import { format, isValid } from 'date-fns';

type RiskFilter = 'all' | 'high' | 'medium' | 'low';
type DateFilter = 'today' | 'week' | 'all';

function normalizeTimestamp(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return isValid(value) ? value : null;

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return isValid(parsed) ? parsed : null;
  }

  if (typeof value === 'object' && value !== null) {
    const withToDate = value as { toDate?: () => Date };
    if (typeof withToDate.toDate === 'function') {
      const parsed = withToDate.toDate();
      return isValid(parsed) ? parsed : null;
    }

    const ts = value as { _seconds?: number; seconds?: number; _nanoseconds?: number; nanoseconds?: number };
    const seconds = ts._seconds ?? ts.seconds;
    const nanos = ts._nanoseconds ?? ts.nanoseconds ?? 0;
    if (typeof seconds === 'number') {
      const parsed = new Date(seconds * 1000 + Math.floor(nanos / 1e6));
      return isValid(parsed) ? parsed : null;
    }
  }

  return null;
}

export default function AlertsPage() {
  const [assessments, setAssessments] = useState<RiskAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('high');
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');

  const fetchAssessments = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getAllAssessments();
      setAssessments(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAssessments();
    const iv = setInterval(fetchAssessments, 15000);
    return () => clearInterval(iv);
  }, [fetchAssessments]);

  const today   = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

  const dateFiltered = assessments.filter((a) => {
    const ts = normalizeTimestamp(a.timestamp);
    if (!ts) return false;
    if (dateFilter === 'today') return ts.toISOString().startsWith(today);
    if (dateFilter === 'week')  return ts.toISOString() >= weekAgo;
    return true;
  });

  const filtered  = dateFiltered.filter((a) => riskFilter === 'all' || a.riskLevel === riskFilter);
  const highCount = dateFiltered.filter((a) => a.riskLevel === 'high').length;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Alert Centre</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Autonomous AI agent actions & risk assessments
          </p>
        </div>
        <button onClick={fetchAssessments}
          className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* High-risk banner — only for today */}
      {highCount > 0 && dateFilter === 'today' && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/40 flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5 text-red-600 animate-pulse" />
            </div>
            <div>
              <p className="font-bold text-red-700 dark:text-red-400">
                {highCount} HIGH RISK Alert{highCount > 1 ? 's' : ''} Today
              </p>
              <p className="text-sm text-red-600/80 dark:text-red-400/80">
                CareSphere AI has autonomously alerted caregivers and identified nearby hospitals.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Date filter */}
        <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
          {([
            { key: 'today', label: 'Today' },
            { key: 'week',  label: 'This Week' },
            { key: 'all',   label: 'All Time' },
          ] as const).map(({ key, label }) => (
            <button key={key} onClick={() => setDateFilter(key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                dateFilter === key
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}>
              {label}
            </button>
          ))}
        </div>

        {/* Risk level filter */}
        <div className="flex gap-2 flex-wrap">
          {(['all', 'high', 'medium', 'low'] as const).map((f) => {
            const count = f === 'all' ? dateFiltered.length : dateFiltered.filter((a) => a.riskLevel === f).length;
            const activeColors = {
              all:    'bg-slate-700 text-white border-slate-700',
              high:   'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800',
              medium: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800',
              low:    'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800',
            };
            return (
              <button key={f} onClick={() => setRiskFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all capitalize ${
                  riskFilter === f ? activeColors[f] : 'text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}>
                {f} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Alerts List */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading alerts…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <CheckCircle className="w-12 h-12 text-green-300 mx-auto mb-3" />
          <p className="text-slate-500 dark:text-slate-400">
            No {riskFilter !== 'all' ? riskFilter + ' risk ' : ''}alerts{dateFilter === 'today' ? ' today' : dateFilter === 'week' ? ' this week' : ''}
          </p>
          <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">
            {dateFilter === 'today'
              ? 'Try "This Week" or "All Time" to see historical alerts'
              : 'Run a simulation from the dashboard to generate alerts'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((assessment) => (
            <AlertCard key={assessment.id} assessment={assessment} />
          ))}
        </div>
      )}
    </div>
  );
}

function AlertCard({ assessment }: { assessment: RiskAssessment }) {
  const [expanded, setExpanded] = useState(false);
  const isHigh   = assessment.riskLevel === 'high';
  const isMedium = assessment.riskLevel === 'medium';

  return (
    <div className={`bg-white dark:bg-slate-800 rounded-xl border shadow-card p-4 transition-all ${
      isHigh ? 'border-red-200 dark:border-red-800' : isMedium ? 'border-amber-200 dark:border-amber-800' : 'border-slate-200 dark:border-slate-700'
    }`}>
      <div className="flex items-start justify-between gap-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-start gap-3 flex-1">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
            isHigh ? 'bg-red-50 dark:bg-red-900/20' : isMedium ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-green-50 dark:bg-green-900/20'
          }`}>
            {isHigh   ? <AlertTriangle className="w-4 h-4 text-red-600" /> :
             isMedium ? <Clock className="w-4 h-4 text-amber-600" /> :
                        <CheckCircle className="w-4 h-4 text-green-600" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                Patient ID: {assessment.patientId.replace('patient-', 'P-')}
              </p>
              <RiskBadge level={assessment.riskLevel} score={assessment.riskScore} size="sm" />
              {isHigh && (
                <span className="text-xs bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Zap className="w-3 h-3" /> Agent Actions Triggered
                </span>
              )}
            </div>
            <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">
              {(() => {
                const ts = normalizeTimestamp(assessment.timestamp);
                return ts ? format(ts, 'dd MMM yyyy, HH:mm:ss') : 'Invalid timestamp';
              })()}
            </p>
            <p className="text-slate-600 dark:text-slate-300 text-sm mt-2 line-clamp-2">{assessment.geminiReasoning}</p>
          </div>
        </div>
        <span className="text-slate-400 text-sm shrink-0">{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div className="mt-4 space-y-4 border-t border-slate-100 dark:border-slate-700 pt-4 animate-slide-up">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">Risk Factors</p>
            <ul className="space-y-1">
              {assessment.reasons.map((r, i) => (
                <li key={i} className="text-sm text-slate-600 dark:text-slate-300 flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">•</span> {r}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">AI Recommendations</p>
            <ul className="space-y-1">
              {assessment.recommendations.map((r, i) => (
                <li key={i} className="text-sm text-slate-600 dark:text-slate-300 flex items-start gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-green-600 shrink-0 mt-0.5" /> {r}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">Vitals at Alert Time</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Heart Rate',     value: `${assessment.healthReading.heartRate} bpm` },
                { label: 'Blood Pressure', value: `${assessment.healthReading.bloodPressure.systolic}/${assessment.healthReading.bloodPressure.diastolic}` },
                { label: 'O₂ Saturation',  value: `${assessment.healthReading.oxygenSaturation.toFixed(1)}%` },
                { label: 'Sleep',          value: `${assessment.healthReading.sleepHours.toFixed(1)} hrs` },
                { label: 'Movement',       value: `${assessment.healthReading.movementScore.toFixed(0)}/100` },
                { label: 'Temperature',    value: `${assessment.healthReading.temperature.toFixed(1)}°C` },
              ].map(({ label, value }) => (
                <div key={label} className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-2 text-center border border-slate-100 dark:border-slate-600">
                  <p className="text-slate-900 dark:text-slate-100 text-sm font-semibold">{value}</p>
                  <p className="text-slate-500 dark:text-slate-400 text-xs">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {(isHigh || isMedium) && (
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">Autonomous Agent Actions</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded-lg px-3 py-2">
                  <Phone className="w-4 h-4" /> Caregiver alert sent via SMS & Email
                </div>
                <div className="flex items-center gap-2 text-sm text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/20 rounded-lg px-3 py-2">
                  <FileText className="w-4 h-4" /> Medical summary generated and stored
                </div>
                {isHigh && (
                  <div className="flex items-center gap-2 text-sm text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 rounded-lg px-3 py-2">
                    <MapPin className="w-4 h-4" /> Nearby hospitals identified and queued
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
