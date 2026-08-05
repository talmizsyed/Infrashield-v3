export class RetryPolicy {
  public readonly maxAttempts: number;
  public readonly delayMs: number;
  public readonly timeoutMs: number;

  public constructor(
    options: {
      readonly maxAttempts?: number;
      readonly delayMs?: number;
      readonly timeoutMs?: number;
    } = {},
  ) {
    this.maxAttempts = Math.max(1, options.maxAttempts ?? 1);
    this.delayMs = Math.max(0, options.delayMs ?? 0);
    this.timeoutMs = Math.max(0, options.timeoutMs ?? 0);
  }

  public canRetry(attempt: number): boolean {
    return attempt < this.maxAttempts;
  }

  public getDelayMs(): number {
    return this.delayMs;
  }

  public getTimeoutMs(): number {
    return this.timeoutMs;
  }
}
