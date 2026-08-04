'use client';

import type { ReactElement, ReactNode } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { Bell, ChevronDown, Command, ShieldCheck, SunMedium } from 'lucide-react';
import { SidebarNav } from './sidebar-nav';
import { SearchBar } from '../ui/search-bar';
import { useAppState } from '../../providers/app-state-provider';
import { cn } from '../../lib/utils';

interface AppShellProps {
  title: string;
  description?: string;
  breadcrumbs?: Array<{ label: string; href?: Route }>;
  children: ReactNode;
}

export function AppShell({
  title,
  description,
  breadcrumbs,
  children,
}: AppShellProps): ReactElement {
  const { theme, toggleTheme, notifications, selectedEnvironment } = useAppState();

  return (
    <div
      className={cn(
        'flex min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.16),_transparent_30%),linear-gradient(135deg,_#030712_0%,_#111827_45%,_#020617_100%)] text-slate-100',
        theme === 'light' ? 'text-slate-900' : 'text-slate-100',
      )}
    >
      <SidebarNav />
      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6">
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
                  <SearchBar />
                  <div className="flex items-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100">
                    <ShieldCheck className="h-4 w-4" />
                    AI ready
                  </div>
                  <button
                    className="rounded-2xl border border-white/10 bg-slate-950/70 p-2 text-slate-300 transition hover:text-white"
                    aria-label="Notifications"
                  >
                    <Bell className="h-4 w-4" />
                    {notifications.length > 0 ? (
                      <span className="sr-only">{notifications.length} notifications</span>
                    ) : null}
                  </button>
                  <button
                    className="rounded-2xl border border-white/10 bg-slate-950/70 p-2 text-slate-300 transition hover:text-white"
                    aria-label="Toggle theme"
                    onClick={toggleTheme}
                  >
                    <SunMedium className="h-4 w-4" />
                  </button>
                  <button className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-300 transition hover:text-white">
                    {selectedEnvironment} <ChevronDown className="h-4 w-4" />
                  </button>
                  <button className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-300 transition hover:text-white">
                    <Command className="h-4 w-4" />
                    Ctrl/Cmd + K
                  </button>
                </div>
              </div>
            </div>
          </header>
          <div>{children}</div>
        </div>
      </main>
    </div>
  );
}
