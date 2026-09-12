'use client';

import React from 'react';
import { ChevronLeft, ChevronRight, Upload, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';

interface PatientCycleControlsProps {
  currentIndex: number;
  totalCount: number;
  onPrevious: () => void;
  onNext: () => void;
  onJumpCritical: () => void;
  hasCritical: boolean;
  onUploadClick: () => void;
}

export function PatientCycleControls({
  currentIndex,
  totalCount,
  onPrevious,
  onNext,
  onJumpCritical,
  hasCritical,
  onUploadClick,
}: PatientCycleControlsProps) {
  return (
    <div className="flex flex-col gap-2 border-t border-white/80 bg-white/60 p-3 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={onPrevious}
          disabled={totalCount <= 1}
          className="h-10 min-h-[40px] flex-1 rounded-xl border-white bg-white/70 text-xs font-medium text-slate-700 transition-[color,background-color,border-color,transform] duration-150 hover:bg-white active:scale-[0.96]"
          title="Previous patient (Shortcut: [ )"
          aria-label="Previous patient"
        >
          <ChevronLeft className="mr-0.5 size-3.5" />
          <span>Prev</span>
          <Kbd className="ml-1 hidden text-[9px] sm:inline-block">[</Kbd>
        </Button>

        <span className="shrink-0 px-2 font-mono text-[11px] font-semibold tabular-nums text-slate-500">
          {totalCount > 0 ? `${currentIndex + 1} / ${totalCount}` : '0 / 0'}
        </span>

        <Button
          variant="outline"
          size="sm"
          onClick={onNext}
          disabled={totalCount <= 1}
          className="h-10 min-h-[40px] flex-1 rounded-xl border-white bg-white/70 text-xs font-medium text-slate-700 transition-[color,background-color,border-color,transform] duration-150 hover:bg-white active:scale-[0.96]"
          title="Next patient (Shortcut: ] )"
          aria-label="Next patient"
        >
          <span>Next</span>
          <Kbd className="mr-0.5 hidden text-[9px] sm:inline-block">]</Kbd>
          <ChevronRight className="ml-0.5 size-3.5" />
        </Button>
      </div>

      <div className="flex items-center gap-1.5">
        {hasCritical && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onJumpCritical}
            className="h-10 min-h-[40px] flex-1 rounded-xl bg-rose-50/80 text-[11px] font-medium text-rose-600 transition-[color,background-color,transform] duration-150 hover:bg-rose-100 hover:text-rose-700 active:scale-[0.96]"
            title="Jump to next critical patient (Shortcut: Alt+C)"
          >
            <Zap className="mr-1 size-3.5 fill-rose-500 text-rose-500" />
            <span>Next Critical</span>
            <Kbd className="ml-auto text-[9px]">Alt+C</Kbd>
          </Button>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={onUploadClick}
          className="h-10 min-h-[40px] min-w-[40px] rounded-xl px-2 text-[11px] text-slate-500 transition-[color,background-color,transform] duration-150 hover:bg-slate-100 hover:text-slate-800 active:scale-[0.96]"
          title="Import CSV or TXT cohort"
        >
          <Upload className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
