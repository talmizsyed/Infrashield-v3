import type { ReactElement } from 'react';
import { AppShell } from '../../components/layout/app-shell';
import { SectionCard } from '../../components/ui/section-card';
import { MetricCard } from '../../components/ui/metric-card';
import { HealthBadge } from '../../components/ui/health-badge';

export default function ObservabilityPage(): ReactElement {
  return (
    <AppShell
      title="Observability"
      description="Tracing, analytics, and operational visibility across the platform."
      breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Observability' }]}
    >
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard title="Signal health" description="Telemetry and event pipeline coverage.">
          <div className="grid gap-4 md:grid-cols-2">
            <MetricCard
              label="Trace coverage"
              value="98%"
              detail="Distributed traces"
              tone="positive"
            />
            <MetricCard label="Ingestion lag" value="<2m" detail="Event freshness" tone="default" />
          </div>
        </SectionCard>
        <SectionCard
          title="Analyst focus"
          description="Key monitoring priorities for the next shift."
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <div>
                <p className="text-sm font-medium text-white">Alert noise</p>
                <p className="text-sm text-slate-400">Provider degradation events</p>
              </div>
              <HealthBadge label="Optimize" tone="warning" />
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <div>
                <p className="text-sm font-medium text-white">Incident correlation</p>
                <p className="text-sm text-slate-400">Policy and incident linkages</p>
              </div>
              <HealthBadge label="Planned" tone="positive" />
            </div>
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}
