'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Wifi, Smartphone, Watch, Activity, Droplets, Thermometer,
  RefreshCw, Send, ChevronDown, CheckCircle, AlertTriangle, Zap, ArrowRight,
  Radio, Heart
} from 'lucide-react';
import { api, DeviceStatus, DeviceReadingResult } from '@/lib/api';

const DEVICE_ICONS: Record<string, React.ElementType> = {
  smartwatch:      Watch,
  bp_cuff:         Activity,
  pulse_oximeter:  Heart,
  glucose_meter:   Droplets,
  mobile_app:      Smartphone,
};

const DEVICE_COLORS: Record<string, string> = {
  smartwatch:     'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
  bp_cuff:        'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
  pulse_oximeter: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800',
  glucose_meter:  'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
  mobile_app:     'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800',
};

const STATUS_STYLE: Record<string, string> = {
  online:          'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
  idle:            'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
  never_connected: 'text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600',
};

const PRESETS: Record<string, Record<string, Partial<Record<string, number | object>>>> = {
  smartwatch: {
    Normal:   { heartRate: 72, movementScore: 65, temperature: 36.8, sleepHours: 7.2 },
    Elevated: { heartRate: 108, movementScore: 22, temperature: 37.6, sleepHours: 4.1 },
    Critical: { heartRate: 130, movementScore: 6, temperature: 38.4, sleepHours: 2.0 },
  },
  bp_cuff: {
    Normal:   { bloodPressure: { systolic: 125, diastolic: 82 } },
    Elevated: { bloodPressure: { systolic: 158, diastolic: 97 } },
    Critical: { bloodPressure: { systolic: 185, diastolic: 115 } },
  },
  pulse_oximeter: {
    Normal:   { oxygenSaturation: 97.5, heartRate: 74 },
    Elevated: { oxygenSaturation: 93.0, heartRate: 102 },
    Critical: { oxygenSaturation: 87.5, heartRate: 128 },
  },
  glucose_meter: {
    Normal:   { glucoseLevel: 6.2 },
    Elevated: { glucoseLevel: 11.8 },
    Critical: { glucoseLevel: 18.4 },
  },
  mobile_app: {
    Normal:   { heartRate: 70, oxygenSaturation: 97, bloodPressure: { systolic: 122, diastolic: 80 }, sleepHours: 7.5, movementScore: 55, temperature: 36.7 },
    Elevated: { heartRate: 104, oxygenSaturation: 93, bloodPressure: { systolic: 155, diastolic: 95 }, sleepHours: 4.5, movementScore: 25, temperature: 37.5 },
    Critical: { heartRate: 132, oxygenSaturation: 88, bloodPressure: { systolic: 180, diastolic: 112 }, sleepHours: 2.0, movementScore: 8, temperature: 38.3 },
  },
};

export default function DevicesPage() {
  const [devices, setDevices] = useState<DeviceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingDevice, setSendingDevice] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<DeviceReadingResult | null>(null);
  const [selectedPresets, setSelectedPresets] = useState<Record<string, string>>({});
  const [liveLog, setLiveLog] = useState<Array<{ time: string; deviceId: string; patient: string; risk: string; score: number; anomalies: number }>>([]);

  const fetchDevices = useCallback(async () => {
    try {
      const data = await api.getDevices();
      setDevices(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDevices();
    const interval = setInterval(fetchDevices, 10000);
    return () => clearInterval(interval);
  }, [fetchDevices]);

  const handleSendReading = async (device: DeviceStatus) => {
    const preset = selectedPresets[device.deviceId] || 'Normal';
    const presets = PRESETS[device.deviceType] || PRESETS.mobile_app;
    const reading = presets[preset] || presets['Normal'];

    setSendingDevice(device.deviceId);
    setLastResult(null);
    try {
      const result = await api.sendDeviceReading(device.deviceId, reading as any);
      setLastResult(result);
      const riskLevel = result.assessment?.riskLevel ?? 'low';
      const riskScore = result.assessment?.riskScore ?? 0;
      setLiveLog((prev) => [{
        time: new Date().toLocaleTimeString('en-MY'),
        deviceId: device.deviceId,
        patient: result.patientName,
        risk: riskLevel,
        score: riskScore,
        anomalies: result.anomalies?.length ?? 0,
      }, ...prev].slice(0, 50));
      await fetchDevices();
    } catch (err) {
      console.error(err);
    } finally {
      setSendingDevice(null);
    }
  };

  const groupedDevices = devices.reduce<Record<string, DeviceStatus[]>>((acc, d) => {
    const name = d.patient?.name || d.patientId;
    if (!acc[name]) acc[name] = [];
    acc[name].push(d);
    return acc;
  }, {});

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Device Data Ingestion</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
            How patient health data enters CareSphere AI — IoT wearables, BP cuffs, glucose meters &amp; mobile app
          </p>
        </div>
        <button onClick={fetchDevices}
          className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Architecture Diagram */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-card p-5">
        <h2 className="text-sm font-semibold text-teal-600 dark:text-teal-400 mb-4 flex items-center gap-2">
          <Radio className="w-4 h-4" />
          Data Flow Architecture
        </h2>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {[
            { label: 'IoT Devices',       sub: 'Wearables, BP cuffs,\npulse oximeters, glucometers', icon: Watch,       color: 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400' },
            { label: '→', sub: '', icon: null, color: '' },
            { label: 'Patient Mobile App', sub: 'Manual self-reporting\n& auto-sync via Bluetooth',    icon: Smartphone,  color: 'border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400' },
            { label: '→', sub: '', icon: null, color: '' },
            { label: 'CareSphere API',    sub: 'POST /api/devices/:id/reading\nHTTPS + device token auth', icon: Zap,     color: 'border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400' },
            { label: '→', sub: '', icon: null, color: '' },
            { label: 'Gemini AI',         sub: 'Risk assessment flow\n+ RAG memory context',           icon: Activity,   color: 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400' },
            { label: '→', sub: '', icon: null, color: '' },
            { label: 'Autonomous Agent',  sub: 'Alert caregiver → generate\nsummary → find hospital',  icon: AlertTriangle, color: 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400' },
          ].map((step, i) => (
            step.icon ? (
              <div key={i} className={`bg-white dark:bg-slate-800 rounded-xl border p-3 text-center flex-1 min-w-[120px] ${step.color}`}>
                <step.icon className="w-5 h-5 mx-auto mb-1.5" />
                <p className="text-xs font-semibold">{step.label}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 whitespace-pre-line leading-relaxed">{step.sub}</p>
              </div>
            ) : (
              <ArrowRight key={i} className="w-5 h-5 text-slate-300 dark:text-slate-600 shrink-0 hidden lg:block" />
            )
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Device List by Patient */}
        <div className="xl:col-span-2 space-y-5">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Wifi className="w-5 h-5 text-teal-600" />
            Registered Devices ({devices.length} total)
          </h2>

          {Object.entries(groupedDevices).map(([patientName, patientDevices]) => (
            <div key={patientName} className="space-y-2">
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-1">{patientName}</p>
              {patientDevices.map((device) => {
                const Icon = DEVICE_ICONS[device.deviceType] || Activity;
                const colorClass = DEVICE_COLORS[device.deviceType] || DEVICE_COLORS.mobile_app;
                const statusClass = STATUS_STYLE[device.status];
                const presets = PRESETS[device.deviceType] || PRESETS.mobile_app;
                const presetKeys = Object.keys(presets);
                const selectedPreset = selectedPresets[device.deviceId] || 'Normal';
                const isSending = sendingDevice === device.deviceId;

                return (
                  <div key={device.deviceId} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-card p-4 flex items-center gap-4 flex-wrap">
                    <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${colorClass}`}>
                      <Icon className="w-5 h-5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{device.model}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusClass}`}>
                          {device.status === 'online' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 animate-ping mr-1" />}
                          {device.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 font-mono">{device.deviceId}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        {device.readingCount} readings sent
                        {device.lastSeen && ` · Last: ${new Date(device.lastSeen).toLocaleTimeString('en-MY')}`}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="relative">
                        <select
                          value={selectedPreset}
                          onChange={(e) => setSelectedPresets((prev) => ({ ...prev, [device.deviceId]: e.target.value }))}
                          className={`appearance-none text-xs rounded-lg px-2.5 py-1.5 pr-6 border focus:outline-none cursor-pointer dark:bg-slate-700 dark:text-slate-200 ${
                            selectedPreset === 'Critical' ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400' :
                            selectedPreset === 'Elevated' ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400' :
                            'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400'
                          }`}
                        >
                          {presetKeys.map((k) => <option key={k} value={k}>{k}</option>)}
                        </select>
                        <ChevronDown className="w-3 h-3 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
                      </div>
                      <button
                        onClick={() => handleSendReading(device)}
                        disabled={isSending}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
                      >
                        {isSending ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                        {isSending ? 'Sending...' : 'Send Reading'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Right Panel */}
        <div className="space-y-4">
          {/* Last Result */}
          {lastResult && lastResult.assessment && (
            <div className={`bg-white dark:bg-slate-800 rounded-xl border shadow-card p-4 ${
              lastResult.assessment.riskLevel === 'high'   ? 'border-red-200 dark:border-red-800' :
              lastResult.assessment.riskLevel === 'medium' ? 'border-amber-200 dark:border-amber-800' :
              'border-green-200 dark:border-green-800'
            }`}>
              <div className="flex items-center gap-2 mb-3">
                {lastResult.assessment.riskLevel === 'low'
                  ? <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                  : <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                }
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Reading Processed</p>
              </div>
              <div className="space-y-1.5 text-xs">
                {[
                  ['Device',          <span className="font-mono text-slate-700 dark:text-slate-300">{lastResult.deviceId}</span>],
                  ['Patient',         <span className="text-slate-700 dark:text-slate-300">{lastResult.patientName}</span>],
                  ['Risk Level',      <span className={`font-bold uppercase ${lastResult.assessment.riskLevel === 'high' ? 'text-red-700 dark:text-red-400' : lastResult.assessment.riskLevel === 'medium' ? 'text-amber-700 dark:text-amber-400' : 'text-green-700 dark:text-green-400'}`}>{lastResult.assessment.riskLevel}</span>],
                  ['Risk Score',      <span className="text-slate-900 dark:text-slate-100 font-semibold">{lastResult.assessment.riskScore}/100</span>],
                  ['Anomalies',       <span className={lastResult.anomalies.length > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-slate-400'}>{lastResult.anomalies.length} detected</span>],
                  ['Agent Triggered', <span className={lastResult.agentActionsTriggered ? 'text-red-700 dark:text-red-400 font-semibold' : 'text-slate-400'}>{lastResult.agentActionsTriggered ? '✓ Yes' : 'No'}</span>],
                ].map(([label, val], i) => (
                  <div key={i} className="flex justify-between">
                    <span className="text-slate-400 dark:text-slate-500">{label}</span>
                    {val}
                  </div>
                ))}
              </div>
              <div className="mt-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg p-2.5 border border-slate-100 dark:border-slate-600">
                <p className="text-xs text-teal-600 dark:text-teal-400 font-semibold mb-1">Gemini AI Analysis</p>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{lastResult.assessment.geminiReasoning}</p>
              </div>
              {lastResult.anomalies.length > 0 && (
                <div className="mt-2 space-y-1">
                  {lastResult.anomalies.map((a, i) => (
                    <p key={i} className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-1">
                      <span className="shrink-0 mt-0.5">⚠</span>{a}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Live Ingestion Log */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-card p-4">
            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-3 flex items-center gap-2">
              <Radio className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              Live Ingestion Log
            </h3>
            {liveLog.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-6">No readings sent yet.<br />Click "Send Reading" on any device.</p>
            ) : (
              <div className="space-y-1.5 max-h-80 overflow-y-auto">
                {liveLog.map((entry, i) => (
                  <div key={i} className={`flex items-center gap-2 p-2 rounded-lg text-xs ${
                    entry.risk === 'high'   ? 'bg-red-50 dark:bg-red-900/20' :
                    entry.risk === 'medium' ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-slate-50 dark:bg-slate-700/50'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${entry.risk === 'high' ? 'bg-red-500' : entry.risk === 'medium' ? 'bg-amber-500' : 'bg-green-500'}`} />
                    <span className="text-slate-400 dark:text-slate-500 shrink-0">{entry.time}</span>
                    <span className="text-slate-700 dark:text-slate-300 truncate flex-1">{entry.patient}</span>
                    <span className={`font-semibold uppercase shrink-0 ${entry.risk === 'high' ? 'text-red-700 dark:text-red-400' : entry.risk === 'medium' ? 'text-amber-700 dark:text-amber-400' : 'text-green-700 dark:text-green-400'}`}>{entry.risk}</span>
                    <span className="text-slate-400 dark:text-slate-500 shrink-0">{entry.score}/100</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Integration Guide */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-card p-4">
            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-3">Real Device Integration</h3>
            <div className="space-y-2 text-xs text-slate-500 dark:text-slate-400">
              <p className="font-semibold text-slate-700 dark:text-slate-300">IoT Device (e.g. Raspberry Pi + sensors):</p>
              <code className="block bg-slate-50 dark:bg-slate-700/50 border border-slate-100 dark:border-slate-600 rounded p-2 text-teal-700 dark:text-teal-400 leading-relaxed">
                POST /api/devices/WATCH-AHM-001/reading<br />
                {'{'}<br />
                &nbsp;&nbsp;"heartRate": 82,<br />
                &nbsp;&nbsp;"oxygenSaturation": 96.5<br />
                {'}'}
              </code>
              <p className="font-semibold text-slate-700 dark:text-slate-300 mt-2">Patient Mobile App:</p>
              <code className="block bg-slate-50 dark:bg-slate-700/50 border border-slate-100 dark:border-slate-600 rounded p-2 text-teal-700 dark:text-teal-400 leading-relaxed">
                POST /api/devices/MOBILE-AHM/reading<br />
                {"{ fullReading... }"}
              </code>
              <p className="text-slate-400 dark:text-slate-500 mt-2">
                Device sends only what it measures. CareSphere fills missing vitals from the patient&apos;s last reading.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
