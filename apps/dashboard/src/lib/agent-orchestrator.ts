import {
  createAgentOrchestrator,
  createDefaultAgentExecutor,
  type AgentOrchestrator,
} from '@infrashield/agent-orchestrator';

let orchestrator: AgentOrchestrator | undefined;

export function getAgentOrchestrator(): AgentOrchestrator {
  if (!orchestrator) {
    orchestrator = createAgentOrchestrator(createDefaultAgentExecutor());
  }
  return orchestrator;
}
