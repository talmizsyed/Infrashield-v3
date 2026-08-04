import type { ReactElement } from 'react';
import { AppShell } from '../../components/layout/app-shell';
import { SectionCard } from '../../components/ui/section-card';
import { MetricCard } from '../../components/ui/metric-card';
import { HealthBadge } from '../../components/ui/health-badge';

export default function AgentsPage(): ReactElement {
  return (
    <AppShell
      title="Agents"
      description="Runtime fleet status, execution health, and autonomous workflow readiness."
      breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Agents' }]}
    >
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard title="Agent fleet" description="Current agent health and deployment posture.">
          <div className="grid gap-4 md:grid-cols-2">
            <MetricCard
              label="Active agents"
              value="14"
              detail="Operational fleet"
              tone="positive"
            />
            <MetricCard label="Maintenance" value="2" detail="Under review" tone="warning" />
          </div>
        </SectionCard>
        <SectionCard
          title="Execution focus"
          description="Operational checkpoints for the current release."
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <div>
                <p className="text-sm font-medium text-white">Recovery tuning</p>
                <p className="text-sm text-slate-400">Long-running tasks</p>
              </div>
              <HealthBadge label="Stable" tone="positive" />
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <div>
                <p className="text-sm font-medium text-white">Queue stabilization</p>
                <p className="text-sm text-slate-400">Incident response automation</p>
              </div>
              <HealthBadge label="Planned" tone="warning" />
            </div>
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}
