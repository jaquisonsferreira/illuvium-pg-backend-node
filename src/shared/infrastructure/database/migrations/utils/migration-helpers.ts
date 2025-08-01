import { Kysely, sql } from 'kysely';

export async function tableExists(
  db: Kysely<any>,
  tableName: string,
): Promise<boolean> {
  try {
    const result = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_name = ${tableName} AND table_schema = 'public'
    `.execute(db);

    return result.rows.length > 0;
  } catch (error) {
    console.error(`Error checking if table ${tableName} exists:`, error);
    return false;
  }
}

export async function indexExists(
  db: Kysely<any>,
  indexName: string,
): Promise<boolean> {
  try {
    const result = await sql`
      SELECT indexname FROM pg_indexes
      WHERE indexname = ${indexName} AND schemaname = 'public'
    `.execute(db);

    return result.rows.length > 0;
  } catch (error) {
    console.error(`Error checking if index ${indexName} exists:`, error);
    return false;
  }
}

export async function constraintExists(
  db: Kysely<any>,
  constraintName: string,
): Promise<boolean> {
  try {
    const result = await sql`
      SELECT constraint_name FROM information_schema.table_constraints
      WHERE constraint_name = ${constraintName} AND table_schema = 'public'
    `.execute(db);

    return result.rows.length > 0;
  } catch (error) {
    console.error(
      `Error checking if constraint ${constraintName} exists:`,
      error,
    );
    return false;
  }
}
