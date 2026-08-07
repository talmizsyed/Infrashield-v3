import { describe, expect, it } from 'vitest';

import {
  BaseTool,
  ToolAuthorization,
  ToolCategory,
  ToolCapability,
  ToolBuilder,
  ToolConfiguration,
  ToolDefinition,
  ToolExecutor,
  ToolExecutionPolicy,
  ToolFactory,
  ToolLifecycle,
  ToolMetadata,
  ToolPermission,
  ToolPolicy,
  ToolRegistry,
  ToolRequest,
  ToolRole,
  ToolResponse,
  ToolScope,
  ToolValidationError,
  ToolValidator,
} from './index.js';

describe('ToolRegistry', () => {
  it('registers, unregisters, and discovers tools by category, version, and name', () => {
    const registry = new ToolRegistry();
    const infrastructureTool = new ToolDefinition({
      id: 'tool-infra',
      name: 'Cluster Inspector',
      metadata: new ToolMetadata({
        description: 'Inspects cluster state.',
        version: '1.0.0',
        categories: [ToolCategory.Infrastructure, ToolCategory.Utility],
        tags: ['cluster', 'inventory'],
      }),
      executor: new ToolExecutor(async () => ({ ok: true })),
    });

    registry.register(infrastructureTool);

    expect(registry.list()).toHaveLength(1);
    expect(registry.discover({ category: ToolCategory.Infrastructure })).toHaveLength(1);
    expect(registry.discover({ version: '1.0.0' })).toHaveLength(1);
    expect(registry.discover({ name: 'cluster' })).toHaveLength(1);
    expect(registry.unregister('tool-infra')).toBe(true);
    expect(registry.list()).toHaveLength(0);
  });

  it('executes a registered tool and returns typed results', async () => {
    const registry = new ToolRegistry();
    registry.register(
      new ToolDefinition({
        id: 'tool-workflow',
        name: 'Workflow Runner',
        metadata: new ToolMetadata({
          description: 'Runs workflows.',
          version: '2.1.0',
          categories: [ToolCategory.Workflow],
        }),
        validator: new ToolValidator<
          { workflowId: string },
          { status: string; workflowId: string }
        >({
          requiredInputFields: ['workflowId'],
          requiredOutputFields: ['status', 'workflowId'],
        }),
        executor: new ToolExecutor(async (input) => ({
          status: 'started',
          workflowId: input.workflowId,
        })),
      }),
    );

    const result = await registry.execute<
      { workflowId: string },
      { status: string; workflowId: string }
    >('tool-workflow', { workflowId: 'wf-1' }, { correlationId: 'corr-1' });

    expect(result.status).toBe('completed');
    expect(result.output).toEqual({ status: 'started', workflowId: 'wf-1' });
    expect(result.version).toBe('2.1.0');
  });

  it('returns failed results for invalid input and invalid output', async () => {
    const registry = new ToolRegistry();
    registry.register(
      new ToolDefinition({
        id: 'tool-security',
        name: 'Security Scanner',
        metadata: new ToolMetadata({
          description: 'Scans for vulnerabilities.',
          version: '1.3.0',
          categories: [ToolCategory.Security],
        }),
        validator: new ToolValidator<{ target: string }, { findings: number }>({
          requiredInputFields: ['target'],
          requiredOutputFields: ['findings'],
        }),
        executor: new ToolExecutor(async () => ({ findings: undefined as never })),
      }),
    );

    const inputFailure = await registry.execute<{ target: string }, { findings: number }>(
      'tool-security',
      {} as { target: string },
    );
    const outputFailure = await registry.execute<{ target: string }, { findings: number }>(
      'tool-security',
      { target: 'host-1' },
    );

    expect(inputFailure.status).toBe('failed');
    expect(inputFailure.error).toContain('Missing required input field');
    expect(outputFailure.status).toBe('failed');
    expect(outputFailure.error).toContain('Missing required output field');
  });

  it('times out long-running tools using metadata or context overrides', async () => {
    const registry = new ToolRegistry();
    registry.register(
      new ToolDefinition({
        id: 'tool-knowledge',
        name: 'Knowledge Graph Sync',
        metadata: new ToolMetadata({
          description: 'Synchronizes graph edges.',
          version: '3.0.0',
          categories: [ToolCategory.KnowledgeGraph],
          timeoutMs: 5,
        }),
        executor: new ToolExecutor(
          async () =>
            new Promise<{ synced: boolean }>((resolve) => {
              setTimeout(() => resolve({ synced: true }), 25);
            }),
        ),
      }),
    );

    const result = await registry.execute<{ scope: string }, { synced: boolean }>(
      'tool-knowledge',
      { scope: 'full' },
    );

    expect(result.status).toBe('timed-out');
    expect(result.error).toContain('timed out');
  });

  it('supports all enterprise categories and custom validation', async () => {
    const validator = new ToolValidator<{ prompt: string }, { answer: string }>({
      requiredInputFields: ['prompt'],
      validateInput: (input) => {
        if (input.prompt.length < 3) {
          throw new ToolValidationError('Prompt must be at least 3 characters.');
        }
      },
      requiredOutputFields: ['answer'],
    });

    const tool = new ToolDefinition({
      id: 'tool-ai',
      name: 'AI Assistant',
      metadata: new ToolMetadata({
        description: 'Answers AI prompts.',
        version: '4.0.0',
        categories: [ToolCategory.AI, ToolCategory.Provider],
      }),
      validator,
      executor: new ToolExecutor(async (input) => ({ answer: input.prompt.toUpperCase() })),
    });

    const registry = new ToolRegistry();
    registry.register(tool);

    expect(registry.discover({ category: ToolCategory.AI })).toHaveLength(1);
    expect(registry.discover({ category: ToolCategory.Provider })).toHaveLength(1);
    expect(registry.discover({ category: ToolCategory.Utility })).toHaveLength(0);

    const validationFailure = await registry.execute<{ prompt: string }, { answer: string }>(
      'tool-ai',
      { prompt: 'hi' },
    );

    expect(validationFailure.status).toBe('failed');
    expect(validationFailure.error).toContain('Prompt must be at least 3 characters.');
  });
});

describe('Tool SDK', () => {
  it('creates tools with the builder and registers them through the factory', async () => {
    const events: string[] = [];
    const registry = new ToolRegistry();
    const factory = new ToolFactory(registry);

    const tool = new ToolBuilder<{ value: string }, { echoed: string }, { region: string }>(
      'sdk-tool',
      'SDK Echo',
    )
      .withDescription('Echoes input values.')
      .withVersion('1.2.3')
      .withCategories([ToolCategory.Utility])
      .withCapabilities([new ToolCapability({ name: 'echo', description: 'Echo capability' })])
      .withConfiguration(new ToolConfiguration<{ region: string }>({ requiredFields: ['region'] }))
      .withLifecycle(
        new ToolLifecycle<{ value: string }, { echoed: string }, { region: string }>({
          onRegister: () => {
            events.push('register');
          },
          beforeExecute: () => {
            events.push('before');
          },
          afterExecute: () => {
            events.push('after');
          },
          onUnregister: () => {
            events.push('unregister');
          },
        }),
      )
      .withHandler((request) => ({ echoed: request.input.value }))
      .build();

    const definition = await factory.register(tool);
    const result = await registry.execute<{ value: string }, { echoed: string }>(
      'sdk-tool',
      { value: 'hello' },
      { configuration: { region: 'us-east-1' } },
    );

    expect(definition.metadata.version).toBe('1.2.3');
    expect(result.output).toEqual({ echoed: 'hello' });
    expect(events).toEqual(['register', 'before', 'after']);

    await factory.unregister('sdk-tool');
    expect(events).toEqual(['register', 'before', 'after', 'unregister']);
  });

  it('validates configuration and surfaces lifecycle errors as failed results', async () => {
    const registry = new ToolRegistry();
    const factory = new ToolFactory(registry);

    const tool = new ToolBuilder<{ value: string }, { echoed: string }, { endpoint: string }>(
      'sdk-config',
      'SDK Config Tool',
    )
      .withDescription('Requires endpoint configuration.')
      .withVersion('2.0.0')
      .withCategories([ToolCategory.Infrastructure])
      .withConfiguration(
        new ToolConfiguration<{ endpoint: string }>({
          requiredFields: ['endpoint'],
          validate: (configuration) => {
            if (!configuration.endpoint.startsWith('https://')) {
              throw new ToolValidationError('Endpoint must use HTTPS.');
            }
          },
        }),
      )
      .withHandler((request) => ({ echoed: request.input.value }))
      .build();

    await factory.register(tool);

    const missingConfiguration = await registry.execute<{ value: string }, { echoed: string }>(
      'sdk-config',
      { value: 'a' },
      {},
    );
    const invalidConfiguration = await registry.execute<{ value: string }, { echoed: string }>(
      'sdk-config',
      { value: 'b' },
      { configuration: { endpoint: 'http://internal' } },
    );

    expect(missingConfiguration.status).toBe('failed');
    expect(missingConfiguration.error).toContain('Missing required configuration field');
    expect(invalidConfiguration.status).toBe('failed');
    expect(invalidConfiguration.error).toContain('Endpoint must use HTTPS.');
  });

  it('supports base tools, request and response wrappers, and timeout handling', async () => {
    class DelayedTool extends BaseTool<{ prompt: string }, { answer: string }, { tenant: string }> {
      public constructor() {
        super({
          id: 'sdk-base',
          name: 'Base Tool',
          metadata: new ToolMetadata({
            description: 'Delayed answer tool.',
            version: '3.0.0',
            categories: [ToolCategory.AI],
            timeoutMs: 5,
          }),
          validator: new ToolValidator<{ prompt: string }, { answer: string }>({
            requiredInputFields: ['prompt'],
            requiredOutputFields: ['answer'],
          }),
          configuration: new ToolConfiguration<{ tenant: string }>({
            requiredFields: ['tenant'],
          }),
        });
      }

      public async execute(
        request: ToolRequest<{ prompt: string }, { tenant: string }>,
      ): Promise<{ answer: string }> {
        return new Promise<{ answer: string }>((resolve) => {
          setTimeout(() => resolve({ answer: request.input.prompt.toUpperCase() }), 20);
        });
      }
    }

    const registry = new ToolRegistry();
    const factory = new ToolFactory(registry);
    const tool = new DelayedTool();
    await factory.register(tool);

    const result = await registry.execute<{ prompt: string }, { answer: string }>(
      'sdk-base',
      { prompt: 'hello' },
      { configuration: { tenant: 'tenant-a' } },
    );
    const response = new ToolResponse(result);

    expect(response.status).toBe('timed-out');
    expect(response.error).toContain('timed out');
  });

  it('enforces role-based access with permission inheritance and audit metadata', async () => {
    const registry = new ToolRegistry();
    const factory = new ToolFactory(registry);
    let observedAudit:
      | {
          readonly actorId?: string;
          readonly roles: readonly string[];
          readonly requestedScopes: readonly ToolScope[];
          readonly decision: 'allow' | 'deny';
        }
      | undefined;

    const readerRole = new ToolRole({
      name: 'reader',
      permissions: [
        new ToolPermission({
          category: ToolCategory.Workflow,
          scopes: [ToolScope.Execute],
          effect: 'allow',
        }),
      ],
    });
    const operatorRole = new ToolRole({
      name: 'operator',
      inheritedRoles: [readerRole],
    });

    const tool = new ToolBuilder<{ workflowId: string }, { ok: boolean }, { tenant: string }>(
      'governed-tool',
      'Governed Workflow Tool',
    )
      .withDescription('Requires workflow execution permission.')
      .withVersion('1.0.0')
      .withCategories([ToolCategory.Workflow])
      .withLifecycle(
        new ToolLifecycle<{ workflowId: string }, { ok: boolean }, { tenant: string }>({
          beforeExecute: (request) => {
            observedAudit = request.context.audit;
          },
        }),
      )
      .withHandler(() => ({ ok: true }))
      .build();

    await factory.register(tool);

    const result = await registry.execute<{ workflowId: string }, { ok: boolean }>(
      'governed-tool',
      { workflowId: 'wf-123' },
      {
        actorId: 'alice',
        roles: [operatorRole],
        executionPolicy: new ToolExecutionPolicy({
          requiredScopes: [ToolScope.Execute],
          authorization: new ToolAuthorization(),
        }),
        configuration: { tenant: 'prod' },
      },
    );

    expect(result.status).toBe('completed');
    expect(observedAudit).toEqual(
      expect.objectContaining({
        actorId: 'alice',
        roles: ['operator'],
        requestedScopes: [ToolScope.Execute],
        decision: 'allow',
      }),
    );
  });

  it('applies allow and deny rules through execution policies', async () => {
    const registry = new ToolRegistry();
    const factory = new ToolFactory(registry);

    const role = new ToolRole({
      name: 'workflow-admin',
      permissions: [
        new ToolPermission({
          category: ToolCategory.Workflow,
          scopes: [ToolScope.Execute, ToolScope.Admin],
          effect: 'allow',
        }),
      ],
    });

    const tool = new ToolBuilder<{ workflowId: string }, { ok: boolean }, { tenant: string }>(
      'denied-tool',
      'Denied Workflow Tool',
    )
      .withDescription('Can be denied by policy.')
      .withVersion('1.0.0')
      .withCategories([ToolCategory.Workflow])
      .withHandler(() => ({ ok: true }))
      .build();

    await factory.register(tool);

    const policy = new ToolPolicy({
      name: 'deny-specific-tool',
      rules: [
        new ToolPermission({
          toolId: 'denied-tool',
          scopes: [ToolScope.Execute],
          effect: 'deny',
        }),
      ],
    });

    const result = await registry.execute<{ workflowId: string }, { ok: boolean }>(
      'denied-tool',
      { workflowId: 'wf-321' },
      {
        actorId: 'bob',
        roles: [role],
        executionPolicy: new ToolExecutionPolicy({
          requiredScopes: [ToolScope.Execute],
          authorization: new ToolAuthorization({ policy }),
        }),
        configuration: { tenant: 'prod' },
      },
    );

    expect(result.status).toBe('failed');
    expect(result.error).toContain('Denied by deny-specific-tool policy');
  });
});
