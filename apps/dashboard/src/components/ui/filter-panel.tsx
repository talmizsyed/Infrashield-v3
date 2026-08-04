import type { ReactElement } from 'react';

interface FilterPanelProps {
  filters: Array<{ label: string; value: string }>;
}

export function FilterPanel({ filters }: FilterPanelProps): ReactElement {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
      <p className="text-sm font-medium text-white">Filters</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {filters.map((filter) => (
          <span
            key={filter.label}
            className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-100"
          >
            {filter.label}: {filter.value}
          </span>
        ))}
      </div>
    </div>
  );
}
