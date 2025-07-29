import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import { Database } from './database.types';
import { EnvironmentConfigService } from '../../infrastructure/config';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const getTlsConfig = () => {
  const tlsPath = '/mnt/tls/cockroachdb-svc-backend-node';
  const caPath = join(tlsPath, 'ca.crt');
  const certPath = join(tlsPath, 'tls.crt');
  const keyPath = join(tlsPath, 'tls.key');

  if (existsSync(caPath) && existsSync(certPath) && existsSync(keyPath)) {
    return {
      ca: readFileSync(caPath, 'utf8'),
      cert: readFileSync(certPath, 'utf8'),
      key: readFileSync(keyPath, 'utf8'),
    };
  }
  return {};
};

/**
 * Creates a database connection using Kysely
 * @param config Environment configuration service
 * @returns Kysely instance connected to CockroachDB
 */
export const createDatabaseConnection = (
  config: EnvironmentConfigService,
): Kysely<Database> => {
  const dbConfig = config.getDatabaseConfig();

  return new Kysely<Database>({
    dialect: new PostgresDialect({
      pool: new Pool({
        host: dbConfig.host,
        database: dbConfig.database,
        user: dbConfig.user,
        password: dbConfig.password,
        port: dbConfig.port,
        ssl: dbConfig.ssl
          ? {
              rejectUnauthorized: true,
              ...getTlsConfig(),
            }
          : undefined,
        application_name: 'illuvium-api',
        max: 20,
        connectionTimeoutMillis: 3000,
        statement_timeout: 30000,
      }),
    }),
  });
};
