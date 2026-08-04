import type { ReactElement } from 'react';
import { PageShell } from '../../components/layout/page-shell';
import { SectionCard } from '../../components/dashboard/section-card';

export default function VmwarePage(): ReactElement {
  return (
    <PageShell
      title="VMware"
      description="Virtual infrastructure inventory, workload placement, and resilience posture."
      breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'VMware' }]}
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard
          title="Virtual estate"
          description="Inventory posture for compute, storage, and network domains."
        >
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-300">
            Virtual workloads are balanced and provisioned within current policy thresholds.
          </div>
        </SectionCard>
        <SectionCard
          title="Operations watchlist"
          description="Events requiring follow-up this shift."
        >
          <ul className="space-y-2 text-sm text-slate-300">
            <li>• Storage reclamation for inactive templates</li>
            <li>• Lifecycle review for expired snapshots</li>
            <li>• Capacity validation for new application tiers</li>
          </ul>
        </SectionCard>
      </div>
    </PageShell>
  );
}
