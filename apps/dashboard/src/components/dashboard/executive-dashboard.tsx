'use client';

import type { ReactElement } from 'react';
import { Activity, AlertTriangle, BrainCircuit, Cpu, ShieldCheck } from 'lucide-react';
import { useExecutiveDashboardData } from '../../hooks/use-executive-dashboard-data';
import { usePlatformConfiguration } from '../../hooks/use-platform-configuration';
import { DashboardRenderer } from './dashboard-renderer';
import {
  AgentActivityTimeline,
  InfrastructureInventoryChart,
  PlatformHealthGauge,
  SecurityRiskTrend,
  WorkflowStatusDonut,
} from './executive-charts';
import { HealthChart } from './health-chart';
import { SectionCard } from './section-card';
import { StatusList } from './status-list';

export function ExecutiveDashboard(): ReactElement {
  const { data, error, isLoading } = useExecutiveDashboardData();
  const {
    configuration,
    error: configurationError,
    isLoading: isConfigurationLoading,
  } = usePlatformConfiguration();
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
          label: 'Active executions',
          value: runtime.activeExecutions.toString(),
          tone: 'positive' as const,
        },
        { label: 'Queue depth', value: runtime.queueDepth.toString(), tone: 'warning' as const },
        {
          label: 'Failed executions',
          value: runtime.failedExecutions.toString(),
          tone: 'danger' as const,
        },
        {
          label: 'Average duration',
          value: `${runtime.averageExecutionDuration}ms`,
          tone: 'default' as const,
        },
      ]
    : [];

  const agentItems =
    runtime && aiPlatform
      ? [
          {
            label: 'Running agents',
            value: runtime.runningAgents.toString(),
            tone: 'positive' as const,
          },
          {
            label: 'Scheduler health',
            value: runtime.schedulerHealth.detail,
            tone:
              runtime.schedulerHealth.status === 'degraded'
                ? ('danger' as const)
                : runtime.schedulerHealth.status === 'warning'
                  ? ('warning' as const)
                  : ('positive' as const),
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

  const activityFeed = runtime?.recentExecutions ?? [];

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

      <DashboardRenderer
        configuration={configuration}
        data={data}
        isLoading={isLoading || isConfigurationLoading}
      />

      {error || configurationError ? (
        <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-100">
          {error ?? configurationError}
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
                value={
                  runtime ? runtime.runningAgents.toString() : aiPlatform.activeAgents.toString()
                }
                icon={<ShieldCheck className="h-4 w-4 text-cyan-300" />}
              />
              <LiveMetric
                label="Running workflows"
                value={
                  runtime
                    ? runtime.activeExecutions.toString()
                    : aiPlatform.runningWorkflows.toString()
                }
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
                  <p className="text-sm text-slate-400">Average execution duration</p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {runtime.averageExecutionDuration}ms
                  </p>
                </div>
                <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-200">
                  {runtime.schedulerHealth.status}
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
        title="Recent workflow executions"
        description="Latest workflow runs sourced from the orchestrator runtime."
      >
        {activityFeed.length > 0 ? (
          <div className="space-y-3">
            {activityFeed.map((event) => (
              <div
                key={event.workflowId}
                className="flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/70 p-4"
              >
                <div className="mt-1 rounded-full border border-cyan-400/20 bg-cyan-500/10 p-2 text-cyan-200">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-medium text-white">{event.workflowId}</p>
                  <p className="mt-1 text-sm text-slate-400">
                    {event.status} · {event.completedNodes} completed · {event.pendingNodes} pending
                    {event.durationMs !== null ? ` · ${event.durationMs}ms` : ''}
                  </p>
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
