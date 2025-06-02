import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import { Database } from './database.types';
import { EnvironmentConfigService } from '../../infrastructure/config';

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
              // Defined as true to verify the SSL certificate CA
            }
          : undefined,
        // CockroachDB specific configurations
        application_name: 'illuvium-api',
        // Transaction retry parameters
        max: 20, // Maximum number of connections
        connectionTimeoutMillis: 3000,
        // CockroachDB recommends these configurations for better performance
        // https://www.cockroachlabs.com/docs/stable/connection-pooling.html
        statement_timeout: 30000, // timeout for query execution (30s)
      }),
    }),
  });
};
