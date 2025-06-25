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

  // Create indexes
  await db.schema
    .createIndex('idx_chat_notifications_user_id')
    .on('chat_notifications')
    .column('user_id')
    .execute();

  await db.schema
    .createIndex('idx_chat_notifications_is_read')
    .on('chat_notifications')
    .column('is_read')
    .execute();

  await db.schema
    .createIndex('idx_chat_notifications_type')
    .on('chat_notifications')
    .column('type')
    .execute();

  await db.schema
    .createIndex('idx_chat_notifications_created_at')
    .on('chat_notifications')
    .column('created_at')
    .execute();

  // Composite index for user notifications
  await db.schema
    .createIndex('idx_chat_notifications_user_read_created')
    .on('chat_notifications')
    .columns(['user_id', 'is_read', 'created_at'])
    .execute();

  console.log('✅ Chat notifications table created successfully');
}
