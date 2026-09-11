'use client';

import React, { useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  HeartPulse,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PatientRecord, RiskLevel } from '@/lib/patient-types';
import { PatientSearchBar } from './patient-search-bar';
import { PatientFilterBar } from './patient-filter-bar';
import { PatientCard } from './patient-card';
import { PatientCycleControls } from './patient-cycle-controls';
import { PatientListSkeleton } from './patient-list-skeleton';
import { PatientListEmpty } from './patient-list-empty';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface PatientSidebarProps {
  cohort: PatientRecord[];
  selectedPatient: PatientRecord | null;
  onSelectPatient: (patient: PatientRecord) => void;
  onCyclePatient: (direction: 'prev' | 'next') => void;
  onJumpCritical: () => void;
  isLoading?: boolean;
  onFileUpload?: (file: File) => Promise<void> | void;
  onLoadDemoCohort?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  className?: string;
}

export function PatientSidebar({
  cohort,
  selectedPatient,
  onSelectPatient,
  onCyclePatient,
  onJumpCritical,
  isLoading = false,
  onFileUpload,
  onLoadDemoCohort,
  isCollapsed = false,
  onToggleCollapse,
  className,
}: PatientSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState<RiskLevel>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Compute counts for filter pills
  const counts = useMemo(() => {
    const res: Record<RiskLevel, number> = {
      all: cohort.length,
      critical: 0,
      moderate: 0,
      stable: 0,
    };
    for (const p of cohort) {
      if (p.riskLevel in res) {
        res[p.riskLevel]++;
      }
    }
    return res;
  }, [cohort]);

  // Filtered and searched patient list
  const filteredPatients = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return cohort.filter((p) => {
      if (riskFilter !== 'all' && p.riskLevel !== riskFilter) {
        return false;
      }
      if (!query) return true;
      return (
        p.name.toLowerCase().includes(query) ||
        p.id.toLowerCase().includes(query) ||
        p.bed.toLowerCase().includes(query) ||
        p.unit.toLowerCase().includes(query)
      );
    });
  }, [cohort, searchQuery, riskFilter]);

  // Current index in filtered list (for Prev/Next display)
  const currentIndex = useMemo(() => {
    if (!selectedPatient) return 0;
    const idx = filteredPatients.findIndex((p) => p.id === selectedPatient.id);
    return idx >= 0 ? idx : 0;
  }, [filteredPatients, selectedPatient]);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onFileUpload) {
      void onFileUpload(file);
    }
    // Reset file input value so re-uploading the same file still triggers onChange
    e.target.value = '';
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setRiskFilter('all');
  };

  const handleCycle = (direction: 'prev' | 'next') => {
    if (filteredPatients.length === 0) {
      onCyclePatient(direction);
      return;
    }
    const nextIdx =
      direction === 'next'
        ? (currentIndex + 1) % filteredPatients.length
        : (currentIndex - 1 + filteredPatients.length) % filteredPatients.length;
    onSelectPatient(filteredPatients[nextIdx]);
  };

  const handleJumpCritical = () => {
    const criticalPatients = cohort.filter((p) => p.riskLevel === 'critical');
    if (criticalPatients.length === 0) {
      onJumpCritical();
      return;
    }
    const currentCritIdx = selectedPatient
      ? criticalPatients.findIndex((p) => p.id === selectedPatient.id)
      : -1;
    const nextCrit =
      criticalPatients[(currentCritIdx + 1) % criticalPatients.length];
    onSelectPatient(nextCrit);
  };

  const hasCriticalPatients = counts.critical > 0;

  return (
    <aside
      aria-label="Patient Roster"
      className={cn(
        'relative flex h-full flex-col border-r border-white/70 bg-[#f8faff]/85 backdrop-blur-2xl transition-all duration-300',
        isCollapsed ? 'w-[72px]' : 'w-[310px] xl:w-[330px]',
        className,
      )}
    >
      {/* Hidden file input for cohort CSV/TXT upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.txt"
        className="hidden"
        tabIndex={-1}
        onChange={handleFileInputChange}
      />

      {/* Screen reader live update announcement */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {selectedPatient
          ? `Current patient: ${selectedPatient.name}, ${selectedPatient.bed}, Risk score ${selectedPatient.riskScore} percent`
          : 'No patient selected'}
      </div>

      {/* Header section */}
      <div className="flex flex-col gap-3 border-b border-white/70 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="brand-orb grid size-9 shrink-0 place-items-center rounded-xl text-white shadow-md shadow-pink-200/50">
              <HeartPulse className="size-4" />
            </div>
            {!isCollapsed && (
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-xs font-semibold tracking-tight text-slate-800">
                    ICU AI Monitor
                  </span>
                  <Badge
                    variant="outline"
                    className="h-4 border-pink-200/60 bg-white/60 px-1 text-[9px] text-pink-600"
                  >
                    <Sparkles className="size-2" /> SaaS
                  </Badge>
                </div>
                <div className="truncate text-[10px] text-slate-400">
                  {cohort.length} Patients · {counts.critical} Critical
                </div>
              </div>
            )}
          </div>

          {onToggleCollapse && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleCollapse}
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="size-8 shrink-0 rounded-lg text-slate-400 hover:bg-white/80 hover:text-slate-600"
            >
              {isCollapsed ? (
                <PanelLeftOpen className="size-4" />
              ) : (
                <PanelLeftClose className="size-4" />
              )}
            </Button>
          )}
        </div>

        {/* Search & Filter Controls (hidden when collapsed to icon rail) */}
        {!isCollapsed && (
          <div className="flex flex-col gap-2 pt-1">
            <PatientSearchBar
              query={searchQuery}
              onChange={setSearchQuery}
            />
            <PatientFilterBar
              selectedFilter={riskFilter}
              onFilterChange={setRiskFilter}
              counts={counts}
            />
          </div>
        )}
      </div>

      {/* Content: Scrollable Patient Roster */}
      <div className="flex-1 overflow-y-auto px-3 py-3 scrollbar-thin">
        {isLoading ? (
          <PatientListSkeleton count={6} />
        ) : filteredPatients.length === 0 ? (
          <PatientListEmpty
            isFiltered={Boolean(searchQuery || riskFilter !== 'all')}
            onResetFilters={handleResetFilters}
            onLoadDemoCohort={onLoadDemoCohort}
            onUploadClick={() => fileInputRef.current?.click()}
          />
        ) : (
          <ul
            aria-label="Patients List"
            className="space-y-2"
          >
            {filteredPatients.map((patient) => {
              const isSelected = selectedPatient?.id === patient.id;
              if (isCollapsed) {
                // Collapsed icon avatar representation
                return (
                  <li key={patient.id} className="list-none">
                    <button
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => onSelectPatient(patient)}
                      title={`${patient.name} (${patient.bed}) · ${patient.riskScore}% risk`}
                      className={cn(
                        'relative grid size-11 place-items-center rounded-xl text-xs font-bold transition-all mx-auto',
                        isSelected
                          ? 'bg-white shadow-md ring-2 ring-violet-500 text-slate-800'
                          : 'bg-white/60 text-slate-600 hover:bg-white',
                      )}
                    >
                      <span
                        className={cn(
                          'absolute right-1 top-1 size-2 rounded-full',
                          patient.riskLevel === 'critical' && 'bg-rose-500 animate-pulse',
                          patient.riskLevel === 'moderate' && 'bg-amber-400',
                          patient.riskLevel === 'stable' && 'bg-emerald-400',
                        )}
                      />
                      {patient.name
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase()}
                    </button>
                  </li>
                );
              }

              return (
                <PatientCard
                  key={patient.id}
                  patient={patient}
                  isSelected={isSelected}
                  onSelect={onSelectPatient}
                />
              );
            })}
          </ul>
        )}
      </div>

      {/* Footer cycling & action cluster */}
      {!isCollapsed ? (
        <PatientCycleControls
          currentIndex={currentIndex}
          totalCount={filteredPatients.length}
          onPrevious={() => handleCycle('prev')}
          onNext={() => handleCycle('next')}
          onJumpCritical={handleJumpCritical}
          hasCritical={hasCriticalPatients}
          onUploadClick={() => fileInputRef.current?.click()}
        />
      ) : (
        <div className="flex flex-col items-center gap-2 border-t border-white/70 p-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleCycle('prev')}
            title="Previous patient (Shortcut: [ )"
            className="size-8 rounded-lg text-slate-500 hover:bg-white"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleCycle('next')}
            title="Next patient (Shortcut: ] )"
            className="size-8 rounded-lg text-slate-500 hover:bg-white"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}
    </aside>
  );
}
