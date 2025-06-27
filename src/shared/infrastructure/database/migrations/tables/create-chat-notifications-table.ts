import { Kysely, sql } from 'kysely';
import { Database } from '../../database.types';

export async function createChatNotificationsTable(db: Kysely<Database>) {
  await db.schema
    .createTable('chat_notifications')
    .ifNotExists()
    .addColumn('id', 'varchar(255)', (col) => col.primaryKey())
    .addColumn('user_id', 'varchar(255)', (col) => col.notNull())
    .addColumn('title', 'varchar(255)', (col) => col.notNull())
    .addColumn('message', 'text', (col) => col.notNull())
    .addColumn(
      'type',
      sql`varchar(50) CHECK (type IN ('system', 'chat', 'mention', 'friend_request', 'guild_invite'))`,
      (col) => col.notNull(),
    )
    .addColumn('is_read', 'boolean', (col) => col.defaultTo(false).notNull())
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
      .createIndex('idx_chat_notifications_user_id')
      .ifNotExists()
      .on('chat_notifications')
      .column('user_id')
      .execute();
  } catch {
    console.log('idx_chat_notifications_user_id already exists, skipping...');
  }

  try {
    await db.schema
      .createIndex('idx_chat_notifications_is_read')
      .ifNotExists()
      .on('chat_notifications')
      .column('is_read')
      .execute();
  } catch {
    console.log('idx_chat_notifications_is_read already exists, skipping...');
  }

  try {
    await db.schema
      .createIndex('idx_chat_notifications_type')
      .ifNotExists()
      .on('chat_notifications')
      .column('type')
      .execute();
  } catch {
    console.log('idx_chat_notifications_type already exists, skipping...');
  }

  try {
    await db.schema
      .createIndex('idx_chat_notifications_created_at')
      .ifNotExists()
      .on('chat_notifications')
      .column('created_at')
      .execute();
  } catch {
    console.log('idx_chat_notifications_created_at already exists, skipping...');
  }

  // Composite index for user notifications
  try {
    await db.schema
      .createIndex('idx_chat_notifications_user_read_created')
      .ifNotExists()
      .on('chat_notifications')
      .columns(['user_id', 'is_read', 'created_at'])
      .execute();
  } catch {
    console.log('idx_chat_notifications_user_read_created already exists, skipping...');
  }

  console.log('✅ Chat notifications table created successfully');
}
