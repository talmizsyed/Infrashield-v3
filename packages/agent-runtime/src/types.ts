export type AgentType =
  | 'InfrastructureAgent'
  | 'SecurityAgent'
  | 'OperationsAgent'
  | 'KnowledgeGraphAgent'
  | 'WorkflowAgent'
  | 'ProviderAgent'
  | 'MonitoringAgent'
  | 'PlanningAgent';

export type ExecutionMode = 'interactive' | 'background' | 'scheduled' | 'event-driven';

export type AgentState =
  | 'registered'
  | 'initialized'
  | 'validated'
  | 'planned'
  | 'executing'
  | 'observing'
  | 'recovering'
  | 'completed'
  | 'cancelled'
  | 'failed'
  | 'awaiting-approval';

export interface AgentDefinition {
  id: string;
  name: string;
  type: AgentType;
  description: string;
  defaultPolicy: AgentPolicy;
}

export interface AgentPolicy {
  executionLimit: number;
  timeoutMs: number;
  approvalRequired: boolean;
  allowedTools: string[];
  allowedProviders: string[];
}

export interface AgentContext {
  sessionId: string;
  agentId: string;
  mode: ExecutionMode;
  goal: string;
  tools: string[];
  providers: string[];
  executionContext: Record<string, string | number | boolean>;
}

export interface AgentTask {
  id: string;
  title: string;
  dependencies: string[];
  subtasks: AgentTask[];
}

export interface AgentPlan {
  goal: string;
  tasks: AgentTask[];
  executionGraph: Array<{ taskId: string; dependsOn: string[] }>;
}

export interface AgentMemory {
  shortTerm: Record<string, string>;
  longTerm: Record<string, string>;
  conversation: string[];
  executionContext: Record<string, string | number | boolean>;
}

export interface AgentCheckpoint {
  id: string;
  sessionId: string;
  state: AgentState;
  completedTaskIds: string[];
  createdAt: string;
}

export interface AgentSession {
  id: string;
  agentId: string;
  state: AgentState;
  context: AgentContext;
  memory: AgentMemory;
  plan?: AgentPlan;
  checkpoints: AgentCheckpoint[];
  attempts: number;
  createdAt: string;
  updatedAt: string;
}

export interface AgentResult {
  sessionId: string;
  agentId: string;
  state: AgentState;
  output?: string;
  error?: string;
  checkpoint?: AgentCheckpoint;
}
