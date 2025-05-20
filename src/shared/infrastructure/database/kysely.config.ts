import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import { Database } from './database.types';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Configuration to connect to CockroachDB using Kysely.
 * The CockroachDB is compatible with PostgreSQL, so we use the PostgresDialect.
 */
const db = new Kysely<Database>({
  dialect: new PostgresDialect({
    pool: new Pool({
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_NAME || 'defaultdb',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      port: parseInt(process.env.DB_PORT || '26257', 10),
      ssl:
        process.env.DB_SSL === 'true'
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

export default db;
