import type { ReactElement } from 'react';
import { PageShell } from '../../components/layout/page-shell';
import { SectionCard } from '../../components/dashboard/section-card';

export default function SettingsPage(): ReactElement {
  return (
    <PageShell
      title="Settings"
      description="Workspace preferences, integrations, and platform configuration."
      breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Settings' }]}
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard
          title="Configuration"
          description="Current workspace and integration settings."
        >
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-300">
            Core settings are available and aligned with the current operating environment.
          </div>
        </SectionCard>
        <SectionCard
          title="Planned updates"
          description="Upcoming configuration and onboarding changes."
        >
          <ul className="space-y-2 text-sm text-slate-300">
            <li>• Review notification preferences for operations teams</li>
            <li>• Align new integrations with governance requirements</li>
            <li>• Expand environment templates for new tenants</li>
          </ul>
        </SectionCard>
      </div>
    </PageShell>
  );
}
