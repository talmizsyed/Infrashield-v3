import { type ReactElement, type ReactNode } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { Bell, ChevronDown, Search, ShieldCheck, SunMedium } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface BreadcrumbItem {
  label: string;
  href?: Route;
}

interface PageShellProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  breadcrumbs?: BreadcrumbItem[];
}

export function PageShell({
  title,
  description,
  actions,
  children,
  className,
  breadcrumbs,
}: PageShellProps): ReactElement {
  return (
    <div className={cn('flex flex-col gap-6', className)}>
      <header className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-[0_0_45px_rgba(2,8,23,0.45)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.35em] text-cyan-300">
              Operations
            </p>
            {breadcrumbs && breadcrumbs.length > 0 ? (
              <nav
                aria-label="Breadcrumb"
                className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-400"
              >
                {breadcrumbs.map((item, index) => (
                  <div key={`${item.label}-${index}`} className="flex items-center gap-2">
                    {index > 0 ? <span className="text-slate-500">/</span> : null}
                    {item.href ? (
                      <Link href={item.href} className="transition hover:text-cyan-300">
                        {item.label}
                      </Link>
                    ) : (
                      <span className="text-slate-200">{item.label}</span>
                    )}
                  </div>
                ))}
              </nav>
            ) : null}
            <h1 className="mt-2 text-2xl font-semibold text-white">{title}</h1>
            {description ? (
              <p className="mt-2 max-w-2xl text-sm text-slate-400">{description}</p>
            ) : null}
          </div>
          <div className="flex flex-col items-stretch gap-3 lg:items-end">
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-400">
                <Search className="h-4 w-4" />
                <input
                  aria-label="Global search"
                  placeholder="Global search"
                  className="w-36 bg-transparent outline-none placeholder:text-slate-500"
                />
              </label>
              <div className="flex items-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100">
                <ShieldCheck className="h-4 w-4" />
                AI ready
              </div>
              <button className="rounded-2xl border border-white/10 bg-slate-950/70 p-2 text-slate-300 transition hover:text-white">
                <Bell className="h-4 w-4" />
              </button>
              <button className="rounded-2xl border border-white/10 bg-slate-950/70 p-2 text-slate-300 transition hover:text-white">
                <SunMedium className="h-4 w-4" />
              </button>
              <button className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-300 transition hover:text-white">
                Prod <ChevronDown className="h-4 w-4" />
              </button>
            </div>
            {actions ? <div className="flex items-center gap-3">{actions}</div> : null}
          </div>
        </div>
      </header>
      <div>{children}</div>
    </div>
  );
}
