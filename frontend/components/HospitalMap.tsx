'use client';

import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Hospital } from '@/lib/api';
import { useEffect } from 'react';

const HospitalIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const PatientIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function ChangeView({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => { map.setView(center, 13); }, [center, map]);
  return null;
}

interface HospitalMapProps {
  hospitals: Hospital[];
  center: [number, number];
}

export default function HospitalMap({ hospitals, center }: HospitalMapProps) {
  return (
    <div className="h-full w-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-inner bg-slate-100 dark:bg-slate-800">
      <MapContainer
        center={center}
        zoom={13}
        scrollWheelZoom={false}
        zoomControl={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ChangeView center={center} />

        <Marker position={center} icon={PatientIcon}>
          <Popup>
            <div className="font-semibold text-slate-900">Current Location</div>
          </Popup>
        </Marker>

        {hospitals.map((h) =>
          h.lat && h.lng ? (
            <Marker key={h.id} position={[h.lat, h.lng]} icon={HospitalIcon}>
              <Popup>
                <div className="min-w-[150px] p-1">
                  <h3 className="font-bold text-slate-900 text-sm leading-tight mb-1">{h.name}</h3>
                  <p className="text-[11px] text-slate-500 mb-1">{h.type} · {h.distance}</p>
                  <p className="text-[11px] text-slate-600 mb-2">{h.address}</p>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                    <a href={`tel:${h.phone}`} className="text-[10px] text-teal-600 font-bold hover:underline">
                      CALL: {h.phone}
                    </a>
                    {h.emergencyAvailable && (
                      <span className="text-[9px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                        24h A&amp;E
                      </span>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          ) : null
        )}
      </MapContainer>
    </div>
  );
}
