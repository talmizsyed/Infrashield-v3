import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@infrashield\/(provider-[^/]+)(\/.*)?$/,
        replacement: path.resolve(rootDir, 'providers/$1/src$2'),
      },
      {
        find: /^@infrashield\/([^/]+)(\/.*)?$/,
        replacement: path.resolve(rootDir, 'packages/$1/src$2'),
      },
    ],
  },
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
    globals: true,
  },
});
