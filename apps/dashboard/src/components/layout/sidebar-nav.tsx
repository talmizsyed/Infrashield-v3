'use client';

import type { ReactElement } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Route } from 'next';
import { cn } from '../../lib/utils';
import { navigationSections } from '../../types/console';

export function SidebarNav(): ReactElement {
  const pathname = usePathname();

  return (
    <aside className="hidden w-72 shrink-0 border-r border-white/10 bg-slate-950/80 px-5 py-7 lg:flex lg:flex-col">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300">
          InfraShield
        </p>
        <h2 className="mt-2 text-xl font-semibold text-white">Developer Console</h2>
        <p className="mt-2 text-sm text-slate-400">Enterprise operations foundation</p>
      </div>

      <nav className="space-y-1">
        {navigationSections.map((section) => {
          const href = section.href as Route;
          const isActive =
            pathname === section.href ||
            (section.href !== '/' && pathname.startsWith(`${section.href}/`));

          return (
            <Link
              key={section.href}
              href={href}
              className={cn(
                'flex items-center justify-between rounded-xl px-3 py-2.5 text-sm transition',
                isActive
                  ? 'bg-cyan-500/15 text-cyan-100 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.2)]'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white',
              )}
            >
              <span>{section.title}</span>
              {section.badge ? (
                <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-cyan-300">
                  {section.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
