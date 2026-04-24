'use client';

import React from 'react';
import Link from 'next/link';
import { Zap, MessageCircle, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { RiskAssessment } from '@/lib/api';

interface ActivityItem {
  id: string;
  type: 'assessment' | 'alert' | 'agent' | 'report';
  message: string;
  timestamp: Date;
  status: 'info' | 'warning' | 'critical' | 'success';
}

interface ActivityFeedProps {
  assessments: RiskAssessment[];
}

export default function ActivityFeed({ assessments }: ActivityFeedProps) {
  const activities: ActivityItem[] = assessments.slice(0, 10).map((a) => {
    let message = `AI assessed risk for patient ID ${a.patientId.slice(-4)}`;
    let status: ActivityItem['status'] = 'info';
    let type: ActivityItem['type'] = 'assessment';

    if (a.riskLevel === 'high') {
      message = `🚨 Emergency Agent triggered for patient ID ${a.patientId.slice(-4)}`;
      status = 'critical';
      type = 'alert';
    } else if (a.riskLevel === 'medium') {
      message = `⚠️ Warning generated for patient ID ${a.patientId.slice(-4)}`;
      status = 'warning';
      type = 'assessment';
    }

    return { id: a.id, type, message, timestamp: new Date(a.timestamp), status };
  });

  const getIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'alert': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'agent': return <Zap className="w-4 h-4 text-teal-500" />;
      default:      return <MessageCircle className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-card flex flex-col h-full">
      <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Zap className="w-4 h-4 text-teal-500" />
          Autonomous Agent Log
        </h3>
        <span className="text-[10px] font-bold text-teal-600 bg-teal-50 dark:bg-teal-900/20 px-2 py-0.5 rounded-full animate-pulse">
          LIVE
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[350px]">
        {activities.length > 0 ? (
          activities.map((item) => (
            <div key={item.id} className="flex gap-3">
              <div className={`mt-1 w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                item.status === 'critical' ? 'bg-red-50 dark:bg-red-900/20' :
                item.status === 'warning'  ? 'bg-amber-50 dark:bg-amber-900/20' :
                'bg-slate-50 dark:bg-slate-700'
              }`}>
                {getIcon(item.type)}
              </div>
              <div className="min-w-0">
                <p className={`text-xs font-medium leading-relaxed ${
                  item.status === 'critical' ? 'text-red-700 dark:text-red-400' : 'text-slate-700 dark:text-slate-300'
                }`}>
                  {item.message}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {formatDistanceToNow(item.timestamp, { addSuffix: true })}
                </p>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-sm italic">No recent activity detected.</div>
        )}
      </div>
      <div className="p-3 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/30">
        <Link href="/alerts" className="text-[10px] font-bold text-brand-600 dark:text-brand-400 hover:text-brand-700 uppercase tracking-wider w-full text-center block">
          View Full Audit Logs
        </Link>
      </div>
    </div>
  );
}
