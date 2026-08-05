import type { AgentPlan, AgentResult, AgentSession } from './types';

export class AgentExecutor {
  public execute(session: AgentSession, plan: AgentPlan): AgentResult {
    return {
      sessionId: session.id,
      agentId: session.agentId,
      state: 'completed',
      output: `Completed ${plan.tasks.length} planned tasks for ${plan.goal}.`,
    };
  }
}
