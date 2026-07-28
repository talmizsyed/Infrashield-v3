import http from 'node:http';
import { HEALTH_ENDPOINTS, DEFAULT_PORT } from './constants';

/**
 * Returns true when the provided path is a health check endpoint.
 */
export const isHealthEndpoint = (path?: string): boolean =>
  typeof path === 'string' && HEALTH_ENDPOINTS.includes(path as HealthEndpoint);

/**
 * Creates a reusable health check HTTP server.
 */
export const createHealthServer = (): http.Server =>
  http.createServer((req, res) => {
    if (!req?.url) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'bad request' }));
      return;
    }

    if (isHealthEndpoint(req.url)) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
  });

/**
 * Returns the default port if the environment does not define PORT.
 */
export const getDefaultPort = (): number => DEFAULT_PORT;
