export interface ChartPoint {
  label: string;
  value: number;
}

export interface NamedMetric {
  name: string;
  value: number;
}

export interface PlatformHealthData {
  overallHealth: number;
  uptime: string;
  activeAlerts: number;
  criticalAlerts: number;
  warningAlerts: number;
  healthTrend: ChartPoint[];
}

export interface InfrastructureSummaryData {
  vmwareClusters: number;
  openshiftClusters: number;
  linuxServers: number;
  windowsServers: number;
  oracleDatabases: number;
  kubernetesClusters: number;
  inventory: NamedMetric[];
}

export interface AiPlatformData {
  activeAgents: number;
  runningWorkflows: number;
  llmProviders: number;
  promptExecutions: number;
  aiResponseTime: number;
  agentActivity: Array<{ label: string; active: number }>;
}

export interface RecentWorkflowExecution {
  workflowId: string;
  status: string;
  updatedAt: string;
  durationMs: number | null;
  completedNodes: number;
  failedNodes: number;
  pendingNodes: number;
}

export interface SchedulerHealthData {
  status: 'healthy' | 'warning' | 'degraded';
  detail: string;
}

export interface RuntimeData {
  activeExecutions: number;
  runningExecutions: number;
  runningAgents: number;
  queueDepth: number;
  failedExecutions: number;
  averageExecutionDuration: number;
  schedulerHealth: SchedulerHealthData;
  workflowStatus: NamedMetric[];
  recentExecutions: RecentWorkflowExecution[];
}

export interface SecurityData {
  openVulnerabilities: number;
  criticalCVEs: number;
  patchCompliance: number;
  zeroTrustScore: number;
  riskTrend: ChartPoint[];
}

export interface ExecutiveDashboardData {
  platformHealth: PlatformHealthData;
  infrastructure: InfrastructureSummaryData;
  aiPlatform: AiPlatformData;
  runtime: RuntimeData;
  security: SecurityData;
}
