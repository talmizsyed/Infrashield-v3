/**
 * Returns the current unix timestamp in milliseconds.
 */
export const now = (): number => Date.now();

/**
 * Converts seconds to milliseconds.
 */
export const secondsToMs = (seconds: number): number => Math.round(seconds * 1000);

/**
 * Creates a human-readable duration string for milliseconds.
 */
export const formatMs = (milliseconds: number): string => `${milliseconds}ms`;
