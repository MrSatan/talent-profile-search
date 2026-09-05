import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const fixturePath = fileURLToPath(
  new URL('../../data/fixtures/profiles.synthetic.csv', import.meta.url),
);

export default defineConfig({
  test: {
    env: {
      NODE_ENV: 'test',
      DATABASE_URL:
        process.env.INTEGRATION_DATABASE_URL ??
        'postgresql://profiles:profiles@localhost:55432/profiles?schema=integration',
      ELASTICSEARCH_NODE:
        process.env.INTEGRATION_ELASTICSEARCH_NODE ?? 'http://localhost:9200',
      ELASTICSEARCH_USERNAME: '',
      ELASTICSEARCH_PASSWORD: '',
      ELASTICSEARCH_INDEX_ALIAS: 'profiles-integration-read',
      WEB_ORIGIN: 'http://localhost:5173',
      DATASET_PATH: fixturePath,
    },
    environment: 'node',
    fileParallelism: false,
    globals: true,
    include: ['test/**/*.integration-spec.ts'],
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
