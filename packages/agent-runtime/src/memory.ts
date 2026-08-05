import type { AgentMemory } from './types';

export function createAgentMemory(
  executionContext: Record<string, string | number | boolean>,
): AgentMemory {
  return { shortTerm: {}, longTerm: {}, conversation: [], executionContext };
}

export function remember(memory: AgentMemory, key: string, value: string): AgentMemory {
  return { ...memory, shortTerm: { ...memory.shortTerm, [key]: value } };
}
