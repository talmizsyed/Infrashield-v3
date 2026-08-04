export interface ConsoleSummary {
  status: string;
  uptime: string;
  activeAgents: number;
  workflowRuns: number;
  approvalsPending: number;
  providersHealthy: number;
}

export interface ConsoleAlert {
  id: string;
  severity: 'high' | 'medium' | 'low';
  title: string;
  message: string;
}

export interface ConsoleProvider {
  name: string;
  health: string;
  latency: string;
  tokens: string;
}

export interface ConsoleData {
  ok: boolean;
  summary: ConsoleSummary;
  alerts: ConsoleAlert[];
  providers: ConsoleProvider[];
}

export interface ConsoleSection {
  id: string;
  title: string;
  href: string;
  description: string;
  badge?: string;
}

export const navigationSections: ConsoleSection[] = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    href: '/',
    description: 'Platform overview and operational health',
    badge: 'Live',
  },
  {
    id: 'infrastructure',
    title: 'Infrastructure',
    href: '/infrastructure',
    description: 'Cluster posture and environment health',
  },
  {
    id: 'openshift',
    title: 'OpenShift',
    href: '/openshift',
    description: 'Control plane and node readiness',
  },
  {
    id: 'vmware',
    title: 'VMware',
    href: '/vmware',
    description: 'Virtual infrastructure and workload health',
  },
  {
    id: 'providers',
    title: 'AI Providers',
    href: '/ai-providers',
    description: 'Model health and provider routing',
  },
  {
    id: 'agents',
    title: 'Agents',
    href: '/agents',
    description: 'Runtime fleet and execution status',
  },
  {
    id: 'workflows',
    title: 'Workflow Studio',
    href: '/workflows',
    description: 'Execution graphs and orchestration state',
  },
  {
    id: 'knowledge',
    title: 'Knowledge Graph',
    href: '/knowledge-graph',
    description: 'Context memory and retrieval topology',
  },
  {
    id: 'security',
    title: 'Security',
    href: '/security',
    description: 'Threats, vulnerabilities, and posture',
  },
  {
    id: 'governance',
    title: 'Governance',
    href: '/governance',
    description: 'Policies, approvals, and controls',
  },
  {
    id: 'observability',
    title: 'Observability',
    href: '/observability',
    description: 'Tracing, analytics, and audit surfaces',
  },
  {
    id: 'settings',
    title: 'Settings',
    href: '/settings',
    description: 'Workspace preferences and integrations',
  },
];
