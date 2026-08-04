'use client';

import type { ReactElement } from 'react';
import { SidebarNav } from './layout/sidebar-nav';
import { PageShell } from './layout/page-shell';
import { ExecutiveDashboard } from './dashboard/executive-dashboard';

export function ConsoleShell(): ReactElement {
  return (
    <div className="flex min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.16),_transparent_30%),linear-gradient(135deg,_#030712_0%,_#111827_45%,_#020617_100%)] text-slate-100">
      <SidebarNav />
      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <PageShell
          title="Executive Dashboard"
          description="Mission control for runtime health, governance approvals, AI routing, and infrastructure posture."
          breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Executive Dashboard' }]}
        >
          <ExecutiveDashboard />
        </PageShell>
      </main>
    </div>
  );
}
