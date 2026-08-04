import type { ReactElement, ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  actions,
  className,
}: PageHeaderProps): ReactElement {
  return (
    <header
      className={cn(
        'rounded-3xl border border-cyan-400/20 bg-slate-900/70 p-6 shadow-[0_0_80px_rgba(34,211,238,0.12)] backdrop-blur-xl',
        className,
      )}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-cyan-300">
            Operations
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-white">{title}</h1>
          {description ? (
            <p className="mt-3 max-w-2xl text-sm text-slate-400">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
      </div>
    </header>
  );
}
