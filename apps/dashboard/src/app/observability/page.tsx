import type { ReactElement } from 'react';
import { PageShell } from '../../components/layout/page-shell';
import { SectionCard } from '../../components/dashboard/section-card';

export default function ObservabilityPage(): ReactElement {
  return (
    <PageShell
      title="Observability"
      description="Tracing, analytics, and operational visibility across the platform."
      breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Observability' }]}
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Signal health" description="Telemetry and event pipeline coverage.">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-300">
            Trace and metric pipelines are healthy, with consistent ingestion across all core
            services.
          </div>
        </SectionCard>
        <SectionCard
          title="Analyst focus"
          description="Key monitoring priorities for the next shift."
        >
          <ul className="space-y-2 text-sm text-slate-300">
            <li>• Optimize alert noise for provider degradation events</li>
            <li>• Expand distributed tracing for workflow orchestration</li>
            <li>• Improve correlation between incidents and policy changes</li>
          </ul>
        </SectionCard>
      </div>
    </PageShell>
  );
}
