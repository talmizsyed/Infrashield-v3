/**
 * Trims the provided string or returns an empty string for undefined values.
 */
export const trim = (value?: string): string => (value ?? '').trim();

/**
 * Returns true when the provided string is non-empty after trimming.
 */
export const isNonEmptyString = (value?: string): boolean => trim(value).length > 0;

/**
 * Normalizes whitespace to single spaces.
 */
export const normalizeWhitespace = (value: string): string => value.replace(/\s+/g, ' ').trim();
