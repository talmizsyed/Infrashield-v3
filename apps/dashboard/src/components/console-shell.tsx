'use client';

import type { ReactElement } from 'react';
import { SidebarNav } from './layout/sidebar-nav';
import { PageShell } from './layout/page-shell';
import { useConsoleData } from '../hooks/use-console-data';
import { MetricCard } from './ui/metric-card';
import { StatusPill } from './ui/status-pill';

export function ConsoleShell(): ReactElement {
  const { data, isLoading, error } = useConsoleData();

  return (
    <div className="flex min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.16),_transparent_30%),linear-gradient(135deg,_#030712_0%,_#111827_45%,_#020617_100%)] text-slate-100">
      <SidebarNav />
      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <PageShell
          title="Console Overview"
          description="A resilient shell for operational runtime intelligence, policy approvals, and provider telemetry."
          actions={
            <StatusPill
              label={isLoading ? 'Loading' : error ? 'Attention required' : 'Operational'}
              tone={error ? 'warning' : isLoading ? 'default' : 'positive'}
            />
          }
        >
          {error ? (
            <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-100">
              {error}
            </div>
          ) : null}

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Platform health"
              value={data?.summary?.status ?? '—'}
              detail="Runtime posture and service integrity"
              tone="positive"
            />
            <MetricCard
              label="Active agents"
              value={data?.summary?.activeAgents?.toString() ?? '—'}
              detail="Live execution surfaces"
            />
            <MetricCard
              label="Workflow runs"
              value={data?.summary?.workflowRuns?.toString() ?? '—'}
              detail="Current orchestration load"
            />
            <MetricCard
              label="Pending approvals"
              value={data?.summary?.approvalsPending?.toString() ?? '—'}
              detail="Governance review queue"
              tone="warning"
            />
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
            <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">Provider Fleet</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    A structured home for provider health and routing telemetry.
                  </p>
                </div>
                <StatusPill
                  label={
                    data?.summary?.providersHealthy
                      ? `${data.summary.providersHealthy} healthy`
                      : 'Awaiting data'
                  }
                  tone="positive"
                />
              </div>
              <div className="mt-5 space-y-3">
                {data?.providers?.map((provider) => (
                  <div
                    key={provider.name}
                    className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3"
                  >
                    <div>
                      <p className="font-medium text-white">{provider.name}</p>
                      <p className="text-sm text-slate-400">
                        Latency {provider.latency} • {provider.tokens} tokens
                      </p>
                    </div>
                    <StatusPill
                      label={provider.health}
                      tone={
                        provider.health === 'healthy'
                          ? 'positive'
                          : provider.health === 'degraded'
                            ? 'warning'
                            : 'default'
                      }
                    />
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
              <h2 className="text-lg font-semibold text-white">Operational Alerts</h2>
              <p className="mt-1 text-sm text-slate-400">
                Priority signals that will drive future workflow and governance experiences.
              </p>
              <div className="mt-5 space-y-3">
                {data?.alerts?.map((alert) => (
                  <div
                    key={alert.id}
                    className="rounded-2xl border border-white/10 bg-slate-950/70 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-white">{alert.title}</p>
                      <StatusPill
                        label={alert.severity}
                        tone={
                          alert.severity === 'high'
                            ? 'danger'
                            : alert.severity === 'medium'
                              ? 'warning'
                              : 'default'
                        }
                      />
                    </div>
                    <p className="mt-2 text-sm text-slate-400">{alert.message}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </PageShell>
      </main>
    </div>
  );
}
