'use client';

import React from 'react';
import { RefreshCw, SearchX, UploadCloud, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PatientListEmptyProps {
  isFiltered: boolean;
  onResetFilters?: () => void;
  onLoadDemoCohort?: () => void;
  onUploadClick?: () => void;
}

export function PatientListEmpty({
  isFiltered,
  onResetFilters,
  onLoadDemoCohort,
  onUploadClick,
}: PatientListEmptyProps) {
  if (isFiltered) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="grid size-10 place-items-center rounded-2xl bg-white/70 text-slate-400 shadow-sm">
          <SearchX className="size-5" />
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-700">
            No matching patients
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            Try adjusting your search terms or filter criteria.
          </p>
        </div>
        {onResetFilters && (
          <Button
            variant="outline"
            size="sm"
            onClick={onResetFilters}
            className="h-7 rounded-xl border-white bg-white/80 text-xs text-slate-700 hover:bg-white"
          >
            <RefreshCw className="mr-1.5 size-3" /> Reset filters
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="grid size-10 place-items-center rounded-2xl bg-white/70 text-slate-400 shadow-sm">
        <Users className="size-5" />
      </div>
      <div>
        <p className="text-xs font-semibold text-slate-700">Cohort is empty</p>
        <p className="mt-1 text-[11px] text-slate-400">
          Load the pre-trained Kaggle demo cohort or upload your own CSV records.
        </p>
      </div>
      <div className="flex flex-col gap-2 w-full max-w-[200px]">
        {onLoadDemoCohort && (
          <Button
            variant="outline"
            size="sm"
            onClick={onLoadDemoCohort}
            className="h-8 rounded-xl border-white bg-white/90 text-xs font-medium text-slate-700 shadow-sm hover:bg-white"
          >
            Load Demo Cohort
          </Button>
        )}
        {onUploadClick && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onUploadClick}
            className="h-8 rounded-xl text-xs text-slate-500 hover:bg-white/60"
          >
            <UploadCloud className="mr-1.5 size-3.5 text-cyan-500" />
            Import CSV / TXT
          </Button>
        )}
      </div>
    </div>
  );
}
