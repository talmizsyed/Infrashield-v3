import { describe, expect, it } from 'vitest';

import {
  AIModelCapability,
  AIModelConstraints,
  AIModelDescriptor,
  AIModelFilter,
  AIModelQuery,
  AIModelRegistry,
  AIModelRequirements,
  AIModelVersion,
} from './index.js';

describe('ai model registry', () => {
  it('registers, updates, and looks up models by provider and family', () => {
    const registry = new AIModelRegistry();
    const descriptor = new AIModelDescriptor({
      id: 'acme-chat-v1',
      providerId: 'acme',
      family: 'general',
      name: 'Acme Chat',
      version: '1.0.0',
      status: 'stable',
      capabilities: [new AIModelCapability({ kind: 'chat', supported: true })],
      constraints: new AIModelConstraints({ maxContextTokens: 8192, maxOutputTokens: 2048 }),
      requirements: new AIModelRequirements({ supportsStreaming: true }),
      aliases: ['acme-chat'],
    });

    registry.register(descriptor);
    expect(registry.lookup('acme', 'acme-chat-v1')?.name).toBe('Acme Chat');

    const updated = new AIModelDescriptor({
      ...descriptor,
      version: '1.1.0',
      status: 'preview',
      aliases: ['acme-chat', 'acme-chat-preview'],
    });
    registry.update(updated);

    expect(registry.latestVersion('general')?.version).toBe('1.1.0');
    expect(registry.lookupFamily('general').length).toBe(1);
  });

  it('filters models by capability, status, and context length', () => {
    const registry = new AIModelRegistry();
    registry.register(
      new AIModelDescriptor({
        id: 'reasoner-v1',
        providerId: 'acme',
        family: 'reasoning',
        name: 'Reasoner',
        version: '1.0.0',
        status: 'stable',
        capabilities: [new AIModelCapability({ kind: 'reasoning', supported: true })],
        constraints: new AIModelConstraints({ maxContextTokens: 32768 }),
      }),
    );
    registry.register(
      new AIModelDescriptor({
        id: 'vision-v1',
        providerId: 'acme',
        family: 'vision',
        name: 'Vision',
        version: '1.0.0',
        status: 'preview',
        capabilities: [new AIModelCapability({ kind: 'vision', supported: true })],
        constraints: new AIModelConstraints({ maxContextTokens: 16384 }),
      }),
    );

    const results = registry.query(
      new AIModelQuery({
        filter: new AIModelFilter({ capability: 'reasoning', status: 'stable' }),
      }),
    );

    expect(results.map((model) => model.id)).toEqual(['reasoner-v1']);
  });

  it('returns immutable snapshots and exposes deprecated models', () => {
    const registry = new AIModelRegistry();
    const descriptor = new AIModelDescriptor({
      id: 'legacy-v1',
      providerId: 'acme',
      family: 'general',
      name: 'Legacy',
      version: '0.9.0',
      status: 'deprecated',
      deprecated: true,
      capabilities: [new AIModelCapability({ kind: 'chat', supported: true })],
      constraints: new AIModelConstraints({ maxContextTokens: 4096 }),
    });

    registry.register(descriptor);
    const snapshot = registry.snapshot();

    expect(snapshot.models).toHaveLength(1);

    const firstModel = snapshot.models[0];
    expect(firstModel).toBeDefined();
    if (!firstModel) {
      throw new Error('Expected snapshot to contain at least one model');
    }

    expect(firstModel.id).toBe('legacy-v1');
    expect(firstModel).toBeInstanceOf(AIModelDescriptor);

    const mutableModel = firstModel as unknown as { name: string };
    expect(() => {
      mutableModel.name = 'changed';
    }).toThrow(TypeError);
  });

  it('supports alias and version lookups', () => {
    const registry = new AIModelRegistry();
    registry.register(
      new AIModelDescriptor({
        id: 'alias-model',
        providerId: 'acme',
        family: 'general',
        name: 'Alias Model',
        version: '2.0.0',
        status: 'stable',
        aliases: ['alias'],
        capabilities: [new AIModelCapability({ kind: 'chat', supported: true })],
        constraints: new AIModelConstraints({ maxContextTokens: 16384 }),
      }),
    );

    expect(registry.lookupByAlias('alias')?.id).toBe('alias-model');
    expect(
      registry.lookupVersion('acme', 'alias-model', new AIModelVersion('2.0.0'))?.version,
    ).toBe('2.0.0');
  });
});
