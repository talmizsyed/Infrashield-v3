import type { ReactElement } from 'react';
import { AppShell } from '../../components/layout/app-shell';
import { SectionCard } from '../../components/ui/section-card';
import { MetricCard } from '../../components/ui/metric-card';
import { HealthBadge } from '../../components/ui/health-badge';

export default function KnowledgeGraphPage(): ReactElement {
  return (
    <AppShell
      title="Knowledge Graph"
      description="Context memory, retrieval topology, and semantic relationships across the platform."
      breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Knowledge Graph' }]}
    >
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard
          title="Graph health"
          description="Coverage and freshness of current knowledge surfaces."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <MetricCard label="Nodes" value="1.2K" detail="Current ontology" tone="positive" />
            <MetricCard
              label="Retrieval confidence"
              value="96.3%"
              detail="Semantic relevance"
              tone="positive"
            />
          </div>
        </SectionCard>
        <SectionCard
          title="Priorities"
          description="Knowledge quality work queued for the next cycle."
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <div>
                <p className="text-sm font-medium text-white">Duplicate entities</p>
                <p className="text-sm text-slate-400">Cross-environment merge</p>
              </div>
              <HealthBadge label="Queued" tone="warning" />
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <div>
                <p className="text-sm font-medium text-white">Incident memory</p>
                <p className="text-sm text-slate-400">Retrieval index expansion</p>
              </div>
              <HealthBadge label="Planned" tone="positive" />
            </div>
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}
