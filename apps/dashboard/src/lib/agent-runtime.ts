import { createAgentRuntimeWithSamples, type AgentRuntime } from '@infrashield/agent-runtime';

let agentRuntime: AgentRuntime | undefined;

export function getAgentRuntime(): AgentRuntime {
  if (!agentRuntime) agentRuntime = createAgentRuntimeWithSamples();
  return agentRuntime;
}
