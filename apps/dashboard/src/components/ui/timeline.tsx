import type { ReactElement } from 'react';

interface TimelineItem {
  title: string;
  detail: string;
}

interface TimelineProps {
  items: TimelineItem[];
}

export function Timeline({ items }: TimelineProps): ReactElement {
  return (
    <ol className="space-y-3">
      {items.map((item, index) => (
        <li key={`${item.title}-${index}`} className="flex gap-3">
          <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-cyan-400" />
          <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">
            <p className="text-sm font-medium text-white">{item.title}</p>
            <p className="mt-1 text-sm text-slate-400">{item.detail}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
