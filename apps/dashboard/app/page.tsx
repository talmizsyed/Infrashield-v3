import type { ReactElement } from 'react';

export default function HomePage(): ReactElement {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.16),_transparent_30%),linear-gradient(135deg,_#030712_0%,_#111827_45%,_#020617_100%)] px-6 py-10 text-slate-100">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <header className="rounded-3xl border border-cyan-400/20 bg-slate-900/70 p-8 shadow-[0_0_80px_rgba(34,211,238,0.12)] backdrop-blur-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.35em] text-cyan-300">
                InfraShield V3
              </p>
              <h1 className="mt-3 text-4xl font-semibold text-white sm:text-5xl">
                Enterprise Agentic Platform
              </h1>
              <p className="mt-4 max-w-2xl text-lg text-slate-300">
                Professional operations console for runtime health, approvals, providers, and
                workflows.
              </p>
            </div>
            <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-5 py-4 text-sm text-cyan-100">
              <div className="font-semibold">Platform health</div>
              <div className="mt-2 text-3xl font-semibold text-white">98.7%</div>
            </div>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[
            { title: 'Operations', description: 'Mission-control overview for runtime posture.' },
            { title: 'Governance', description: 'Approval queues and policy surfaces.' },
            { title: 'Infrastructure', description: 'Provider and environment status.' },
          ].map((card) => (
            <article
              key={card.title}
              className="rounded-2xl border border-white/10 bg-slate-900/70 p-6"
            >
              <div className="text-lg font-semibold text-white">{card.title}</div>
              <div className="mt-2 text-sm text-slate-400">{card.description}</div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
