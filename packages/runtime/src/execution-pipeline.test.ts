import { describe, expect, it } from 'vitest';

import {
  ExecutionBehavior,
  ExecutionPipelineBuilder,
  ExecutionPipelineContext,
  ExecutionStage,
  PipelineExecutionException,
  type IExecutionMiddleware,
} from './execution-pipeline.js';

describe('execution pipeline', () => {
  it('preserves middleware order and enriches the pipeline context', async () => {
    const order: string[] = [];
    const middleware: IExecutionMiddleware<{ trace: string }, { ok: boolean }> = {
      id: 'mw-1',
      stage: ExecutionStage.Pre,
      async execute(context, next) {
        order.push(`before:${context.correlationId}`);
        context.setData('trace', context.runtimeContext?.trace ?? 'missing');
        const result = await next(context);
        order.push(`after:${context.correlationId}`);
        return { ...result, metadata: { ...result.metadata, enriched: true } };
      },
    };

    const pipeline = new ExecutionPipelineBuilder<{ trace: string }, { ok: boolean }>()
      .use(middleware)
      .use({
        id: 'mw-2',
        stage: ExecutionStage.Pre,
        async execute(context, next) {
          order.push(`middle:${context.correlationId}`);
          return next(context);
        },
      })
      .build();

    const context = new ExecutionPipelineContext<{ trace: string }>({
      correlationId: 'corr-1',
      runtimeContext: { trace: 'demo' },
      services: { logger: { info: () => undefined } },
      metadata: { requestId: 'req-1' },
      executionScope: 'scope-1',
    });

    const result = await pipeline.execute(context, async () => {
      return {
        value: { ok: true },
        metadata: { from: 'delegate' },
      };
    });

    expect(order).toEqual(['before:corr-1', 'middle:corr-1', 'after:corr-1']);
    expect(result.value).toEqual({ ok: true });
    expect(result.metadata).toEqual({ from: 'delegate', enriched: true });
    expect(context.getData<string>('trace')).toBe('demo');
    expect(context.snapshot().state).toBe('completed');
  });

  it('supports short-circuit execution and skips the remaining middleware', async () => {
    const pipeline = new ExecutionPipelineBuilder<number, number>()
      .use({
        id: 'mw-1',
        behavior: ExecutionBehavior.ShortCircuit,
        async execute() {
          return {
            value: 42,
            status: 'short-circuited',
            metadata: { short: true },
          };
        },
      })
      .use({
        id: 'mw-2',
        async execute(_context, _next) {
          throw new Error('should not run');
        },
      })
      .build();

    const result = await pipeline.execute(
      new ExecutionPipelineContext({ correlationId: 'corr-2' }),
      async () => ({ value: 7 }),
    );

    expect(result.status).toBe('short-circuited');
    expect(result.value).toBe(42);
    expect(result.metadata).toEqual({ short: true });
  });

  it('propagates cancellation and stops remaining middleware', async () => {
    const controller = new AbortController();
    const pipeline = new ExecutionPipelineBuilder<string, string>()
      .use({
        id: 'mw-1',
        async execute(context, next) {
          context.throwIfCancelled();
          return next(context);
        },
      })
      .use({
        id: 'mw-2',
        async execute(_context, _next) {
          throw new Error('should not run');
        },
      })
      .build();

    const context = new ExecutionPipelineContext<string>({
      correlationId: 'corr-3',
      cancellation: controller.signal,
    });

    controller.abort();

    const result = await pipeline.execute(context, async () => ({ value: 'done' }));

    expect(result.status).toBe('cancelled');
    expect(result.error?.message).toContain('cancelled');
    expect(context.snapshot().state).toBe('cancelled');
  });

  it('wraps middleware failures with a pipeline exception and preserves the original cause', async () => {
    const pipeline = new ExecutionPipelineBuilder<string, string>()
      .use({
        id: 'mw-1',
        async execute(_context, _next) {
          throw new Error('boom');
        },
      })
      .build();

    await expect(
      pipeline.execute(new ExecutionPipelineContext({ correlationId: 'corr-4' }), async () => ({
        value: 'done',
      })),
    ).rejects.toBeInstanceOf(PipelineExecutionException);
  });

  it('supports builder mutation operations and validation', () => {
    const builder = new ExecutionPipelineBuilder<string, string>();
    builder.use({
      id: 'mw-1',
      async execute(context, next) {
        return next(context);
      },
    });
    builder.use({
      id: 'mw-2',
      async execute(context, next) {
        return next(context);
      },
    });

    builder.insertBefore('mw-2', {
      id: 'mw-0',
      async execute(context, next) {
        return next(context);
      },
    });
    builder.insertAfter('mw-1', {
      id: 'mw-1b',
      async execute(context, next) {
        return next(context);
      },
    });
    builder.replace('mw-2', {
      id: 'mw-2x',
      async execute(context, next) {
        return next(context);
      },
    });
    builder.remove('mw-1b');

    const pipeline = builder.build();
    const descriptors = pipeline['descriptors'];
    expect(descriptors.map((descriptor) => descriptor.middleware.id)).toEqual([
      'mw-1',
      'mw-0',
      'mw-2x',
    ]);

    expect(() => new ExecutionPipelineBuilder<string, string>().build()).not.toThrow();
    expect(() => builder.validate()).not.toThrow();
  });

  it('runs concurrent executions with isolated contexts and collects metrics', async () => {
    const pipeline = new ExecutionPipelineBuilder<string, string>()
      .use({
        id: 'mw-1',
        async execute(context, next) {
          context.setData('count', (context.getData<number>('count') ?? 0) + 1);
          return next(context);
        },
      })
      .build();

    const [first, second] = await Promise.all([
      pipeline.execute(
        new ExecutionPipelineContext({ correlationId: 'corr-5' }),
        async (context) => ({ value: context.correlationId }),
      ),
      pipeline.execute(
        new ExecutionPipelineContext({ correlationId: 'corr-6' }),
        async (context) => ({ value: context.correlationId }),
      ),
    ]);

    expect(first.value).toBe('corr-5');
    expect(second.value).toBe('corr-6');
    expect(pipeline.metrics.completed).toBe(2);
    expect(pipeline.metrics.averageDurationMs).toBeGreaterThanOrEqual(0);
  });
});
