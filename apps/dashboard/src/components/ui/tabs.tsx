import type { ReactElement, ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface TabsProps {
  items: Array<{ id: string; label: string }>;
  activeId: string;
  onChange: (id: string) => void;
  children: ReactNode;
}

export function Tabs({ items, activeId, onChange, children }: TabsProps): ReactElement {
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={cn(
              'rounded-full border px-3 py-2 text-sm transition',
              activeId === item.id
                ? 'border-cyan-400/20 bg-cyan-500/10 text-cyan-100'
                : 'border-white/10 bg-slate-900/70 text-slate-300 hover:text-white',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}
