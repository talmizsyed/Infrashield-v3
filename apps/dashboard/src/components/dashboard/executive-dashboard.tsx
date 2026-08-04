'use client';

import type { ReactElement } from 'react';
import { Activity, AlertTriangle, BrainCircuit, Cpu, ShieldCheck } from 'lucide-react';
import { useExecutiveDashboardData } from '../../hooks/use-executive-dashboard-data';
import {
  AgentActivityTimeline,
  InfrastructureInventoryChart,
  PlatformHealthGauge,
  SecurityRiskTrend,
  WorkflowStatusDonut,
} from './executive-charts';
import { HealthChart } from './health-chart';
import { OverviewGrid } from './overview-grid';
import { SectionCard } from './section-card';
import { StatusList } from './status-list';

export function ExecutiveDashboard(): ReactElement {
  const { data, error, isLoading } = useExecutiveDashboardData();
  const platformHealth = data?.platformHealth;
  const infrastructure = data?.infrastructure;
  const aiPlatform = data?.aiPlatform;
  const runtime = data?.runtime;
  const security = data?.security;

  const infrastructureItems = infrastructure
    ? [
        {
          label: 'VMware clusters',
          value: infrastructure.vmwareClusters.toString(),
          tone: 'positive' as const,
        },
        {
          label: 'OpenShift clusters',
          value: infrastructure.openshiftClusters.toString(),
          tone: 'positive' as const,
        },
        {
          label: 'Linux servers',
          value: infrastructure.linuxServers.toString(),
          tone: 'default' as const,
        },
        {
          label: 'Windows servers',
          value: infrastructure.windowsServers.toString(),
          tone: 'default' as const,
        },
        {
          label: 'Oracle databases',
          value: infrastructure.oracleDatabases.toString(),
          tone: 'positive' as const,
        },
        {
          label: 'Kubernetes clusters',
          value: infrastructure.kubernetesClusters.toString(),
          tone: 'positive' as const,
        },
      ]
    : [];

  const workflowItems = runtime
    ? [
        {
          label: 'Running executions',
          value: runtime.runningExecutions.toString(),
          tone: 'positive' as const,
        },
        { label: 'Queue depth', value: runtime.queueDepth.toString(), tone: 'warning' as const },
        {
          label: 'Failed executions',
          value: runtime.failedExecutions.toString(),
          tone: 'danger' as const,
        },
        {
          label: 'Average latency',
          value: `${runtime.averageLatency}ms`,
          tone: 'default' as const,
        },
      ]
    : [];

  const agentItems = aiPlatform
    ? [
        {
          label: 'Active agents',
          value: aiPlatform.activeAgents.toString(),
          tone: 'positive' as const,
        },
        {
          label: 'Running workflows',
          value: aiPlatform.runningWorkflows.toString(),
          tone: 'positive' as const,
        },
        {
          label: 'LLM providers',
          value: aiPlatform.llmProviders.toString(),
          tone: 'default' as const,
        },
        {
          label: 'Prompt executions',
          value: aiPlatform.promptExecutions.toLocaleString(),
          tone: 'default' as const,
        },
      ]
    : [];

  const securityItems = security
    ? [
        {
          label: 'Open vulnerabilities',
          value: security.openVulnerabilities.toString(),
          tone: 'warning' as const,
        },
        {
          label: 'Critical CVEs',
          value: security.criticalCVEs.toString(),
          tone: 'danger' as const,
        },
        {
          label: 'Patch compliance',
          value: `${security.patchCompliance}%`,
          tone: 'positive' as const,
        },
        {
          label: 'Zero Trust score',
          value: `${security.zeroTrustScore}%`,
          tone: 'positive' as const,
        },
      ]
    : [];

  const activityFeed = platformHealth
    ? [
        {
          title: 'Platform health',
          detail: `${platformHealth.overallHealth}% overall health with ${platformHealth.uptime} uptime.`,
          tone: 'positive' as const,
        },
        {
          title: 'Critical alert exposure',
          detail: `${platformHealth.criticalAlerts} critical alerts require operational attention.`,
          tone: 'danger' as const,
        },
        {
          title: 'Warning alert exposure',
          detail: `${platformHealth.warningAlerts} warning alerts are currently being monitored.`,
          tone: 'warning' as const,
        },
      ]
    : [];

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
              {isLoading
                ? 'Loading…'
                : platformHealth
                  ? `${platformHealth.overallHealth}%`
                  : 'Unavailable'}
            </div>
          </div>
        </div>
      </header>

      <OverviewGrid data={data} isLoading={isLoading} />

      {error ? (
        <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <SectionCard title="Platform health gauge" description="Live weighted service health.">
          <PlatformHealthGauge data={platformHealth?.healthTrend} isLoading={isLoading} />
        </SectionCard>
        <SectionCard title="Infrastructure inventory" description="Managed operational estate.">
          <InfrastructureInventoryChart data={infrastructure?.inventory} isLoading={isLoading} />
        </SectionCard>
        <SectionCard
          title="Agent activity timeline"
          description="Active agents by operating window."
        >
          <AgentActivityTimeline data={aiPlatform?.agentActivity} isLoading={isLoading} />
        </SectionCard>
        <SectionCard title="Workflow status" description="Current orchestration distribution.">
          <WorkflowStatusDonut data={runtime?.workflowStatus} isLoading={isLoading} />
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard
          title="Infrastructure health"
          description="Cross-domain posture for clusters, servers, databases, and Kubernetes readiness."
        >
          {infrastructureItems.length > 0 ? (
            <StatusList items={infrastructureItems} />
          ) : (
            <EmptyState isLoading={isLoading} />
          )}
        </SectionCard>

        <SectionCard
          title="AI control center"
          description="Provider posture, routing quality, and operational throughput."
        >
          {aiPlatform ? (
            <div className="grid gap-4 md:grid-cols-2">
              <LiveMetric
                label="Active agents"
                value={aiPlatform.activeAgents.toString()}
                icon={<ShieldCheck className="h-4 w-4 text-cyan-300" />}
              />
              <LiveMetric
                label="Running workflows"
                value={aiPlatform.runningWorkflows.toString()}
                icon={<Activity className="h-4 w-4 text-cyan-300" />}
              />
              <LiveMetric
                label="AI response time"
                value={`${aiPlatform.aiResponseTime}ms`}
                icon={<Cpu className="h-4 w-4 text-cyan-300" />}
              />
              <LiveMetric
                label="Prompt executions"
                value={aiPlatform.promptExecutions.toLocaleString()}
                icon={<BrainCircuit className="h-4 w-4 text-cyan-300" />}
              />
            </div>
          ) : (
            <EmptyState isLoading={isLoading} />
          )}
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <SectionCard
          title="Workflow center"
          description="Execution posture for orchestration, queue depth, and failure signal quality."
        >
          {workflowItems.length > 0 ? (
            <StatusList items={workflowItems} />
          ) : (
            <EmptyState isLoading={isLoading} />
          )}
        </SectionCard>

        <SectionCard
          title="Agent center"
          description="Runtime state for agent activity, workflow execution, and provider availability."
        >
          {agentItems.length > 0 ? (
            <StatusList items={agentItems} />
          ) : (
            <EmptyState isLoading={isLoading} />
          )}
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard
          title="Runtime performance"
          description="Execution latency and queue signals across the runtime fabric."
        >
          {runtime ? (
            <div className="rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/10 via-slate-950 to-slate-900 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-slate-400">Average execution latency</p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {runtime.averageLatency}ms
                  </p>
                </div>
                <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-200">
                  {runtime.runningExecutions} running
                </div>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <LiveMetric label="Queue depth" value={runtime.queueDepth.toString()} />
                <LiveMetric label="Failed executions" value={runtime.failedExecutions.toString()} />
              </div>
            </div>
          ) : (
            <EmptyState isLoading={isLoading} />
          )}
        </SectionCard>

        <SectionCard
          title="Security posture"
          description="Vulnerabilities, CVEs, patch compliance, and Zero Trust posture."
        >
          {securityItems.length > 0 ? (
            <StatusList items={securityItems} />
          ) : (
            <EmptyState isLoading={isLoading} />
          )}
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard
          title="Platform health trend"
          description="Rolling service health across core runtime signals."
        >
          {platformHealth?.healthTrend.length ? (
            <HealthChart
              data={platformHealth.healthTrend.map(({ label, value }) => ({ name: label, value }))}
            />
          ) : (
            <EmptyState isLoading={isLoading} />
          )}
        </SectionCard>

        <SectionCard
          title="Security risk trend"
          description="Open vulnerability trend for the current operating window."
        >
          <SecurityRiskTrend data={security?.riskTrend} isLoading={isLoading} />
        </SectionCard>
      </div>

      <SectionCard
        title="Activity feed"
        description="Live operational summary from platform health signals."
      >
        {activityFeed.length > 0 ? (
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
        ) : (
          <EmptyState isLoading={isLoading} />
        )}
      </SectionCard>
    </div>
  );
}

function LiveMetric({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: ReactElement;
}): ReactElement {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">{label}</p>
        {icon}
      </div>
      <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

function EmptyState({ isLoading }: { isLoading: boolean }): ReactElement {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/40 p-4 text-sm text-slate-400">
      {isLoading
        ? 'Loading operational data…'
        : 'No operational data is available for this surface yet.'}
    </div>
  );
}
