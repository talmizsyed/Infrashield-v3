import {
  AgentRuntime,
  type AgentDefinition as RuntimeAgentDefinition,
  type AgentType,
} from '@infrashield/agent-runtime';

import { createPlatformConfigurationService, type PlatformConfigurationService } from './service';
import { type AdminFormSchema } from './admin-form-schema';
import type {
  AgentDefinitionConfiguration,
  AgentPolicyConfiguration,
  AgentRuntimeStatus,
  PlatformConfiguration,
} from './types';

export interface AgentManagementFilters {
  search?: string;
  enabled?: boolean;
  status?: AgentRuntimeStatus;
  tool?: string;
  provider?: string;
}

export interface AgentManagementInput {
  id: string;
  name: string;
  description?: string;
  type?: string;
  enabled?: boolean;
  tools?: readonly string[];
  providers?: readonly string[];
  policy?: Partial<AgentPolicyConfiguration>;
  runtime?: Partial<AgentDefinitionConfiguration['runtime']>;
  configuration?: Readonly<Record<string, unknown>>;
}

export interface AgentManagementUpdateInput extends Partial<AgentManagementInput> {}

export interface AgentManagementEntry extends AgentDefinitionConfiguration {
  registeredAt: string;
  updatedAt: string;
}

export class AgentManagementConsole {
  private readonly configurationService: PlatformConfigurationService;
  private readonly records = new Map<string, AgentManagementEntry>();
  private runtime: AgentRuntime;

  public constructor(
    options: {
      configurationService?: PlatformConfigurationService;
    } = {},
  ) {
    this.configurationService =
      options.configurationService ?? createPlatformConfigurationService();
    this.runtime = new AgentRuntime();
    this.bootstrapFromConfiguration(this.configurationService.getConfiguration());
  }

  public listAgents(filters: AgentManagementFilters = {}): readonly AgentManagementEntry[] {
    const search = filters.search?.toLowerCase().trim();
    return Object.freeze(
      [...this.records.values()]
        .filter((agent) => {
          if (search) {
            const searchable = [
              agent.id,
              agent.name,
              agent.description ?? '',
              agent.type ?? '',
              ...agent.tools,
              ...agent.providers,
              agent.runtime.status,
              agent.runtime.mode,
            ]
              .join(' ')
              .toLowerCase();
            if (!searchable.includes(search)) {
              return false;
            }
          }

          if (filters.enabled !== undefined && agent.enabled !== filters.enabled) {
            return false;
          }

          if (filters.status && agent.runtime.status !== filters.status) {
            return false;
          }

          if (filters.tool && !agent.tools.includes(filters.tool)) {
            return false;
          }

          if (filters.provider && !agent.providers.includes(filters.provider)) {
            return false;
          }

          return true;
        })
        .sort((left, right) => left.name.localeCompare(right.name)),
    );
  }

  public getAgent(agentId: string): AgentManagementEntry | undefined {
    return this.records.get(agentId);
  }

  public createAgent(input: AgentManagementInput): AgentManagementEntry {
    if (this.records.has(input.id)) {
      throw new Error(`Agent ${input.id} already exists.`);
    }

    const now = new Date().toISOString();
    const entry = this.createEntry(input, now, now);
    this.records.set(entry.id, entry);
    this.rebuildRuntime();
    this.syncConfiguration();
    return entry;
  }

  public editAgent(agentId: string, input: AgentManagementUpdateInput): AgentManagementEntry {
    const current = this.requireAgent(agentId);
    const updated: AgentManagementEntry = {
      ...current,
      name: input.name ?? current.name,
      description: input.description ?? current.description,
      type: input.type ?? current.type,
      enabled: input.enabled ?? current.enabled,
      tools: Object.freeze([...(input.tools ?? current.tools)]),
      providers: Object.freeze([...(input.providers ?? current.providers)]),
      policy: {
        executionLimit: input.policy?.executionLimit ?? current.policy.executionLimit,
        timeoutMs: input.policy?.timeoutMs ?? current.policy.timeoutMs,
        approvalRequired: input.policy?.approvalRequired ?? current.policy.approvalRequired,
      },
      runtime: {
        status: input.runtime?.status ?? current.runtime.status,
        mode: input.runtime?.mode ?? current.runtime.mode,
        lastRunAt: input.runtime?.lastRunAt ?? current.runtime.lastRunAt,
        lastHeartbeatAt: input.runtime?.lastHeartbeatAt ?? current.runtime.lastHeartbeatAt,
        message: input.runtime?.message ?? current.runtime.message,
      },
      configuration: Object.freeze({ ...(input.configuration ?? current.configuration) }),
      updatedAt: new Date().toISOString(),
    };

    this.records.set(agentId, updated);
    this.rebuildRuntime();
    this.syncConfiguration();
    return updated;
  }

  public assignTools(agentId: string, tools: readonly string[]): AgentManagementEntry {
    return this.editAgent(agentId, { tools });
  }

  public assignProviders(agentId: string, providers: readonly string[]): AgentManagementEntry {
    return this.editAgent(agentId, { providers });
  }

  public enableAgent(agentId: string): AgentManagementEntry {
    return this.editAgent(agentId, {
      enabled: true,
      runtime: { status: 'idle' },
    });
  }

  public disableAgent(agentId: string): AgentManagementEntry {
    return this.editAgent(agentId, {
      enabled: false,
      runtime: { status: 'disabled' },
    });
  }

  public deleteAgent(agentId: string): boolean {
    const existing = this.records.get(agentId);
    if (!existing) {
      return false;
    }

    this.records.delete(agentId);
    this.rebuildRuntime();
    this.syncConfiguration();
    return true;
  }

  public getRuntimeStatus(agentId: string): AgentRuntimeStatus {
    return this.requireAgent(agentId).runtime.status;
  }

  public simulateHeartbeat(agentId: string): AgentManagementEntry {
    return this.editAgent(agentId, {
      runtime: {
        status: this.requireAgent(agentId).enabled ? 'idle' : 'disabled',
        lastHeartbeatAt: new Date().toISOString(),
        message: 'Mock runtime heartbeat recorded.',
      },
    });
  }

  public describeFormSchema(): AdminFormSchema {
    return {
      id: 'agent-management',
      title: 'Agent Management',
      description: 'Create and maintain runtime agents.',
      sections: [
        {
          id: 'agent-core',
          title: 'Core',
          fields: [
            { id: 'id', label: 'Agent ID', type: 'text', required: true },
            { id: 'name', label: 'Agent Name', type: 'text', required: true },
            { id: 'description', label: 'Description', type: 'textarea' },
            { id: 'type', label: 'Type', type: 'text' },
            { id: 'enabled', label: 'Enabled', type: 'boolean' },
          ],
        },
        {
          id: 'agent-access',
          title: 'Assignments',
          fields: [
            { id: 'tools', label: 'Tools', type: 'multiselect' },
            { id: 'providers', label: 'Providers', type: 'multiselect' },
          ],
        },
        {
          id: 'agent-runtime',
          title: 'Runtime',
          fields: [
            { id: 'policy', label: 'Policy', type: 'json' },
            { id: 'runtime', label: 'Runtime', type: 'json' },
            { id: 'configuration', label: 'Configuration', type: 'json' },
          ],
        },
      ],
    };
  }

  private bootstrapFromConfiguration(configuration: PlatformConfiguration): void {
    for (const agent of configuration.agentDefinitions) {
      const entry = this.createEntry(agent, new Date().toISOString(), new Date().toISOString());
      this.records.set(entry.id, entry);
    }
    this.rebuildRuntime();
  }

  private createEntry(
    input: AgentManagementInput | AgentDefinitionConfiguration,
    registeredAt: string,
    updatedAt: string,
  ): AgentManagementEntry {
    return {
      id: input.id,
      name: input.name,
      description: input.description,
      type: input.type ?? 'OperationsAgent',
      enabled: input.enabled ?? true,
      tools: Object.freeze([...(input.tools ?? [])]),
      providers: Object.freeze([...(input.providers ?? [])]),
      policy: {
        executionLimit: input.policy?.executionLimit ?? 3,
        timeoutMs: input.policy?.timeoutMs ?? 30_000,
        approvalRequired: input.policy?.approvalRequired ?? false,
      },
      runtime: {
        status: input.runtime?.status ?? 'registered',
        mode: input.runtime?.mode ?? 'interactive',
        lastRunAt: input.runtime?.lastRunAt,
        lastHeartbeatAt: input.runtime?.lastHeartbeatAt,
        message: input.runtime?.message ?? 'Mock runtime state.',
      },
      configuration: Object.freeze({ ...(input.configuration ?? {}) }),
      registeredAt,
      updatedAt,
    };
  }

  private rebuildRuntime(): void {
    this.runtime = new AgentRuntime();
    for (const agent of this.records.values()) {
      this.runtime.register(this.toRuntimeDefinition(agent));
    }
  }

  private toRuntimeDefinition(agent: AgentManagementEntry): RuntimeAgentDefinition {
    return {
      id: agent.id,
      name: agent.name,
      type: this.resolveAgentType(agent.type),
      description: agent.description ?? `${agent.name} agent`,
      defaultPolicy: {
        executionLimit: agent.policy.executionLimit,
        timeoutMs: agent.policy.timeoutMs,
        approvalRequired: agent.policy.approvalRequired,
        allowedTools: [...agent.tools],
        allowedProviders: [...agent.providers],
      },
    };
  }

  private resolveAgentType(type?: string): AgentType {
    const supportedTypes: readonly AgentType[] = [
      'InfrastructureAgent',
      'SecurityAgent',
      'OperationsAgent',
      'KnowledgeGraphAgent',
      'WorkflowAgent',
      'ProviderAgent',
      'MonitoringAgent',
      'PlanningAgent',
    ];

    return supportedTypes.includes(type as AgentType) ? (type as AgentType) : 'OperationsAgent';
  }

  private requireAgent(agentId: string): AgentManagementEntry {
    const agent = this.records.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} was not found.`);
    }
    return agent;
  }

  private syncConfiguration(): void {
    const configuration = this.configurationService.getConfiguration();
    configuration.agentDefinitions = [...this.records.values()].map((agent) => ({
      id: agent.id,
      name: agent.name,
      enabled: agent.enabled,
      description: agent.description,
      type: agent.type,
      tools: [...agent.tools],
      providers: [...agent.providers],
      policy: { ...agent.policy },
      runtime: { ...agent.runtime },
      configuration: { ...agent.configuration },
    }));
  }
}
