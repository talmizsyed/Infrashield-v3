import type { ReactElement } from 'react';
import { PageShell } from '../../components/layout/page-shell';
import { SectionCard } from '../../components/dashboard/section-card';

export default function KnowledgeGraphPage(): ReactElement {
  return (
    <PageShell
      title="Knowledge Graph"
      description="Context memory, retrieval topology, and semantic relationships across the platform."
      breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Knowledge Graph' }]}
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard
          title="Graph health"
          description="Coverage and freshness of current knowledge surfaces."
        >
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-300">
            Core ontology coverage is healthy, with recent updates streaming from the latest runtime
            events.
          </div>
        </SectionCard>
        <SectionCard
          title="Priorities"
          description="Knowledge quality work queued for the next cycle."
        >
          <ul className="space-y-2 text-sm text-slate-300">
            <li>• Merge duplicate entities across environments</li>
            <li>• Expand retrieval indexes for incident memory</li>
            <li>• Align policy metadata with governance records</li>
          </ul>
        </SectionCard>
      </div>
    </PageShell>
  );
}
