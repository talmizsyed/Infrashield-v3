import { createHealthServer } from '@infrashield/shared';

const server = createHealthServer();
const port = Number(process.env.PORT || 3000);

server.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log('Service workflow-engine listening on port', port);
});
