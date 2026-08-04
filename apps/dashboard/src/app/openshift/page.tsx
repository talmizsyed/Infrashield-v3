import type { ReactElement } from 'react';
import { PageShell } from '../../components/layout/page-shell';
import { SectionCard } from '../../components/dashboard/section-card';

export default function OpenshiftPage(): ReactElement {
  return (
    <PageShell
      title="OpenShift"
      description="Control plane, node readiness, and cluster operations for mission-critical workloads."
      breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'OpenShift' }]}
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard
          title="Cluster health"
          description="Current node pool readiness and workload balance."
        >
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-300">
            All control planes are healthy and aligned with the current release window.
          </div>
        </SectionCard>
        <SectionCard
          title="Change window"
          description="Scheduled maintenance and rollout readiness."
        >
          <ul className="space-y-2 text-sm text-slate-300">
            <li>• Drain and upgrade plan for worker nodes</li>
            <li>• Audit of admission policies and quotas</li>
            <li>• Rollback drill for recent automation changes</li>
          </ul>
        </SectionCard>
      </div>
    </PageShell>
  );
}
