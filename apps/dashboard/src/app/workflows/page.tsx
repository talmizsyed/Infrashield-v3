import type { ReactElement } from 'react';
import { PageShell } from '../../components/layout/page-shell';
import { SectionCard } from '../../components/dashboard/section-card';

export default function WorkflowsPage(): ReactElement {
  return (
    <PageShell
      title="Workflow Studio"
      description="Execution graphs, orchestration state, and workflow governance."
      breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Workflow Studio' }]}
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard
          title="Active workflows"
          description="Current orchestration health and throughput metrics."
        >
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-300">
            Workflow throughput remains stable, with one scheduled run pending provider
            confirmation.
          </div>
        </SectionCard>
        <SectionCard
          title="Governance checkpoints"
          description="Policy checks for workflow quality and reliability."
        >
          <ul className="space-y-2 text-sm text-slate-300">
            <li>• Review of approval gates and escalation logic</li>
            <li>• Recovery policy for high-latency stages</li>
            <li>• Audit of dependency chain resilience</li>
          </ul>
        </SectionCard>
      </div>
    </PageShell>
  );
}
