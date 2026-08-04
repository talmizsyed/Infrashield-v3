'use client';

import type { ReactElement } from 'react';
import { Activity, AlertTriangle, BrainCircuit, Cpu, ShieldCheck } from 'lucide-react';
import { useConsoleData } from '../../hooks/use-console-data';
import { OverviewGrid } from './overview-grid';
import { SectionCard } from './section-card';
import { StatusList } from './status-list';
import { HealthChart } from './health-chart';

export function ExecutiveDashboard(): ReactElement {
  const { data, error } = useConsoleData();

  const chartData = [
    { name: 'Mon', value: 88 },
    { name: 'Tue', value: 91 },
    { name: 'Wed', value: 95 },
    { name: 'Thu', value: 93 },
    { name: 'Fri', value: 97 },
    { name: 'Sat', value: 98 },
  ];

  const infrastructureItems = [
    {
      label: 'OpenShift cluster',
      value: '3 control planes / 18 workers',
      tone: 'positive' as const,
    },
    {
      label: 'VMware fabric',
      value: '6 clusters / 94% readiness',
      tone: 'positive' as const,
    },
    {
      label: 'Storage',
      value: '78% utilized • 1.4 PB available',
      tone: 'warning' as const,
    },
    {
      label: 'Network',
      value: '7.2 Gbps • 0.08% packet loss',
      tone: 'positive' as const,
    },
    {
      label: 'Database',
      value: 'Latency 21ms • failover ready',
      tone: 'positive' as const,
    },
    {
      label: 'Certificate status',
      value: '98% valid • 2 expiring soon',
      tone: 'warning' as const,
    },
  ];

  const workflowItems = [
    { label: 'Running', value: `${data?.summary?.workflowRuns ?? 42}`, tone: 'positive' as const },
    { label: 'Queued', value: '17', tone: 'default' as const },
    { label: 'Completed', value: '1,284', tone: 'positive' as const },
    { label: 'Failed', value: '2', tone: 'danger' as const },
  ];

  const agentItems = [
    {
      label: 'Running agents',
      value: `${data?.summary?.activeAgents ?? 18}`,
      tone: 'positive' as const,
    },
    { label: 'Thinking', value: '6', tone: 'default' as const },
    { label: 'Waiting', value: '11', tone: 'warning' as const },
    { label: 'Executing', value: '4', tone: 'positive' as const },
  ];

  const activityFeed = [
    {
      title: 'Governance approval',
      detail: 'Security policy review moved to final sign-off with zero exception drift.',
      tone: 'positive' as const,
    },
    {
      title: 'AI routing decision',
      detail: 'Provider failover triggered to Gemini for low-latency routing.',
      tone: 'warning' as const,
    },
    {
      title: 'Infrastructure event',
      detail: 'Storage throughput peaked at 7.2 Gbps after a replication sweep.',
      tone: 'positive' as const,
    },
    {
      title: 'Security alert',
      detail: 'Anomalous access pattern detected in the runtime fabric.',
      tone: 'danger' as const,
    },
  ];

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-cyan-400/20 bg-slate-900/70 p-6 shadow-[0_0_80px_rgba(34,211,238,0.12)] backdrop-blur-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-cyan-300">
              Executive Dashboard
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-white">
              Mission control for the enterprise agentic platform
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-400">
              Monitoring runtime health, governance, AI routing, and infrastructure posture from one
              authoritative surface.
            </p>
          </div>
          <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
            <div className="font-semibold">Current platform health</div>
            <div className="mt-1 text-2xl font-semibold text-white">
              {data?.summary?.status ?? 'Healthy'}
            </div>
          </div>
        </div>
      </header>

      <OverviewGrid />

      {error ? (
        <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-100">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard
          title="Infrastructure health"
          description="Cross-domain posture for OpenShift, VMware, storage, networking, database, and certificate readiness."
        >
          <StatusList items={infrastructureItems} />
        </SectionCard>

        <SectionCard
          title="AI control center"
          description="Provider posture, routing quality, and failover readiness in a single command surface."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-400">Current provider</p>
                <ShieldCheck className="h-4 w-4 text-cyan-300" />
              </div>
              <p className="mt-3 text-2xl font-semibold text-white">
                {data?.providers?.[0]?.name ?? 'Gemini'}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-400">Fallback provider</p>
                <Activity className="h-4 w-4 text-cyan-300" />
              </div>
              <p className="mt-3 text-2xl font-semibold text-white">Anthropic</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-400">Latency</p>
                <Cpu className="h-4 w-4 text-cyan-300" />
              </div>
              <p className="mt-3 text-2xl font-semibold text-white">196ms</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-400">Token usage</p>
                <BrainCircuit className="h-4 w-4 text-cyan-300" />
              </div>
              <p className="mt-3 text-2xl font-semibold text-white">7.1M</p>
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <SectionCard
          title="Workflow center"
          description="Execution posture for orchestration, queue depth, completions, and failure signal quality."
        >
          <StatusList items={workflowItems} />
        </SectionCard>

        <SectionCard
          title="Agent center"
          description="Runtime state for thinking, waiting, executing, and memory intensive agent operations."
        >
          <StatusList items={agentItems} />
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard
          title="Knowledge graph"
          description="Interactive topology placeholder with discovery insights and memory relationships."
        >
          <div className="rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/10 via-slate-950 to-slate-900 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-slate-400">Relationship graph</p>
                <p className="mt-2 text-2xl font-semibold text-white">1.2K nodes • 8.4K links</p>
              </div>
              <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-200">
                Live topology
              </div>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <p className="text-sm text-slate-400">Recent discoveries</p>
                <p className="mt-2 text-xl font-semibold text-white">12 high-value relationships</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <p className="text-sm text-slate-400">Retrieval confidence</p>
                <p className="mt-2 text-xl font-semibold text-white">96.3%</p>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Security posture"
          description="Threats, vulnerabilities, critical assets, and policy compliance in one view."
        >
          <StatusList
            items={[
              { label: 'Threats', value: '3 active', tone: 'danger' },
              { label: 'Vulnerabilities', value: '12 critical', tone: 'warning' },
              { label: 'Critical assets', value: '89 protected', tone: 'positive' },
              { label: 'Compliance', value: '98% aligned', tone: 'positive' },
            ]}
          />
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard
          title="Platform health trend"
          description="Rolling performance for the last seven days across core runtime signals."
        >
          <HealthChart data={chartData} />
        </SectionCard>

        <SectionCard
          title="Activity feed"
          description="Live operational events, governance approvals, AI decisions, and secure signals."
        >
          <div className="space-y-3">
            {activityFeed.map((event) => (
              <div
                key={event.title}
                className="flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/70 p-4"
              >
                <div className="mt-1 rounded-full border border-cyan-400/20 bg-cyan-500/10 p-2 text-cyan-200">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-medium text-white">{event.title}</p>
                  <p className="mt-1 text-sm text-slate-400">{event.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
