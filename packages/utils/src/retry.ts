/**
 * Retry options for asynchronous operations.
 */
export type RetryOptions = {
  attempts: number;
  delayMs?: number;
  factor?: number;
};

/**
 * Retries an asynchronous callback with configurable backoff.
 */
export const retry = async <T>(
  callback: () => Promise<T>,
  options: RetryOptions,
): Promise<T> => {
  const attempts = Math.max(1, options.attempts);
  const delayMs = options.delayMs ?? 100;
  const factor = options.factor ?? 2;
  let currentDelay = delayMs;

  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await callback();
    } catch (error) {
      lastError = error;
      if (attempt === attempts) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, currentDelay));
      currentDelay = Math.round(currentDelay * factor);
    }
  }

  throw lastError;
};
