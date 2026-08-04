import type { ReactElement } from 'react';
import { AppShell } from '../../components/layout/app-shell';
import { SectionCard } from '../../components/ui/section-card';
import { MetricCard } from '../../components/ui/metric-card';
import { HealthBadge } from '../../components/ui/health-badge';

export default function InfrastructurePage(): ReactElement {
  return (
    <AppShell
      title="Infrastructure"
      description="Enterprise infrastructure posture, platform resilience, and environment readiness."
      breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Infrastructure' }]}
    >
      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
        <SectionCard
          title="Infrastructure health"
          description="Current readiness across core services and edge environments."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <MetricCard
              label="Availability"
              value="99.94%"
              detail="Service reliability and incident posture"
              tone="positive"
            />
            <MetricCard
              label="Replicas"
              value="128"
              detail="Operational capacity across regions"
              tone="default"
            />
          </div>
        </SectionCard>

        <SectionCard
          title="Operational focus"
          description="Priority initiatives for the next reporting window."
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <div>
                <p className="text-sm font-medium text-white">Patch cadence</p>
                <p className="text-sm text-slate-400">Shared services hardening</p>
              </div>
              <HealthBadge label="On track" tone="positive" />
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <div>
                <p className="text-sm font-medium text-white">Capacity planning</p>
                <p className="text-sm text-slate-400">AI inference clustering</p>
              </div>
              <HealthBadge label="Planning" tone="warning" />
            </div>
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}
