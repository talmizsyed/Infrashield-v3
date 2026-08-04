import type { ReactElement } from 'react';

interface ProgressRingProps {
  value: number;
  label: string;
}

export function ProgressRing({ value, label }: ProgressRingProps): ReactElement {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
      <svg viewBox="0 0 100 100" className="h-16 w-16 -rotate-90">
        <circle
          cx="50"
          cy="50"
          r={radius}
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="10"
          fill="none"
        />
        <circle
          cx="50"
          cy="50"
          r={radius}
          stroke="#22d3ee"
          strokeWidth="10"
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div>
        <p className="text-sm text-slate-400">{label}</p>
        <p className="mt-1 text-2xl font-semibold text-white">{value}%</p>
      </div>
    </div>
  );
}
