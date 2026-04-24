'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

interface AuthCtx {
  isAuthed: boolean;
  user?: { id: string; name: string; type: 'admin' | 'patient'; accountNumber?: string; email?: string };
  login: (email: string, pass: string) => boolean;
  loginPatient: (username: string, password: string) => Promise<boolean>;
  signupPatient: (username: string, fullName: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthCtx>({
  isAuthed: false,
  login: () => false,
  loginPatient: async () => false,
  signupPatient: async () => false,
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthed, setIsAuthed] = useState(false);
  const [user, setUser] = useState<{ id: string; name: string; type: 'admin' | 'patient'; accountNumber?: string; email?: string } | undefined>();
  const router = useRouter();

  const buildPatientEmail = (input: string) => {
    const normalized = input.toLowerCase().replace(/[^a-z0-9]/g, '');
    return `${normalized || 'patient'}@gmail.com`;
  };

  const getCookie = (name: string): string | null => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
    return null;
  };

  useEffect(() => {
    const authCookie     = getCookie('cs_auth');
    const patientId      = getCookie('cs_patient_id');
    const patientName    = getCookie('cs_patient_name');
    const patientAccount = getCookie('cs_patient_account');
    const patientEmail   = getCookie('cs_patient_email');

    if (patientId && patientName) {
      const accountNumber = patientAccount || undefined;
      const email = patientEmail ? decodeURIComponent(patientEmail) : buildPatientEmail(accountNumber ?? patientName);
      setIsAuthed(true);
      setUser({ id: patientId, name: decodeURIComponent(patientName), type: 'patient', accountNumber, email });
    } else if (authCookie) {
      setIsAuthed(true);
      setUser({ id: '', name: 'Admin', type: 'admin' });
    } else {
      setIsAuthed(false);
    }
  }, []);

  const login = (email: string, pass: string): boolean => {
    if (email === 'admin@caresphere.my' && pass === 'demo2030') {
      document.cookie = 'cs_auth=1; max-age=86400; path=/';
      setIsAuthed(true);
      setUser({ id: '', name: 'Admin', type: 'admin' });
      return true;
    }
    return false;
  };

  const loginPatient = async (username: string, password: string): Promise<boolean> => {
    try {
      const norm = username.trim().toUpperCase();
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: norm, password }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      const p = data?.data ? data.data : data;
      if (p?.token && p?.patientId) {
        const acct  = p.username || norm;
        const email = p.patientEmail  || buildPatientEmail(acct || p.patientName);
        document.cookie = `cs_auth=${p.token}; max-age=86400; path=/`;
        document.cookie = `cs_patient_id=${p.patientId}; max-age=86400; path=/`;
        document.cookie = `cs_patient_name=${encodeURIComponent(p.patientName)}; max-age=86400; path=/`;
        document.cookie = `cs_patient_account=${acct}; max-age=86400; path=/`;
        document.cookie = `cs_patient_email=${encodeURIComponent(email)}; max-age=86400; path=/`;
        setIsAuthed(true);
        setUser({ id: p.patientId, name: p.patientName, type: 'patient', accountNumber: acct, email });
        return true;
      }
      return false;
    } catch (err) {
      console.error('Login error:', err);
      return false;
    }
  };

  const signupPatient = async (username: string, fullName: string, password: string): Promise<boolean> => {
    try {
      const norm = username.trim().toUpperCase();
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: norm, fullName, password }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      const p = data?.data ? data.data : data;
      if (p?.token && p?.patientId) {
        const acct  = p.username || norm;
        const email = p.patientEmail  || buildPatientEmail(acct || p.patientName);
        document.cookie = `cs_auth=${p.token}; max-age=86400; path=/`;
        document.cookie = `cs_patient_id=${p.patientId}; max-age=86400; path=/`;
        document.cookie = `cs_patient_name=${encodeURIComponent(p.patientName)}; max-age=86400; path=/`;
        document.cookie = `cs_patient_account=${acct}; max-age=86400; path=/`;
        document.cookie = `cs_patient_email=${encodeURIComponent(email)}; max-age=86400; path=/`;
        setIsAuthed(true);
        setUser({ id: p.patientId, name: p.patientName, type: 'patient', accountNumber: acct, email });
        return true;
      }
      return false;
    } catch (err) {
      console.error('Signup error:', err);
      return false;
    }
  };

  const logout = () => {
    document.cookie = 'cs_auth=; max-age=0; path=/';
    document.cookie = 'cs_patient_id=; max-age=0; path=/';
    document.cookie = 'cs_patient_name=; max-age=0; path=/';
    document.cookie = 'cs_patient_account=; max-age=0; path=/';
    document.cookie = 'cs_patient_email=; max-age=0; path=/';
    setIsAuthed(false);
    setUser(undefined);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ isAuthed, user, login, loginPatient, signupPatient, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
