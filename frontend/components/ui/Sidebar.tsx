'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  LayoutDashboard, Bell, TrendingUp, MapPin,
  Pill, Users, FileText, UserPlus, ChevronRight,
  Activity, Zap, Brain, Shield, ClipboardList, Heart,
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';

interface NavItem {
  href: string;
  icon: React.ElementType;
  key?: string;
  label?: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { href: '/',          icon: LayoutDashboard, key: 'dashboard' },
      { href: '/alerts',    icon: Bell,            key: 'alerts' },
      { href: '/trends',    icon: TrendingUp,      label: 'Vital Monitoring' },
    ],
  },
  {
    label: 'Patient Care',
    items: [
      { href: '/companion',  icon: Brain,         label: 'AI Clinical Assistant' },
      { href: '/caregiver',  icon: Users,         key: 'caregiver' },
      { href: '/medications',icon: Pill,          key: 'medications' },
    ],
  },
  {
    label: 'Tools',
    items: [
      { href: '/hospitals', icon: MapPin,   key: 'hospitals' },
{ href: '/report',    icon: FileText, key: 'weeklyReport' },
      { href: '/onboard',   icon: UserPlus, label: 'Add Patient' },
    ],
  },
  {
    label: 'Admin',
    items: [
      { href: '/admin', icon: Shield,        label: 'Admin Centre' },
      { href: '/audit', icon: ClipboardList, label: 'Audit Log' },
    ],
  },
];

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.split(';').map(c => c.trim()).find(c => c.startsWith(name + '='));
  return match ? decodeURIComponent(match.split('=')[1]) : null;
}

export default function Sidebar() {
  const pathname = usePathname();
  const { t } = useLanguage();
  const { user } = useAuth();

  const [isPatient, setIsPatient] = useState(false);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [patientName, setPatientName] = useState<string | null>(null);

  // Read cookies on client only (avoids SSR/hydration mismatch)
  useEffect(() => {
    const pid = readCookie('cs_patient_id');
    setIsPatient(!!pid);
    setPatientId(pid);
    setPatientName(readCookie('cs_patient_name'));
  }, []);

  // Also sync with AuthContext once it loads (for logout/login changes)
  useEffect(() => {
    if (user !== undefined) {
      setIsPatient(user?.type === 'patient');
      if (user?.type === 'patient') {
        setPatientId(user.id);
        setPatientName(user.name);
      }
    }
  }, [user]);

  const [hasHighAlert, setHasHighAlert] = useState(false);

  useEffect(() => {
    const check = () => {
      const today = new Date().toISOString().split('T')[0];
      api.getAllAssessments()
        .then((assessments) => {
          setHasHighAlert(assessments.some((a) => a.riskLevel === 'high' && a.timestamp.startsWith(today)));
        })
        .catch(() => {});
    };
    check();
    const iv = setInterval(check, 60000);
    return () => clearInterval(iv);
  }, []);

  const getLabel = (item: NavItem) => {
    if (item.key) {
      const translations = t as unknown as Record<string, string>;
      return translations[item.key] || item.key;
    }
    return item.label || '';
  };

  return (
    <aside className="fixed left-0 top-16 h-[calc(100vh-4rem)] w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col z-40 overflow-y-auto">

      {/* ── Navigation Groups ────────────────────────────────────── */}
      <nav className="flex-1 p-3 space-y-5 pt-4">

        {/* Patient-only nav */}
        {isPatient && (
          <>
            <div>
              <p className="px-3 mb-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">My Health</p>
              <ul className="space-y-0.5">
                {[
                  { href: `/patients/${patientId}`, icon: Heart, label: 'My Profile' },
                  { href: '/companion',            icon: Brain, label: 'AI Companion' },
                  { href: '/medications',          icon: Pill,  label: 'Medications' },
                ].map(({ href, icon: Icon, label }) => {
                  const active = pathname === href;
                  return (
                    <li key={href}>
                      <Link href={href}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group border-l-[3px] ${
                          active
                            ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-600 border-brand-500'
                            : 'text-slate-600 dark:text-slate-300 border-transparent hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100'
                        }`}>
                        <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-brand-500' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'}`} />
                        <span className="flex-1">{label}</span>
                        {active && <ChevronRight className="w-3.5 h-3.5 text-brand-400 shrink-0" />}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div>
              <p className="px-3 mb-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Emergency</p>
              <ul className="space-y-0.5">
                {[
                  { href: '/hospitals', icon: MapPin, label: 'Nearby Hospitals' },
                ].map(({ href, icon: Icon, label }) => {
                  const active = pathname === href;
                  return (
                    <li key={href}>
                      <Link href={href}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group border-l-[3px] ${
                          active
                            ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-600 border-brand-500'
                            : 'text-slate-600 dark:text-slate-300 border-transparent hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100'
                        }`}>
                        <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-brand-500' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'}`} />
                        <span className="flex-1">{label}</span>
                        {active && <ChevronRight className="w-3.5 h-3.5 text-brand-400 shrink-0" />}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </>
        )}

        {/* Admin nav */}
        {!isPatient && NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="px-3 mb-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const { href, icon: Icon } = item;
                const active = pathname === href;
                const itemLabel = getLabel(item);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group border-l-[3px] ${
                        active
                          ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-600 border-brand-500'
                          : 'text-slate-600 dark:text-slate-300 border-transparent hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100'
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-brand-500' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'}`} />
                      <span className="flex-1 truncate">{itemLabel}</span>
                      {href === '/alerts' && hasHighAlert && (
                        <span className="w-2 h-2 rounded-full bg-red-500 shrink-0 animate-pulse" />
                      )}
                      {active && <ChevronRight className="w-3.5 h-3.5 text-brand-400 shrink-0" />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* ── AI Status Panel ──────────────────────────────────────── */}
      <div className="p-3 border-t border-slate-100 dark:border-slate-700 shrink-0">
        <div className="rounded-xl bg-gradient-to-br from-brand-50 to-teal-50 dark:from-slate-700 dark:to-slate-700 border border-brand-100 dark:border-slate-600 p-3">
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2.5">
            AI Stack
          </p>
          <div className="space-y-2">
            {[
              { icon: Zap,      label: 'Gemini 2.5 Flash', status: 'Active',  color: 'text-teal-600' },
              { icon: Activity, label: 'Genkit Flows',      status: 'Ready',   color: 'text-brand-600' },
              { icon: Brain,    label: 'RAG Memory',        status: 'Online',  color: 'text-purple-600' },
            ].map(({ icon: Icon, label, status, color }) => (
              <div key={label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className={`w-3.5 h-3.5 ${color}`} />
                  <span className="text-xs text-slate-600 dark:text-slate-300">{label}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full animate-blink ${
                    status === 'Active' ? 'bg-teal-500' : status === 'Ready' ? 'bg-brand-500' : 'bg-purple-500'
                  }`} />
                  <span className={`text-[10px] font-semibold ${color}`}>{status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-center text-slate-400 dark:text-slate-500 text-[11px] mt-3">
          Project 2030 · Track 3: Vital Signs
        </p>
        <p className="text-center text-slate-300 dark:text-slate-600 text-[10px]">
          GDG UTM Hackathon
        </p>
      </div>
    </aside>
  );
}
