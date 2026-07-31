import { describe, expect, it } from 'vitest';

import {
  WorkflowAnnotation,
  WorkflowCategory,
  WorkflowDefinitionBuilder,
  WorkflowDefinitionMetadata,
  WorkflowDefinitionOptions,
  WorkflowDefinitionSnapshot,
  WorkflowDefinitionStatistics,
  WorkflowDefinitionVersion,
  WorkflowDescription,
  WorkflowLabel,
  WorkflowMetadataException,
  WorkflowOwner,
  WorkflowTagCollection,
  WorkflowValidationException,
  WorkflowVersionException,
} from './index.js';

describe('workflow definition model', () => {
  it('builds immutable definitions with metadata, labels, annotations, and options', () => {
    const definition = new WorkflowDefinitionBuilder()
      .withId('workflow-definition-1')
      .withName('Customer Onboarding')
      .withVersion('2.3.1')
      .withDescription('Handles onboarding')
      .withOwner('ops-team')
      .withCategory('customer-journey')
      .withTags(['core', 'onboarding'])
      .withLabels(['production', 'critical'])
      .withAnnotations([new WorkflowAnnotation('source', 'internal')])
      .withMetadata(new WorkflowDefinitionMetadata({ author: 'alice', tenant: 'acme' }))
      .withOptions(new WorkflowDefinitionOptions({ timeoutMs: 5000, retryCount: 2 }))
      .build();

    expect(definition.id.toString()).toBe('workflow-definition-1');
    expect(definition.version.toString()).toBe('2.3.1');
    expect(definition.category?.toString()).toBe('customer-journey');
    expect(definition.tags.toArray()).toEqual(['core', 'onboarding']);
    expect(definition.labels.map((label) => label.toString())).toEqual(['production', 'critical']);
    expect(definition.annotations[0]?.key).toBe('source');
    expect(definition.metadata.get('author')).toBe('alice');
    expect(definition.options?.timeoutMs).toBe(5000);
    expect(Object.isFrozen(definition.metadata.values)).toBe(true);
    expect(Object.isFrozen(definition.tags.values)).toBe(true);
  });

  it('rejects invalid definitions and metadata', () => {
    expect(() => new WorkflowDefinitionBuilder().withName('missing-id').build()).toThrow(
      WorkflowValidationException,
    );

    expect(() =>
      new WorkflowDefinitionBuilder().withId('id').withName('name').withOwner('owner').build(),
    ).toThrow(WorkflowValidationException);

    expect(() => new WorkflowDefinitionMetadata({ author: '' })).toThrow(WorkflowMetadataException);
    expect(() => new WorkflowDefinitionVersion('1.2')).toThrow(WorkflowVersionException);
  });

  it('supports semantic version parsing, comparison, and latest helper', () => {
    const version = new WorkflowDefinitionVersion('1.2.3');
    const newer = new WorkflowDefinitionVersion('1.3.0');

    expect(version.major).toBe(1);
    expect(version.minor).toBe(2);
    expect(version.patch).toBe(3);
    expect(version.compareTo(newer)).toBeLessThan(0);
    expect(WorkflowDefinitionVersion.latest([version, newer])?.toString()).toBe('1.3.0');
  });

  it('creates immutable snapshots and deterministic hashes', () => {
    const definition = new WorkflowDefinitionBuilder()
      .withId('snapshot-workflow')
      .withName('Snapshot workflow')
      .withVersion('3.0.0')
      .withOwner('ops')
      .withTags(['snapshot'])
      .withMetadata(new WorkflowDefinitionMetadata({ tenant: 'acme' }))
      .build();

    const snapshot = definition.snapshot();

    expect(snapshot).toBeInstanceOf(WorkflowDefinitionSnapshot);
    expect(snapshot.hash).toBeDefined();
    expect(snapshot.hash).toBe(definition.definitionHash);
    expect(Object.isFrozen(snapshot.metadata.values)).toBe(true);
    expect(() => {
      Object.assign(snapshot.metadata.values, { author: 'x' });
    }).toThrow(TypeError);
  });

  it('tracks statistics and supports cloning for immutable definitions', () => {
    const definition = new WorkflowDefinitionBuilder()
      .withId('clone-workflow')
      .withName('Clone workflow')
      .withVersion('4.5.6')
      .withOwner('qa')
      .withTags(['clone'])
      .withLabels(['one', 'two'])
      .withAnnotations([new WorkflowAnnotation('flag', 'true')])
      .withMetadata(new WorkflowDefinitionMetadata({ environment: 'prod' }))
      .build();

    const clone = definition.clone();
    expect(clone).not.toBe(definition);
    expect(clone.toString()).toBe(definition.toString());
    expect(clone.statistics).toBeInstanceOf(WorkflowDefinitionStatistics);
    expect(clone.statistics.metadataCount).toBe(1);
    expect(clone.statistics.tagCount).toBe(1);
    expect(clone.statistics.annotationCount).toBe(1);
  });

  it('uses value objects for owner, description, category, and labels', () => {
    const owner = new WorkflowOwner('platform');
    const description = new WorkflowDescription('described');
    const category = new WorkflowCategory('platform');
    const label = new WorkflowLabel('ready');

    expect(owner.toString()).toBe('platform');
    expect(description.toString()).toBe('described');
    expect(category.toString()).toBe('platform');
    expect(label.toString()).toBe('ready');
  });

  it('supports tag collection helpers immutably', () => {
    const tags = new WorkflowTagCollection(['a', 'b']);
    const next = tags.add('c');

    expect(tags.toArray()).toEqual(['a', 'b']);
    expect(next.toArray()).toEqual(['a', 'b', 'c']);
    expect(next.has('c')).toBe(true);
  });

  it('supports builder clone and validation hooks', () => {
    const builder = new WorkflowDefinitionBuilder()
      .withId('builder-clone')
      .withName('Builder Clone')
      .withVersion('1.0.0')
      .withOwner('ops')
      .withTags(['builder']);

    const clone = builder.clone();
    expect(clone).not.toBe(builder);
    expect(clone.build().id.toString()).toBe('builder-clone');
    expect(() => builder.validate()).not.toThrow();
  });
});
