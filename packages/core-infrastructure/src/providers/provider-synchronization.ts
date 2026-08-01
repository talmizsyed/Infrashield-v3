import type { SerializableObject } from '../primitives';

export class ProviderSynchronization {
  private _lastDurationMs = 0;
  private _inventorySize = 0;
  private _lastSynchronizedAt?: string;

  public constructor(public readonly providerId: string) {}

  public async synchronize(options: {
    readonly durationMs?: number;
    readonly inventorySize?: number;
  }): Promise<void> {
    this._lastDurationMs = options.durationMs ?? 0;
    this._inventorySize = options.inventorySize ?? 0;
    this._lastSynchronizedAt = new Date().toISOString();
  }

  public get lastDurationMs(): number {
    return this._lastDurationMs;
  }

  public get inventorySize(): number {
    return this._inventorySize;
  }

  public get lastSynchronizedAt(): string | undefined {
    return this._lastSynchronizedAt;
  }

  public snapshot(): SerializableObject {
    return Object.freeze({
      providerId: this.providerId,
      lastDurationMs: this._lastDurationMs,
      inventorySize: this._inventorySize,
      lastSynchronizedAt: this._lastSynchronizedAt ?? null,
    });
  }
}
