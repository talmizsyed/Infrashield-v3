'use client';

import type { ReactElement } from 'react';
import { Activity, Bot, BrainCircuit, Layers3, ShieldCheck, Workflow } from 'lucide-react';
import type {
  DashboardWidgetConfiguration,
  PlatformConfiguration,
} from '@infrashield/platform-configuration';
import type { ExecutiveDashboardData } from '../../types/executive-dashboard';
import { KpiCard } from './kpi-card';
import { LoadingSkeleton } from '../ui/loading-skeleton';

interface DashboardWidgetProps {
  configuration: PlatformConfiguration;
  data: ExecutiveDashboardData;
}

interface RegisteredDashboardWidget {
  id: string;
  render: (props: DashboardWidgetProps) => ReactElement;
}

class DashboardWidgetRegistry {
  private readonly widgets = new Map<string, RegisteredDashboardWidget>();

  public register(widget: RegisteredDashboardWidget): void {
    this.widgets.set(widget.id, widget);
  }

  public get(widgetId: string): RegisteredDashboardWidget | undefined {
    return this.widgets.get(widgetId);
  }
}

const widgetRegistry = new DashboardWidgetRegistry();

widgetRegistry.register({
  id: 'InfrastructureHealth',
  render: ({ data }) => {
    const infrastructure = data.infrastructure;
    const inventory =
      infrastructure.vmwareClusters +
      infrastructure.openshiftClusters +
      infrastructure.linuxServers +
      infrastructure.windowsServers +
      infrastructure.oracleDatabases +
      infrastructure.kubernetesClusters;

    return (
      <KpiCard
        label="Infrastructure health"
        value={inventory.toString()}
        detail="Configured infrastructure inventory"
        icon={<Layers3 className="h-5 w-5" />}
      />
    );
  },
});

widgetRegistry.register({
  id: 'RuntimeHealth',
  render: ({ data }) => (
    <KpiCard
      label="Runtime health"
      value={`${data.runtime.averageExecutionDuration}ms`}
      detail="Average execution duration"
      tone="positive"
      icon={<Activity className="h-5 w-5" />}
    />
  ),
});

widgetRegistry.register({
  id: 'WorkflowStatus',
  render: ({ data }) => (
    <KpiCard
      label="Workflow status"
      value={data.runtime.activeExecutions.toString()}
      detail="Active executions"
      icon={<Workflow className="h-5 w-5" />}
    />
  ),
});

widgetRegistry.register({
  id: 'SecurityOverview',
  render: ({ data }) => (
    <KpiCard
      label="Security overview"
      value={data.security.openVulnerabilities.toString()}
      detail="Open vulnerabilities"
      tone="danger"
      icon={<ShieldCheck className="h-5 w-5" />}
    />
  ),
});

widgetRegistry.register({
  id: 'AgentHealth',
  render: ({ data }) => (
    <KpiCard
      label="Agent health"
      value={data.runtime.runningAgents.toString()}
      detail="Running agents"
      tone="positive"
      icon={<Bot className="h-5 w-5" />}
    />
  ),
});

widgetRegistry.register({
  id: 'KnowledgeGraph',
  render: ({ configuration, data }) => (
    <KpiCard
      label="Knowledge graph"
      value={
        configuration.knowledgeGraph.enabled
          ? data.aiPlatform.promptExecutions.toLocaleString()
          : 'Disabled'
      }
      detail="Configured knowledge context operations"
      icon={<BrainCircuit className="h-5 w-5" />}
    />
  ),
});

interface DashboardRendererProps {
  configuration: PlatformConfiguration | null;
  data: ExecutiveDashboardData | null;
  isLoading: boolean;
}

export function DashboardRenderer({
  configuration,
  data,
  isLoading,
}: DashboardRendererProps): ReactElement {
  if (isLoading) {
    return <DashboardWidgetSkeleton />;
  }

  if (!configuration || !data) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/40 p-4 text-sm text-slate-400">
        No configured dashboard widgets are available.
      </div>
    );
  }

  const widgets = configuration.dashboard.widgets
    .filter((widget) => widget.enabled)
    .sort((left, right) => left.order - right.order);

  if (!widgets.length) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/40 p-4 text-sm text-slate-400">
        No configured dashboard widgets are enabled.
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {widgets.map((widget) => (
        <ConfiguredWidget
          key={widget.id}
          widget={widget}
          configuration={configuration}
          data={data}
        />
      ))}
    </div>
  );
}

function ConfiguredWidget({
  widget,
  configuration,
  data,
}: {
  widget: DashboardWidgetConfiguration;
  configuration: PlatformConfiguration;
  data: ExecutiveDashboardData;
}): ReactElement {
  const registeredWidget = widgetRegistry.get(widget.id);

  if (!registeredWidget) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/40 p-5 text-sm text-slate-400">
        Widget {widget.title} is not registered.
      </div>
    );
  }

  return registeredWidget.render({ configuration, data });
}

function DashboardWidgetSkeleton(): ReactElement {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 6 }, (_, index) => (
        <LoadingSkeleton key={index} className="h-36" />
      ))}
    </div>
  );
}
