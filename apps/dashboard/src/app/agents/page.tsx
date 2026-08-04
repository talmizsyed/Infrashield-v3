import type { ReactElement } from 'react';
import { PageShell } from '../../components/layout/page-shell';
import { SectionCard } from '../../components/dashboard/section-card';

export default function AgentsPage(): ReactElement {
  return (
    <PageShell
      title="Agents"
      description="Runtime fleet status, execution health, and autonomous workflow readiness."
      breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Agents' }]}
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Agent fleet" description="Current agent health and deployment posture.">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-300">
            14 agents are active, with 2 under maintenance and 1 preparing for redeployment.
          </div>
        </SectionCard>
        <SectionCard
          title="Execution focus"
          description="Operational checkpoints for the current release."
        >
          <ul className="space-y-2 text-sm text-slate-300">
            <li>• Recovery tuning for long-running tasks</li>
            <li>• Policy-based routing review for high-value workloads</li>
            <li>• Queue stabilization for incident response automation</li>
          </ul>
        </SectionCard>
      </div>
    </PageShell>
  );
}
