'use client';

import React from 'react';
import { Radio, ShieldCheck, Download, AlertCircle, Send, Cpu } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';

export default function QuickActions() {
  const { addToast } = useToast();

  const actions = [
    {
      label: 'Broadcast to Caregivers',
      icon: Radio,
      color: 'bg-blue-500',
      desc: 'Send city-wide alert',
      action: () => addToast('System-wide broadcast sent to 842 caregivers in Johor.', 'info'),
    },
    {
      label: 'System Health Sweep',
      icon: ShieldCheck,
      color: 'bg-teal-500',
      desc: 'Verify all IoT links',
      action: () => addToast('IoT Diagnostic complete: 1,000 links verified.', 'success'),
    },
    {
      label: 'Export High-Risk PDF',
      icon: Download,
      color: 'bg-purple-500',
      desc: 'Current clinical summaries',
      action: () => addToast('High-risk batch report generated.', 'info'),
    },
    {
      label: 'Emergency Override',
      icon: AlertCircle,
      color: 'bg-red-500',
      desc: 'Manual agent trigger',
      action: () => addToast('Emergency override active. All priority-1 protocols engaged.', 'error'),
    },
  ];

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-card p-4 h-full">
      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
        <Cpu className="w-4 h-4 text-brand-500" />
        Quick Action Command Center
      </h3>
      <div className="grid grid-cols-1 gap-3">
        {actions.map((act) => (
          <button key={act.label} onClick={act.action}
            className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 hover:shadow-sm transition-all group text-left">
            <div className={`w-10 h-10 rounded-lg ${act.color} flex items-center justify-center shrink-0 shadow-sm`}>
              <act.icon className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{act.label}</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{act.desc}</p>
            </div>
            <Send className="w-3 h-3 text-slate-300 dark:text-slate-600 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        ))}
      </div>
      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-4 text-center">
        Secure Admin Tunnel ID: <span className="font-mono">AE-99-CS</span>
      </p>
    </div>
  );
}
