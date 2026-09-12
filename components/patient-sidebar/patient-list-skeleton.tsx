'use client';

import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export function PatientListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2 p-1" aria-busy="true" aria-label="Loading patient records">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col gap-2 rounded-2xl border border-white/40 bg-white/40 p-3 backdrop-blur-sm"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Skeleton className="size-3 rounded-full" />
              <Skeleton className="h-3.5 w-24 rounded-md" />
            </div>
            <Skeleton className="h-3 w-10 rounded-md" />
          </div>
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-16 rounded-md" />
            <Skeleton className="h-3 w-12 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}
