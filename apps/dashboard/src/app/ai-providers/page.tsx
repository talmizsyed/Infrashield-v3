import type { ReactElement } from 'react';
import { AppShell } from '../../components/layout/app-shell';
import { SectionCard } from '../../components/ui/section-card';
import { MetricCard } from '../../components/ui/metric-card';
import { HealthBadge } from '../../components/ui/health-badge';

export default function AiProvidersPage(): ReactElement {
  return (
    <AppShell
      title="AI Providers"
      description="Provider health, routing confidence, and model availability posture."
      breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'AI Providers' }]}
    >
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard
          title="Provider readiness"
          description="Current routing health across supported providers."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <MetricCard
              label="Healthy providers"
              value="6/6"
              detail="Primary fleet"
              tone="positive"
            />
            <MetricCard label="Latency" value="118ms" detail="Median response" tone="default" />
          </div>
        </SectionCard>
        <SectionCard
          title="Routing priorities"
          description="Operational work queued for provider reliability."
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <div>
                <p className="text-sm font-medium text-white">Failover thresholds</p>
                <p className="text-sm text-slate-400">Secondary models</p>
              </div>
              <HealthBadge label="Review" tone="warning" />
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <div>
                <p className="text-sm font-medium text-white">Capacity reservations</p>
                <p className="text-sm text-slate-400">Critical workload protection</p>
              </div>
              <HealthBadge label="Queued" tone="positive" />
            </div>
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}
