import type { SerializableObject, TimestampString } from '../primitives';
import { toTimestampString } from '../primitives';
import type { ProviderHealth } from './provider-health';
import type { ProviderLifecycle } from './provider-lifecycle';
import type { ProviderSynchronization } from './provider-synchronization';

export const ProviderLifecycleState = {
  Installed: 'installed',
  Registered: 'registered',
  Initializing: 'initializing',
  Running: 'running',
  Paused: 'paused',
  Stopping: 'stopping',
  Stopped: 'stopped',
  Restarting: 'restarting',
  Upgrading: 'upgrading',
  Unregistered: 'unregistered',
} as const;

export type ProviderLifecycleStateValue =
  (typeof ProviderLifecycleState)[keyof typeof ProviderLifecycleState];

export interface IProvider {
  readonly metadata: ProviderMetadata;
  readonly capabilities: ProviderCapabilities;
  readonly version: ProviderVersion;
  readonly configuration: ProviderConfiguration;
  readonly lifecycle: ProviderLifecycle;
  readonly health: ProviderHealth;
  readonly synchronization: ProviderSynchronization;
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  snapshot(): ProviderSnapshot;
}

export interface IProviderHost {
  register(provider: IProvider): Promise<void>;
  unregister(providerId: string): Promise<void>;
  get(providerId: string): IProvider | undefined;
  list(): readonly IProvider[];
}

export interface IProviderFactory {
  create<TProvider extends IProvider>(descriptor: ProviderMetadata): Promise<TProvider>;
  registerProvider(provider: IProvider): Promise<void>;
}

export interface IProviderRegistry {
  register(provider: IProvider): Promise<void>;
  unregister(providerId: string): Promise<void>;
  get(providerId: string): IProvider | undefined;
  list(): readonly IProvider[];
}

export interface IProviderScheduler {
  schedule(job: ProviderJob, options?: ProviderScheduleOptions): void;
  next(): ProviderJob | undefined;
  complete(jobId: string): void;
}

export interface IProviderDiscovery {
  discover(providerId: string, options?: ProviderDiscoveryOptions): Promise<void>;
}

export interface IProviderInventory {
  refresh(providerId: string): Promise<void>;
}

export interface IProviderHealth {
  check(providerId: string): Promise<void>;
}

export interface IProviderSynchronization {
  synchronize(providerId: string): Promise<void>;
}

export interface ProviderScheduleOptions {
  readonly priority?: number;
  readonly cron?: string;
  readonly intervalMs?: number;
  readonly eventDriven?: boolean;
  readonly onDemand?: boolean;
}

export interface ProviderDiscoveryOptions {
  readonly kind?: 'manual' | 'scheduled' | 'incremental' | 'full' | 'continuous';
  readonly force?: boolean;
}

export interface ProviderDeploymentOptions {
  readonly providerId: string;
}

export interface ProviderJob {
  readonly id: string;
  readonly providerId: string;
  readonly createdAt: TimestampString;
  readonly kind: string;
  readonly priority: number;
  execute(): Promise<void>;
}

export class ProviderVersion {
  public constructor(
    public readonly major: number,
    public readonly minor: number,
    public readonly patch: number,
  ) {}

  public toString(): string {
    return `${this.major}.${this.minor}.${this.patch}`;
  }
}

export class ProviderMetadata {
  public constructor(
    public readonly options: {
      readonly id: string;
      readonly name: string;
      readonly kind: string;
      readonly version?: ProviderVersion;
      readonly description?: string;
      readonly tags?: readonly string[];
      readonly tenantId?: string;
      readonly metadata?: SerializableObject;
    },
  ) {}

  public get id(): string {
    return this.options.id;
  }

  public get name(): string {
    return this.options.name;
  }

  public get kind(): string {
    return this.options.kind;
  }

  public get version(): ProviderVersion | undefined {
    return this.options.version;
  }
}

export class ProviderCapabilities {
  private readonly values = new Set<string>();

  public constructor(options: {
    readonly inventory?: boolean;
    readonly topology?: boolean;
    readonly metrics?: boolean;
    readonly events?: boolean;
    readonly configuration?: boolean;
    readonly snapshots?: boolean;
    readonly health?: boolean;
    readonly automation?: boolean;
    readonly readOnly?: boolean;
    readonly readWrite?: boolean;
  }) {
    if (options.inventory) {
      this.values.add('inventory');
    }
    if (options.topology) {
      this.values.add('topology');
    }
    if (options.metrics) {
      this.values.add('metrics');
    }
    if (options.events) {
      this.values.add('events');
    }
    if (options.configuration) {
      this.values.add('configuration');
    }
    if (options.snapshots) {
      this.values.add('snapshots');
    }
    if (options.health) {
      this.values.add('health');
    }
    if (options.automation) {
      this.values.add('automation');
    }
    if (options.readOnly) {
      this.values.add('read-only');
    }
    if (options.readWrite) {
      this.values.add('read-write');
    }
  }

  public supports(capability: string): boolean {
    return this.values.has(capability);
  }

  public list(): readonly string[] {
    return [...this.values];
  }
}

export class ProviderConfiguration {
  public constructor(
    public readonly options: {
      readonly tenantId?: string;
      readonly settings?: SerializableObject;
      readonly credentialRefs?: readonly ProviderSecretsReference[];
      readonly certificates?: readonly string[];
      readonly allowInsecure?: boolean;
    },
  ) {}

  public snapshot(): SerializableObject {
    const settings = this.options.settings ? { ...this.options.settings } : undefined;
    const entries: Record<string, unknown> = {
      tenantId: this.options.tenantId ?? null,
      credentialRefs: this.options.credentialRefs ? [...this.options.credentialRefs] : [],
      certificates: this.options.certificates ? [...this.options.certificates] : [],
      allowInsecure: this.options.allowInsecure ?? false,
    };
    if (settings) {
      entries.settings = settings;
    }
    return Object.freeze(entries as SerializableObject);
  }
}

export class ProviderSecretsReference {
  public constructor(
    public readonly name: string,
    public readonly namespace: string,
    public readonly key: string,
  ) {}
}

export class ProviderSnapshot {
  public constructor(
    public readonly metadata: ProviderMetadata,
    public readonly lifecycleState: ProviderLifecycleStateValue,
    public readonly health: ProviderHealth,
    public readonly synchronization: ProviderSynchronization,
    public readonly timestamp: TimestampString = toTimestampString(new Date().toISOString()),
  ) {}

  public get providerId(): string {
    return this.metadata.id;
  }

  public toJSON(): SerializableObject {
    const snapshot = {
      providerId: this.providerId,
      lifecycleState: this.lifecycleState,
      availability: this.health.availability,
      inventorySize: this.synchronization.inventorySize,
      timestamp: this.timestamp,
    };
    return new Proxy(snapshot, {
      set(): boolean {
        return true;
      },
    }) as SerializableObject;
  }
}

export class ProviderAudit {
  public constructor(
    public readonly providerId: string,
    public readonly action: string,
    public readonly timestamp: TimestampString = toTimestampString(new Date().toISOString()),
  ) {}
}
