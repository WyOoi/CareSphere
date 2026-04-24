'use client';

import React from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Patient, RiskAssessment } from '@/lib/api';

interface RiskMapProps {
  patients: Array<{
    patient: Patient;
    latestAssessment: RiskAssessment | null;
  }>;
}

export default function RiskMap({ patients }: RiskMapProps) {
  // Center of Malaysia
  const center: [number, number] = [4.2105, 101.9758];

  return (
    <div className="h-[400px] w-full rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-card">
      <MapContainer center={center} zoom={6} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {patients.map(({ patient, latestAssessment }) => {
          if (!patient.location?.lat || !patient.location?.lng) return null;

          const riskColor =
            latestAssessment?.riskLevel === 'high'   ? '#ef4444' :
            latestAssessment?.riskLevel === 'medium' ? '#f59e0b' : '#10b981';

          const isHighRisk = latestAssessment?.riskLevel === 'high';

          return (
            <CircleMarker
              key={patient.id}
              center={[patient.location.lat, patient.location.lng]}
              radius={isHighRisk ? 10 : 6}
              pathOptions={{ fillColor: riskColor, color: 'white', weight: 2, fillOpacity: 0.8 }}
            >
              <Tooltip direction="top" offset={[0, -5]} opacity={1}>
                <div className="px-1 py-0.5">
                  <p className="text-xs font-bold text-slate-900">{patient.name}</p>
                  <p className="text-[10px] text-slate-500 uppercase font-semibold">
                    {latestAssessment?.riskLevel || 'Low'} Risk
                  </p>
                </div>
              </Tooltip>
              <Popup>
                <div className="min-w-[150px] p-1">
                  <h3 className="font-bold text-sm text-slate-900 mb-1">{patient.name}</h3>
                  <p className="text-xs text-slate-600 mb-2">{patient.location.city}, {patient.location.state}</p>
                  <div className={`text-[10px] inline-block px-2 py-0.5 rounded-full font-bold text-white mb-2 ${
                    latestAssessment?.riskLevel === 'high'   ? 'bg-red-500' :
                    latestAssessment?.riskLevel === 'medium' ? 'bg-amber-500' : 'bg-green-500'
                  }`}>
                    {latestAssessment?.riskLevel?.toUpperCase() || 'LOW'} RISK
                  </div>
                  <a href={`/patients/${patient.id}`}
                    className="block text-center bg-brand-500 text-white text-xs py-1.5 rounded-lg hover:bg-brand-600 transition-colors">
                    View Details
                  </a>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
