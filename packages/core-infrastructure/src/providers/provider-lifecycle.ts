import { createError, ErrorSeverity } from '../errors';
import { ProviderLifecycleState, type ProviderLifecycleStateValue } from './provider-types';

export class ProviderLifecycle {
  private _state: ProviderLifecycleStateValue = ProviderLifecycleState.Installed;

  public constructor(public readonly providerId: string) {}

  public get state(): ProviderLifecycleStateValue {
    return this._state;
  }

  public async initialize(): Promise<void> {
    this._state = ProviderLifecycleState.Initializing;
    await Promise.resolve();
    this._state = ProviderLifecycleState.Registered;
  }

  public async start(): Promise<void> {
    if (this._state === ProviderLifecycleState.Running) {
      return;
    }
    this._state = ProviderLifecycleState.Running;
  }

  public async stop(): Promise<void> {
    if (
      this._state === ProviderLifecycleState.Stopped ||
      this._state === ProviderLifecycleState.Unregistered
    ) {
      return;
    }
    this._state = ProviderLifecycleState.Stopped;
  }

  public async pause(): Promise<void> {
    if (this._state === ProviderLifecycleState.Running) {
      this._state = ProviderLifecycleState.Paused;
    }
  }

  public async resume(): Promise<void> {
    if (this._state === ProviderLifecycleState.Paused) {
      this._state = ProviderLifecycleState.Running;
    }
  }

  public async restart(): Promise<void> {
    this._state = ProviderLifecycleState.Restarting;
    this._state = ProviderLifecycleState.Running;
  }

  public async upgrade(): Promise<void> {
    this._state = ProviderLifecycleState.Upgrading;
    this._state = ProviderLifecycleState.Running;
  }

  public async unregister(): Promise<void> {
    this._state = ProviderLifecycleState.Unregistered;
  }

  public async validate(): Promise<void> {
    if (this._state === ProviderLifecycleState.Unregistered) {
      throw createError({
        code: 'provider.lifecycle.unregistered',
        message: 'Provider has been unregistered.',
        severity: ErrorSeverity.Error,
      });
    }
  }
}
