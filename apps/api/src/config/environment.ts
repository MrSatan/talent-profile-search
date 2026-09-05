import { resolve } from 'node:path';

export interface Environment {
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  DATABASE_URL: string;
  ELASTICSEARCH_NODE: string;
  ELASTICSEARCH_USERNAME: string;
  ELASTICSEARCH_PASSWORD: string;
  ELASTICSEARCH_INDEX_ALIAS: string;
  WEB_ORIGIN: string;
  DATASET_PATH: string;
}

export function validateEnvironment(
  input: Record<string, unknown>,
): Environment {
  const nodeEnvironment = optionalString(input.NODE_ENV, 'development');
  if (!['development', 'production', 'test'].includes(nodeEnvironment)) {
    throw new Error('NODE_ENV must be development, production, or test.');
  }

  const port = Number(optionalString(input.PORT, '3000'));
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  const databaseUrl = optionalString(
    input.DATABASE_URL,
    'postgresql://profiles:profiles@localhost:55432/profiles',
  );
  validateUrl(databaseUrl, ['postgres:', 'postgresql:'], 'DATABASE_URL');

  const elasticsearchNode = optionalString(
    input.ELASTICSEARCH_NODE,
    'http://localhost:9200',
  );
  validateUrl(elasticsearchNode, ['http:', 'https:'], 'ELASTICSEARCH_NODE');

  const username = optionalString(input.ELASTICSEARCH_USERNAME, '');
  const password = optionalString(input.ELASTICSEARCH_PASSWORD, '');
  if (Boolean(username) !== Boolean(password)) {
    throw new Error(
      'ELASTICSEARCH_USERNAME and ELASTICSEARCH_PASSWORD must be set together.',
    );
  }

  const webOrigin = optionalString(input.WEB_ORIGIN, 'http://localhost:5173');
  validateUrl(webOrigin, ['http:', 'https:'], 'WEB_ORIGIN');

  const alias = optionalString(
    input.ELASTICSEARCH_INDEX_ALIAS,
    'profiles-read',
  );
  if (!/^[a-z0-9][a-z0-9_-]{1,126}$/u.test(alias)) {
    throw new Error('ELASTICSEARCH_INDEX_ALIAS has an invalid format.');
  }

  return {
    NODE_ENV: nodeEnvironment as Environment['NODE_ENV'],
    PORT: port,
    DATABASE_URL: databaseUrl,
    ELASTICSEARCH_NODE: elasticsearchNode,
    ELASTICSEARCH_USERNAME: username,
    ELASTICSEARCH_PASSWORD: password,
    ELASTICSEARCH_INDEX_ALIAS: alias,
    WEB_ORIGIN: webOrigin,
    DATASET_PATH: optionalString(
      input.DATASET_PATH,
      resolve(__dirname, '../../../../data/raw/300 user linkedin.txt'),
    ),
  };
}

function optionalString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function validateUrl(value: string, protocols: string[], name: string): void {
  try {
    const url = new URL(value);
    if (!protocols.includes(url.protocol)) {
      throw new Error('Unsupported protocol');
    }
  } catch {
    throw new Error(`${name} must be a valid URL.`);
  }
}
