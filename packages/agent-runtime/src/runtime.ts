import { AgentExecutor } from './executor';
import { createAgentMemory } from './memory';
import { AgentPlanner } from './planner';
import { AgentRegistry } from './registry';
import type {
  AgentCheckpoint,
  AgentContext,
  AgentDefinition,
  AgentPlan,
  AgentResult,
  AgentSession,
  AgentState,
  ExecutionMode,
} from './types';

export class AgentRuntime {
  public readonly registry = new AgentRegistry();
  private readonly sessions = new Map<string, AgentSession>();
  private readonly planner = new AgentPlanner();
  private readonly executor = new AgentExecutor();
  private sessionSequence = 0;

  public register(agent: AgentDefinition): void {
    this.registry.register(agent);
  }

  public initialize(
    agentId: string,
    goal: string,
    mode: ExecutionMode = 'interactive',
    executionContext: Record<string, string | number | boolean> = {},
  ): AgentSession {
    const agent = this.getAgent(agentId);
    const now = new Date().toISOString();
    const id = `agent-session-${++this.sessionSequence}`;
    const context: AgentContext = {
      sessionId: id,
      agentId,
      mode,
      goal,
      tools: agent.defaultPolicy.allowedTools,
      providers: agent.defaultPolicy.allowedProviders,
      executionContext,
    };
    const session: AgentSession = {
      id,
      agentId,
      state: 'initialized',
      context,
      memory: createAgentMemory(executionContext),
      checkpoints: [],
      attempts: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.sessions.set(id, session);
    return session;
  }

  public validate(sessionId: string): AgentSession {
    const session = this.getSession(sessionId);
    const agent = this.getAgent(session.agentId);
    if (session.context.tools.some((tool) => !agent.defaultPolicy.allowedTools.includes(tool))) {
      return this.transition(session, 'failed');
    }
    return this.transition(
      session,
      agent.defaultPolicy.approvalRequired ? 'awaiting-approval' : 'validated',
    );
  }

  public plan(sessionId: string): AgentPlan {
    const session = this.getSession(sessionId);
    if (session.state !== 'validated')
      throw new Error(`Session ${sessionId} must be validated before planning.`);
    const plan = this.planner.plan(session.context.goal);
    this.saveSession({ ...session, state: 'planned', plan, updatedAt: new Date().toISOString() });
    return plan;
  }

  public execute(sessionId: string): AgentResult {
    const session = this.getSession(sessionId);
    const plan = session.plan;
    if (!plan || session.state !== 'planned') {
      throw new Error(`Session ${sessionId} must be planned before execution.`);
    }
    const executing = this.transition(session, 'executing');
    const result = this.executor.execute(executing, plan);
    const observing = this.transition(executing, 'observing');
    const completed = this.transition(observing, result.state);
    const checkpoint = this.checkpoint(completed.id);
    return { ...result, checkpoint };
  }

  public run(agentId: string, goal: string, mode: ExecutionMode = 'interactive'): AgentResult {
    const initialized = this.initialize(agentId, goal, mode);
    const validated = this.validate(initialized.id);
    if (validated.state === 'awaiting-approval') {
      return {
        sessionId: validated.id,
        agentId,
        state: validated.state,
        error: 'Execution approval is required.',
      };
    }
    if (validated.state === 'failed') {
      return {
        sessionId: validated.id,
        agentId,
        state: validated.state,
        error: 'Agent policy validation failed.',
      };
    }
    this.plan(validated.id);
    return this.execute(validated.id);
  }

  public observe(sessionId: string): AgentSession {
    return this.getSession(sessionId);
  }

  public recover(sessionId: string): AgentResult {
    const session = this.getSession(sessionId);
    if (session.attempts >= this.getAgent(session.agentId).defaultPolicy.executionLimit) {
      return {
        sessionId,
        agentId: session.agentId,
        state: 'failed',
        error: 'Execution retry limit reached.',
      };
    }
    const recovering = this.saveSession({
      ...session,
      state: 'recovering',
      attempts: session.attempts + 1,
      updatedAt: new Date().toISOString(),
    });
    const resumed = this.saveSession({
      ...recovering,
      state: 'planned',
      updatedAt: new Date().toISOString(),
    });
    return this.execute(resumed.id);
  }

  public cancel(sessionId: string): AgentSession {
    return this.transition(this.getSession(sessionId), 'cancelled');
  }

  public complete(sessionId: string): AgentSession {
    return this.transition(this.getSession(sessionId), 'completed');
  }

  public rollback(sessionId: string): AgentSession {
    const session = this.getSession(sessionId);
    const checkpoint = session.checkpoints[session.checkpoints.length - 1];
    if (!checkpoint) throw new Error(`Session ${sessionId} has no checkpoint to roll back to.`);
    return this.saveSession({
      ...session,
      state: checkpoint.state,
      updatedAt: new Date().toISOString(),
    });
  }

  public checkpoint(sessionId: string): AgentCheckpoint {
    const session = this.getSession(sessionId);
    const checkpoint: AgentCheckpoint = {
      id: `${session.id}-checkpoint-${session.checkpoints.length + 1}`,
      sessionId: session.id,
      state: session.state,
      completedTaskIds:
        session.state === 'completed' ? (session.plan?.tasks.map((task) => task.id) ?? []) : [],
      createdAt: new Date().toISOString(),
    };
    this.saveSession({
      ...session,
      checkpoints: [...session.checkpoints, checkpoint],
      updatedAt: checkpoint.createdAt,
    });
    return checkpoint;
  }

  private getAgent(agentId: string): AgentDefinition {
    const agent = this.registry.get(agentId);
    if (!agent) throw new Error(`Agent ${agentId} is not registered.`);
    return agent;
  }

  private getSession(sessionId: string): AgentSession {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Agent session ${sessionId} was not found.`);
    return session;
  }

  private transition(session: AgentSession, state: AgentState): AgentSession {
    return this.saveSession({ ...session, state, updatedAt: new Date().toISOString() });
  }

  private saveSession(session: AgentSession): AgentSession {
    this.sessions.set(session.id, session);
    return session;
  }
}
