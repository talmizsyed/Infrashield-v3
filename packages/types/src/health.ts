/**
 * Health status values returned by platform services.
 */
export type HealthStatus = 'ok' | 'degraded' | 'down';

/**
 * Shared health check response format.
 */
export type HealthResponse = {
  status: HealthStatus;
  uptime: number;
  timestamp: string;
};
