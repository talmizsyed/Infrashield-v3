import type { Identifier, SerializableValueObject, TimestampString } from '@infrashield/contracts';

import { ToolRegistryException } from '@infrashield/ai-tools';

import type { Provider, ProviderHealthStatus } from './provider-core.js';

export type ProviderState =
  'new' | 'initialized' | 'starting' | 'running' | 'suspended' | 'stopping' | 'stopped' | 'failed';

export type ProviderEventType =
  | 'initialized'
  | 'started'
  | 'stopped'
  | 'restarted'
  | 'suspended'
  | 'resumed'
  | 'health-updated'
  | 'recovery-attempted'
  | 'recovered'
  | 'failed';

export interface ProviderLifecycleEvent {
  readonly type: ProviderEventType;
  readonly providerId: Identifier;
  readonly state: ProviderState;
  readonly message?: string;
  readonly occurredAt: TimestampString;
}

type ProviderEventListener = (event: ProviderLifecycleEvent) => void;

export class ProviderEvents {
  private readonly listeners = new Map<ProviderEventType, Set<ProviderEventListener>>();

  public on(type: ProviderEventType, listener: ProviderEventListener): void {
    const listeners = this.listeners.get(type) ?? new Set<ProviderEventListener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  public off(type: ProviderEventType, listener: ProviderEventListener): void {
    this.listeners.get(type)?.delete(listener);
  }

  public emit(event: ProviderLifecycleEvent): void {
    this.listeners.get(event.type)?.forEach((listener) => listener(event));
  }
}

export class ProviderStateMachine {
  private stateValue: ProviderState;
  private updatedAtValue: TimestampString;

  public constructor(initialState: ProviderState = 'new') {
    this.stateValue = initialState;
    this.updatedAtValue = new Date().toISOString();
  }

  public get state(): ProviderState {
    return this.stateValue;
  }

  public get updatedAt(): TimestampString {
    return this.updatedAtValue;
  }

  public canTransition(next: ProviderState): boolean {
    const allowed: Readonly<Record<ProviderState, readonly ProviderState[]>> = {
      new: ['initialized', 'failed'],
      initialized: ['starting', 'stopping', 'stopped', 'failed'],
      starting: ['running', 'failed', 'stopping'],
      running: ['suspended', 'stopping', 'failed'],
      suspended: ['running', 'stopping', 'failed'],
      stopping: ['stopped', 'failed'],
      stopped: ['initialized', 'starting', 'failed'],
      failed: ['initialized', 'starting', 'stopping', 'stopped'],
    };

    return allowed[this.stateValue].includes(next);
  }

  public transition(next: ProviderState): void {
    if (!this.canTransition(next)) {
      throw new ToolRegistryException(
        `Invalid provider state transition from ${this.stateValue} to ${next}.`,
      );
    }

    this.stateValue = next;
    this.updatedAtValue = new Date().toISOString();
  }
}

export interface ProviderHealthSnapshot {
  readonly providerId: Identifier;
  readonly status: ProviderHealthStatus;
  readonly healthy: boolean;
  readonly checkedAt: TimestampString;
  readonly message?: string;
}

export class ProviderHealthMonitor {
  public constructor(
    private readonly healthCheck?: (
      provider: Provider,
    ) => ProviderHealthSnapshot | Promise<ProviderHealthSnapshot>,
  ) {}

  public async check(provider: Provider): Promise<ProviderHealthSnapshot> {
    if (this.healthCheck) {
      return this.healthCheck(provider);
    }

    const status = provider.getHealthStatus();
    return {
      providerId: provider.manifest.id,
      status,
      healthy: status === 'healthy',
      checkedAt: new Date().toISOString(),
    };
  }
}

export class ProviderStartup {
  public constructor(private readonly startup?: (provider: Provider) => void | Promise<void>) {}

  public async run(provider: Provider): Promise<void> {
    await this.startup?.(provider);
  }
}

export class ProviderShutdown {
  public constructor(private readonly shutdown?: (provider: Provider) => void | Promise<void>) {}

  public async run(provider: Provider): Promise<void> {
    await this.shutdown?.(provider);
  }
}

export interface ProviderRecoveryResult {
  readonly recovered: boolean;
  readonly attempts: number;
  readonly lastError?: string;
}

export class ProviderRecovery {
  public readonly maxAttempts: number;

  public constructor(
    options: {
      readonly maxAttempts?: number;
      readonly recover?: (provider: Provider, error?: unknown) => boolean | Promise<boolean>;
    } = {},
  ) {
    this.maxAttempts = options.maxAttempts ?? 1;
    this.recover = options.recover;
  }

  private readonly recover?: (provider: Provider, error?: unknown) => boolean | Promise<boolean>;

  public async run(provider: Provider, error?: unknown): Promise<ProviderRecoveryResult> {
    let lastError: unknown = error;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      try {
        const recovered = this.recover ? await this.recover(provider, lastError) : true;
        if (recovered) {
          return { recovered: true, attempts: attempt };
        }
      } catch (recoveryError) {
        lastError = recoveryError;
      }
    }

    return {
      recovered: false,
      attempts: this.maxAttempts,
      lastError: lastError instanceof Error ? lastError.message : String(lastError ?? 'unknown'),
    };
  }
}

export class ProviderLifecycleManager {
  private readonly stateMachines = new Map<Identifier, ProviderStateMachine>();
  private readonly health = new Map<Identifier, ProviderHealthSnapshot>();
  private readonly events: ProviderEvents;
  private readonly startup: ProviderStartup;
  private readonly shutdown: ProviderShutdown;
  private readonly recovery: ProviderRecovery;
  private readonly healthMonitor: ProviderHealthMonitor;

  public constructor(
    options: {
      readonly events?: ProviderEvents;
      readonly startup?: ProviderStartup;
      readonly shutdown?: ProviderShutdown;
      readonly recovery?: ProviderRecovery;
      readonly healthMonitor?: ProviderHealthMonitor;
    } = {},
  ) {
    this.events = options.events ?? new ProviderEvents();
    this.startup = options.startup ?? new ProviderStartup();
    this.shutdown = options.shutdown ?? new ProviderShutdown();
    this.recovery = options.recovery ?? new ProviderRecovery();
    this.healthMonitor = options.healthMonitor ?? new ProviderHealthMonitor();
  }

  public getState(providerId: Identifier): ProviderState {
    return this.getStateMachine(providerId).state;
  }

  public getHealth(providerId: Identifier): ProviderHealthSnapshot | undefined {
    return this.health.get(providerId);
  }

  public on(type: ProviderEventType, listener: ProviderEventListener): void {
    this.events.on(type, listener);
  }

  public off(type: ProviderEventType, listener: ProviderEventListener): void {
    this.events.off(type, listener);
  }

  public initialize<TConfiguration extends SerializableValueObject>(
    provider: Provider<TConfiguration>,
  ): ProviderState {
    const machine = this.getStateMachine(provider.manifest.id);
    if (machine.state !== 'initialized') {
      if (machine.state !== 'new' && machine.state !== 'stopped' && machine.state !== 'failed') {
        throw new ToolRegistryException(
          `Provider ${provider.manifest.id} cannot initialize from ${machine.state}.`,
        );
      }
      machine.transition('initialized');
      this.emit('initialized', provider.manifest.id, machine.state);
    }

    return machine.state;
  }

  public async start<TConfiguration extends SerializableValueObject>(
    provider: Provider<TConfiguration>,
  ): Promise<ProviderState> {
    const machine = this.getStateMachine(provider.manifest.id);
    if (machine.state === 'running') {
      return machine.state;
    }

    if (machine.state === 'new' || machine.state === 'stopped' || machine.state === 'failed') {
      this.initialize(provider);
    }

    machine.transition('starting');
    try {
      await this.startup.run(provider);
      machine.transition('running');
      this.emit('started', provider.manifest.id, machine.state);
      return machine.state;
    } catch (error) {
      machine.transition('failed');
      this.emit('failed', provider.manifest.id, machine.state, this.errorMessage(error));
      throw error;
    }
  }

  public async stop<TConfiguration extends SerializableValueObject>(
    provider: Provider<TConfiguration>,
  ): Promise<ProviderState> {
    const machine = this.getStateMachine(provider.manifest.id);
    if (machine.state === 'stopped') {
      return machine.state;
    }

    if (machine.state === 'new') {
      machine.transition('initialized');
    }

    machine.transition('stopping');
    try {
      await this.shutdown.run(provider);
      machine.transition('stopped');
      this.emit('stopped', provider.manifest.id, machine.state);
      return machine.state;
    } catch (error) {
      machine.transition('failed');
      this.emit('failed', provider.manifest.id, machine.state, this.errorMessage(error));
      throw error;
    }
  }

  public async restart<TConfiguration extends SerializableValueObject>(
    provider: Provider<TConfiguration>,
  ): Promise<ProviderState> {
    await this.stop(provider);
    const state = await this.start(provider);
    this.emit('restarted', provider.manifest.id, state);
    return state;
  }

  public suspend(providerId: Identifier): ProviderState {
    const machine = this.getStateMachine(providerId);
    machine.transition('suspended');
    this.emit('suspended', providerId, machine.state);
    return machine.state;
  }

  public resume(providerId: Identifier): ProviderState {
    const machine = this.getStateMachine(providerId);
    machine.transition('running');
    this.emit('resumed', providerId, machine.state);
    return machine.state;
  }

  public async monitorHealth<TConfiguration extends SerializableValueObject>(
    provider: Provider<TConfiguration>,
  ): Promise<ProviderHealthSnapshot> {
    const snapshot = await this.healthMonitor.check(provider);
    this.health.set(provider.manifest.id, snapshot);
    this.emit(
      'health-updated',
      provider.manifest.id,
      this.getStateMachine(provider.manifest.id).state,
      snapshot.status,
    );

    if (!snapshot.healthy) {
      const machine = this.getStateMachine(provider.manifest.id);
      if (machine.state === 'running' || machine.state === 'starting') {
        machine.transition('failed');
        this.emit(
          'failed',
          provider.manifest.id,
          machine.state,
          `Health check failed: ${snapshot.status}`,
        );
      }
    }

    return snapshot;
  }

  public async recover<TConfiguration extends SerializableValueObject>(
    provider: Provider<TConfiguration>,
    error?: unknown,
  ): Promise<ProviderRecoveryResult> {
    const machine = this.getStateMachine(provider.manifest.id);
    this.emit('recovery-attempted', provider.manifest.id, machine.state, this.errorMessage(error));

    const result = await this.recovery.run(provider, error);
    if (result.recovered) {
      if (
        machine.state === 'failed' ||
        machine.state === 'stopped' ||
        machine.state === 'initialized'
      ) {
        machine.transition('starting');
        machine.transition('running');
      } else if (machine.state !== 'running') {
        machine.transition('running');
      }
      this.emit('recovered', provider.manifest.id, machine.state);
      return result;
    }

    if (machine.state !== 'failed') {
      machine.transition('failed');
    }
    this.emit('failed', provider.manifest.id, machine.state, result.lastError);
    return result;
  }

  private getStateMachine(providerId: Identifier): ProviderStateMachine {
    const machine = this.stateMachines.get(providerId) ?? new ProviderStateMachine();
    this.stateMachines.set(providerId, machine);
    return machine;
  }

  private emit(
    type: ProviderEventType,
    providerId: Identifier,
    state: ProviderState,
    message?: string,
  ): void {
    this.events.emit({
      type,
      providerId,
      state,
      message,
      occurredAt: new Date().toISOString(),
    });
  }

  private errorMessage(error: unknown): string | undefined {
    if (!error) {
      return undefined;
    }

    return error instanceof Error ? error.message : String(error);
  }
}
