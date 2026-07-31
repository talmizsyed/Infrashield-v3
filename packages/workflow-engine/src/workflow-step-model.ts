import { createHash } from 'node:crypto';

import type { SerializableValueObject, TimestampString } from '@infrashield/contracts';

import {
  WorkflowMetadataException,
  WorkflowValidationException,
  WorkflowVersionException,
} from './workflow-foundation.js';

export type WorkflowStepType =
  | 'start'
  | 'task'
  | 'decision'
  | 'parallel'
  | 'merge'
  | 'loop'
  | 'delay'
  | 'approval'
  | 'subworkflow'
  | 'compensation'
  | 'end';

export interface IWorkflowStep {
  readonly id: WorkflowStepIdentifier;
  readonly name: string;
  readonly description?: string;
  readonly version: WorkflowStepVersion;
  readonly type: WorkflowStepType;
  readonly metadata: WorkflowStepMetadata;
  readonly tags: readonly string[];
  readonly labels: readonly string[];
  readonly annotations: readonly WorkflowStepAnnotation[];
  readonly retryPolicyRef?: string;
  readonly timeoutRef?: string;
  readonly conditionRef?: string;
  readonly options?: WorkflowStepOptions;
  readonly dependencies: readonly string[];
  readonly inputs: readonly string[];
  readonly outputs: readonly string[];
  readonly owner?: string;
  readonly correlationId?: string;
  validate(): void;
  snapshot(): WorkflowStepSnapshot;
}

export interface IWorkflowStepBuilder {
  withId(id: string): this;
  withName(name: string): this;
  withDescription(description: string): this;
  withVersion(version: string): this;
  withType(type: WorkflowStepType): this;
  withMetadata(metadata: WorkflowStepMetadata): this;
  withTags(tags: readonly string[]): this;
  withLabels(labels: readonly string[]): this;
  withAnnotations(annotations: readonly WorkflowStepAnnotation[]): this;
  withRetryPolicyRef(ref: string): this;
  withTimeoutRef(ref: string): this;
  withConditionRef(ref: string): this;
  withOptions(options: WorkflowStepOptions): this;
  withDependencies(dependencies: readonly string[]): this;
  withInputs(inputs: readonly string[]): this;
  withOutputs(outputs: readonly string[]): this;
  withOwner(owner: string): this;
  withCorrelationId(correlationId: string): this;
  build(): WorkflowStep;
  validate(): void;
  clone(): WorkflowStepBuilder;
}

export interface IWorkflowGraph {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly steps: readonly WorkflowStep[];
  readonly entryNodeId?: string;
  readonly exitNodeId?: string;
  readonly edges: readonly WorkflowEdge[];
  validate(): void;
  snapshot(): WorkflowGraphSnapshot;
}

export interface IWorkflowEdge {
  readonly id: string;
  readonly sourceId: string;
  readonly targetId: string;
  readonly conditionRef?: string;
  readonly metadata?: WorkflowStepMetadata;
  readonly labels?: readonly string[];
}

export interface IWorkflowStepMetadata {
  readonly values: Readonly<Record<string, unknown>>;
  get(key: string): unknown;
  has(key: string): boolean;
  toObject(): Record<string, unknown>;
}

export interface IWorkflowStepSnapshot {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly hash: string;
  readonly createdAt: TimestampString;
  readonly modifiedAt: TimestampString;
  toJSON(): Record<string, unknown>;
  diagnostics(): string[];
}

export class WorkflowStepIdentifier {
  private readonly value: string;

  public constructor(value: string) {
    if (!value.trim()) {
      throw new WorkflowValidationException('Workflow step identifier is required');
    }
    this.value = value.trim();
  }

  public toString(): string {
    return this.value;
  }
}

export class WorkflowStepVersion {
  public readonly major: number;
  public readonly minor: number;
  public readonly patch: number;
  private readonly value: string;

  public constructor(value: string) {
    if (!/^(\d+)\.(\d+)\.(\d+)$/.test(value)) {
      throw new WorkflowVersionException(`Invalid workflow step version '${value}'`);
    }

    const [major, minor, patch] = value.split('.').map((segment) => Number(segment));
    this.major = major ?? 0;
    this.minor = minor ?? 0;
    this.patch = patch ?? 0;
    this.value = value;
  }

  public compareTo(other: WorkflowStepVersion): number {
    if (this.major !== other.major) {
      return this.major - other.major;
    }
    if (this.minor !== other.minor) {
      return this.minor - other.minor;
    }
    return this.patch - other.patch;
  }

  public static latest(versions: readonly WorkflowStepVersion[]): WorkflowStepVersion | undefined {
    return versions.slice().sort((left, right) => right.compareTo(left))[0];
  }

  public toString(): string {
    return this.value;
  }
}

export class WorkflowStepAnnotation {
  public constructor(
    public readonly key: string,
    public readonly value: string,
  ) {
    if (!key.trim() || !value.trim()) {
      throw new WorkflowMetadataException(
        'Workflow step annotations require a non-empty key and value',
      );
    }
  }
}

export class WorkflowStepMetadata implements IWorkflowStepMetadata {
  public readonly values: Readonly<Record<string, unknown>>;

  public constructor(values: Record<string, unknown> = {}) {
    if (Object.keys(values).some((key) => !key.trim())) {
      throw new WorkflowMetadataException('Workflow step metadata keys must be non-empty');
    }

    const normalizedEntries = Object.entries(values).map(
      ([key, value]) => [key.trim(), value] as const,
    );
    const normalizedValues = Object.fromEntries(normalizedEntries);

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

export class WorkflowStepOptions {
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
      throw new WorkflowValidationException('Workflow step timeout must be non-negative');
    }
    if (options.retryCount !== undefined && options.retryCount < 0) {
      throw new WorkflowValidationException('Workflow step retry count must be non-negative');
    }

    this.timeoutMs = options.timeoutMs;
    this.retryCount = options.retryCount;
    this.metadata = options.metadata ? Object.freeze({ ...options.metadata }) : undefined;
  }
}

export class WorkflowStepStatistics {
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

export class WorkflowStepSnapshot implements IWorkflowStepSnapshot {
  public readonly id: string;
  public readonly name: string;
  public readonly version: string;
  public readonly hash: string;
  public readonly createdAt: TimestampString;
  public readonly modifiedAt: TimestampString;
  private readonly payload: Record<string, unknown>;

  public constructor(options: {
    readonly id: string;
    readonly name: string;
    readonly version: string;
    readonly hash: string;
    readonly createdAt: TimestampString;
    readonly modifiedAt: TimestampString;
    readonly payload: Record<string, unknown>;
  }) {
    this.id = options.id;
    this.name = options.name;
    this.version = options.version;
    this.hash = options.hash;
    this.createdAt = options.createdAt;
    this.modifiedAt = options.modifiedAt;
    this.payload = Object.freeze({ ...options.payload });
  }

  public toJSON(): Record<string, unknown> {
    return { ...this.payload };
  }

  public diagnostics(): string[] {
    return [`id=${this.id}`, `version=${this.version}`, `hash=${this.hash}`];
  }
}

export class WorkflowStep implements IWorkflowStep {
  public readonly id: WorkflowStepIdentifier;
  public readonly name: string;
  public readonly description?: string;
  public readonly version: WorkflowStepVersion;
  public readonly type: WorkflowStepType;
  public readonly metadata: WorkflowStepMetadata;
  public readonly tags: readonly string[];
  public readonly labels: readonly string[];
  public readonly annotations: readonly WorkflowStepAnnotation[];
  public readonly retryPolicyRef?: string;
  public readonly timeoutRef?: string;
  public readonly conditionRef?: string;
  public readonly options?: WorkflowStepOptions;
  public readonly dependencies: readonly string[];
  public readonly inputs: readonly string[];
  public readonly outputs: readonly string[];
  public readonly owner?: string;
  public readonly correlationId?: string;
  public readonly createdAt: TimestampString;
  public readonly modifiedAt: TimestampString;
  public readonly definitionHash: string;
  public readonly statistics: WorkflowStepStatistics;

  public constructor(options: {
    readonly id: string;
    readonly name: string;
    readonly description?: string;
    readonly version: string;
    readonly type: WorkflowStepType;
    readonly metadata?: WorkflowStepMetadata;
    readonly tags?: readonly string[];
    readonly labels?: readonly string[];
    readonly annotations?: readonly WorkflowStepAnnotation[];
    readonly retryPolicyRef?: string;
    readonly timeoutRef?: string;
    readonly conditionRef?: string;
    readonly options?: WorkflowStepOptions;
    readonly dependencies?: readonly string[];
    readonly inputs?: readonly string[];
    readonly outputs?: readonly string[];
    readonly owner?: string;
    readonly correlationId?: string;
    readonly createdAt?: TimestampString;
    readonly modifiedAt?: TimestampString;
  }) {
    this.id = new WorkflowStepIdentifier(options.id);
    this.name = options.name.trim();
    this.description = options.description?.trim();
    this.version = new WorkflowStepVersion(options.version);
    this.type = options.type;
    this.metadata = options.metadata ?? new WorkflowStepMetadata();
    this.tags = Object.freeze([...(options.tags ?? [])]);
    this.labels = Object.freeze([...(options.labels ?? [])]);
    this.annotations = Object.freeze([...(options.annotations ?? [])]);
    this.retryPolicyRef = options.retryPolicyRef;
    this.timeoutRef = options.timeoutRef;
    this.conditionRef = options.conditionRef;
    this.options = options.options;
    this.dependencies = Object.freeze([...(options.dependencies ?? [])]);
    this.inputs = Object.freeze([...(options.inputs ?? [])]);
    this.outputs = Object.freeze([...(options.outputs ?? [])]);
    this.owner = options.owner?.trim();
    this.correlationId = options.correlationId?.trim();
    this.createdAt = options.createdAt ?? new Date().toISOString();
    this.modifiedAt = options.modifiedAt ?? this.createdAt;
    this.definitionHash = this.computeHash();
    this.statistics = new WorkflowStepStatistics({
      definitionSize: this.computeDefinitionSize(),
      metadataCount: Object.keys(this.metadata.toObject()).length,
      tagCount: this.tags.length,
      annotationCount: this.annotations.length,
      version: this.version.toString(),
      createdAt: this.createdAt,
      modifiedAt: this.modifiedAt,
    });

    this.validate();
  }

  public validate(): void {
    if (!this.id.toString().trim()) {
      throw new WorkflowValidationException('Workflow step identifier is required');
    }
    if (!this.name.trim()) {
      throw new WorkflowValidationException('Workflow step name is required');
    }
    if (!this.version.toString().trim()) {
      throw new WorkflowValidationException('Workflow step version is required');
    }
    if (this.name.includes('DROP') || this.name.includes('SELECT')) {
      throw new WorkflowValidationException('Workflow step name contains reserved words');
    }
  }

  public snapshot(): WorkflowStepSnapshot {
    return new WorkflowStepSnapshot({
      id: this.id.toString(),
      name: this.name,
      version: this.version.toString(),
      hash: this.definitionHash,
      createdAt: this.createdAt,
      modifiedAt: this.modifiedAt,
      payload: {
        type: this.type,
        metadata: this.metadata.toObject(),
        tags: this.tags,
        labels: this.labels,
        annotations: this.annotations.map((annotation) => ({
          key: annotation.key,
          value: annotation.value,
        })),
      },
    });
  }

  private computeHash(): string {
    const payload = JSON.stringify({
      id: this.id.toString(),
      name: this.name,
      version: this.version.toString(),
      type: this.type,
      metadata: this.metadata.toObject(),
      tags: this.tags,
      labels: this.labels,
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

export class WorkflowStepBuilder implements IWorkflowStepBuilder {
  private id?: string;
  private name?: string;
  private description?: string;
  private version = '1.0.0';
  private type: WorkflowStepType = 'task';
  private metadata?: WorkflowStepMetadata;
  private tags: string[] = [];
  private labels: string[] = [];
  private annotations: WorkflowStepAnnotation[] = [];
  private retryPolicyRef?: string;
  private timeoutRef?: string;
  private conditionRef?: string;
  private options?: WorkflowStepOptions;
  private dependencies: string[] = [];
  private inputs: string[] = [];
  private outputs: string[] = [];
  private owner?: string;
  private correlationId?: string;

  public withId(id: string): this {
    this.id = id;
    return this;
  }

  public withName(name: string): this {
    this.name = name;
    return this;
  }

  public withDescription(description: string): this {
    this.description = description;
    return this;
  }

  public withVersion(version: string): this {
    this.version = version;
    return this;
  }

  public withType(type: WorkflowStepType): this {
    this.type = type;
    return this;
  }

  public withMetadata(metadata: WorkflowStepMetadata): this {
    this.metadata = metadata;
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

  public withAnnotations(annotations: readonly WorkflowStepAnnotation[]): this {
    this.annotations = [...annotations];
    return this;
  }

  public withRetryPolicyRef(ref: string): this {
    this.retryPolicyRef = ref;
    return this;
  }

  public withTimeoutRef(ref: string): this {
    this.timeoutRef = ref;
    return this;
  }

  public withConditionRef(ref: string): this {
    this.conditionRef = ref;
    return this;
  }

  public withOptions(options: WorkflowStepOptions): this {
    this.options = options;
    return this;
  }

  public withDependencies(dependencies: readonly string[]): this {
    this.dependencies = [...dependencies];
    return this;
  }

  public withInputs(inputs: readonly string[]): this {
    this.inputs = [...inputs];
    return this;
  }

  public withOutputs(outputs: readonly string[]): this {
    this.outputs = [...outputs];
    return this;
  }

  public withOwner(owner: string): this {
    this.owner = owner;
    return this;
  }

  public withCorrelationId(correlationId: string): this {
    this.correlationId = correlationId;
    return this;
  }

  public build(): WorkflowStep {
    if (!this.id) {
      throw new WorkflowValidationException('Workflow step identifier is required');
    }
    if (!this.name) {
      throw new WorkflowValidationException('Workflow step name is required');
    }

    return new WorkflowStep({
      id: this.id,
      name: this.name,
      description: this.description,
      version: this.version,
      type: this.type,
      metadata: this.metadata ?? new WorkflowStepMetadata({ source: 'builder' }),
      tags: this.tags,
      labels: this.labels,
      annotations: this.annotations,
      retryPolicyRef: this.retryPolicyRef,
      timeoutRef: this.timeoutRef,
      conditionRef: this.conditionRef,
      options: this.options,
      dependencies: this.dependencies,
      inputs: this.inputs,
      outputs: this.outputs,
      owner: this.owner,
      correlationId: this.correlationId,
    });
  }

  public validate(): void {
    this.build();
  }

  public clone(): WorkflowStepBuilder {
    const clone = new WorkflowStepBuilder();
    clone.id = this.id;
    clone.name = this.name;
    clone.description = this.description;
    clone.version = this.version;
    clone.type = this.type;
    clone.metadata = this.metadata;
    clone.tags = [...this.tags];
    clone.labels = [...this.labels];
    clone.annotations = [...this.annotations];
    clone.retryPolicyRef = this.retryPolicyRef;
    clone.timeoutRef = this.timeoutRef;
    clone.conditionRef = this.conditionRef;
    clone.options = this.options;
    clone.dependencies = [...this.dependencies];
    clone.inputs = [...this.inputs];
    clone.outputs = [...this.outputs];
    clone.owner = this.owner;
    clone.correlationId = this.correlationId;
    return clone;
  }
}

export class WorkflowEdge implements IWorkflowEdge {
  public readonly id: string;
  public readonly sourceId: string;
  public readonly targetId: string;
  public readonly conditionRef?: string;
  public readonly metadata?: WorkflowStepMetadata;
  public readonly labels?: readonly string[];

  public constructor(options: {
    readonly id: string;
    readonly sourceId: string;
    readonly targetId: string;
    readonly conditionRef?: string;
    readonly metadata?: WorkflowStepMetadata;
    readonly labels?: readonly string[];
  }) {
    this.id = options.id;
    this.sourceId = options.sourceId;
    this.targetId = options.targetId;
    this.conditionRef = options.conditionRef;
    this.metadata = options.metadata;
    this.labels = options.labels ? Object.freeze([...options.labels]) : undefined;
  }
}

export class WorkflowGraph implements IWorkflowGraph {
  public readonly id: string;
  public readonly name: string;
  public readonly version: string;
  public readonly steps: readonly WorkflowStep[];
  public readonly entryNodeId?: string;
  public readonly exitNodeId?: string;
  public readonly edges: readonly WorkflowEdge[];
  public readonly createdAt: TimestampString;
  public readonly modifiedAt: TimestampString;
  public readonly definitionHash: string;
  public readonly validationState: 'valid' | 'invalid';

  public constructor(options: {
    readonly id: string;
    readonly name: string;
    readonly version: string;
    readonly steps: readonly WorkflowStep[];
    readonly entryNodeId?: string;
    readonly exitNodeId?: string;
    readonly edges?: readonly WorkflowEdge[];
    readonly createdAt?: TimestampString;
    readonly modifiedAt?: TimestampString;
  }) {
    this.id = options.id;
    this.name = options.name;
    this.version = options.version;
    this.steps = Object.freeze([...options.steps]);
    this.entryNodeId = options.entryNodeId;
    this.exitNodeId = options.exitNodeId;
    this.edges = Object.freeze([...(options.edges ?? [])]);
    this.createdAt = options.createdAt ?? new Date().toISOString();
    this.modifiedAt = options.modifiedAt ?? this.createdAt;
    this.definitionHash = this.computeHash();
    this.validationState = 'valid';
    this.validate();
  }

  public validate(): void {
    const stepIds = this.steps.map((step) => step.id.toString());
    if (stepIds.length === 0) {
      throw new WorkflowValidationException('Workflow graph must contain at least one step');
    }
    if (new Set(stepIds).size !== stepIds.length) {
      throw new WorkflowValidationException('Workflow graph contains duplicate step identifiers');
    }
    if (!this.entryNodeId) {
      throw new WorkflowValidationException('Workflow graph requires an entry node');
    }
    if (!this.exitNodeId) {
      throw new WorkflowValidationException('Workflow graph requires an exit node');
    }
    if (!stepIds.includes(this.entryNodeId)) {
      throw new WorkflowValidationException('Workflow graph entry node does not exist');
    }
    if (!stepIds.includes(this.exitNodeId)) {
      throw new WorkflowValidationException('Workflow graph exit node does not exist');
    }
    if (this.entryNodeId === this.exitNodeId) {
      throw new WorkflowValidationException(
        'Workflow graph entry and exit nodes must be different',
      );
    }
    const edgeIds = this.edges.map((edge) => edge.id);
    if (new Set(edgeIds).size !== edgeIds.length) {
      throw new WorkflowValidationException('Workflow graph contains duplicate edge identifiers');
    }
    for (const edge of this.edges) {
      if (edge.sourceId === edge.targetId) {
        throw new WorkflowValidationException('Workflow graph contains a self-referential edge');
      }
      if (!stepIds.includes(edge.sourceId) || !stepIds.includes(edge.targetId)) {
        throw new WorkflowValidationException('Workflow graph contains an invalid edge reference');
      }
    }
  }

  public snapshot(): WorkflowGraphSnapshot {
    return new WorkflowGraphSnapshot({
      id: this.id,
      name: this.name,
      version: this.version,
      hash: this.definitionHash,
      createdAt: this.createdAt,
      modifiedAt: this.modifiedAt,
      payload: {
        entryNodeId: this.entryNodeId,
        exitNodeId: this.exitNodeId,
        stepCount: this.steps.length,
        edgeCount: this.edges.length,
      },
    });
  }

  private computeHash(): string {
    const payload = JSON.stringify({
      id: this.id,
      name: this.name,
      version: this.version,
      steps: this.steps.map((step) => step.id.toString()),
      entryNodeId: this.entryNodeId,
      exitNodeId: this.exitNodeId,
      edges: this.edges.map((edge) => ({
        id: edge.id,
        sourceId: edge.sourceId,
        targetId: edge.targetId,
      })),
    });
    return createHash('sha256').update(payload).digest('hex');
  }
}

export class WorkflowGraphSnapshot implements IWorkflowStepSnapshot {
  public readonly id: string;
  public readonly name: string;
  public readonly version: string;
  public readonly hash: string;
  public readonly createdAt: TimestampString;
  public readonly modifiedAt: TimestampString;
  private readonly payload: Record<string, unknown>;

  public constructor(options: {
    readonly id: string;
    readonly name: string;
    readonly version: string;
    readonly hash: string;
    readonly createdAt: TimestampString;
    readonly modifiedAt: TimestampString;
    readonly payload: Record<string, unknown>;
  }) {
    this.id = options.id;
    this.name = options.name;
    this.version = options.version;
    this.hash = options.hash;
    this.createdAt = options.createdAt;
    this.modifiedAt = options.modifiedAt;
    this.payload = Object.freeze({ ...options.payload });
  }

  public toJSON(): Record<string, unknown> {
    return { ...this.payload };
  }

  public diagnostics(): string[] {
    return [`id=${this.id}`, `version=${this.version}`, `hash=${this.hash}`];
  }
}

export class WorkflowStepException extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'WorkflowStepException';
  }
}

export class WorkflowGraphException extends WorkflowStepException {
  public constructor(message: string) {
    super(message);
    this.name = 'WorkflowGraphException';
  }
}

export class WorkflowEdgeException extends WorkflowStepException {
  public constructor(message: string) {
    super(message);
    this.name = 'WorkflowEdgeException';
  }
}

export class WorkflowStructureException extends WorkflowStepException {
  public constructor(message: string) {
    super(message);
    this.name = 'WorkflowStructureException';
  }
}

export class WorkflowStepCollection {
  private readonly values: readonly WorkflowStep[];

  public constructor(values: readonly WorkflowStep[] = []) {
    this.values = Object.freeze([...values]);
  }

  public add(step: WorkflowStep): WorkflowStepCollection {
    return new WorkflowStepCollection([...this.values, step]);
  }

  public toArray(): WorkflowStep[] {
    return [...this.values];
  }
}
