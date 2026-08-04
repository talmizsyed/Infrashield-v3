import type { ReactElement } from 'react';
import { PageShell } from '../../components/layout/page-shell';
import { SectionCard } from '../../components/dashboard/section-card';

export default function InfrastructurePage(): ReactElement {
  return (
    <PageShell
      title="Infrastructure"
      description="Enterprise infrastructure posture, platform resilience, and environment readiness."
      breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Infrastructure' }]}
    >
      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
        <SectionCard
          title="Infrastructure health"
          description="Current readiness across core services and edge environments."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">
              <div className="text-xs uppercase tracking-[0.3em] text-emerald-300">
                Availability
              </div>
              <div className="mt-2 text-3xl font-semibold text-white">99.94%</div>
            </div>
            <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4 text-sm text-cyan-100">
              <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Replicas</div>
              <div className="mt-2 text-3xl font-semibold text-white">128</div>
            </div>
          </div>
        </SectionCard>
        <SectionCard
          title="Operational focus"
          description="Priority initiatives for the next reporting window."
        >
          <ul className="space-y-3 text-sm text-slate-300">
            <li>• Patch and hardening cadence for shared services</li>
            <li>• Capacity planning for AI inference clusters</li>
            <li>• Expansion readiness for regional failover</li>
          </ul>
        </SectionCard>
      </div>
    </PageShell>
  );
}
