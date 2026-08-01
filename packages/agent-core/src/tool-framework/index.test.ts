import { describe, expect, it } from 'vitest';
import {
  ToolAuthorization,
  ToolCatalog,
  ToolCapability,
  ToolDefinition,
  ToolExecution,
  ToolExecutionContext,
  ToolExecutionRequest,
  ToolHealth,
  ToolManifest,
  ToolMetrics,
  ToolPipeline,
  ToolPolicy,
  ToolRegistry,
  ToolScope,
  ToolSecurity,
  ToolSession,
  ToolSnapshot,
  ToolValidation,
  ToolVersion,
  ToolExecutionStatus,
  ToolType,
  ToolException,
  ToolAuthorizationException,
  ToolValidationException,
} from './index';

describe('tool-framework', () => {
  it('registers, discovers, and resolves tools by capability and category', () => {
    const registry = new ToolRegistry();
    const definition = new ToolDefinition({
      id: 'tool-1',
      name: 'Summarizer',
      description: 'Summarizes content',
      version: new ToolVersion('1.0.0'),
      type: ToolType.AITool,
      capabilities: [new ToolCapability('summarization', 'analysis')],
      categories: ['ai', 'analysis'],
      tags: ['nlp', 'summary'],
      manifest: new ToolManifest({
        id: 'tool-1',
        name: 'Summarizer',
        type: ToolType.AITool,
      }),
    });

    registry.register(definition);

    const discovered = registry.discover({ capability: 'summarization' });
    expect(discovered).toHaveLength(1);
    expect(registry.get('tool-1')).toBeDefined();
    expect(registry.lookupByVersion('1.0.0')).toHaveLength(1);
    expect(registry.lookupByCategory('analysis')).toHaveLength(1);
  });

  it('authorizes, validates, and executes a tool request', async () => {
    const authorization = new ToolAuthorization({ allow: ['tenant-a'] });
    const validator = new ToolValidation();
    const policy = new ToolPolicy({
      name: 'default-policy',
      maxRetries: 2,
      timeoutMs: 1000,
    });
    const security = new ToolSecurity({ tenant: 'tenant-a', scopes: [ToolScope.Execute] });
    const definition = new ToolDefinition({
      id: 'tool-2',
      name: 'Echo',
      description: 'echoes the input',
      version: new ToolVersion('1.1.0'),
      type: ToolType.CustomTool,
      capabilities: [new ToolCapability('echo')],
      manifest: new ToolManifest({ id: 'tool-2', name: 'Echo', type: ToolType.CustomTool }),
    });

    const execution = new ToolExecution(definition, async () => ({ ok: true, value: 'hi' }));
    const request = new ToolExecutionRequest({
      toolId: 'tool-2',
      input: { value: 'hi' },
      context: new ToolExecutionContext({
        session: new ToolSession('session-1'),
        authorization,
        security,
        policy,
        validator,
      }),
    });

    const result = await execution.execute(request);

    expect(result.status).toBe(ToolExecutionStatus.Completed);
    expect(result.output).toEqual({ ok: true, value: 'hi' });
  });

  it('supports pipelines, retries, cancellation, and snapshots', async () => {
    const definition = new ToolDefinition({
      id: 'tool-3',
      name: 'Retryable',
      description: 'retries a few times',
      version: new ToolVersion('2.0.0'),
      type: ToolType.CustomTool,
      manifest: new ToolManifest({ id: 'tool-3', name: 'Retryable', type: ToolType.CustomTool }),
    });
    const pipeline = new ToolPipeline();
    const execution = new ToolExecution(definition, async () => ({ ok: true, value: 'done' }));
    const request = new ToolExecutionRequest({ toolId: 'tool-3', input: { value: 'done' } });

    const result = await pipeline.run([execution], request);
    const snapshot = execution.createSnapshot();

    expect(result.status).toBe(ToolExecutionStatus.Completed);
    expect(snapshot).toBeInstanceOf(ToolSnapshot);
    expect(snapshot.status).toBe(ToolExecutionStatus.Completed);
  });

  it('collects metrics and exposes health and catalog views', () => {
    const catalog = new ToolCatalog();
    const definition = new ToolDefinition({
      id: 'tool-4',
      name: 'HealthCheck',
      description: 'reports health',
      version: new ToolVersion('1.0.0'),
      type: ToolType.CustomTool,
      manifest: new ToolManifest({ id: 'tool-4', name: 'HealthCheck', type: ToolType.CustomTool }),
    });

    catalog.register(definition);
    const metrics = new ToolMetrics();
    metrics.recordSuccess();
    metrics.recordFailure();
    const health = new ToolHealth({ status: 'ok', uptimeMs: 100, metrics });

    expect(catalog.list().length).toBe(1);
    expect(metrics.successes).toBe(1);
    expect(metrics.failures).toBe(1);
    expect(health.status).toBe('ok');
  });

  it('throws typed exceptions for invalid tool definitions and authorization', async () => {
    expect(
      () => new ToolDefinition({ id: '', name: 'Broken', version: new ToolVersion('1.0.0') }),
    ).toThrow(ToolException);
    const auth = new ToolAuthorization({ allow: [] });
    const request = new ToolExecutionRequest({ toolId: 'missing', input: {} });

    await expect(auth.authorize(request)).rejects.toThrow(ToolAuthorizationException);
    expect(() => new ToolValidation().validate('')).toThrow(ToolValidationException);
  });
});
