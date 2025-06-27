import { Kysely, sql } from 'kysely';
import { Database } from '../../database.types';

/**
 * Migration to create the webhook_subscriptions table
 * @param db Instance of Kysely connected to the database
 */
export async function createWebhookSubscriptionsTable(
  db: Kysely<Database>,
): Promise<void> {
  try {
    // Check if the webhook_subscriptions table exists
    const tableExists = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_name = 'webhook_subscriptions' AND table_schema = 'public'
    `.execute(db);

    // If the table does not exist, create it
    if (tableExists.rows.length === 0) {
      console.log('Creating webhook_subscriptions table...');

      // Create the webhook_subscriptions table
      await sql`
        CREATE TABLE webhook_subscriptions (
          id VARCHAR PRIMARY KEY,
          developer_id VARCHAR NOT NULL,
          svix_application_id VARCHAR NOT NULL,
          svix_endpoint_id VARCHAR NOT NULL,
          url VARCHAR NOT NULL,
          event_types JSONB NOT NULL DEFAULT '[]'::jsonb,
          status VARCHAR NOT NULL DEFAULT 'ACTIVE',
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )
      `.execute(db);

      // Create indexes for better performance
      await sql`
        CREATE INDEX idx_webhook_subscriptions_developer_id 
        ON webhook_subscriptions(developer_id)
      `.execute(db);

      await sql`
        CREATE INDEX idx_webhook_subscriptions_status 
        ON webhook_subscriptions(status)
      `.execute(db);

      await sql`
        CREATE INDEX idx_webhook_subscriptions_event_types 
        ON webhook_subscriptions USING GIN(event_types)
      `.execute(db);

      console.log('webhook_subscriptions table created successfully');
    } else {
      console.log('webhook_subscriptions table already exists, skipping creation');
    }
  } catch (error) {
    console.error('Error creating webhook_subscriptions table:', error);
    throw error;
  }
}
