import {
  WorkflowDefinition,
  WorkflowDefinitionMetadata,
  WorkflowDefinitionOptions,
  WorkflowExecutionPolicy,
} from '@infrashield/workflow-engine';
import type { SerializableValueObject } from '@infrashield/contracts';

import { createPlatformConfigurationService, type PlatformConfigurationService } from './service';
import { type AdminFormSchema } from './admin-form-schema';
import type {
  AgentRuntimeStatus,
  PlatformConfiguration,
  WorkflowDefinitionConfiguration,
  WorkflowExecutionPolicyKind,
} from './types';

export interface WorkflowManagementFilters {
  search?: string;
  enabled?: boolean;
  status?: AgentRuntimeStatus;
  agent?: string;
}

export interface WorkflowManagementInput {
  id: string;
  name: string;
  description?: string;
  enabled?: boolean;
  agents?: readonly string[];
  executionPolicy?: Partial<WorkflowDefinitionConfiguration['executionPolicy']> & {
    kind?: WorkflowExecutionPolicyKind;
  };
  schedule?: Partial<WorkflowDefinitionConfiguration['schedule']>;
  status?: AgentRuntimeStatus;
  configuration?: SerializableValueObject;
}

export interface WorkflowManagementUpdateInput extends Partial<WorkflowManagementInput> {}

export interface WorkflowManagementEntry extends WorkflowDefinitionConfiguration {
  registeredAt: string;
  updatedAt: string;
  definition: WorkflowDefinition;
  executionPolicySnapshot: ReturnType<WorkflowExecutionPolicy['snapshot']>;
}

export class WorkflowManagementConsole {
  private readonly configurationService: PlatformConfigurationService;
  private readonly records = new Map<string, WorkflowManagementEntry>();

  public constructor(
    options: {
      configurationService?: PlatformConfigurationService;
    } = {},
  ) {
    this.configurationService =
      options.configurationService ?? createPlatformConfigurationService();
    this.bootstrapFromConfiguration(this.configurationService.getConfiguration());
  }

  public listWorkflows(
    filters: WorkflowManagementFilters = {},
  ): readonly WorkflowManagementEntry[] {
    const search = filters.search?.toLowerCase().trim();
    return Object.freeze(
      [...this.records.values()]
        .filter((workflow) => {
          if (search) {
            const searchable = [
              workflow.id,
              workflow.name,
              workflow.description ?? '',
              workflow.status,
              workflow.schedule.cron ?? '',
              ...workflow.agents,
              workflow.executionPolicy.kind,
            ]
              .join(' ')
              .toLowerCase();
            if (!searchable.includes(search)) {
              return false;
            }
          }

          if (filters.enabled !== undefined && workflow.enabled !== filters.enabled) {
            return false;
          }

          if (filters.status && workflow.status !== filters.status) {
            return false;
          }

          if (filters.agent && !workflow.agents.includes(filters.agent)) {
            return false;
          }

          return true;
        })
        .sort((left, right) => left.name.localeCompare(right.name)),
    );
  }

  public getWorkflow(workflowId: string): WorkflowManagementEntry | undefined {
    return this.records.get(workflowId);
  }

  public createWorkflow(input: WorkflowManagementInput): WorkflowManagementEntry {
    if (this.records.has(input.id)) {
      throw new Error(`Workflow ${input.id} already exists.`);
    }

    const now = new Date().toISOString();
    const entry = this.createEntry(input, now, now);
    this.records.set(entry.id, entry);
    this.syncConfiguration();
    return entry;
  }

  public editWorkflow(
    workflowId: string,
    input: WorkflowManagementUpdateInput,
  ): WorkflowManagementEntry {
    const current = this.requireWorkflow(workflowId);
    const updated: WorkflowManagementEntry = this.createEntry(
      {
        id: current.id,
        name: input.name ?? current.name,
        description: input.description ?? current.description,
        enabled: input.enabled ?? current.enabled,
        agents: input.agents ?? current.agents,
        executionPolicy: {
          ...current.executionPolicy,
          ...input.executionPolicy,
        },
        schedule: {
          ...current.schedule,
          ...input.schedule,
        },
        status: input.status ?? current.status,
        configuration: input.configuration ?? current.configuration,
      },
      current.registeredAt,
      new Date().toISOString(),
    );

    this.records.set(workflowId, updated);
    this.syncConfiguration();
    return updated;
  }

  public assignAgents(workflowId: string, agents: readonly string[]): WorkflowManagementEntry {
    return this.editWorkflow(workflowId, { agents });
  }

  public configureExecutionPolicy(
    workflowId: string,
    executionPolicy: WorkflowManagementInput['executionPolicy'],
  ): WorkflowManagementEntry {
    return this.editWorkflow(workflowId, { executionPolicy });
  }

  public configureSchedule(
    workflowId: string,
    schedule: WorkflowManagementInput['schedule'],
  ): WorkflowManagementEntry {
    return this.editWorkflow(workflowId, { schedule });
  }

  public enableWorkflow(workflowId: string): WorkflowManagementEntry {
    return this.editWorkflow(workflowId, { enabled: true, status: 'registered' });
  }

  public disableWorkflow(workflowId: string): WorkflowManagementEntry {
    return this.editWorkflow(workflowId, { enabled: false, status: 'disabled' });
  }

  public deleteWorkflow(workflowId: string): boolean {
    if (!this.records.has(workflowId)) {
      return false;
    }

    this.records.delete(workflowId);
    this.syncConfiguration();
    return true;
  }

  public getStatus(workflowId: string): AgentRuntimeStatus {
    return this.requireWorkflow(workflowId).status;
  }

  public getExecutionPolicySnapshot(
    workflowId: string,
  ): ReturnType<WorkflowExecutionPolicy['snapshot']> {
    return this.requireWorkflow(workflowId).executionPolicySnapshot;
  }

  public describeFormSchema(): AdminFormSchema {
    return {
      id: 'workflow-management',
      title: 'Workflow Management',
      description: 'Create and manage orchestrated workflows.',
      sections: [
        {
          id: 'workflow-core',
          title: 'Core',
          fields: [
            { id: 'id', label: 'Workflow ID', type: 'text', required: true },
            { id: 'name', label: 'Name', type: 'text', required: true },
            { id: 'description', label: 'Description', type: 'textarea' },
            { id: 'enabled', label: 'Enabled', type: 'boolean' },
          ],
        },
        {
          id: 'workflow-assignment',
          title: 'Assignment',
          fields: [
            { id: 'agents', label: 'Agents', type: 'multiselect' },
            { id: 'status', label: 'Status', type: 'text' },
          ],
        },
        {
          id: 'workflow-policy',
          title: 'Execution Policy',
          fields: [
            { id: 'executionPolicy', label: 'Execution Policy', type: 'json' },
            { id: 'schedule', label: 'Schedule', type: 'json' },
            { id: 'configuration', label: 'Configuration', type: 'json' },
          ],
        },
      ],
    };
  }

  private bootstrapFromConfiguration(configuration: PlatformConfiguration): void {
    for (const workflow of configuration.workflowDefinitions) {
      const entry = this.createEntry(workflow, new Date().toISOString(), new Date().toISOString());
      this.records.set(entry.id, entry);
    }
  }

  private createEntry(
    input: WorkflowManagementInput | WorkflowDefinitionConfiguration,
    registeredAt: string,
    updatedAt: string,
  ): WorkflowManagementEntry {
    const workflowDefinition = new WorkflowDefinition({
      id: input.id,
      name: input.name,
      version: '1.0.0',
      description: input.description,
      owner: 'platform-operator',
      category: 'administration',
      metadata: new WorkflowDefinitionMetadata({
        agents: input.agents ?? [],
        status: input.status ?? 'registered',
        enabled: input.enabled ?? true,
      }),
      tags: input.agents && input.agents.length > 0 ? [...input.agents] : ['workflow'],
      labels: [input.status ?? 'registered'],
      options: new WorkflowDefinitionOptions({
        timeoutMs: input.executionPolicy?.timeoutMs,
        retryCount: input.executionPolicy?.retryCount,
        metadata: input.configuration,
      }),
      validationState: 'valid',
    });

    const executionPolicy = new WorkflowExecutionPolicy({
      id: `${input.id}-policy`,
      kind: input.executionPolicy?.kind ?? 'approval',
      metadata: input.executionPolicy?.metadata,
      dependsOn: input.executionPolicy?.dependsOn,
    });

    return {
      id: input.id,
      name: input.name,
      description: input.description,
      enabled: input.enabled ?? true,
      agents: Object.freeze([...(input.agents ?? [])]),
      executionPolicy: {
        kind: input.executionPolicy?.kind ?? 'approval',
        metadata: Object.freeze({ ...(input.executionPolicy?.metadata ?? {}) }),
        dependsOn: Object.freeze([...(input.executionPolicy?.dependsOn ?? [])]),
        timeoutMs: input.executionPolicy?.timeoutMs,
        retryCount: input.executionPolicy?.retryCount,
        approvalRequired: input.executionPolicy?.approvalRequired,
        concurrencyLimit: input.executionPolicy?.concurrencyLimit,
        schedule: input.executionPolicy?.schedule,
      },
      schedule: {
        enabled: input.schedule?.enabled ?? false,
        cron: input.schedule?.cron,
        timezone: input.schedule?.timezone,
        nextRunAt: input.schedule?.nextRunAt,
      },
      status: input.status ?? 'registered',
      configuration: Object.freeze({ ...(input.configuration ?? {}) }),
      registeredAt,
      updatedAt,
      definition: workflowDefinition,
      executionPolicySnapshot: executionPolicy.snapshot(),
    };
  }

  private requireWorkflow(workflowId: string): WorkflowManagementEntry {
    const workflow = this.records.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} was not found.`);
    }
    return workflow;
  }

  private syncConfiguration(): void {
    const configuration = this.configurationService.getConfiguration();
    configuration.workflowDefinitions = [...this.records.values()].map((workflow) => ({
      id: workflow.id,
      name: workflow.name,
      enabled: workflow.enabled,
      description: workflow.description,
      agents: [...workflow.agents],
      executionPolicy: {
        kind: workflow.executionPolicy.kind,
        metadata: { ...workflow.executionPolicy.metadata },
        dependsOn: [...workflow.executionPolicy.dependsOn],
        timeoutMs: workflow.executionPolicy.timeoutMs,
        retryCount: workflow.executionPolicy.retryCount,
        approvalRequired: workflow.executionPolicy.approvalRequired,
        concurrencyLimit: workflow.executionPolicy.concurrencyLimit,
        schedule: workflow.executionPolicy.schedule,
      },
      schedule: { ...workflow.schedule },
      status: workflow.status,
      configuration: { ...workflow.configuration },
    }));
  }
}
