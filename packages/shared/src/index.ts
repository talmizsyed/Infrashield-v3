import http from 'node:http';

export const createHealthServer = () => {
  return http.createServer((req, res) => {
    if (!req?.url) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'bad request' }));
      return;
    }

    const healthy = ['/health', '/ready', '/live'].includes(req.url);
    if (healthy) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
  });
};
