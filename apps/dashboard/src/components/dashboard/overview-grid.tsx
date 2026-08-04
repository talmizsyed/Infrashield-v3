import type { ReactElement } from 'react';
import { Activity, Bot, Cpu, Layers3, ShieldCheck, Workflow } from 'lucide-react';
import { KpiCard } from './kpi-card';
import { LoadingSkeleton } from '../ui/loading-skeleton';
import type { ExecutiveDashboardData } from '../../types/executive-dashboard';

interface OverviewGridProps {
  data: ExecutiveDashboardData | null;
  isLoading: boolean;
}

export function OverviewGrid({ data, isLoading }: OverviewGridProps): ReactElement {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <LoadingSkeleton key={index} className="h-36" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        label="Platform health"
        value={data ? `${data.platformHealth.overallHealth}%` : '—'}
        detail="Runtime posture and service integrity"
        tone="positive"
        icon={<ShieldCheck className="h-5 w-5" />}
      />
      <KpiCard
        label="Running agents"
        value={data?.aiPlatform.activeAgents.toString() ?? '—'}
        detail="Live execution surfaces"
        icon={<Bot className="h-5 w-5" />}
      />
      <KpiCard
        label="Running workflows"
        value={data?.aiPlatform.runningWorkflows.toString() ?? '—'}
        detail="Current orchestration load"
        icon={<Workflow className="h-5 w-5" />}
      />
      <KpiCard
        label="Active alerts"
        value={data?.platformHealth.activeAlerts.toString() ?? '—'}
        detail="Critical and warning operational signals"
        tone="warning"
        icon={<Activity className="h-5 w-5" />}
      />
      <KpiCard
        label="Prompt executions"
        value={data?.aiPlatform.promptExecutions.toLocaleString() ?? '—'}
        detail="AI requests processed by the platform"
        icon={<Cpu className="h-5 w-5" />}
      />
      <KpiCard
        label="Infrastructure assets"
        value={
          data
            ? (
                data.infrastructure.linuxServers +
                data.infrastructure.windowsServers +
                data.infrastructure.vmwareClusters +
                data.infrastructure.openshiftClusters +
                data.infrastructure.oracleDatabases +
                data.infrastructure.kubernetesClusters
              ).toString()
            : '—'
        }
        detail="Cluster, server, database, and Kubernetes inventory"
        icon={<Layers3 className="h-5 w-5" />}
      />
      <KpiCard
        label="Open vulnerabilities"
        value={data?.security.openVulnerabilities.toString() ?? '—'}
        detail="Vulnerabilities requiring security attention"
        tone="danger"
        icon={<Activity className="h-5 w-5" />}
      />
      <KpiCard
        label="LLM providers"
        value={data?.aiPlatform.llmProviders.toString() ?? '—'}
        detail="Model routing readiness"
        icon={<Cpu className="h-5 w-5" />}
      />
    </div>
  );
}
