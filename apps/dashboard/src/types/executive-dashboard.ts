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

export interface RuntimeData {
  runningExecutions: number;
  queueDepth: number;
  failedExecutions: number;
  averageLatency: number;
  workflowStatus: NamedMetric[];
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
