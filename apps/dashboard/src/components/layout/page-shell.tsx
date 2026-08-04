import { type ReactElement, type ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface PageShellProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function PageShell({
  title,
  description,
  actions,
  children,
  className,
}: PageShellProps): ReactElement {
  return (
    <div className={cn('flex flex-col gap-6', className)}>
      <header className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-[0_0_45px_rgba(2,8,23,0.45)] lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.35em] text-cyan-300">
            Operations
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-white">{title}</h1>
          {description ? (
            <p className="mt-2 max-w-2xl text-sm text-slate-400">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex items-center gap-3">{actions}</div> : null}
      </header>
      <div>{children}</div>
    </div>
  );
}
