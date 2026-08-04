import type { ReactElement } from 'react';
import { AppShell } from '../../components/layout/app-shell';
import { SectionCard } from '../../components/ui/section-card';
import { MetricCard } from '../../components/ui/metric-card';
import { HealthBadge } from '../../components/ui/health-badge';

export default function WorkflowsPage(): ReactElement {
  return (
    <AppShell
      title="Workflow Studio"
      description="Execution graphs, orchestration state, and workflow governance."
      breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Workflow Studio' }]}
    >
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard
          title="Active workflows"
          description="Current orchestration health and throughput metrics."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <MetricCard
              label="Active runs"
              value="42"
              detail="Current throughput"
              tone="positive"
            />
            <MetricCard
              label="Pending confirmation"
              value="1"
              detail="Provider handoff"
              tone="warning"
            />
          </div>
        </SectionCard>
        <SectionCard
          title="Governance checkpoints"
          description="Policy checks for workflow quality and reliability."
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <div>
                <p className="text-sm font-medium text-white">Approval gates</p>
                <p className="text-sm text-slate-400">Escalation logic review</p>
              </div>
              <HealthBadge label="Review" tone="warning" />
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <div>
                <p className="text-sm font-medium text-white">Dependency resilience</p>
                <p className="text-sm text-slate-400">Chain audit</p>
              </div>
              <HealthBadge label="Stable" tone="positive" />
            </div>
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}
