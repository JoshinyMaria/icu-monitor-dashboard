'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
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

const OVERSCAN = 6;
const CARD_ROW_HEIGHT = 94; // 86px card + 8px pb-2
const COLLAPSED_ROW_HEIGHT = 52; // 44px avatar + 8px pb-2

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
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(600);

  const rowHeight = isCollapsed ? COLLAPSED_ROW_HEIGHT : CARD_ROW_HEIGHT;

  // Track container height for virtualization
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const updateHeight = () => {
      if (el.clientHeight > 0) {
        setContainerHeight(el.clientHeight);
      }
    };
    updateHeight();

    const observer = new ResizeObserver(updateHeight);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

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
        p.unit.toLowerCase().includes(query) ||
        (Boolean(p.kaggleId) && p.kaggleId!.toLowerCase().includes(query))
      );
    });
  }, [cohort, searchQuery, riskFilter]);

  // Current index in filtered list (for Prev/Next display)
  const currentIndex = useMemo(() => {
    if (!selectedPatient) return 0;
    const idx = filteredPatients.findIndex((p) => p.id === selectedPatient.id);
    return idx >= 0 ? idx : 0;
  }, [filteredPatients, selectedPatient]);

  // Reset scroll when filter shrinks the list beyond current position
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const maxScroll = Math.max(0, filteredPatients.length * rowHeight - el.clientHeight);
    if (el.scrollTop > maxScroll) {
      el.scrollTop = 0;
      setScrollTop(0);
    }
  }, [filteredPatients.length, rowHeight]);

  // Auto-scroll selected patient into view when selection changes
  useEffect(() => {
    if (!selectedPatient) return;
    const idx = filteredPatients.findIndex((p) => p.id === selectedPatient.id);
    if (idx === -1) return;

    const el = scrollContainerRef.current;
    if (!el) return;

    const itemTop = idx * rowHeight;
    const itemBottom = itemTop + rowHeight;
    const visibleTop = el.scrollTop;
    const visibleBottom = el.scrollTop + el.clientHeight;

    if (itemTop < visibleTop) {
      el.scrollTo({ top: itemTop, behavior: 'smooth' });
    } else if (itemBottom > visibleBottom) {
      el.scrollTo({ top: itemBottom - el.clientHeight, behavior: 'smooth' });
    }
  }, [selectedPatient, filteredPatients, rowHeight]);

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

  // Windowing calculations
  const totalCount = filteredPatients.length;
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - OVERSCAN);
  const endIndex = Math.min(
    totalCount,
    Math.ceil((scrollTop + containerHeight) / rowHeight) + OVERSCAN,
  );
  const topSpacerHeight = startIndex * rowHeight;
  const bottomSpacerHeight = Math.max(0, (totalCount - endIndex) * rowHeight);

  const visibleSlice = useMemo(() => {
    return filteredPatients.slice(startIndex, endIndex);
  }, [filteredPatients, startIndex, endIndex]);

  return (
    <aside
      aria-label="Patient Roster"
      className={cn(
        'relative flex h-full flex-col border-r border-white/70 bg-[#f8faff]/85 backdrop-blur-2xl transition-[width] duration-300',
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
                  <span className="font-semibold tabular-nums text-slate-600">
                    {cohort.length}
                  </span>{' '}
                  Patients ·{' '}
                  <span className="font-semibold tabular-nums text-rose-600">
                    {counts.critical}
                  </span>{' '}
                  Critical
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
              className="size-10 min-h-[40px] min-w-[40px] shrink-0 rounded-xl text-slate-400 transition-[color,background-color,transform] duration-150 hover:bg-white/80 hover:text-slate-600 active:scale-[0.96]"
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

      {/* Visible count indicator bar when not collapsed */}
      {!isCollapsed && (
        <div className="flex items-center justify-between border-b border-white/40 px-4 py-1.5 text-[11px] text-slate-400">
          <span>
            Showing{' '}
            <span className="font-semibold tabular-nums text-slate-700">
              {filteredPatients.length}
            </span>{' '}
            of <span className="tabular-nums">{cohort.length}</span>
          </span>
          {filteredPatients.length < cohort.length && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="flex min-h-[40px] items-center text-[10px] font-medium text-violet-600 transition-[color,transform] duration-150 hover:underline active:scale-[0.96]"
            >
              Reset filters
            </button>
          )}
        </div>
      )}

      {/* Content: Virtualized Scrollable Patient Roster */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 py-3 scrollbar-thin"
        aria-label="Patients list"
      >
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
            className="m-0 w-full list-none p-0"
          >
            {topSpacerHeight > 0 && (
              <li style={{ height: `${topSpacerHeight}px` }} aria-hidden="true" />
            )}
            {visibleSlice.map((patient) => {
              const isSelected = selectedPatient?.id === patient.id;
              if (isCollapsed) {
                // Collapsed icon avatar representation
                return (
                  <li key={patient.id} className="list-none pb-2">
                    <button
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => onSelectPatient(patient)}
                      title={`${patient.name} (${patient.bed}) · ${patient.riskScore}% risk`}
                      className={cn(
                        'relative mx-auto grid size-11 min-h-[44px] min-w-[44px] place-items-center rounded-xl text-xs font-bold transition-[background-color,box-shadow,color,transform] duration-150 active:scale-[0.96]',
                        isSelected
                          ? 'bg-white text-slate-800 shadow-md ring-2 ring-violet-500'
                          : 'bg-white/60 text-slate-600 hover:bg-white',
                      )}
                    >
                      <span
                        className={cn(
                          'absolute right-1 top-1 size-2 rounded-full',
                          patient.riskLevel === 'critical' && 'animate-pulse bg-rose-500',
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
                <div key={patient.id} className="pb-2">
                  <PatientCard
                    patient={patient}
                    isSelected={isSelected}
                    onSelect={onSelectPatient}
                  />
                </div>
              );
            })}
            {bottomSpacerHeight > 0 && (
              <li style={{ height: `${bottomSpacerHeight}px` }} aria-hidden="true" />
            )}
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
            className="size-10 min-h-[40px] min-w-[40px] rounded-xl text-slate-500 transition-[color,background-color,transform] duration-150 hover:bg-white active:scale-[0.96]"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleCycle('next')}
            title="Next patient (Shortcut: ] )"
            className="size-10 min-h-[40px] min-w-[40px] rounded-xl text-slate-500 transition-[color,background-color,transform] duration-150 hover:bg-white active:scale-[0.96]"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}
    </aside>
  );
}
