/**
 * Wraps a promise and returns a tuple of [error, result].
 */
export const to = async <T>(promise: Promise<T>): Promise<[Error | null, T | null]> => {
  try {
    const result = await promise;
    return [null, result];
  } catch (error) {
    return [error instanceof Error ? error : new Error('Unknown error'), null];
  }
};
