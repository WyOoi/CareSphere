'use client';

import { useState, useEffect } from 'react';
import { MapPin, Phone, AlertTriangle, Building2, Ambulance, ChevronDown, ExternalLink, Clock, RefreshCw } from 'lucide-react';
import { api, HospitalData, Patient, RiskAssessment } from '@/lib/api';
import dynamic from 'next/dynamic';

interface HighRiskPatient {
  patient: Patient;
  assessment: RiskAssessment;
}

const HospitalMap = dynamic(() => import('@/components/HospitalMap'), { ssr: false });

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.split(';').map(c => c.trim()).find(c => c.startsWith(name + '='));
  return match ? decodeURIComponent(match.split('=')[1]) : null;
}

export default function HospitalsPage() {
  // Role detection
  const [isPatient, setIsPatient] = useState(false);
  const [myPatientId, setMyPatientId] = useState<string | null>(null);

  // Admin-only state
  const [highRiskPatients, setHighRiskPatients] = useState<HighRiskPatient[]>([]);
  const [allPatients, setAllPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');

  // Shared state
  const [hospitalData, setHospitalData] = useState<HospitalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [hospitalLoading, setHospitalLoading] = useState(false);

  // Detect role on mount
  useEffect(() => {
    const pid = readCookie('cs_patient_id');
    if (pid) {
      setIsPatient(true);
      setMyPatientId(pid);
    }
  }, []);

  // Patient mode: load hospitals for own location automatically
  useEffect(() => {
    if (!isPatient || !myPatientId) return;
    setLoading(false);
    setHospitalLoading(true);
    setHospitalData(null);
    api.getHospitals(myPatientId)
      .then(setHospitalData)
      .catch(console.error)
      .finally(() => setHospitalLoading(false));
  }, [isPatient, myPatientId]);

  // Admin mode: load all patients + high-risk list
  const loadAdminData = async () => {
    if (isPatient) return;
    setLoading(true);
    try {
      const [patients, assessments] = await Promise.all([
        api.getPatients(),
        api.getAllAssessments(),
      ]);
      setAllPatients(patients);

      const seen = new Set<string>();
      const highRisk: HighRiskPatient[] = [];
      for (const a of assessments) {
        if (a.riskLevel === 'high' && !seen.has(a.patientId)) {
          const patient = patients.find((p) => p.id === a.patientId);
          if (patient) {
            seen.add(a.patientId);
            highRisk.push({ patient, assessment: a });
          }
        }
        if (highRisk.length >= 8) break;
      }
      setHighRiskPatients(highRisk);

      const defaultId = highRisk[0]?.patient.id || patients[0]?.id || '';
      setSelectedPatientId(defaultId);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isPatient) loadAdminData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPatient]);

  // Admin: load hospital data when selected patient changes
  useEffect(() => {
    if (isPatient || !selectedPatientId) return;
    setHospitalLoading(true);
    setHospitalData(null);
    api.getHospitals(selectedPatientId)
      .then(setHospitalData)
      .catch(console.error)
      .finally(() => setHospitalLoading(false));
  }, [isPatient, selectedPatientId]);

  const selectedPatient = allPatients.find((p) => p.id === selectedPatientId);
  const selectedRisk    = highRiskPatients.find((r) => r.patient.id === selectedPatientId);
  const mapCenter: [number, number] = hospitalData?.patientLocation?.lat && hospitalData?.patientLocation?.lng
    ? [hospitalData.patientLocation.lat, hospitalData.patientLocation.lng]
    : hospitalData?.hospitals?.[0]?.lat && hospitalData?.hospitals?.[0]?.lng
      ? [hospitalData.hospitals[0].lat, hospitalData.hospitals[0].lng]
      : [3.1390, 101.6869];

  // ── PATIENT VIEW ─────────────────────────────────────────────────────────────
  if (isPatient) {
    return (
      <div className="space-y-5 animate-fade-in max-w-2xl mx-auto">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Ambulance className="w-6 h-6 text-red-500" />
            Nearby Hospitals
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Hospitals near your location — ready to help you anytime
          </p>
        </div>

        {/* Emergency banner */}
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-900/40 flex items-center justify-center shrink-0">
            <Phone className="w-6 h-6 text-red-600" />
          </div>
          <div className="flex-1">
            <p className="text-base font-bold text-red-700 dark:text-red-400">Emergency: Call 999</p>
            <p className="text-sm text-red-600/80 dark:text-red-400/80">For life-threatening emergencies, call immediately</p>
          </div>
          <a href="tel:999"
            className="shrink-0 px-5 py-3 bg-red-600 text-white text-sm font-bold rounded-xl hover:bg-red-700 transition-colors">
            Call 999
          </a>
        </div>

        {hospitalLoading ? (
          <div className="text-center py-16 text-slate-400 text-lg">Finding hospitals near you…</div>
        ) : hospitalData ? (
          <>
            {/* Recommended banner */}
            <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-700 rounded-2xl p-4">
              <p className="text-sm font-bold text-teal-700 dark:text-teal-400">
                ✓ Recommended: {hospitalData.recommendedHospital}
              </p>
              <p className="text-sm text-teal-600/80 dark:text-teal-400/80 mt-0.5">
                Estimated travel time: {hospitalData.estimatedTravelTime}
              </p>
            </div>

            {/* Hospital cards — patient-safe, no other patient data */}
            <div className="space-y-3">
              {hospitalData.hospitals.map((hospital, idx) => (
                <div key={hospital.id} className={`bg-white dark:bg-slate-800 rounded-2xl border shadow-sm p-5 ${
                  idx === 0 ? 'border-teal-300 dark:border-teal-700' : 'border-slate-200 dark:border-slate-700'
                }`}>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      {idx === 0 && (
                        <span className="text-xs font-bold bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-700 px-2.5 py-1 rounded-full mb-2 inline-block">
                          ⭐ Nearest &amp; Recommended
                        </span>
                      )}
                      <p className="text-base font-bold text-slate-900 dark:text-slate-100">{hospital.name}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{hospital.address}, {hospital.city}</p>
                    </div>
                    {hospital.emergencyAvailable && (
                      <span className="text-xs font-bold bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 px-2.5 py-1 rounded-full shrink-0">
                        24h A&amp;E
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400 mb-4">
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-teal-500" /> {hospital.distance}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-brand-500" /> {hospital.type}
                    </span>
                  </div>

                  <div className="flex gap-3">
                    <a href={`tel:${hospital.phone}`}
                      className="flex-1 flex items-center justify-center gap-2 py-3 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700 transition-colors">
                      <Phone className="w-4 h-4" /> Call {hospital.phone}
                    </a>
                    <a
                      href={`https://www.google.com/maps/search/${encodeURIComponent(hospital.name + ' ' + hospital.city)}`}
                      target="_blank" rel="noopener noreferrer"
                      className="px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-500 hover:text-brand-600 transition-colors flex items-center gap-1.5 text-sm font-medium">
                      <ExternalLink className="w-4 h-4" /> Map
                    </a>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
              <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-brand-500" />
                  Hospitals near {hospitalData.patientCity}
                </p>
                <a
                  href={`https://www.openstreetmap.org/search?query=hospital+${encodeURIComponent(hospitalData.patientCity + ' Malaysia')}`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-xs text-brand-600 hover:underline flex items-center gap-1">
                  Open map <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="h-80">
                <HospitalMap hospitals={hospitalData.hospitals} center={mapCenter} />
              </div>
            </div>
          </>
        ) : null}
      </div>
    );
  }

  // ── ADMIN VIEW ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Ambulance className="w-6 h-6 text-red-500" />
            Emergency Referral
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Identify the nearest hospital for high-risk patients — pre-loaded with patient medical summary
          </p>
        </div>
        <button onClick={loadAdminData} className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-700 transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading patient data…</div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-5">

          {/* Left: High-risk patient list */}
          <div className="space-y-3">
            {highRiskPatients.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-card overflow-hidden">
                <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
                  <p className="text-xs font-bold text-red-700 dark:text-red-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" /> HIGH RISK — Referral Needed
                  </p>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                  {highRiskPatients.map(({ patient, assessment }) => (
                    <button
                      key={patient.id}
                      onClick={() => setSelectedPatientId(patient.id)}
                      className={`w-full text-left px-4 py-3 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors ${
                        selectedPatientId === patient.id ? 'bg-red-50 dark:bg-red-900/10' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{patient.name}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">{patient.age}y · {patient.location.city}</p>
                          <p className="text-[11px] text-red-600 dark:text-red-400 mt-0.5 font-medium">
                            Score {assessment.riskScore}/100
                          </p>
                        </div>
                        <span className="text-[10px] font-bold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-2 py-1 rounded-full">HIGH</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* All patients dropdown for manual selection */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-card p-4">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Find Hospital for Any Patient</p>
              <div className="relative">
                <select
                  value={selectedPatientId}
                  onChange={(e) => setSelectedPatientId(e.target.value)}
                  className="w-full appearance-none border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 pr-8 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-700 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                >
                  {allPatients.slice(0, 50).map((p) => (
                    <option key={p.id} value={p.id}>{p.name} — {p.location.city}</option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Right: Hospital details + map */}
          <div className="space-y-4">

            {/* Selected patient info */}
            {selectedPatient && (
              <div className={`rounded-xl border p-4 ${
                selectedRisk
                  ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                  : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
              }`}>
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    selectedRisk ? 'bg-red-100 dark:bg-red-900/40' : 'bg-slate-100 dark:bg-slate-700'
                  }`}>
                    <Ambulance className={`w-4 h-4 ${selectedRisk ? 'text-red-600' : 'text-slate-500'}`} />
                  </div>
                  <div className="flex-1">
                    <p className={`font-bold text-sm ${selectedRisk ? 'text-red-700 dark:text-red-400' : 'text-slate-800 dark:text-slate-200'}`}>
                      {selectedRisk ? 'URGENT: ' : ''}{selectedPatient.name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {selectedPatient.age}y · {selectedPatient.conditions.join(', ')} · {selectedPatient.location.city}, {selectedPatient.location.state}
                    </p>
                    {selectedRisk && (
                      <p className="text-xs text-red-600 dark:text-red-400 mt-1 font-medium">
                        Risk score {selectedRisk.assessment.riskScore}/100 — caregiver: {selectedPatient.caregiver.name} ({selectedPatient.caregiver.phone})
                      </p>
                    )}
                  </div>
                  {selectedRisk && (
                    <a href={`tel:${selectedPatient.caregiver.phone}`}
                      className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 transition-colors">
                      <Phone className="w-3.5 h-3.5" /> Call Caregiver
                    </a>
                  )}
                </div>
              </div>
            )}

            {hospitalLoading ? (
              <div className="text-center py-12 text-slate-400">Finding nearest hospitals…</div>
            ) : hospitalData ? (
              <>
                {/* Emergency banner */}
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/40 flex items-center justify-center shrink-0">
                    <Phone className="w-4 h-4 text-red-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-red-700 dark:text-red-400">Emergency: {hospitalData.emergencyContact}</p>
                    <p className="text-xs text-red-600/80 dark:text-red-400/80">
                      Recommended: <span className="font-semibold">{hospitalData.recommendedHospital}</span> · {hospitalData.estimatedTravelTime} travel
                    </p>
                  </div>
                  <a href="tel:999" className="shrink-0 px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition-colors">
                    Call 999
                  </a>
                </div>

                {/* Hospitals grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {hospitalData.hospitals.map((hospital, idx) => (
                    <div key={hospital.id} className={`bg-white dark:bg-slate-800 rounded-xl border shadow-card p-4 ${
                      idx === 0 ? 'border-teal-300 dark:border-teal-700' : 'border-slate-200 dark:border-slate-700'
                    }`}>
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div>
                          {idx === 0 && (
                            <span className="text-[10px] font-bold bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-700 px-2 py-0.5 rounded-full mb-1 inline-block">
                              RECOMMENDED
                            </span>
                          )}
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{hospital.name}</p>
                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{hospital.address}</p>
                        </div>
                        {hospital.emergencyAvailable && (
                          <span className="text-[10px] font-bold bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 px-2 py-0.5 rounded-full shrink-0">
                            24h A&E
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-teal-500" /> {hospital.distance}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-brand-500" /> {hospital.type}
                        </span>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <a href={`tel:${hospital.phone}`}
                          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-700 rounded-lg text-xs font-medium hover:bg-teal-100 transition-colors">
                          <Phone className="w-3 h-3" /> {hospital.phone}
                        </a>
                        <a
                          href={`https://www.google.com/maps/search/${encodeURIComponent(hospital.name + ' ' + hospital.city)}`}
                          target="_blank" rel="noopener noreferrer"
                          className="p-1.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-500 hover:text-brand-600 transition-colors">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-card overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-brand-500" />
                      Hospitals near {hospitalData.patientCity}
                    </p>
                    <a
                      href={`https://www.openstreetmap.org/search?query=hospital+${encodeURIComponent(hospitalData.patientCity + ' Malaysia')}`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-[11px] text-brand-600 hover:underline flex items-center gap-1">
                      Open full map <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="h-72">
                    <HospitalMap hospitals={hospitalData.hospitals} center={mapCenter} />
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
