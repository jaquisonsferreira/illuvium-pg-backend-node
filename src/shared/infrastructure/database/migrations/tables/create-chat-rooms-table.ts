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

  // Create indexes
  await db.schema
    .createIndex('idx_chat_rooms_type')
    .on('chat_rooms')
    .column('type')
    .execute();

  await db.schema
    .createIndex('idx_chat_rooms_created_by')
    .on('chat_rooms')
    .column('created_by')
    .execute();

  await db.schema
    .createIndex('idx_chat_rooms_is_active')
    .on('chat_rooms')
    .column('is_active')
    .execute();

  console.log('✅ Chat rooms table created successfully');
}
