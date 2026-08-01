import { EventBase } from '../event-bus/core';

export class ProviderRegisteredEvent extends EventBase<Record<string, unknown>> {
  public constructor(providerId: string) {
    super(
      { providerId },
      {
        source: 'core-infrastructure.provider',
        category: 'system',
        priority: 'normal',
        version: 1,
      },
    );
  }
}

export class ProviderStartedEvent extends EventBase<Record<string, unknown>> {
  public constructor(providerId: string) {
    super(
      { providerId },
      {
        source: 'core-infrastructure.provider',
        category: 'system',
        priority: 'normal',
        version: 1,
      },
    );
  }
}

export class ProviderStoppedEvent extends EventBase<Record<string, unknown>> {
  public constructor(providerId: string) {
    super(
      { providerId },
      {
        source: 'core-infrastructure.provider',
        category: 'system',
        priority: 'normal',
        version: 1,
      },
    );
  }
}

export class ProviderHealthChangedEvent extends EventBase<Record<string, unknown>> {
  public constructor(providerId: string, availability: number) {
    super(
      { providerId, availability },
      {
        source: 'core-infrastructure.provider',
        category: 'system',
        priority: 'normal',
        version: 1,
      },
    );
  }
}

export class DiscoveryStartedEvent extends EventBase<Record<string, unknown>> {
  public constructor(providerId: string) {
    super(
      { providerId },
      {
        source: 'core-infrastructure.provider',
        category: 'system',
        priority: 'normal',
        version: 1,
      },
    );
  }
}

export class DiscoveryCompletedEvent extends EventBase<Record<string, unknown>> {
  public constructor(providerId: string) {
    super(
      { providerId },
      {
        source: 'core-infrastructure.provider',
        category: 'system',
        priority: 'normal',
        version: 1,
      },
    );
  }
}

export class SynchronizationCompletedEvent extends EventBase<Record<string, unknown>> {
  public constructor(providerId: string, durationMs: number) {
    super(
      { providerId, durationMs },
      {
        source: 'core-infrastructure.provider',
        category: 'system',
        priority: 'normal',
        version: 1,
      },
    );
  }
}
