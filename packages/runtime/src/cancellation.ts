/**
 * Cancellation error raised when a token has been aborted.
 */
export class CancellationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'CancellationError';
  }
}

/**
 * Runtime cancellation token contract.
 */
export interface CancellationToken {
  readonly isCancellationRequested: boolean;
  readonly reason?: string;
  readonly signal: AbortSignal;
  throwIfCancellationRequested(): void;
  onCancellationRequested(listener: (reason?: string) => void | Promise<void>): () => void;
}

/**
 * Handle returned by the cancellation manager.
 */
export interface CancellationHandle {
  readonly token: CancellationToken;
  readonly controller: AbortController;
  cancel(reason?: string): void;
  dispose(): void;
}

class ManagedCancellationToken implements CancellationToken {
  private readonly listeners = new Set<(reason?: string) => void | Promise<void>>();
  private cancelled = false;
  private cancelReason?: string;

  public readonly signal: AbortSignal;

  public constructor(private readonly controller: AbortController) {
    this.signal = controller.signal;
  }

  public get isCancellationRequested(): boolean {
    return this.cancelled || this.signal.aborted;
  }

  public get reason(): string | undefined {
    return (
      this.cancelReason ?? (typeof this.signal.reason === 'string' ? this.signal.reason : undefined)
    );
  }

  public cancel(reason?: string): void {
    if (this.isCancellationRequested) {
      return;
    }

    this.cancelled = true;
    this.cancelReason = reason;
    this.controller.abort(reason);
    void Promise.all([...this.listeners].map(async (listener) => listener(reason)));
  }

  public throwIfCancellationRequested(): void {
    if (this.isCancellationRequested) {
      throw new CancellationError(this.reason ?? 'Operation cancelled');
    }
  }

  public onCancellationRequested(listener: (reason?: string) => void | Promise<void>): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

/**
 * Creates and manages cancellation tokens for runtime operations.
 */
export class CancellationManager {
  public create(options?: {
    readonly timeoutMs?: number;
    readonly signal?: AbortSignal;
  }): CancellationHandle {
    const controller = new AbortController();
    const token = new ManagedCancellationToken(controller);

    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    let detachExternal: (() => void) | undefined;

    if (options?.signal) {
      const externalSignal = options.signal;
      const onAbort = (): void => {
        token.cancel(typeof externalSignal.reason === 'string' ? externalSignal.reason : 'aborted');
      };

      if (externalSignal.aborted) {
        onAbort();
      } else {
        externalSignal.addEventListener('abort', onAbort, { once: true });
        detachExternal = () => externalSignal.removeEventListener('abort', onAbort);
      }
    }

    if (typeof options?.timeoutMs === 'number' && options.timeoutMs > 0) {
      timeoutHandle = setTimeout(() => token.cancel('timeout'), options.timeoutMs);
    }

    return {
      token,
      controller,
      cancel(reason?: string): void {
        token.cancel(reason);
      },
      dispose(): void {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }

        if (detachExternal) {
          detachExternal();
        }
      },
    };
  }
}
