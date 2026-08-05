import { AgentRuntime } from './runtime';
import type { AgentDefinition, AgentType } from './types';

const agentTypes: AgentType[] = [
  'InfrastructureAgent',
  'SecurityAgent',
  'OperationsAgent',
  'KnowledgeGraphAgent',
  'WorkflowAgent',
  'ProviderAgent',
  'MonitoringAgent',
  'PlanningAgent',
];

export function createSampleAgentDefinitions(): AgentDefinition[] {
  return agentTypes.map((type) => ({
    id: type.replace('Agent', '').toLowerCase(),
    name: type,
    type,
    description: `${type} runtime capability.`,
    defaultPolicy: {
      executionLimit: 3,
      timeoutMs: 30000,
      approvalRequired: false,
      allowedTools: ['read'],
      allowedProviders: ['platform'],
    },
  }));
}

export function createAgentRuntimeWithSamples(): AgentRuntime {
  const runtime = new AgentRuntime();
  for (const agent of createSampleAgentDefinitions()) runtime.register(agent);
  return runtime;
}
