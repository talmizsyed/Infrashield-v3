import type { ReactElement } from 'react';
import { cn } from '../../lib/utils';

interface StatusPillProps {
  label: string;
  tone?: 'default' | 'positive' | 'warning' | 'danger';
}

export function StatusPill({ label, tone = 'default' }: StatusPillProps): ReactElement {
  const toneClasses = {
    default: 'border-white/10 bg-slate-800 text-slate-200',
    positive: 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200',
    warning: 'border-amber-400/20 bg-amber-500/10 text-amber-200',
    danger: 'border-rose-400/20 bg-rose-500/10 text-rose-200',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium',
        toneClasses[tone],
      )}
    >
      {label}
    </span>
  );
}
