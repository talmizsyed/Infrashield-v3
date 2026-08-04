import type { ReactElement, ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

interface KpiCardProps {
  label: string;
  value: string;
  detail?: string;
  tone?: 'default' | 'positive' | 'warning' | 'danger';
  icon?: ReactNode;
}

export function KpiCard({
  label,
  value,
  detail,
  tone = 'default',
  icon,
}: KpiCardProps): ReactElement {
  const toneClasses = {
    default: 'border-white/10 bg-slate-900/70 text-slate-100',
    positive: 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100',
    warning: 'border-amber-400/20 bg-amber-500/10 text-amber-100',
    danger: 'border-rose-400/20 bg-rose-500/10 text-rose-100',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'rounded-2xl border p-5 shadow-[0_0_30px_rgba(2,8,23,0.32)]',
        toneClasses[tone],
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-400">{label}</p>
          <p className="mt-3 text-3xl font-semibold">{value}</p>
        </div>
        {icon ? (
          <div className="rounded-xl border border-white/10 bg-slate-950/60 p-2">{icon}</div>
        ) : null}
      </div>
      {detail ? <p className="mt-3 text-sm text-slate-400">{detail}</p> : null}
    </motion.div>
  );
}
