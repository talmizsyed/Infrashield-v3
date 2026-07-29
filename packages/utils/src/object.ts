/**
 * Returns a copy of the object without undefined values.
 */
export const compact = <T extends Record<string, unknown>>(obj: T): Partial<T> =>
  Object.entries(obj).reduce((result, [key, value]) => {
    if (value !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (result as any)[key] = value;
    }
    return result;
  }, {} as Partial<T>);

/**
 * Merges shallow objects into a new object.
 */
export const merge = <T extends Record<string, unknown>>(base: T, overrides: Partial<T>): T => ({
  ...base,
  ...overrides,
});
