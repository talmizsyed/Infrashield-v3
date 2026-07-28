/**
 * Generic dictionary with string keys.
 */
export type Dictionary<T = unknown> = Record<string, T>;

/**
 * A value that may be null or undefined.
 */
export type Nullable<T> = T | null | undefined;

/**
 * A universally unique identifier.
 */
export type UUID = string;
