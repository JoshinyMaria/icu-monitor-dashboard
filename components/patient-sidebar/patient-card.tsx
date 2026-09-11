'use client';

import React from 'react';
import { Droplets, Edit3, HeartPulse } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PatientRecord } from '@/lib/patient-types';

interface PatientCardProps {
  patient: PatientRecord;
  isSelected: boolean;
  onSelect: (patient: PatientRecord) => void;
}

export function PatientCard({
  patient,
  isSelected,
  onSelect,
}: PatientCardProps) {
  const isCritical = patient.riskLevel === 'critical';
  const isModerate = patient.riskLevel === 'moderate';

  return (
    <li className="list-none">
      <button
        type="button"
        aria-pressed={isSelected}
        onClick={() => onSelect(patient)}
        className={cn(
          'relative flex h-[86px] w-full flex-col justify-between rounded-2xl p-3 text-left transition-[background-color,border-color,box-shadow,transform] duration-150 active:scale-[0.96]',
          'border border-white/60 bg-white/50 backdrop-blur-md hover:bg-white/80 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400',
          isSelected &&
            'border-violet-200/90 bg-white/95 shadow-[0_8px_24px_rgba(70,80,120,0.09)] ring-1 ring-violet-400/40',
        )}
      >
        {isSelected && (
          <span
            className="absolute -left-[1px] bottom-3 top-3 w-1.5 rounded-r-full bg-gradient-to-b from-pink-500 to-cyan-500"
            aria-hidden="true"
          />
        )}

        <div className="flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={cn(
                'size-2.5 shrink-0 rounded-full',
                isCritical && 'bg-rose-500 ring-2 ring-rose-300/60 animate-pulse',
                isModerate && 'bg-amber-400 ring-2 ring-amber-200/60',
                !isCritical && !isModerate && 'bg-emerald-400 ring-2 ring-emerald-200/60',
              )}
              aria-hidden="true"
            />
            <span className="truncate text-xs font-semibold tracking-tight text-slate-800">
              {patient.name}
            </span>
          </div>
          <span className="shrink-0 font-mono text-[11px] font-semibold tabular-nums text-slate-500">
            {patient.bed}
          </span>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span className="truncate tabular-nums">
            {patient.id} · {patient.age}y
          </span>
          <div className="flex shrink-0 items-center gap-1.5 font-mono">
            <span
              className={cn(
                'text-xs font-semibold tabular-nums',
                isCritical && 'text-rose-600',
                isModerate && 'text-amber-600',
                !isCritical && !isModerate && 'text-emerald-600',
              )}
            >
              {patient.riskScore}%
            </span>
            <span className="text-[10px] text-slate-400">risk</span>
          </div>
        </div>

        <div className="flex h-4 items-center gap-1 overflow-hidden">
          {patient.currentVitals.hr > 100 && (
            <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-rose-600">
              <HeartPulse className="size-2.5" /> {patient.currentVitals.hr}
            </span>
          )}
          {patient.currentVitals.spo2 < 92 && (
            <span className="inline-flex items-center gap-1 rounded-md bg-cyan-50 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-cyan-700">
              <Droplets className="size-2.5" /> {patient.currentVitals.spo2}%
            </span>
          )}
          {patient.isModified && (
            <span className="inline-flex items-center gap-1 rounded-md bg-violet-50 px-1.5 py-0.5 font-mono text-[10px] text-violet-600">
              <Edit3 className="size-2.5" /> what-if
            </span>
          )}
          {patient.currentVitals.hr <= 100 && patient.currentVitals.spo2 >= 92 && !patient.isModified && (
            <span className="truncate font-mono text-[10px] text-slate-400">
              {patient.unit}
            </span>
          )}
        </div>
      </button>
    </li>
  );
}
