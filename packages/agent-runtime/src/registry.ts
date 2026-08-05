import type { AgentDefinition } from './types';

export class AgentRegistry {
  private readonly agents = new Map<string, AgentDefinition>();

  public register(agent: AgentDefinition): void {
    this.agents.set(agent.id, agent);
  }

  public get(agentId: string): AgentDefinition | undefined {
    return this.agents.get(agentId);
  }

  public list(): AgentDefinition[] {
    return [...this.agents.values()].sort((left, right) => left.name.localeCompare(right.name));
  }
}
