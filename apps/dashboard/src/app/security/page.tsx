import type { ReactElement } from 'react';
import { AppShell } from '../../components/layout/app-shell';
import { SectionCard } from '../../components/ui/section-card';
import { MetricCard } from '../../components/ui/metric-card';
import { HealthBadge } from '../../components/ui/health-badge';

export default function SecurityPage(): ReactElement {
  return (
    <AppShell
      title="Security"
      description="Threat posture, vulnerability management, and trust controls across the platform."
      breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Security' }]}
    >
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard
          title="Posture overview"
          description="Current exposure posture and control effectiveness."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <MetricCard label="Threats" value="3" detail="Active signals" tone="danger" />
            <MetricCard
              label="Critical assets"
              value="89"
              detail="Protected assets"
              tone="positive"
            />
          </div>
        </SectionCard>
        <SectionCard
          title="Priority actions"
          description="Recommended follow-up for the next reporting interval."
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <div>
                <p className="text-sm font-medium text-white">Privileged role exceptions</p>
                <p className="text-sm text-slate-400">Access policy review</p>
              </div>
              <HealthBadge label="Review" tone="warning" />
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <div>
                <p className="text-sm font-medium text-white">AI traffic anomaly detection</p>
                <p className="text-sm text-slate-400">Coverage expansion</p>
              </div>
              <HealthBadge label="Planned" tone="positive" />
            </div>
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}
