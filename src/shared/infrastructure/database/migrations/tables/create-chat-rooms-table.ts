import { Kysely, sql } from 'kysely';
import { Database } from '../../database.types';

export async function createChatRoomsTable(db: Kysely<Database>) {
  await db.schema
    .createTable('chat_rooms')
    .ifNotExists()
    .addColumn('id', 'varchar(255)', (col) => col.primaryKey())
    .addColumn('name', 'varchar(255)', (col) => col.notNull())
    .addColumn(
      'type',
      sql`varchar(50) CHECK (type IN ('direct', 'group', 'guild'))`,
      (col) => col.notNull(),
    )
    .addColumn('description', 'text')
    .addColumn('is_active', 'boolean', (col) => col.defaultTo(true).notNull())
    .addColumn('created_by', 'varchar(255)', (col) => col.notNull())
    .addColumn('created_at', 'timestamp', (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addColumn('updated_at', 'timestamp', (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addColumn('metadata', 'jsonb')
    .execute();

  // Create indexes only if they don't exist
  try {
    await db.schema
      .createIndex('idx_chat_rooms_type')
      .ifNotExists()
      .on('chat_rooms')
      .column('type')
      .execute();
  } catch {
    // Index might already exist, ignore error
    console.log('idx_chat_rooms_type already exists, skipping...');
  }

  try {
    await db.schema
      .createIndex('idx_chat_rooms_created_by')
      .ifNotExists()
      .on('chat_rooms')
      .column('created_by')
      .execute();
  } catch {
    // Index might already exist, ignore error
    console.log('idx_chat_rooms_created_by already exists, skipping...');
  }

  try {
    await db.schema
      .createIndex('idx_chat_rooms_is_active')
      .ifNotExists()
      .on('chat_rooms')
      .column('is_active')
      .execute();
  } catch {
    // Index might already exist, ignore error
    console.log('idx_chat_rooms_is_active already exists, skipping...');
  }

  console.log('✅ Chat rooms table created successfully');
}
