'use client';

import { useState, useEffect, useCallback } from 'react';
import { Users, Heart, AlertTriangle, Phone, Mail, Activity, Pill, RefreshCw } from 'lucide-react';
import { api, DashboardStats } from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';

export default function CaregiverPage() {
  const { t } = useLanguage();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchData = useCallback(async () => {
    try {
      const data = await api.getDashboardStats();
      setStats(data);
      setLastUpdate(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const riskColor = (level: string) => ({
    high: 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
    medium: 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
    low: 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
  }[level] || 'text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-500 rounded-full animate-spin" />
      </div>
    );
  }

  const highRiskPatients = stats?.patientsWithReadings.filter(
    (p) => p.latestAssessment?.riskLevel === 'high'
  ) || [];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{t.caregiver}</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">Family & caregiver overview — all patients at a glance</p>
        </div>
        <div className="flex items-center gap-2">
          <p className="text-slate-400 dark:text-slate-500 text-xs">Updated {lastUpdate.toLocaleTimeString()}</p>
          <button onClick={fetchData}
            className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Urgent Alerts */}
      {highRiskPatients.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-5">
          <h2 className="text-sm font-bold text-red-700 dark:text-red-400 flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 animate-pulse" />
            URGENT — Immediate Attention Required
          </h2>
          <div className="space-y-2">
            {highRiskPatients.map(({ patient, latestAssessment }) => (
              <div key={patient.id} className="bg-white dark:bg-slate-800 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-red-700 dark:text-red-400">{patient.name}</p>
                    <p className="text-xs text-red-500 dark:text-red-400/70">{patient.age} yrs · {patient.location.city}</p>
                  </div>
                  <span className="text-xs font-bold text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-2 py-0.5 rounded-full border border-red-200 dark:border-red-800">
                    Score: {latestAssessment?.riskScore}/100
                  </span>
                </div>
                {latestAssessment && (
                  <p className="text-xs text-red-600 dark:text-red-400/80 mt-2 line-clamp-2">{latestAssessment.geminiReasoning}</p>
                )}
                <div className="mt-2 flex gap-2">
                  <a href={`tel:${patient.caregiver.phone}`}
                    className="flex items-center gap-1 text-xs text-green-700 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 transition-colors">
                    <Phone className="w-3 h-3" /> {patient.caregiver.phone}
                  </a>
                  <a href={`mailto:${patient.caregiver.email}`}
                    className="flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors">
                    <Mail className="w-3 h-3" /> {patient.caregiver.email}
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-card p-5">
          <Users className="w-5 h-5 text-brand-500 mb-2" />
          <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">{stats?.totalPatients || 0}</p>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{t.totalPatients}</p>
        </div>
        <div className={`bg-white dark:bg-slate-800 rounded-xl border shadow-card p-5 ${(stats?.highRiskCount || 0) > 0 ? 'border-red-200 dark:border-red-800' : 'border-slate-200 dark:border-slate-700'}`}>
          <AlertTriangle className={`w-5 h-5 mb-2 ${(stats?.highRiskCount || 0) > 0 ? 'text-red-600 animate-pulse' : 'text-slate-300 dark:text-slate-600'}`} />
          <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">{stats?.highRiskCount || 0}</p>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{t.highRisk}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-card p-5">
          <Activity className="w-5 h-5 text-amber-500 mb-2" />
          <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">{stats?.mediumRiskCount || 0}</p>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{t.mediumRisk}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-card p-5">
          <Heart className="w-5 h-5 text-teal-600 mb-2" />
          <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">{stats?.alertsToday || 0}</p>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{t.assessmentsToday}</p>
        </div>
      </div>

      {/* All Patients Detail */}
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-teal-600" />
          All Patients Under Care
        </h2>
        <div className="space-y-4">
          {stats?.patientsWithReadings.map(({ patient, latestReading, latestAssessment, adherenceRate }) => {
            const riskLevel = latestAssessment?.riskLevel || 'low';
            return (
              <div key={patient.id} className={`bg-white dark:bg-slate-800 rounded-xl border shadow-card p-5 transition-all hover:scale-[1.002] ${riskColor(riskLevel)}`}>
                <div className="flex items-start gap-4 flex-wrap">
                  {/* Patient Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <h3 className="font-bold text-slate-900 dark:text-slate-100 text-lg">{patient.name}</h3>
                      {latestAssessment && (
                        <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full border ${riskColor(riskLevel)}`}>
                          {riskLevel} risk · {latestAssessment.riskScore}/100
                        </span>
                      )}
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">{patient.age} years · {patient.gender} · {patient.location.city}, {patient.location.state}</p>
                    <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">{patient.conditions.join(' · ')}</p>
                  </div>

                  {/* Caregiver Contact */}
                  <div className="text-right">
                    <p className="text-xs text-slate-600 dark:text-slate-300 font-semibold">{patient.caregiver.name}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">{patient.caregiver.relationship}</p>
                    <a href={`tel:${patient.caregiver.phone}`}
                      className="text-xs text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 flex items-center gap-1 justify-end mt-1 transition-colors">
                      <Phone className="w-3 h-3" /> {patient.caregiver.phone}
                    </a>
                  </div>
                </div>

                {/* Vitals Row */}
                {latestReading && (
                  <div className="mt-4 grid grid-cols-3 md:grid-cols-6 gap-2">
                    {[
                      { label: 'HR', value: `${latestReading.heartRate}bpm`, alert: latestReading.heartRate > 100 || latestReading.heartRate < 50 },
                      { label: 'BP', value: `${latestReading.bloodPressure.systolic}/${latestReading.bloodPressure.diastolic}`, alert: latestReading.bloodPressure.systolic > 160 },
                      { label: 'O₂', value: `${latestReading.oxygenSaturation.toFixed(1)}%`, alert: latestReading.oxygenSaturation < 95 },
                      { label: 'Sleep', value: `${latestReading.sleepHours.toFixed(1)}h`, alert: latestReading.sleepHours < 5 },
                      { label: 'Move', value: `${latestReading.movementScore.toFixed(0)}/100`, alert: latestReading.movementScore < 30 },
                      { label: 'Temp', value: `${latestReading.temperature.toFixed(1)}°C`, alert: latestReading.temperature > 37.8 },
                    ].map(({ label, value, alert }) => (
                      <div key={label} className={`text-center p-2 rounded-lg border ${alert ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : 'bg-slate-50 dark:bg-slate-700/50 border-slate-100 dark:border-slate-600'}`}>
                        <p className={`text-sm font-bold ${alert ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-slate-100'}`}>{value}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">{label}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Medication Adherence + AI Reasoning */}
                <div className="mt-4 flex gap-4 flex-wrap">
                  {adherenceRate !== undefined && (
                    <div className="flex items-center gap-2">
                      <Pill className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                      <span className="text-xs text-slate-500 dark:text-slate-400">{t.adherenceRate}:</span>
                      <span className={`text-xs font-bold ${adherenceRate >= 80 ? 'text-green-700 dark:text-green-400' : adherenceRate >= 60 ? 'text-amber-700 dark:text-amber-400' : 'text-red-700 dark:text-red-400'}`}>
                        {adherenceRate}%
                      </span>
                    </div>
                  )}
                  {latestAssessment && (
                    <p className="text-xs text-slate-400 dark:text-slate-500 italic flex-1 line-clamp-2">
                      {latestAssessment.geminiReasoning}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
