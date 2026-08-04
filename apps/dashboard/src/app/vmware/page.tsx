import type { ReactElement } from 'react';
import { AppShell } from '../../components/layout/app-shell';
import { SectionCard } from '../../components/ui/section-card';
import { MetricCard } from '../../components/ui/metric-card';
import { HealthBadge } from '../../components/ui/health-badge';

export default function VmwarePage(): ReactElement {
  return (
    <AppShell
      title="VMware"
      description="Virtual infrastructure inventory, workload placement, and resilience posture."
      breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'VMware' }]}
    >
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard
          title="Virtual estate"
          description="Inventory posture for compute, storage, and network domains."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <MetricCard
              label="Virtual workloads"
              value="382"
              detail="Balanced placement"
              tone="positive"
            />
            <MetricCard
              label="Policy compliance"
              value="98%"
              detail="Current thresholds"
              tone="positive"
            />
          </div>
        </SectionCard>
        <SectionCard
          title="Operations watchlist"
          description="Events requiring follow-up this shift."
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <div>
                <p className="text-sm font-medium text-white">Storage reclamation</p>
                <p className="text-sm text-slate-400">Inactive templates</p>
              </div>
              <HealthBadge label="Queued" tone="warning" />
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <div>
                <p className="text-sm font-medium text-white">Snapshot lifecycle</p>
                <p className="text-sm text-slate-400">Expired snapshot review</p>
              </div>
              <HealthBadge label="Planned" tone="positive" />
            </div>
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}
