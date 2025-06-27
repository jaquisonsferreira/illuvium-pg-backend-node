import { Kysely, sql } from 'kysely';
import { Database } from '../../database.types';

export async function createChatMessagesTable(db: Kysely<Database>) {
  await db.schema
    .createTable('chat_messages')
    .ifNotExists()
    .addColumn('id', 'varchar(255)', (col) => col.primaryKey())
    .addColumn('room_id', 'varchar(255)', (col) => col.notNull())
    .addColumn('sender_id', 'varchar(255)', (col) => col.notNull())
    .addColumn('content', 'text', (col) => col.notNull())
    .addColumn(
      'type',
      sql`varchar(50) CHECK (type IN ('text', 'image', 'file', 'system'))`,
      (col) => col.notNull(),
    )
    .addColumn('reply_to_id', 'varchar(255)')
    .addColumn('edited_at', 'timestamp')
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
      .createIndex('idx_chat_messages_room_id')
      .ifNotExists()
      .on('chat_messages')
      .column('room_id')
      .execute();
  } catch {
    console.log('idx_chat_messages_room_id already exists, skipping...');
  }

  try {
    await db.schema
      .createIndex('idx_chat_messages_sender_id')
      .ifNotExists()
      .on('chat_messages')
      .column('sender_id')
      .execute();
  } catch {
    console.log('idx_chat_messages_sender_id already exists, skipping...');
  }

  try {
    await db.schema
      .createIndex('idx_chat_messages_created_at')
      .ifNotExists()
      .on('chat_messages')
      .column('created_at')
      .execute();
  } catch {
    console.log('idx_chat_messages_created_at already exists, skipping...');
  }

  try {
    await db.schema
      .createIndex('idx_chat_messages_type')
      .ifNotExists()
      .on('chat_messages')
      .column('type')
      .execute();
  } catch {
    console.log('idx_chat_messages_type already exists, skipping...');
  }

  try {
    await db.schema
      .createIndex('idx_chat_messages_reply_to_id')
      .ifNotExists()
      .on('chat_messages')
      .column('reply_to_id')
      .execute();
  } catch {
    console.log('idx_chat_messages_reply_to_id already exists, skipping...');
  }

  console.log('✅ Chat messages table created successfully');
}
