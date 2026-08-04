import type { ConsoleData, ConsoleSection } from '../types/console';
import { navigationSections } from '../types/console';

export interface DashboardWidget {
  id: string;
  title: string;
  description: string;
  kind: 'metric' | 'status' | 'timeline' | 'table' | 'chart';
  value?: string;
  trend?: string;
  loading?: boolean;
  error?: string;
  empty?: boolean;
  refreshable?: boolean;
  drillable?: boolean;
}

export interface DashboardViewModel {
  summary: ConsoleData['summary'];
  widgets: DashboardWidget[];
  modules: ConsoleSection[];
}

export interface ModulePageModel {
  title: string;
  description: string;
  breadcrumbs: Array<{ label: string; href?: string }>;
  sections: Array<{ title: string; description: string }>;
}

const fallbackConsoleData: ConsoleData = {
  ok: true,
  summary: {
    status: 'healthy',
    uptime: '99.98%',
    activeAgents: 18,
    workflowRuns: 42,
    approvalsPending: 6,
    providersHealthy: 6,
  },
  alerts: [
    {
      id: 'alert-1',
      severity: 'high',
      title: 'Approval queue backlog',
      message: '3 approvals are pending review above the target threshold.',
    },
    {
      id: 'alert-2',
      severity: 'medium',
      title: 'Provider latency spike',
      message: 'Gemini response latency climbed 18% over the last 15 minutes.',
    },
  ],
  providers: [
    { name: 'OpenAI', health: 'healthy', latency: '132ms', tokens: '12.4M' },
    { name: 'Anthropic', health: 'healthy', latency: '118ms', tokens: '9.6M' },
    { name: 'Gemini', health: 'degraded', latency: '196ms', tokens: '7.1M' },
    { name: 'Groq', health: 'healthy', latency: '94ms', tokens: '11.2M' },
    { name: 'Kimi', health: 'healthy', latency: '108ms', tokens: '8.5M' },
    { name: 'Ollama', health: 'healthy', latency: '87ms', tokens: '2.3M' },
  ],
};

async function loadConsoleData(): Promise<ConsoleData> {
  const requestUrl = '/api/console';
  const baseUrl =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'http://localhost';

  try {
    const response = await fetch(new URL(requestUrl, baseUrl).toString(), {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      return fallbackConsoleData;
    }

    return (await response.json()) as ConsoleData;
  } catch {
    return fallbackConsoleData;
  }
}

export async function getDashboardViewModel(): Promise<DashboardViewModel> {
  const data = await loadConsoleData();

  return {
    summary: data.summary,
    modules: navigationSections,
    widgets: [
      {
        id: 'infrastructure-health',
        title: 'Infrastructure Health',
        description: 'Current readiness across core services and edges.',
        kind: 'metric',
        value: '99.94%',
        trend: '+0.8%',
        refreshable: true,
        drillable: true,
      },
      {
        id: 'ai-provider-health',
        title: 'AI Provider Health',
        description: 'Model routing and resilience posture.',
        kind: 'status',
        value: '6/6 healthy',
        refreshable: true,
        drillable: true,
      },
      {
        id: 'running-agents',
        title: 'Running Agents',
        description: 'Live execution surfaces and queue depth.',
        kind: 'metric',
        value: `${data.summary.activeAgents}`,
        refreshable: true,
        drillable: true,
      },
      {
        id: 'running-workflows',
        title: 'Running Workflows',
        description: 'Current orchestration load and SLA posture.',
        kind: 'metric',
        value: `${data.summary.workflowRuns}`,
        refreshable: true,
        drillable: true,
      },
    ],
  };
}

export async function getModulePageModel(moduleId: string): Promise<ModulePageModel> {
  const module = navigationSections.find(
    (item) => item.href === `/${moduleId}` || item.id === moduleId,
  );
  const title = module?.title ?? 'Module';

  return {
    title,
    description: `${title} operations and monitoring surface.`,
    breadcrumbs: [{ label: 'Home', href: '/' }, { label: title }],
    sections: [
      {
        title: 'Overview',
        description: 'Operational status and current posture.',
      },
      {
        title: 'Signals',
        description: 'Recent health, activity, and compliance events.',
      },
      {
        title: 'Actions',
        description: 'Recommended interventions and operational controls.',
      },
    ],
  };
}
