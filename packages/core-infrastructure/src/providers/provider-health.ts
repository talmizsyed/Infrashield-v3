import { type SerializableObject, toTimestampString } from '../primitives';

export class ProviderHealth {
  private readonly history: Array<{
    readonly timestamp: string;
    readonly ok: boolean;
    readonly latencyMs: number;
  }> = [];
  private _successes = 0;
  private _failures = 0;
  private _latencyMs = 0;
  private _lastHeartbeatMs = 0;
  private _availability = 1;

  public constructor(public readonly providerId: string) {}

  public recordSuccess(latencyMs: number): void {
    this._successes += 1;
    this._latencyMs = latencyMs;
    this.history.push({ timestamp: new Date().toISOString(), ok: true, latencyMs });
    this.recomputeAvailability();
  }

  public recordFailure(_reason: string): void {
    this._failures += 1;
    this.history.push({ timestamp: new Date().toISOString(), ok: false, latencyMs: 0 });
    this.recomputeAvailability();
  }

  public recordHeartbeat(latencyMs: number): void {
    this._lastHeartbeatMs = latencyMs;
    this._latencyMs = latencyMs;
  }

  public get successRate(): number {
    const total = this._successes + this._failures;
    return total === 0 ? 0 : this._successes / total;
  }

  public get errorRate(): number {
    const total = this._successes + this._failures;
    return total === 0 ? 0 : this._failures / total;
  }

  public get availability(): number {
    return this._availability;
  }

  public get latencyMs(): number {
    return this._latencyMs;
  }

  public get heartbeatLatencyMs(): number {
    return this._lastHeartbeatMs;
  }

  public snapshot(): SerializableObject {
    return Object.freeze({
      providerId: this.providerId,
      successRate: this.successRate,
      errorRate: this.errorRate,
      availability: this.availability,
      latencyMs: this.latencyMs,
      heartbeatLatencyMs: this.heartbeatLatencyMs,
      timestamp: toTimestampString(new Date().toISOString()),
    });
  }

  private recomputeAvailability(): void {
    const total = this._successes + this._failures;
    this._availability = total === 0 ? 1 : this._successes / total;
  }
}
