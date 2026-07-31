import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mergeConfig } from 'vitest/config';
import baseConfig from '../../vitest.config';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default mergeConfig(baseConfig, {
  resolve: {
    alias: [
      {
        find: /^@infrashield\/([^/]+)(\/.*)?$/,
        replacement: path.resolve(rootDir, '../../packages/$1/src$2'),
      },
      {
        find: /^@agentic\/([^/]+)(\/.*)?$/,
        replacement: path.resolve(rootDir, '../../packages/$1/src$2'),
      },
    ],
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
