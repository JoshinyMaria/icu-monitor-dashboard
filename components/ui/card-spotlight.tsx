'use client';

import React, { MouseEvent as ReactMouseEvent } from 'react';
import { cn } from '@/lib/utils';

export const CardSpotlight = ({
  children,
  radius = 350,
  color = '#262626',
  className,
  ...props
}: {
  radius?: number;
  color?: string;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) => {
  function handleMouseMove({
    currentTarget,
    clientX,
    clientY,
  }: ReactMouseEvent<HTMLDivElement>) {
    const { left, top } = currentTarget.getBoundingClientRect();

    currentTarget.style.setProperty('--spotlight-x', `${clientX - left}px`);
    currentTarget.style.setProperty('--spotlight-y', `${clientY - top}px`);
  }
  return (
    <div
      className={cn(
        'group/spotlight p-10 rounded-md relative border border-neutral-800 bg-black dark:border-neutral-800',
        className,
      )}
      onMouseMove={handleMouseMove}
      {...props}
    >
      <div
        className="pointer-events-none absolute z-0 -inset-px rounded-md opacity-0 transition duration-300 group-hover/spotlight:opacity-100"
        style={{
          background: `radial-gradient(${radius}px circle at var(--spotlight-x, 50%) var(--spotlight-y, 50%), ${color}, transparent 80%)`,
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-pink-300/20 via-violet-300/10 to-cyan-300/20" />
      </div>
      {children}
    </div>
  );
};
