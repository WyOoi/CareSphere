'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Heart, Eye, EyeOff, Lock, User, AlertCircle, CheckCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

export default function SignupPage() {
  const router = useRouter();
  const { signupPatient } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [shake, setShake] = useState(false);

  const getCookie = (name: string): string | null => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!username.trim()) {
      setError('Username is required');
      setShake(true); setTimeout(() => setShake(false), 500);
      setLoading(false); return;
    }
    if (!fullName.trim()) {
      setError('Full name is required');
      setShake(true); setTimeout(() => setShake(false), 500);
      setLoading(false); return;
    }
    if (!password) {
      setError('Password is required');
      setShake(true); setTimeout(() => setShake(false), 500);
      setLoading(false); return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      setShake(true); setTimeout(() => setShake(false), 500);
      setLoading(false); return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setShake(true); setTimeout(() => setShake(false), 500);
      setLoading(false); return;
    }

    try {
      const ok = await signupPatient(username.trim(), fullName.trim(), password);
      if (!ok) {
        setError('Signup failed');
        setShake(true); setTimeout(() => setShake(false), 500);
        setLoading(false); return;
      }

      setSuccess(true);
      const patientId = getCookie('cs_patient_id');

      // Redirect patient to their own health profile
      setTimeout(() => { router.push(patientId ? `/patients/${patientId}` : '/login'); }, 1500);
    } catch (err) {
      setError('Network error. Please try again.');
      setShake(true); setTimeout(() => setShake(false), 500);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel — Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-brand-500 via-teal-500 to-teal-600 flex-col items-center justify-center p-12 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="absolute rounded-full border border-white"
              style={{ width: `${(i + 1) * 120}px`, height: `${(i + 1) * 120}px`, top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />
          ))}
        </div>
        <div className="relative z-10 text-center w-full max-w-sm">
          <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center mx-auto mb-6 shadow-xl">
            <Heart className="w-10 h-10 text-white animate-pulse" />
          </div>
          <h1 className="text-4xl font-bold mb-1">CareSphere AI</h1>
          <p className="text-white/80 text-base mb-8">Malaysia Elderly Health Monitoring</p>
          <div className="bg-white/10 rounded-2xl p-6 backdrop-blur text-left space-y-4">
            <h3 className="text-lg font-semibold text-white mb-4">Join CareSphere AI</h3>
            {[
              { icon: Heart, text: '24/7 Health Monitoring' },
              { icon: Lock,  text: 'Secure Personal Health Data' },
              { icon: User,  text: 'Easy Caregiver Notifications' },
            ].map(({ icon: Icon, text }, i) => (
              <div key={i} className="flex items-center gap-3">
                <Icon className="w-5 h-5 text-white/80" />
                <p className="text-white/90 text-sm">{text}</p>
              </div>
            ))}
          </div>
          <p className="text-white/50 text-xs mt-8">CareSphere AI · Malaysia · 2024–2030</p>
        </div>
      </div>

      {/* Right Panel — Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50 dark:bg-slate-900">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-teal-500 flex items-center justify-center">
              <Heart className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-bold text-slate-900 dark:text-slate-100">CareSphere AI</p>
              <p className="text-xs text-teal-600">Create Your Account</p>
            </div>
          </div>

          <div className={`bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl p-8 ${shake ? 'animate-[shake_0.4s_ease-in-out]' : ''}`}>
            {success ? (
              <div className="text-center py-4">
                <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">Account Created!</h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm">Redirecting to dashboard...</p>
              </div>
            ) : (
              <>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">Create Account</h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm mb-7">Join CareSphere AI for health monitoring</p>

                <form onSubmit={handleSubmit} className="space-y-5">
                  {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl px-4 py-3 text-red-700 dark:text-red-400 text-sm flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  {/* Full Name */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Full Name</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
                      <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required
                        placeholder="e.g., Ahmad Bin Hassan"
                        className="w-full pl-10 pr-4 py-3 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-700 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all" />
                    </div>
                  </div>

                  {/* Username */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Username</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
                      <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required
                        placeholder="e.g., owv_patient"
                        className="w-full pl-10 pr-4 py-3 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-700 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all font-mono" />
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Use this username to sign in later</p>
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
                      <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required
                        placeholder="Create a strong password"
                        className="w-full pl-10 pr-10 py-3 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-700 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Confirm Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
                      <input type={showConfirm ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required
                        placeholder="Confirm your password"
                        className="w-full pl-10 pr-10 py-3 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-700 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all" />
                      <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                        {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button type="submit" disabled={loading}
                    className="w-full bg-gradient-to-r from-brand-500 to-teal-500 hover:from-brand-600 hover:to-teal-600 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 mt-7">
                    {loading ? (
                      <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creating account...</>
                    ) : (
                      <>Create Account <ArrowRight className="w-4 h-4" /></>
                    )}
                  </button>

                  <div className="text-center text-sm">
                    <span className="text-slate-600 dark:text-slate-400">Already have an account? </span>
                    <Link href="/login" className="text-brand-600 dark:text-brand-400 font-semibold hover:underline">Sign in</Link>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
