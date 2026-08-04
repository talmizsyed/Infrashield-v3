import type { ReactElement } from 'react';
import { cn } from '../../lib/utils';

interface ToastProps {
  message: string;
  tone?: 'default' | 'positive' | 'warning' | 'danger';
}

export function Toast({ message, tone = 'default' }: ToastProps): ReactElement {
  const toneClasses = {
    default: 'border-white/10 bg-slate-900/90 text-slate-100',
    positive: 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100',
    warning: 'border-amber-400/20 bg-amber-500/10 text-amber-100',
    danger: 'border-rose-400/20 bg-rose-500/10 text-rose-100',
  };

  return (
    <div className={cn('rounded-2xl border px-4 py-3 text-sm shadow-lg', toneClasses[tone])}>
      {message}
    </div>
  );
}
