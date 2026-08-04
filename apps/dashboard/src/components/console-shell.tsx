'use client';

import type { ReactElement } from 'react';
import { AppShell } from './layout/app-shell';
import { ExecutiveDashboard } from './dashboard/executive-dashboard';

export function ConsoleShell(): ReactElement {
  return (
    <AppShell
      title="Executive Dashboard"
      description="Mission control for runtime health, governance approvals, AI routing, and infrastructure posture."
      breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Executive Dashboard' }]}
    >
      <ExecutiveDashboard />
    </AppShell>
  );
}
