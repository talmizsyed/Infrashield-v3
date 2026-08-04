import type { ReactElement } from 'react';
import {
  Activity,
  Bot,
  BrainCircuit,
  Cpu,
  HardHat,
  Layers3,
  ShieldCheck,
  Workflow,
} from 'lucide-react';
import { KpiCard } from './kpi-card';
import { useConsoleData } from '../../hooks/use-console-data';

export function OverviewGrid(): ReactElement {
  const { data } = useConsoleData();

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        label="Platform health"
        value={data?.summary?.status ?? 'Healthy'}
        detail="Runtime posture and service integrity"
        tone="positive"
        icon={<ShieldCheck className="h-5 w-5" />}
      />
      <KpiCard
        label="Running agents"
        value={data?.summary?.activeAgents?.toString() ?? '18'}
        detail="Live execution surfaces"
        icon={<Bot className="h-5 w-5" />}
      />
      <KpiCard
        label="Running workflows"
        value={data?.summary?.workflowRuns?.toString() ?? '42'}
        detail="Current orchestration load"
        icon={<Workflow className="h-5 w-5" />}
      />
      <KpiCard
        label="Pending approvals"
        value={data?.summary?.approvalsPending?.toString() ?? '6'}
        detail="Governance review queue"
        tone="warning"
        icon={<HardHat className="h-5 w-5" />}
      />
      <KpiCard
        label="Knowledge graph nodes"
        value="1.2K"
        detail="Context memory topology"
        icon={<BrainCircuit className="h-5 w-5" />}
      />
      <KpiCard
        label="Infrastructure assets"
        value="382"
        detail="VMware and OpenShift stock"
        icon={<Layers3 className="h-5 w-5" />}
      />
      <KpiCard
        label="Open incidents"
        value="3"
        detail="Active priority signals"
        tone="danger"
        icon={<Activity className="h-5 w-5" />}
      />
      <KpiCard
        label="Provider health"
        value={`${data?.summary?.providersHealthy ?? 6}/6`}
        detail="Model routing readiness"
        icon={<Cpu className="h-5 w-5" />}
      />
    </div>
  );
}
