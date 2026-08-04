import type { ReactElement } from 'react';
import { PageShell } from '../../components/layout/page-shell';
import { SectionCard } from '../../components/dashboard/section-card';

export default function SecurityPage(): ReactElement {
  return (
    <PageShell
      title="Security"
      description="Threat posture, vulnerability management, and trust controls across the platform."
      breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Security' }]}
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard
          title="Posture overview"
          description="Current exposure posture and control effectiveness."
        >
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-300">
            Security controls are operational, and no critical incidents are open at this time.
          </div>
        </SectionCard>
        <SectionCard
          title="Priority actions"
          description="Recommended follow-up for the next reporting interval."
        >
          <ul className="space-y-2 text-sm text-slate-300">
            <li>• Review access policy exceptions for privileged roles</li>
            <li>• Validate secrets rotation for automation accounts</li>
            <li>• Expand anomaly detection coverage for AI traffic</li>
          </ul>
        </SectionCard>
      </div>
    </PageShell>
  );
}
