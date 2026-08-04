import type { ReactElement, ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface DrawerProps {
  open: boolean;
  title: string;
  children: ReactNode;
  className?: string;
}

export function Drawer({ open, title, children, className }: DrawerProps): ReactElement | null {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/70">
      <aside
        className={cn(
          'h-full w-full max-w-md border-l border-white/10 bg-slate-900/95 p-6 shadow-2xl',
          className,
        )}
      >
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <div className="mt-4">{children}</div>
      </aside>
    </div>
  );
}
