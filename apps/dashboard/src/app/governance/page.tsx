import type { ReactElement } from 'react';
import { AppShell } from '../../components/layout/app-shell';
import { SectionCard } from '../../components/ui/section-card';
import { MetricCard } from '../../components/ui/metric-card';
import { HealthBadge } from '../../components/ui/health-badge';

export default function GovernancePage(): ReactElement {
  return (
    <AppShell
      title="Governance"
      description="Policies, approvals, and control surfaces across the operating environment."
      breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Governance' }]}
    >
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard
          title="Approval queue"
          description="Running policy approvals and exception handling."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <MetricCard label="Pending approvals" value="7" detail="Current queue" tone="warning" />
            <MetricCard
              label="Executive attention"
              value="2"
              detail="High-priority review"
              tone="danger"
            />
          </div>
        </SectionCard>
        <SectionCard
          title="Control focus"
          description="Policy domains with active attention this week."
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <div>
                <p className="text-sm font-medium text-white">Supply chain attestation</p>
                <p className="text-sm text-slate-400">Review upstream controls</p>
              </div>
              <HealthBadge label="In review" tone="warning" />
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <div>
                <p className="text-sm font-medium text-white">Change controls</p>
                <p className="text-sm text-slate-400">Incident learning alignment</p>
              </div>
              <HealthBadge label="Aligned" tone="positive" />
            </div>
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}
