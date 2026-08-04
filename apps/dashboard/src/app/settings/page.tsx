import type { ReactElement } from 'react';
import { AppShell } from '../../components/layout/app-shell';
import { SectionCard } from '../../components/ui/section-card';
import { MetricCard } from '../../components/ui/metric-card';
import { HealthBadge } from '../../components/ui/health-badge';

export default function SettingsPage(): ReactElement {
  return (
    <AppShell
      title="Settings"
      description="Workspace preferences, integrations, and platform configuration."
      breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Settings' }]}
    >
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard
          title="Configuration"
          description="Current workspace and integration settings."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <MetricCard
              label="Integrations"
              value="12"
              detail="Connected services"
              tone="positive"
            />
            <MetricCard label="Templates" value="8" detail="Environment presets" tone="default" />
          </div>
        </SectionCard>
        <SectionCard
          title="Planned updates"
          description="Upcoming configuration and onboarding changes."
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <div>
                <p className="text-sm font-medium text-white">Notification preferences</p>
                <p className="text-sm text-slate-400">Operations team review</p>
              </div>
              <HealthBadge label="Review" tone="warning" />
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <div>
                <p className="text-sm font-medium text-white">Tenant templates</p>
                <p className="text-sm text-slate-400">Future onboarding support</p>
              </div>
              <HealthBadge label="Planned" tone="positive" />
            </div>
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}
