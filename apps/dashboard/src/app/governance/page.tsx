import type { ReactElement } from 'react';
import { PageShell } from '../../components/layout/page-shell';
import { SectionCard } from '../../components/dashboard/section-card';

export default function GovernancePage(): ReactElement {
  return (
    <PageShell
      title="Governance"
      description="Policies, approvals, and control surfaces across the operating environment."
      breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Governance' }]}
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard
          title="Approval queue"
          description="Running policy approvals and exception handling."
        >
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-300">
            7 approvals are pending review, with 2 flagged for executive attention.
          </div>
        </SectionCard>
        <SectionCard
          title="Control focus"
          description="Policy domains with active attention this week."
        >
          <ul className="space-y-2 text-sm text-slate-300">
            <li>• Review of software supply chain attestations</li>
            <li>• Validation of access policy exceptions</li>
            <li>• Alignment of change controls with incident learnings</li>
          </ul>
        </SectionCard>
      </div>
    </PageShell>
  );
}
