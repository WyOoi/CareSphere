'use client';

import 'leaflet/dist/leaflet.css';
import { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

interface Patient {
  id: string;
  name: string;
  age: number;
  gender: string;
  conditions: string[];
  location: { city: string; state: string; lat?: number; lng?: number };
}

interface Assessment {
  patientId: string;
  riskLevel: 'high' | 'medium' | 'low';
  riskScore: number;
  timestamp: string;
}

interface DashboardMapProps {
  patients: Patient[];
  assessments: Assessment[];
}

function ChangeView({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => { map.setView(center, zoom); }, [center, zoom, map]);
  return null;
}

export default function DashboardMap({ patients, assessments }: DashboardMapProps) {
  const center: [number, number] = [4.2105, 108.9758];
  const zoom = 6;

  const getColor = (patientId: string): string => {
    const assessment = assessments.find(a => a.patientId === patientId);
    if (!assessment) return '#94a3b8';
    switch (assessment.riskLevel) {
      case 'high':   return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low':    return '#22c55e';
      default:       return '#94a3b8';
    }
  };

  const getRiskLabel = (patientId: string): string => {
    const assessment = assessments.find(a => a.patientId === patientId);
    return assessment ? assessment.riskLevel : 'No data';
  };

  const getRiskScore = (patientId: string): number | null => {
    const assessment = assessments.find(a => a.patientId === patientId);
    return assessment ? assessment.riskScore : null;
  };

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      style={{ height: '100%', width: '100%' }}
      className="rounded-xl overflow-hidden"
    >
      <ChangeView center={center} zoom={zoom} />
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="&copy; OpenStreetMap contributors"
      />
      {patients
        .filter(p => p.location.lat != null && p.location.lng != null)
        .map(p => {
          const color = getColor(p.id);
          const riskLabel = getRiskLabel(p.id);
          const riskScore = getRiskScore(p.id);
          return (
            <CircleMarker
              key={p.id}
              center={[p.location.lat!, p.location.lng!]}
              radius={6}
              fillOpacity={0.8}
              weight={1}
              color="white"
              fillColor={color}
            >
              <Popup>
                <div className="text-sm min-w-[140px]">
                  <p className="font-semibold text-slate-800">{p.name}</p>
                  <p className="text-slate-500 text-xs">{p.age}y · {p.location.city}</p>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span
                      className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white capitalize"
                      style={{ backgroundColor: color }}
                    >
                      {riskLabel}
                    </span>
                    {riskScore != null && (
                      <span className="text-[10px] text-slate-400">Score: {riskScore}/100</span>
                    )}
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
    </MapContainer>
  );
}
