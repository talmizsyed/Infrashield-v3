import type { ReactElement } from 'react';
import { StatusPill } from '../ui/status-pill';

interface StatusListItem {
  label: string;
  value: string;
  tone?: 'default' | 'positive' | 'warning' | 'danger';
}

interface StatusListProps {
  items: StatusListItem[];
}

export function StatusList({ items }: StatusListProps): ReactElement {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3"
        >
          <div>
            <p className="font-medium text-white">{item.label}</p>
            <p className="text-sm text-slate-400">{item.value}</p>
          </div>
          <StatusPill label={item.value} tone={item.tone ?? 'default'} />
        </div>
      ))}
    </div>
  );
}
