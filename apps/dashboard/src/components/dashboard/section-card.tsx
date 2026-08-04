import type { ReactElement, ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface SectionCardProps {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function SectionCard({
  title,
  description,
  action,
  children,
  className,
}: SectionCardProps): ReactElement {
  return (
    <section
      className={cn(
        'rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-[0_0_40px_rgba(2,8,23,0.35)] backdrop-blur',
        className,
      )}
    >
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          {description ? <p className="mt-1 text-sm text-slate-400">{description}</p> : null}
        </div>
        {action ? <div>{action}</div> : null}
      </div>
      {children}
    </section>
  );
}
