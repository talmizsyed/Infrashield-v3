import type { ReactElement } from 'react';
import { AppShell } from '../../components/layout/app-shell';
import { SectionCard } from '../../components/ui/section-card';
import { MetricCard } from '../../components/ui/metric-card';
import { HealthBadge } from '../../components/ui/health-badge';

export default function OpenshiftPage(): ReactElement {
  return (
    <AppShell
      title="OpenShift"
      description="Control plane, node readiness, and cluster operations for mission-critical workloads."
      breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'OpenShift' }]}
    >
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard
          title="Cluster health"
          description="Current node pool readiness and workload balance."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <MetricCard
              label="Control planes"
              value="3"
              detail="Healthy and active"
              tone="positive"
            />
            <MetricCard
              label="Worker nodes"
              value="18"
              detail="Ready and balanced"
              tone="positive"
            />
          </div>
        </SectionCard>
        <SectionCard
          title="Change window"
          description="Scheduled maintenance and rollout readiness."
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <div>
                <p className="text-sm font-medium text-white">Node upgrades</p>
                <p className="text-sm text-slate-400">Worker node drain plan</p>
              </div>
              <HealthBadge label="Scheduled" tone="warning" />
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <div>
                <p className="text-sm font-medium text-white">Rollback drill</p>
                <p className="text-sm text-slate-400">Automation change readiness</p>
              </div>
              <HealthBadge label="Ready" tone="positive" />
            </div>
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}
