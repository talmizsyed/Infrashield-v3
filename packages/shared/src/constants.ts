export const DEFAULT_PORT = 3000;
export const DEFAULT_LOG_LEVEL = 'info' as const;
export const CORRELATION_ID_HEADER = 'x-correlation-id' as const;

export const HEALTH_ENDPOINTS = ['/health', '/ready', '/live'] as const;
export type HealthEndpoint = (typeof HEALTH_ENDPOINTS)[number];
