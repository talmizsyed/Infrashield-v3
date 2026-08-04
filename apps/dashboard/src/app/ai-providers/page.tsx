import type { ReactElement } from 'react';
import { PageShell } from '../../components/layout/page-shell';
import { SectionCard } from '../../components/dashboard/section-card';

export default function AiProvidersPage(): ReactElement {
  return (
    <PageShell
      title="AI Providers"
      description="Provider health, routing confidence, and model availability posture."
      breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'AI Providers' }]}
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard
          title="Provider readiness"
          description="Current routing health across supported providers."
        >
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-300">
            Provider routing remains stable, with no active degradations across the primary model
            fleet.
          </div>
        </SectionCard>
        <SectionCard
          title="Routing priorities"
          description="Operational work queued for provider reliability."
        >
          <ul className="space-y-2 text-sm text-slate-300">
            <li>• Review failover thresholds for secondary models</li>
            <li>• Tune load-based routing for peak latency windows</li>
            <li>• Validate capacity reservations for critical workloads</li>
          </ul>
        </SectionCard>
      </div>
    </PageShell>
  );
}
