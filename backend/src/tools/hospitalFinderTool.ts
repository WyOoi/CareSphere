import { z } from 'zod';
import { Hospital } from '../types/health.types';
import { healthMemory } from '../rag/healthMemoryService';
import { db } from '../lib/firebase';
import { MALAYSIA_HOSPITALS } from '../data/malaysiaHospitals';

export const hospitalFinderInputSchema = z.object({
  patientId: z.string().describe('The patient ID to find hospitals near their location'),
  urgency: z.enum(['low', 'medium', 'high']).describe('Urgency level affecting hospital type preference'),
});

export const hospitalFinderOutputSchema = z.object({
  success: z.boolean(),
  hospitals: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      address: z.string(),
      city: z.string(),
      phone: z.string(),
      distance: z.string(),
      type: z.string(),
      emergencyAvailable: z.boolean(),
      lat: z.number().optional(),
      lng: z.number().optional(),
    })
  ),
  recommendedHospital: z.string(),
  estimatedTravelTime: z.string(),
  emergencyContact: z.string(),
});

export type HospitalFinderInput = z.infer<typeof hospitalFinderInputSchema>;
export type HospitalFinderOutput = z.infer<typeof hospitalFinderOutputSchema>;

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

async function loadHospitalsForState(state: string): Promise<Hospital[]> {
  if (db) {
    const snap = await db.collection('hospitalsMY').where('state', '==', state).get();
    if (!snap.empty) {
      return snap.docs.map((doc) => {
        const h = doc.data() as Hospital & { lat?: number; lng?: number };
        return {
          id: doc.id,
          name: h.name,
          address: h.address,
          city: h.city,
          phone: h.phone,
          distance: h.distance || '',
          type: h.type,
          emergencyAvailable: Boolean(h.emergencyAvailable),
          lat: h.lat,
          lng: h.lng,
        };
      });
    }
  }

  return MALAYSIA_HOSPITALS.filter((h) => h.state === state).map((h) => ({
    id: h.id,
    name: h.name,
    address: h.address,
    city: h.city,
    phone: h.phone,
    distance: '',
    type: h.type,
    emergencyAvailable: h.emergencyAvailable,
    lat: h.lat,
    lng: h.lng,
  }));
}

export async function findNearbyHospitals(input: HospitalFinderInput): Promise<HospitalFinderOutput> {
  const patient = healthMemory.getPatient(input.patientId);
  if (!patient) {
    return {
      success: false,
      hospitals: [],
      recommendedHospital: 'Hospital Kuala Lumpur (HKL)',
      estimatedTravelTime: 'Unknown',
      emergencyContact: '999',
    };
  }

  const state = patient.location.state || 'Wilayah Persekutuan';
  const fallbackState = 'Wilayah Persekutuan';
  let stateHospitals = await loadHospitalsForState(state);
  if (!stateHospitals.length && state !== fallbackState) {
    stateHospitals = await loadHospitalsForState(fallbackState);
  }
  if (!stateHospitals.length) {
    stateHospitals = MALAYSIA_HOSPITALS.filter((h) => h.state === fallbackState).map((h) => ({
      id: h.id,
      name: h.name,
      address: h.address,
      city: h.city,
      phone: h.phone,
      distance: '',
      type: h.type,
      emergencyAvailable: h.emergencyAvailable,
      lat: h.lat,
      lng: h.lng,
    }));
  }

  // For high urgency: emergency hospitals first; for low: include clinics
  const filtered: Hospital[] =
    input.urgency === 'high'
      ? stateHospitals.filter((h) => h.emergencyAvailable)
      : stateHospitals;

  const patientLat = patient.location.lat;
  const patientLng = patient.location.lng;
  const withDistance = filtered.map((h) => {
    if (typeof patientLat === 'number' && typeof patientLng === 'number' && typeof h.lat === 'number' && typeof h.lng === 'number') {
      const km = distanceKm(patientLat, patientLng, h.lat, h.lng);
      return { ...h, distance: `${km.toFixed(1)} km`, _km: km };
    }
    return { ...h, distance: h.distance || 'Unknown', _km: Number.POSITIVE_INFINITY };
  });

  // Sort by urgency/quality first, then distance.
  const sorted = withDistance.sort((a, b) => {
    const priority = (t: string) =>
      t.includes('Government') || t.includes('University') ? 0 :
      t.includes('Specialist') ? 1 :
      t.includes('Private') ? 2 : 3;
    const p = priority(a.type) - priority(b.type);
    if (p !== 0) return p;
    return a._km - b._km;
  });

  const recommended = sorted[0];
  const bestKm = Number.isFinite(recommended?._km) ? recommended._km : 6;
  const travelMin = Math.max(5, Math.round(bestKm * 2.4));
  const travelMax = travelMin + 8;

  return {
    success: true,
    hospitals: sorted.slice(0, 8).map(({ _km, ...h }) => h),
    recommendedHospital: recommended?.name || 'Hospital Kuala Lumpur (HKL)',
    estimatedTravelTime: `${travelMin}–${travelMax} minit / ${travelMin}–${travelMax} minutes`,
    emergencyContact: `999 (Kecemasan) | ${recommended?.phone || '03-2615 5555'} (${recommended?.name || 'HKL'})`,
  };
}
