'use client';

import React, { useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Kbd } from '@/components/ui/kbd';

interface PatientSearchBarProps {
  query: string;
  onChange: (query: string) => void;
}

export function PatientSearchBar({ query, onChange }: PatientSearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="relative flex items-center">
      <Search
        className="pointer-events-none absolute left-3 size-3.5 text-slate-400"
        aria-hidden="true"
      />
      <Input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            onChange('');
            inputRef.current?.blur();
          }
        }}
        placeholder="Search patient, EHR, bed..."
        aria-label="Search patients by name, EHR, or bed number"
        className="h-9 w-full rounded-xl border-white/80 bg-white/70 pl-8 pr-14 text-xs placeholder:text-slate-400 focus-visible:bg-white focus-visible:ring-1 focus-visible:ring-violet-400"
      />
      <div className="absolute right-2 flex items-center gap-1">
        {query ? (
          <button
            type="button"
            onClick={() => {
              onChange('');
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
            className="rounded p-0.5 text-slate-400 hover:text-slate-600 focus-visible:outline-none"
          >
            <X className="size-3" />
          </button>
        ) : (
          <Kbd className="hidden text-[9px] sm:inline-block">/</Kbd>
        )}
      </div>
    </div>
  );
}
