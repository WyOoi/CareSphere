'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Send, Brain, User, Stethoscope, Mic, MicOff, Volume2, VolumeX,
  FileText, TrendingUp, Pill, AlertTriangle, Loader2, Sparkles,
  Search, X, Heart, Activity, Moon, Smile, HelpCircle, PhoneCall,
} from 'lucide-react';
import { api, Patient, CompanionResponse } from '@/lib/api';

/* ─── types ─────────────────────────────────────────────────── */
interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: Date;
  sentiment?: string;
  flagged?: boolean;
  suggestions?: string[];
}

/* ─── cookie helper ─────────────────────────────────────────── */
function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.split(';').map(c => c.trim()).find(c => c.startsWith(name + '='));
  return match ? decodeURIComponent(match.split('=')[1]) : null;
}

/* ─── admin suggested queries ────────────────────────────────── */
const ADMIN_QUERIES = [
  { icon: TrendingUp,    label: 'Vital trend summary',   query: "Give me a summary of this patient's vital signs trend over the past week." },
  { icon: Pill,          label: 'Medication review',      query: "Review this patient's current medications and flag any concerns." },
  { icon: AlertTriangle, label: 'Risk factors',           query: 'What are the top risk factors I should be monitoring for this patient?' },
  { icon: FileText,      label: 'Clinical summary',       query: "Generate a concise clinical summary of this patient's current health status." },
  { icon: Stethoscope,   label: 'Condition assessment',   query: "Based on the latest readings, how well-controlled are this patient's chronic conditions?" },
  { icon: TrendingUp,    label: 'Deterioration signs',    query: 'Are there any early signs of health deterioration I should be concerned about?' },
];

/* ─── patient suggested prompts ─────────────────────────────── */
// Fallback reply options shown if the AI greeting fails to load
const PATIENT_PROMPTS: Record<Lang, { icon: React.ElementType; label: string; query: string }[]> = {
  en: [
    { icon: Smile,      label: 'I feel good today',    query: 'I am feeling good today.' },
    { icon: HelpCircle, label: 'I feel unwell',        query: 'I am not feeling well today.' },
    { icon: Pill,       label: 'About my medicines',   query: 'Can you tell me about my medicines?' },
    { icon: Activity,   label: 'My health readings',   query: 'How are my health readings today?' },
    { icon: Moon,       label: 'I cannot sleep well',  query: 'I have been having trouble sleeping.' },
    { icon: Heart,      label: 'I have a question',    query: 'I have a health question for you.' },
  ],
  bm: [
    { icon: Smile,      label: 'Saya rasa sihat',          query: 'Saya rasa sihat hari ini.' },
    { icon: HelpCircle, label: 'Saya tidak sihat',         query: 'Saya tidak rasa sihat hari ini.' },
    { icon: Pill,       label: 'Tentang ubat saya',        query: 'Boleh ceritakan tentang ubat saya?' },
    { icon: Activity,   label: 'Bacaan kesihatan saya',    query: 'Bagaimana bacaan kesihatan saya hari ini?' },
    { icon: Moon,       label: 'Saya susah tidur',         query: 'Saya susah nak tidur kebelakangan ini.' },
    { icon: Heart,      label: 'Saya ada soalan',          query: 'Saya ada soalan tentang kesihatan.' },
  ],
  zh: [
    { icon: Smile,      label: '我今天感觉很好',    query: '我今天感觉很好。' },
    { icon: HelpCircle, label: '我感觉不舒服',      query: '我今天感觉不太好。' },
    { icon: Pill,       label: '关于我的药物',      query: '请告诉我关于我的药物。' },
    { icon: Activity,   label: '我的健康数据',      query: '今天我的健康数据怎么样？' },
    { icon: Moon,       label: '我睡眠不好',        query: '我最近睡眠不太好。' },
    { icon: Heart,      label: '我有一个问题',      query: '我有一个健康问题想问您。' },
  ],
  ta: [
    { icon: Smile,      label: 'நான் நலமாக இருக்கிறேன்',  query: 'நான் இன்று நலமாக இருக்கிறேன்.' },
    { icon: HelpCircle, label: 'உடம்பு சரியில்லை',         query: 'இன்று உடம்பு சரியில்லை.' },
    { icon: Pill,       label: 'என் மருந்துகள்',            query: 'என் மருந்துகளைப் பற்றி சொல்லுங்கள்.' },
    { icon: Activity,   label: 'என் உடல்நல அளவீடுகள்',   query: 'இன்று என் உடல்நல அளவீடுகள் எப்படி?' },
    { icon: Moon,       label: 'தூக்கம் வரவில்லை',         query: 'சமீபத்தில் தூக்கம் சரியாக வரவில்லை.' },
    { icon: Heart,      label: 'என்னிடம் ஒரு கேள்வி',     query: 'என்னிடம் ஒரு உடல்நல கேள்வி இருக்கிறது.' },
  ],
};

/* ─── language config ────────────────────────────────────────── */
type Lang = 'en' | 'bm' | 'zh' | 'ta';

const LANG_OPTIONS: { code: Lang; label: string; speechLocale: string }[] = [
  { code: 'en', label: 'EN',  speechLocale: 'en-MY' },
  { code: 'bm', label: 'BM',  speechLocale: 'ms-MY' },
  { code: 'zh', label: '中文', speechLocale: 'zh-MY' },
  { code: 'ta', label: 'தமிழ்', speechLocale: 'ta-MY' },
];

/* ─── UI strings ─────────────────────────────────────────────── */
const UI: Record<Lang, {
  hello: string; subtitle: string; voiceOn: string; voiceOff: string;
  iAmHere: string; tapToChat: string; readAloud: string; stopReading: string;
  readingAloud: string; listening: string; tapToSpeak: string; tapToStop: string;
  thinking: string; typePlaceholder: string; privacy: string;
  caregiverNotified: string; errorMsg: string;
}> = {
  en: {
    hello: 'Hello',
    subtitle: 'Your AI Health Companion',
    voiceOn: 'Voice On',
    voiceOff: 'Voice Off',
    iAmHere: 'I am here for you',
    tapToChat: 'Talk to me or type a message — I will help with your health.',
    readAloud: 'Read aloud',
    stopReading: 'Stop',
    readingAloud: 'Reading…',
    listening: 'Listening… speak now',
    tapToSpeak: 'Tap to speak',
    tapToStop: 'Tap to stop',
    thinking: 'Thinking…',
    typePlaceholder: 'Type your message here…',
    privacy: 'Your conversations are private and help improve your care',
    caregiverNotified: 'Your caregiver has been notified',
    errorMsg: 'Sorry, I could not connect right now. Please try again.',
  },
  bm: {
    hello: 'Helo',
    subtitle: 'Teman AI Kesihatan Anda',
    voiceOn: 'Suara Hidup',
    voiceOff: 'Suara Mati',
    iAmHere: 'Saya di sini untuk anda',
    tapToChat: 'Bercakap atau taip mesej — saya akan bantu masalah kesihatan anda.',
    readAloud: 'Baca kuat',
    stopReading: 'Berhenti',
    readingAloud: 'Sedang membaca…',
    listening: 'Mendengar… sila bercakap',
    tapToSpeak: 'Ketuk untuk bercakap',
    tapToStop: 'Ketuk untuk berhenti',
    thinking: 'Sedang berfikir…',
    typePlaceholder: 'Taip mesej anda di sini…',
    privacy: 'Perbualan anda adalah sulit dan membantu penjagaan anda',
    caregiverNotified: 'Penjaga anda telah dimaklumkan',
    errorMsg: 'Maaf, tidak dapat berhubung. Sila cuba lagi.',
  },
  zh: {
    hello: '你好',
    subtitle: 'AI 健康助手',
    voiceOn: '语音开',
    voiceOff: '语音关',
    iAmHere: '我在这里陪伴您',
    tapToChat: '您可以说话或打字 — 我会帮助您解答健康问题。',
    readAloud: '朗读',
    stopReading: '停止',
    readingAloud: '正在朗读…',
    listening: '正在聆听… 请说话',
    tapToSpeak: '点击说话',
    tapToStop: '点击停止',
    thinking: '正在思考…',
    typePlaceholder: '在这里输入您的问题…',
    privacy: '您的对话是保密的，有助于改善您的护理',
    caregiverNotified: '已通知您的看护人',
    errorMsg: '抱歉，暂时无法连接。请稍后再试。',
  },
  ta: {
    hello: 'வணக்கம்',
    subtitle: 'உங்கள் AI உடல்நல துணை',
    voiceOn: 'குரல் இயக்கு',
    voiceOff: 'குரல் நிறுத்து',
    iAmHere: 'நான் உங்களுக்காக இங்கே இருக்கிறேன்',
    tapToChat: 'பேசுங்கள் அல்லது தட்டச்சு செய்யுங்கள் — உங்கள் உடல்நலம் பற்றி உதவுவேன்.',
    readAloud: 'படிக்கவும்',
    stopReading: 'நிறுத்து',
    readingAloud: 'படிக்கிறது…',
    listening: 'கேட்கிறேன்… பேசுங்கள்',
    tapToSpeak: 'பேச தொடவும்',
    tapToStop: 'நிறுத்த தொடவும்',
    thinking: 'யோசிக்கிறேன்…',
    typePlaceholder: 'இங்கே தட்டச்சு செய்யுங்கள்…',
    privacy: 'உங்கள் உரையாடல்கள் தனிப்பட்டவை',
    caregiverNotified: 'உங்கள் பராமரிப்பாளர் அறிவிக்கப்பட்டார்',
    errorMsg: 'மன்னிக்கவும், இணைக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.',
  },
};

/* ══════════════════════════════════════════════════════════════ */
export default function CompanionPage() {
  const [patientMode, setPatientMode] = useState(false);
  const [patientId,   setPatientId]   = useState('');
  const [patientName, setPatientName] = useState('');

  /* shared */
  const [messages,  setMessages]  = useState<Message[]>([]);
  const [input,     setInput]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLInputElement>(null);

  /* patient language & voice features */
  const [lang,        setLang]       = useState<Lang>('en');
  const langRef = useRef<Lang>('en'); // always-current lang for callbacks
  const [listening,   setListening]  = useState(false);
  const [speaking,    setSpeaking]   = useState(false);
  const [voiceEnabled,setVoiceEnabled] = useState(true);
  const [speechReady, setSpeechReady] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  /* admin patient search */
  const [patients,    setPatients]   = useState<Patient[]>([]);
  const [selectedId,  setSelectedId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen,  setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  /* ── keep langRef in sync ── */
  useEffect(() => { langRef.current = lang; }, [lang]);

  /* ── pre-load TTS voices so they're available when speak() is called ── */
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    // voices load async — trigger load and listen for the event
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => { window.speechSynthesis.getVoices(); };
  }, []);

  /* ── role detection ── */
  useEffect(() => {
    const myId   = readCookie('cs_patient_id');
    const myName = readCookie('cs_patient_name');
    if (myId) {
      setPatientMode(true);
      setPatientId(myId);
      setPatientName(myName || 'Friend');
    } else {
      api.getPatients()
        .then(setPatients)
        .catch((err) => {
          console.error('[companion] Failed to load patients:', err);
          setPatients([]);
        });
    }
  }, []);

  // Admin convenience: auto-select the first available patient so chat is immediately usable.
  useEffect(() => {
    if (patientMode) return;
    if (!selectedId && patients.length > 0) {
      setSelectedId(patients[0].id);
    }
  }, [patientMode, patients, selectedId]);

  /* ── AI greets the patient first when page loads ── */
  useEffect(() => {
    if (!patientMode || !patientId) return;
    setLoading(true);
    api.chat(patientId, '__greeting__', 'daily_checkin', undefined, 'patient')
      .then(result => {
        const aiMsg: Message = {
          id: `a-${Date.now()}`,
          role: 'ai',
          content: result.response,
          timestamp: new Date(),
          sentiment: result.sentiment,
          suggestions: result.followUpSuggestions?.slice(0, 4),
        };
        setMessages([aiMsg]);
        setTimeout(() => speak(result.response), 800);
      })
      .catch(() => {/* silent fail — patient can still type */})
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientMode, patientId]);

  /* ── speech recognition setup ── */
  useEffect(() => {
    if (!patientMode) return;
    const SR = (window as Window & { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition
            || (window as Window & { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition;
    if (!SR) return;
    setSpeechReady(true);
    const rec = new SR();
    rec.continuous    = false;
    rec.interimResults = false;
    rec.lang          = LANG_OPTIONS.find(l => l.code === lang)?.speechLocale ?? 'en-MY';
    rec.onresult = (e) => {
      const text = e.results[0][0].transcript;
      setInput(text);
      setListening(false);
      // auto-send after voice
      setTimeout(() => sendMessage(text), 300);
    };
    rec.onerror = () => setListening(false);
    rec.onend   = () => setListening(false);
    recognitionRef.current = rec;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientMode, lang]);

  /* ── text-to-speech ── */
  const speak = useCallback((text: string) => {
    if (!voiceEnabled || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utt  = new SpeechSynthesisUtterance(text);
    utt.rate   = 0.88;
    utt.pitch  = 1.05;
    utt.volume = 1;
    // pick a voice matching the current language
    const voices = window.speechSynthesis.getVoices();
    const locale = LANG_OPTIONS.find(l => l.code === lang)?.speechLocale ?? 'en-MY';
    const localePrefix = locale.split('-')[0]; // 'ms', 'zh', 'ta', 'en'
    utt.lang = locale;
    const preferred = voices.find(v => v.lang === locale)
                   || voices.find(v => v.lang.startsWith(localePrefix))
                   || voices.find(v => v.lang.startsWith('en'));
    if (preferred) utt.voice = preferred;
    utt.onstart = () => setSpeaking(true);
    utt.onend   = () => setSpeaking(false);
    utt.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utt);
  }, [voiceEnabled, lang]);

  const stopSpeaking = () => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  };

  const toggleListen = () => {
    if (!recognitionRef.current) return;
    if (listening) {
      recognitionRef.current.stop();
      setListening(false);
    } else {
      stopSpeaking();
      setListening(true);
      recognitionRef.current.start();
    }
  };

  /* ── load chat history ── */
  useEffect(() => {
    const id = patientMode ? patientId : selectedId;
    if (!id) return;
    setMessages([]);
    api.getChatHistory(id).then((history) => {
      setMessages(history.map(h => ({
        id: h.id,
        role: h.role === 'user' ? 'user' : 'ai',
        content: h.content,
        timestamp: new Date(h.timestamp),
      })));
    }).catch(() => {});
  }, [patientMode, patientId, selectedId]);

  /* ── scroll to bottom ── */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  /* ── outside click to close admin search ── */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /* ── send message ── */
  const sendMessage = useCallback(async (text?: string) => {
    const msgText = (text ?? input).trim();
    const targetId = patientMode ? patientId : selectedId;
    if (!msgText || !targetId || loading) return;

    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: msgText, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    stopSpeaking();

    try {
      const result: CompanionResponse = await api.chat(targetId, msgText, 'general', undefined, patientMode ? 'patient' : 'doctor');
      const aiMsg: Message = {
        id:          `a-${Date.now()}`,
        role:        'ai',
        content:     result.response,
        timestamp:   new Date(),
        sentiment:   result.sentiment,
        flagged:     result.flaggedForCaregiver,
        suggestions: result.followUpSuggestions?.slice(0, 3),
      };
      setMessages(prev => [...prev, aiMsg]);
      if (patientMode) speak(result.response);
    } catch {
      const err: Message = {
        id:        `e-${Date.now()}`,
        role:      'ai',
        content:   patientMode
          ? UI[lang].errorMsg
          : 'Unable to connect to AI backend. Please check your connection.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, err]);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, patientId, selectedId, patientMode, loading, speak]);

  const adminPatient   = patients.find(p => p.id === selectedId);
  const filteredPats   = searchQuery.trim()
    ? patients.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.location.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.conditions.some(c => c.toLowerCase().includes(searchQuery.toLowerCase()))
      ).slice(0, 8)
    : patients.slice(0, 8);

  /* ════════════════════════════════════════════════════════════
     PATIENT VIEW — warm, large, voice-first
  ════════════════════════════════════════════════════════════ */
  if (patientMode) {
    const firstName = patientName.split(' ')[0] || 'Friend';

    const t = UI[lang];
    const prompts = PATIENT_PROMPTS[lang];

    return (
      <div className="flex flex-col h-[calc(100vh-4rem)] -mx-6 -mt-6 bg-gradient-to-b from-violet-50 to-white dark:from-slate-900 dark:to-slate-800">

        {/* ── Header ── */}
        <div className="shrink-0 px-6 pt-6 pb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-200 dark:shadow-violet-900/40 shrink-0">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">{t.hello}, {firstName}!</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">{t.subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Language toggle */}
            <div className="flex rounded-xl border-2 border-slate-200 dark:border-slate-700 overflow-hidden">
              {LANG_OPTIONS.map(({ code, label }) => (
                <button
                  key={code}
                  onClick={() => { setLang(code); langRef.current = code; }}
                  className={`px-2.5 py-2 text-xs font-bold transition-all ${
                    lang === code
                      ? 'bg-violet-600 text-white'
                      : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}>
                  {label}
                </button>
              ))}
            </div>

            {/* Voice toggle */}
            <button
              onClick={() => { setVoiceEnabled(v => !v); if (speaking) stopSpeaking(); }}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all border-2 ${
                voiceEnabled
                  ? 'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-700 text-violet-700 dark:text-violet-300'
                  : 'bg-slate-100 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400'
              }`}>
              {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              <span className="hidden sm:inline">{voiceEnabled ? t.voiceOn : t.voiceOff}</span>
            </button>
          </div>
        </div>

        {/* ── Messages ── */}
        <div className="flex-1 overflow-y-auto px-5 py-2">

          {/* Empty state — AI is loading the greeting */}
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center min-h-[40vh] text-center gap-5 px-4">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-violet-400 to-indigo-600 flex items-center justify-center shadow-xl shadow-violet-200/60 dark:shadow-violet-900/40">
                {loading
                  ? <Loader2 className="w-10 h-10 text-white animate-spin" />
                  : <Brain className="w-10 h-10 text-white" />}
              </div>
              {loading ? (
                <p className="text-lg text-slate-500 dark:text-slate-400">{t.thinking}</p>
              ) : (
                <>
                  <div>
                    <p className="text-2xl font-bold text-slate-700 dark:text-slate-200 mb-2">{t.iAmHere}</p>
                    <p className="text-base text-slate-500 dark:text-slate-400">{t.tapToChat}</p>
                  </div>
                  {/* Fallback prompts — only shown if greeting failed */}
                  <div className="w-full max-w-sm space-y-3 mt-2">
                    {prompts.map(({ icon: Icon, label, query }) => (
                      <button
                        key={label}
                        onClick={() => sendMessage(query)}
                        disabled={loading}
                        className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20 active:scale-95 transition-all text-left shadow-sm">
                        <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center shrink-0">
                          <Icon className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                        </div>
                        <span className="text-base font-semibold text-slate-700 dark:text-slate-200">{label}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Messages */}
          <div className="space-y-5 py-2">
            {messages.map((msg, msgIdx) => (
              <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>

                {/* AI avatar */}
                {msg.role === 'ai' && (
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0 mt-1 shadow-md shadow-violet-200/50 dark:shadow-violet-900/30">
                    <Brain className="w-5 h-5 text-white" />
                  </div>
                )}

                <div className={`flex flex-col ${msg.role === 'user' ? 'items-end max-w-[78%]' : 'items-start max-w-[85%]'}`}>
                  <div className={`rounded-3xl px-5 py-4 text-lg leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-br from-violet-600 to-indigo-600 text-white rounded-br-md'
                      : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border-2 border-slate-100 dark:border-slate-700 rounded-bl-md shadow-sm'
                  }`}>
                    <p className="whitespace-pre-wrap">{msg.content}</p>

                    {msg.flagged && (
                      <div className="mt-3 flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm border-t border-amber-200/50 dark:border-amber-700/30 pt-2">
                        <PhoneCall className="w-4 h-4 shrink-0" />
                        {t.caregiverNotified}
                      </div>
                    )}
                  </div>

                  {/* Read aloud button for AI messages */}
                  {msg.role === 'ai' && (
                    <button
                      onClick={() => speaking ? stopSpeaking() : speak(msg.content)}
                      className="mt-1.5 ml-1 flex items-center gap-1.5 text-xs text-slate-400 hover:text-violet-500 transition-colors">
                      <Volume2 className="w-3.5 h-3.5" />
                      {speaking ? t.stopReading : t.readAloud}
                    </button>
                  )}

                  {/* Follow-up suggestion chips — only on last AI message in patient mode */}
                  {patientMode && msg.role === 'ai' && msgIdx === messages.length - 1 && msg.suggestions && msg.suggestions.length > 0 && !loading && (
                    <div className="mt-3 flex flex-wrap gap-2 ml-1">
                      {msg.suggestions.map((s, i) => (
                        <button
                          key={i}
                          onClick={() => sendMessage(s)}
                          className="px-3.5 py-2 rounded-full bg-violet-50 dark:bg-violet-900/30 border border-violet-200 dark:border-violet-700 text-violet-700 dark:text-violet-300 text-sm font-medium hover:bg-violet-100 dark:hover:bg-violet-800/40 hover:border-violet-300 transition-all active:scale-95">
                          {s}
                        </button>
                      ))}
                    </div>
                  )}

                  <span className="text-xs text-slate-300 dark:text-slate-600 mt-1 px-1">
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {/* User avatar */}
                {msg.role === 'user' && (
                  <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0 mt-1">
                    <User className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                  </div>
                )}
              </div>
            ))}

            {/* Thinking indicator */}
            {loading && (
              <div className="flex gap-3 justify-start">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-md shadow-violet-200/50 dark:shadow-violet-900/30">
                  <Brain className="w-5 h-5 text-white" />
                </div>
                <div className="bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-3xl rounded-bl-md px-5 py-4 flex items-center gap-3 shadow-sm">
                  <Loader2 className="w-5 h-5 text-violet-500 animate-spin" />
                  <span className="text-base text-slate-400 dark:text-slate-500">{t.thinking}</span>
                </div>
              </div>
            )}

            {/* Speaking indicator */}
            {speaking && (
              <div className="flex justify-center">
                <div className="flex items-center gap-2 px-4 py-2 bg-violet-100 dark:bg-violet-900/30 rounded-full">
                  <Volume2 className="w-4 h-4 text-violet-600 dark:text-violet-400 animate-pulse" />
                  <span className="text-sm text-violet-700 dark:text-violet-300 font-medium">{t.readingAloud}</span>
                  <button onClick={stopSpeaking} className="text-violet-500 hover:text-violet-700 ml-1">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} className="h-2" />
          </div>
        </div>

        {/* ── Listening status banner ── */}
        {listening && (
          <div className="shrink-0 mx-5 mb-3">
            <div className="flex items-center justify-center gap-3 py-3 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-700 rounded-2xl">
              <div className="flex gap-1">
                {[0, 150, 300].map(d => (
                  <span key={d} className="w-2 h-5 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                ))}
              </div>
              <span className="text-base font-bold text-red-600 dark:text-red-400">{t.listening}</span>
            </div>
          </div>
        )}

        {/* ── Input bar ── */}
        <div className="shrink-0 px-5 pb-6 pt-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-t border-slate-100 dark:border-slate-800">

          {/* Text input */}
          <div className="flex items-center gap-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl px-5 py-3 focus-within:border-violet-400 dark:focus-within:border-violet-600 transition-all shadow-sm">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder={t.typePlaceholder}
              disabled={loading || listening}
              className="flex-1 bg-transparent text-lg text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none disabled:opacity-40"
            />
            {speechReady && (
              <button
                onClick={toggleListen}
                disabled={loading}
                title={listening ? t.tapToStop : t.tapToSpeak}
                className={`w-11 h-11 rounded-xl flex items-center justify-center border transition-all shrink-0 active:scale-95 disabled:opacity-30 ${
                  listening
                    ? 'bg-red-500 border-red-500 text-white hover:bg-red-600'
                    : 'bg-violet-50 dark:bg-violet-900/25 border-violet-200 dark:border-violet-700 text-violet-600 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/40'
                }`}
              >
                {listening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
            )}
            <button
              onClick={() => sendMessage()}
              disabled={loading || !input.trim() || listening}
              className="w-11 h-11 rounded-xl flex items-center justify-center bg-gradient-to-br from-violet-500 to-indigo-600 text-white disabled:opacity-30 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-violet-200 dark:hover:shadow-violet-900/40 hover:scale-105 active:scale-95 transition-all shrink-0">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </div>

          <p className="text-center text-xs text-slate-300 dark:text-slate-600 mt-2.5 select-none">
            {t.privacy}
          </p>
        </div>
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════════
     ADMIN / DOCTOR VIEW — clinical, compact, professional
  ════════════════════════════════════════════════════════════ */
  return (
    <div className="flex h-[calc(100vh-4rem)] -mx-6 -mt-6">

      {/* ── Left sidebar ── */}
      <aside className="w-60 shrink-0 flex flex-col bg-slate-50 dark:bg-slate-900 border-r border-slate-200/70 dark:border-slate-800">
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-sm">
              <Brain className="w-3 h-3 text-white" />
            </div>
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 tracking-tight">Clinical Assistant</span>
          </div>
        </div>

        {/* Patient search */}
        <div className="px-3 pb-3">
          <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 px-2">Patient</p>
          <div ref={searchRef} className="relative">
            <div className="relative flex items-center">
              <Search className="absolute left-2.5 w-3 h-3 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setSearchOpen(true); }}
                onFocus={() => setSearchOpen(true)}
                placeholder="Search patients…"
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-7 pr-6 py-1.5 text-xs text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-violet-300 dark:focus:border-violet-600 focus:ring-1 focus:ring-violet-500/20 transition-all"
              />
              {searchQuery && (
                <button onClick={() => { setSearchQuery(''); setSearchOpen(true); }} className="absolute right-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {searchOpen && (
              <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200/80 dark:border-slate-700 overflow-hidden max-h-52 overflow-y-auto">
                {filteredPats.length === 0 ? (
                  <p className="px-3 py-3 text-xs text-slate-400 text-center">No patients found</p>
                ) : (
                  filteredPats.map(p => (
                    <button
                      key={p.id}
                      onClick={() => { setSelectedId(p.id); setSearchQuery(''); setSearchOpen(false); }}
                      className={`w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors border-b border-slate-100/60 dark:border-slate-700/60 last:border-0 ${selectedId === p.id ? 'bg-violet-50 dark:bg-violet-900/20' : ''}`}>
                      <p className="text-xs font-medium text-slate-800 dark:text-slate-200">{p.name}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{p.age}y · {p.location.city}</p>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Selected patient card */}
          {adminPatient && (
            <div className="mt-2 px-2 py-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700/60">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center shrink-0">
                  <User className="w-2.5 h-2.5 text-white" />
                </div>
                <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">{adminPatient.name}</p>
              </div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 ml-7">{adminPatient.age}y · {adminPatient.gender}</p>
              {adminPatient.conditions.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5 ml-7">
                  {adminPatient.conditions.slice(0, 2).map(c => (
                    <span key={c} className="text-[9px] bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 rounded-full px-1.5 py-0.5">{c}</span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Quick queries */}
        <div className="flex-1 overflow-y-auto px-3 pt-1 pb-3">
          <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5 px-2">Quick Queries</p>
          <div className="space-y-px">
            {ADMIN_QUERIES.map(({ icon: Icon, label, query }) => (
              <button
                key={label}
                onClick={() => sendMessage(query)}
                disabled={loading || !selectedId}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-left transition-colors hover:bg-white dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30 group">
                <Icon className="w-3 h-3 shrink-0 text-slate-300 dark:text-slate-600 group-hover:text-violet-400 transition-colors" />
                <span className="flex-1 truncate leading-snug">{label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="px-5 py-3 border-t border-slate-200/60 dark:border-slate-800">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] text-slate-400 dark:text-slate-500">Gemini 2.5 Flash</span>
          </div>
        </div>
      </aside>

      {/* ── Main chat area ── */}
      <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 overflow-hidden">

        {/* Header strip */}
        {adminPatient && (
          <div className="shrink-0 flex items-center justify-between px-8 py-3 border-b border-slate-100 dark:border-slate-800/60">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-sm">
                <Brain className="w-3 h-3 text-white" />
              </div>
              <span className="text-sm text-slate-700 dark:text-slate-300">
                Consulting on <span className="font-semibold text-slate-900 dark:text-slate-100">{adminPatient.name}</span>
              </span>
              <span className="text-slate-300 dark:text-slate-600 text-xs">·</span>
              <span className="text-xs text-slate-400 dark:text-slate-500">{adminPatient.age}y · {adminPatient.conditions[0]}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-[11px] text-slate-400">Live data</span>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto w-full px-6 py-8">

            {/* No patient selected */}
            {!selectedId && (
              <div className="flex flex-col items-center justify-center min-h-[62vh] text-center select-none">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center mb-6 shadow-lg shadow-violet-200/60 dark:shadow-violet-900/30">
                  <Brain className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-2xl font-semibold text-slate-800 dark:text-slate-100 mb-2 tracking-tight">AI Clinical Assistant</h1>
                <p className="text-[15px] text-slate-400 dark:text-slate-500 max-w-sm leading-relaxed mb-10">
                  Search for a patient on the left, then ask clinical questions — vitals, trends, medications, and risk assessment.
                </p>
                <div className="flex flex-wrap gap-2 justify-center max-w-md">
                  {['Vital trend summary', 'Medication concerns', 'Risk factors', 'Clinical summary', 'Deterioration signs'].map(chip => (
                    <span key={chip} className="px-3.5 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 bg-transparent cursor-default select-none">
                      {chip}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Patient selected, no messages */}
            {selectedId && messages.length === 0 && (
              <div className="flex flex-col items-center justify-center min-h-[58vh] text-center select-none">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center mb-5 shadow-md shadow-violet-200/50 dark:shadow-violet-900/30">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <p className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-1 tracking-tight">
                  Ready for {adminPatient?.name}
                </p>
                <p className="text-sm text-slate-400 dark:text-slate-500 max-w-xs mb-8 leading-relaxed">
                  Ask anything — vitals, trends, medications, or a full clinical summary.
                </p>
                <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                  {ADMIN_QUERIES.map(({ label, query }) => (
                    <button
                      key={label}
                      onClick={() => sendMessage(query)}
                      disabled={loading}
                      className="px-3.5 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400 bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 hover:text-slate-900 dark:hover:text-slate-200 transition-all disabled:opacity-40">
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Messages */}
            <div className="space-y-6">
              {messages.map(msg => (
                <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'ai' && (
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                      <Brain className="w-3.5 h-3.5 text-white" />
                    </div>
                  )}
                  <div className={`flex flex-col ${msg.role === 'user' ? 'items-end max-w-[72%]' : 'items-start max-w-[80%]'}`}>
                    <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-br from-violet-600 to-indigo-600 text-white rounded-br-sm'
                        : 'bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 rounded-bl-sm'
                    }`}>
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                      {msg.flagged && (
                        <div className="mt-2 flex items-center gap-1.5 text-amber-500 dark:text-amber-400 text-[11px] border-t border-amber-200/50 dark:border-amber-700/30 pt-2">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          Caregiver alert triggered
                        </div>
                      )}
                    </div>
                    <div className={`flex items-center gap-2 mt-1 px-0.5 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                      <span className="text-[10px] text-slate-300 dark:text-slate-600">
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {msg.sentiment && msg.role === 'ai' && (
                        <span className={`text-[9px] font-medium px-2 py-0.5 rounded-full ${
                          msg.sentiment === 'urgent'      ? 'bg-red-50 dark:bg-red-900/20 text-red-500' :
                          msg.sentiment === 'informative' ? 'bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400' :
                          msg.sentiment === 'reassuring'  ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' :
                          'bg-slate-100 dark:bg-slate-800 text-slate-400'
                        }`}>
                          {msg.sentiment}
                        </span>
                      )}
                    </div>
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                      <Stethoscope className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="flex justify-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-sm">
                    <Brain className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/80 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 text-violet-500 animate-spin" />
                    <span className="text-xs text-slate-400 dark:text-slate-500">Analysing patient data…</span>
                  </div>
                </div>
              )}
            </div>

            <div ref={messagesEndRef} className="h-4" />
          </div>
        </div>

        {/* Input bar */}
        <div className="shrink-0 px-6 pb-6 pt-3 bg-white dark:bg-slate-900">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center gap-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full px-5 py-3 shadow-sm focus-within:border-violet-300 dark:focus-within:border-violet-600/60 focus-within:shadow-md transition-all">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                placeholder={adminPatient ? `Ask about ${adminPatient.name}…` : 'Select a patient to begin…'}
                disabled={!selectedId}
                className="flex-1 bg-transparent text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none disabled:opacity-40"
              />
              <button
                onClick={() => sendMessage()}
                disabled={loading || !input.trim() || !selectedId}
                className="w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-br from-violet-500 to-indigo-600 text-white disabled:opacity-30 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-violet-200 dark:hover:shadow-violet-900/40 hover:scale-105 active:scale-95 transition-all shrink-0">
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="text-[10px] text-slate-300 dark:text-slate-700 text-center mt-2.5 select-none">
              Grounded in real patient vitals via RAG memory · Gemini 2.5 Flash
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
