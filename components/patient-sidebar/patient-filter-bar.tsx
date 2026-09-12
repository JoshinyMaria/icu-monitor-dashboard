'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { RiskLevel } from '@/lib/patient-types';

interface PatientFilterBarProps {
  selectedFilter: RiskLevel;
  onFilterChange: (filter: RiskLevel) => void;
  counts: Record<RiskLevel, number>;
}

export function PatientFilterBar({
  selectedFilter,
  onFilterChange,
  counts,
}: PatientFilterBarProps) {
  const filters: Array<{
    id: RiskLevel;
    label: string;
    badgeColor?: string;
  }> = [
    { id: 'all', label: 'All' },
    {
      id: 'critical',
      label: 'High',
      badgeColor: 'text-rose-600 bg-rose-50',
    },
    {
      id: 'moderate',
      label: 'Med',
      badgeColor: 'text-amber-600 bg-amber-50',
    },
    {
      id: 'stable',
      label: 'Stable',
      badgeColor: 'text-emerald-600 bg-emerald-50',
    },
  ];

  return (
    <div
      role="tablist"
      aria-label="Filter patients by risk level"
      className="grid grid-cols-4 gap-1 rounded-xl bg-slate-200/50 p-1 backdrop-blur-md"
    >
      {filters.map((tab) => {
        const isSelected = selectedFilter === tab.id;
        const count = counts[tab.id] ?? 0;

        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={isSelected}
            onClick={() => onFilterChange(tab.id)}
            className={cn(
              'flex min-h-[40px] items-center justify-center gap-1 rounded-lg px-1.5 py-2 text-[11px] font-medium transition-[background-color,color,box-shadow,transform] duration-150 active:scale-[0.96]',
              'text-slate-500 hover:text-slate-800',
              isSelected &&
                'bg-white text-slate-900 shadow-sm font-semibold',
            )}
          >
            <span>{tab.label}</span>
            <span
              className={cn(
                'rounded-full px-1 text-[9px] font-mono tabular-nums leading-tight',
                tab.badgeColor ? tab.badgeColor : 'bg-slate-100 text-slate-500',
              )}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
