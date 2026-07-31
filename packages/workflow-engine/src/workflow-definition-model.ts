import { createHash } from 'node:crypto';

import type { SerializableValueObject, TimestampString } from '@infrashield/contracts';

import {
  WorkflowMetadataException,
  WorkflowValidationException,
  WorkflowVersionException,
} from './workflow-foundation.js';

export type WorkflowDefinitionIdentifier = string;
export type WorkflowDefinitionName = string;
export type WorkflowDefinitionOwner = string;
export type WorkflowDefinitionCategory = string;
export type WorkflowDefinitionTag = string;
export type WorkflowDefinitionLabel = string;
export type WorkflowDefinitionAnnotationKey = string;
export type WorkflowDefinitionAnnotationValue = string;

export interface IWorkflowDefinitionBuilder {
  withId(id: WorkflowDefinitionIdentifier): this;
  withName(name: WorkflowDefinitionName): this;
  withVersion(version: string): this;
  withDescription(description: string): this;
  withOwner(owner: WorkflowDefinitionOwner): this;
  withCategory(category: WorkflowDefinitionCategory): this;
  withTags(tags: readonly WorkflowDefinitionTag[]): this;
  withLabels(labels: readonly WorkflowDefinitionLabel[]): this;
  withAnnotations(annotations: readonly WorkflowAnnotation[]): this;
  withMetadata(metadata: WorkflowDefinitionMetadata): this;
  withOptions(options: WorkflowDefinitionOptions): this;
  build(): WorkflowDefinition;
  validate(): void;
  clone(): WorkflowDefinitionBuilder;
}

export interface IWorkflowMetadata {
  readonly values: Readonly<Record<string, unknown>>;
  get(key: string): unknown;
  has(key: string): boolean;
  toObject(): Record<string, unknown>;
}

export interface IWorkflowVersion {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
  compareTo(other: WorkflowDefinitionVersion): number;
  toString(): string;
}

export interface IWorkflowStatistics {
  readonly definitionSize: number;
  readonly metadataCount: number;
  readonly tagCount: number;
  readonly annotationCount: number;
  readonly version: string;
  readonly createdAt: TimestampString;
  readonly modifiedAt: TimestampString;
}

export interface IWorkflowSnapshot {
  readonly id: string;
  readonly version: string;
  readonly metadata: WorkflowDefinitionMetadata;
  readonly tags: WorkflowTagCollection;
  readonly labels: readonly WorkflowLabel[];
  readonly annotations: readonly WorkflowAnnotation[];
  readonly options?: WorkflowDefinitionOptions;
  readonly hash: string;
  readonly createdAt: TimestampString;
  readonly modifiedAt: TimestampString;
  toJSON(): Record<string, unknown>;
  diagnostics(): string[];
}

export class WorkflowDefinitionVersion implements IWorkflowVersion {
  public readonly major: number;
  public readonly minor: number;
  public readonly patch: number;
  private readonly value: string;

  public constructor(value: string) {
    if (!/^(\d+)\.(\d+)\.(\d+)$/.test(value)) {
      throw new WorkflowVersionException(`Invalid workflow version '${value}'`);
    }

    const [major, minor, patch] = value.split('.').map((segment) => Number(segment));
    this.major = major ?? 0;
    this.minor = minor ?? 0;
    this.patch = patch ?? 0;
    this.value = value;
  }

  public compareTo(other: WorkflowDefinitionVersion): number {
    if (this.major !== other.major) {
      return this.major - other.major;
    }

    if (this.minor !== other.minor) {
      return this.minor - other.minor;
    }

    return this.patch - other.patch;
  }

  public static latest(
    versions: readonly WorkflowDefinitionVersion[],
  ): WorkflowDefinitionVersion | undefined {
    return versions.slice().sort((left, right) => right.compareTo(left))[0];
  }

  public toString(): string {
    return this.value;
  }
}

export class WorkflowOwner {
  private readonly value: string;

  public constructor(value: string) {
    if (!value.trim()) {
      throw new WorkflowMetadataException('Workflow owner is required');
    }
    this.value = value.trim();
  }

  public toString(): string {
    return this.value;
  }
}

export class WorkflowDescription {
  private readonly value: string;

  public constructor(value: string) {
    if (!value.trim()) {
      throw new WorkflowMetadataException('Workflow description is required');
    }
    this.value = value.trim();
  }

  public toString(): string {
    return this.value;
  }
}

export class WorkflowCategory {
  private readonly value: string;

  public constructor(value: string) {
    if (!value.trim()) {
      throw new WorkflowMetadataException('Workflow category is required');
    }
    this.value = value.trim();
  }

  public toString(): string {
    return this.value;
  }
}

export class WorkflowLabel {
  private readonly value: string;

  public constructor(value: string) {
    if (!value.trim()) {
      throw new WorkflowMetadataException('Workflow label is required');
    }
    this.value = value.trim();
  }

  public toString(): string {
    return this.value;
  }
}

export class WorkflowAnnotation {
  public constructor(
    public readonly key: WorkflowDefinitionAnnotationKey,
    public readonly value: WorkflowDefinitionAnnotationValue,
  ) {
    if (!key.trim() || !value.trim()) {
      throw new WorkflowMetadataException('Workflow annotations require a non-empty key and value');
    }
  }
}

export class WorkflowTagCollection {
  public readonly values: readonly string[];

  public constructor(values: readonly string[] = []) {
    this.values = Object.freeze([...values]);
  }

  public add(tag: string): WorkflowTagCollection {
    if (!tag.trim()) {
      throw new WorkflowMetadataException('Workflow tags require a non-empty value');
    }
    return new WorkflowTagCollection([...this.values, tag.trim()]);
  }

  public has(tag: string): boolean {
    return this.values.includes(tag);
  }

  public toArray(): string[] {
    return [...this.values];
  }
}

export class WorkflowDefinitionMetadata implements IWorkflowMetadata {
  public readonly values: Readonly<Record<string, unknown>>;

  public constructor(values: Record<string, unknown> = {}) {
    if (Object.keys(values).some((key) => !key.trim())) {
      throw new WorkflowMetadataException('Metadata keys must be non-empty');
    }

    const normalizedEntries = Object.entries(values).map(
      ([key, value]) => [key.trim(), value] as const,
    );
    const normalizedValues = Object.fromEntries(normalizedEntries);

    for (const [key, value] of Object.entries(normalizedValues)) {
      if (typeof value === 'string' && !value.trim()) {
        throw new WorkflowMetadataException(`Metadata value for '${key}' must be non-empty`);
      }
    }

    this.values = Object.freeze(normalizedValues);
  }

  public get(key: string): unknown {
    return this.values[key];
  }

  public has(key: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.values, key);
  }

  public toObject(): Record<string, unknown> {
    return { ...this.values };
  }
}

export class WorkflowDefinitionOptions {
  public readonly timeoutMs?: number;
  public readonly retryCount?: number;
  public readonly metadata?: SerializableValueObject;

  public constructor(
    options: {
      readonly timeoutMs?: number;
      readonly retryCount?: number;
      readonly metadata?: SerializableValueObject;
    } = {},
  ) {
    if (options.timeoutMs !== undefined && options.timeoutMs < 0) {
      throw new WorkflowValidationException('Workflow timeout must be non-negative');
    }
    if (options.retryCount !== undefined && options.retryCount < 0) {
      throw new WorkflowValidationException('Workflow retry count must be non-negative');
    }

    this.timeoutMs = options.timeoutMs;
    this.retryCount = options.retryCount;
    this.metadata = options.metadata ? Object.freeze({ ...options.metadata }) : undefined;
  }
}

export class WorkflowDefinitionStatistics implements IWorkflowStatistics {
  public readonly definitionSize: number;
  public readonly metadataCount: number;
  public readonly tagCount: number;
  public readonly annotationCount: number;
  public readonly version: string;
  public readonly createdAt: TimestampString;
  public readonly modifiedAt: TimestampString;

  public constructor(options: {
    readonly definitionSize: number;
    readonly metadataCount: number;
    readonly tagCount: number;
    readonly annotationCount: number;
    readonly version: string;
    readonly createdAt: TimestampString;
    readonly modifiedAt: TimestampString;
  }) {
    this.definitionSize = options.definitionSize;
    this.metadataCount = options.metadataCount;
    this.tagCount = options.tagCount;
    this.annotationCount = options.annotationCount;
    this.version = options.version;
    this.createdAt = options.createdAt;
    this.modifiedAt = options.modifiedAt;
  }
}

export class WorkflowDefinitionSnapshot implements IWorkflowSnapshot {
  public readonly id: string;
  public readonly version: string;
  public readonly metadata: WorkflowDefinitionMetadata;
  public readonly tags: WorkflowTagCollection;
  public readonly labels: readonly WorkflowLabel[];
  public readonly annotations: readonly WorkflowAnnotation[];
  public readonly options?: WorkflowDefinitionOptions;
  public readonly hash: string;
  public readonly createdAt: TimestampString;
  public readonly modifiedAt: TimestampString;

  public constructor(options: {
    readonly id: string;
    readonly version: string;
    readonly metadata: WorkflowDefinitionMetadata;
    readonly tags: WorkflowTagCollection;
    readonly labels: readonly WorkflowLabel[];
    readonly annotations: readonly WorkflowAnnotation[];
    readonly options?: WorkflowDefinitionOptions;
    readonly hash: string;
    readonly createdAt: TimestampString;
    readonly modifiedAt: TimestampString;
  }) {
    this.id = options.id;
    this.version = options.version;
    this.metadata = options.metadata;
    this.tags = options.tags;
    this.labels = Object.freeze([...options.labels]);
    this.annotations = Object.freeze([...options.annotations]);
    this.options = options.options;
    this.hash = options.hash;
    this.createdAt = options.createdAt;
    this.modifiedAt = options.modifiedAt;
  }

  public toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      version: this.version,
      metadata: this.metadata.toObject(),
      tags: this.tags.toArray(),
      labels: this.labels.map((label) => label.toString()),
      annotations: this.annotations.map((annotation) => ({
        key: annotation.key,
        value: annotation.value,
      })),
      hash: this.hash,
      createdAt: this.createdAt,
      modifiedAt: this.modifiedAt,
    };
  }

  public diagnostics(): string[] {
    return [
      `version=${this.version}`,
      `hash=${this.hash}`,
      `metadataCount=${this.metadata.toObject().length}`,
      `tagCount=${this.tags.toArray().length}`,
    ];
  }
}

export class WorkflowDefinition {
  public readonly id: WorkflowDefinitionVersion | WorkflowIdentifier;
  public readonly name: string;
  public readonly version: WorkflowDefinitionVersion;
  public readonly description?: WorkflowDescription;
  public readonly owner: WorkflowOwner;
  public readonly category?: WorkflowCategory;
  public readonly metadata: WorkflowDefinitionMetadata;
  public readonly tags: WorkflowTagCollection;
  public readonly labels: readonly WorkflowLabel[];
  public readonly annotations: readonly WorkflowAnnotation[];
  public readonly options?: WorkflowDefinitionOptions;
  public readonly createdAt: TimestampString;
  public readonly modifiedAt: TimestampString;
  public readonly definitionHash: string;
  public readonly statistics: WorkflowDefinitionStatistics;
  public readonly validationState: 'valid' | 'invalid';

  public constructor(options: {
    readonly id: string;
    readonly name: string;
    readonly version: string;
    readonly description?: string;
    readonly owner: string;
    readonly category?: string;
    readonly metadata?: WorkflowDefinitionMetadata;
    readonly tags?: readonly string[];
    readonly labels?: readonly string[];
    readonly annotations?: readonly WorkflowAnnotation[];
    readonly options?: WorkflowDefinitionOptions;
    readonly createdAt?: TimestampString;
    readonly modifiedAt?: TimestampString;
    readonly definitionHash?: string;
    readonly validationState?: 'valid' | 'invalid';
  }) {
    this.id = new WorkflowIdentifier(options.id);
    this.name = options.name.trim();
    this.version = new WorkflowDefinitionVersion(options.version);
    this.description = options.description
      ? new WorkflowDescription(options.description)
      : undefined;
    this.owner = new WorkflowOwner(options.owner);
    this.category = options.category ? new WorkflowCategory(options.category) : undefined;
    this.metadata = options.metadata ?? new WorkflowDefinitionMetadata();
    this.tags = new WorkflowTagCollection(options.tags ?? []);
    this.labels = Object.freeze((options.labels ?? []).map((label) => new WorkflowLabel(label)));
    this.annotations = Object.freeze((options.annotations ?? []).map((annotation) => annotation));
    this.options = options.options;
    this.createdAt = options.createdAt ?? new Date().toISOString();
    this.modifiedAt = options.modifiedAt ?? this.createdAt;
    this.definitionHash = options.definitionHash ?? this.computeHash();
    this.validationState = options.validationState ?? 'valid';
    this.statistics = new WorkflowDefinitionStatistics({
      definitionSize: this.computeDefinitionSize(),
      metadataCount: Object.keys(this.metadata.toObject()).length,
      tagCount: this.tags.toArray().length,
      annotationCount: this.annotations.length,
      version: this.version.toString(),
      createdAt: this.createdAt,
      modifiedAt: this.modifiedAt,
    });

    this.validate();
  }

  public validate(): void {
    if (!this.id.toString().trim()) {
      throw new WorkflowValidationException('Workflow identifier is required');
    }

    if (!this.name.trim()) {
      throw new WorkflowValidationException('Workflow name is required');
    }

    if (!this.owner.toString().trim()) {
      throw new WorkflowValidationException('Workflow owner is required');
    }

    if (!this.version.toString().trim()) {
      throw new WorkflowValidationException('Workflow version is required');
    }

    if (this.metadata.values && Object.keys(this.metadata.values).length === 0) {
      throw new WorkflowValidationException('Workflow metadata is required');
    }

    if (this.tags.toArray().length === 0) {
      throw new WorkflowValidationException('Workflow tags are required');
    }

    if (this.name.includes('DROP') || this.name.includes('SELECT')) {
      throw new WorkflowValidationException('Workflow name contains reserved words');
    }
  }

  public clone(): WorkflowDefinition {
    return new WorkflowDefinition({
      id: this.id.toString(),
      name: this.name,
      version: this.version.toString(),
      description: this.description?.toString(),
      owner: this.owner.toString(),
      category: this.category?.toString(),
      metadata: new WorkflowDefinitionMetadata(this.metadata.toObject()),
      tags: this.tags.toArray(),
      labels: this.labels.map((label) => label.toString()),
      annotations: [...this.annotations],
      options: this.options,
      createdAt: this.createdAt,
      modifiedAt: this.modifiedAt,
      definitionHash: this.definitionHash,
      validationState: this.validationState,
    });
  }

  public snapshot(): WorkflowDefinitionSnapshot {
    return new WorkflowDefinitionSnapshot({
      id: this.id.toString(),
      version: this.version.toString(),
      metadata: this.metadata,
      tags: this.tags,
      labels: this.labels,
      annotations: this.annotations,
      options: this.options,
      hash: this.definitionHash,
      createdAt: this.createdAt,
      modifiedAt: this.modifiedAt,
    });
  }

  public toString(): string {
    return `${this.name}@${this.version.toString()}`;
  }

  private computeHash(): string {
    const payload = JSON.stringify({
      id: this.id.toString(),
      name: this.name,
      version: this.version.toString(),
      owner: this.owner.toString(),
      metadata: this.metadata.toObject(),
      tags: this.tags.toArray(),
      labels: this.labels.map((label) => label.toString()),
      annotations: this.annotations.map((annotation) => ({
        key: annotation.key,
        value: annotation.value,
      })),
    });
    return createHash('sha256').update(payload).digest('hex');
  }

  private computeDefinitionSize(): number {
    return Buffer.byteLength(JSON.stringify(this.toString()), 'utf8');
  }
}

export class WorkflowIdentifier {
  private readonly value: string;

  public constructor(value: string) {
    if (!value.trim()) {
      throw new WorkflowValidationException('Workflow identifier is required');
    }
    this.value = value.trim();
  }

  public toString(): string {
    return this.value;
  }
}

export class WorkflowDefinitionBuilder implements IWorkflowDefinitionBuilder {
  private id?: string;
  private name?: string;
  private version = '1.0.0';
  private description?: string;
  private owner?: string;
  private category?: string;
  private metadata?: WorkflowDefinitionMetadata;
  private tags: string[] = [];
  private labels: string[] = [];
  private annotations: WorkflowAnnotation[] = [];
  private options?: WorkflowDefinitionOptions;

  public withId(id: string): this {
    this.id = id;
    return this;
  }

  public withName(name: string): this {
    this.name = name;
    return this;
  }

  public withVersion(version: string): this {
    this.version = version;
    return this;
  }

  public withDescription(description: string): this {
    this.description = description;
    return this;
  }

  public withOwner(owner: string): this {
    this.owner = owner;
    return this;
  }

  public withCategory(category: string): this {
    this.category = category;
    return this;
  }

  public withTags(tags: readonly string[]): this {
    this.tags = [...tags];
    return this;
  }

  public withLabels(labels: readonly string[]): this {
    this.labels = [...labels];
    return this;
  }

  public withAnnotations(annotations: readonly WorkflowAnnotation[]): this {
    this.annotations = [...annotations];
    return this;
  }

  public withMetadata(metadata: WorkflowDefinitionMetadata): this {
    this.metadata = metadata;
    return this;
  }

  public withOptions(options: WorkflowDefinitionOptions): this {
    this.options = options;
    return this;
  }

  public build(): WorkflowDefinition {
    if (!this.id) {
      throw new WorkflowValidationException('Workflow identifier is required');
    }

    if (!this.name) {
      throw new WorkflowValidationException('Workflow name is required');
    }

    if (!this.owner) {
      throw new WorkflowValidationException('Workflow owner is required');
    }

    if (!this.version) {
      throw new WorkflowValidationException('Workflow version is required');
    }

    if (this.tags.length === 0) {
      throw new WorkflowValidationException('Workflow tags are required');
    }

    return new WorkflowDefinition({
      id: this.id,
      name: this.name,
      version: this.version,
      description: this.description,
      owner: this.owner,
      category: this.category,
      metadata: this.metadata ?? new WorkflowDefinitionMetadata({ author: 'system' }),
      tags: this.tags,
      labels: this.labels,
      annotations: this.annotations,
      options: this.options,
    });
  }

  public validate(): void {
    this.build();
  }

  public clone(): WorkflowDefinitionBuilder {
    const clone = new WorkflowDefinitionBuilder();
    clone.id = this.id;
    clone.name = this.name;
    clone.version = this.version;
    clone.description = this.description;
    clone.owner = this.owner;
    clone.category = this.category;
    clone.metadata = this.metadata;
    clone.tags = [...this.tags];
    clone.labels = [...this.labels];
    clone.annotations = [...this.annotations];
    clone.options = this.options;
    return clone;
  }
}
