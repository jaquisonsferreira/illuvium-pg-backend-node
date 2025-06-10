import { Kysely, sql } from 'kysely';
import { Database } from '../../database.types';

/**
 * Migration to create the asset_marketplace table
 * @param db Instance of Kysely connected to the database
 */
export async function createAssetMarketplaceTable(
  db: Kysely<Database>,
): Promise<void> {
  try {
    // Check if the asset_marketplace table exists
    const tableExists = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_name = 'asset_marketplace' AND table_schema = 'public'
    `.execute(db);

    // If the table does not exist, create it
    if (tableExists.rows.length === 0) {
      console.log('Creating asset_marketplace table...');

      // Create the table
      await sql`
        CREATE TABLE asset_marketplace (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          asset_id UUID NOT NULL REFERENCES blockchain_assets(id) ON DELETE CASCADE,
          listing_type VARCHAR NOT NULL CHECK (listing_type IN ('SALE', 'BID')),
          price VARCHAR NOT NULL,
          currency_contract UUID NULL REFERENCES blockchain_contracts(id) ON DELETE SET NULL,
          seller_address VARCHAR NOT NULL,
          buyer_address VARCHAR NULL,
          status VARCHAR NOT NULL CHECK (status IN ('ACTIVE', 'COMPLETED', 'CANCELLED', 'EXPIRED')) DEFAULT 'ACTIVE',
          expires_at TIMESTAMP NULL,
          created_at TIMESTAMP NOT NULL DEFAULT now(),
          updated_at TIMESTAMP NOT NULL DEFAULT now()
        )
      `.execute(db);

      // Create indexes
      await sql`
        CREATE INDEX asset_marketplace_asset_idx ON asset_marketplace (asset_id)
      `.execute(db);

      await sql`
        CREATE INDEX asset_marketplace_listing_type_idx ON asset_marketplace (listing_type)
      `.execute(db);

      await sql`
        CREATE INDEX asset_marketplace_status_idx ON asset_marketplace (status)
      `.execute(db);

      await sql`
        CREATE INDEX asset_marketplace_seller_idx ON asset_marketplace (seller_address)
      `.execute(db);

      await sql`
        CREATE INDEX asset_marketplace_buyer_idx ON asset_marketplace (buyer_address)
      `.execute(db);

      await sql`
        CREATE INDEX asset_marketplace_active_sales_idx ON asset_marketplace (asset_id, status)
        WHERE listing_type = 'SALE' AND status = 'ACTIVE'
      `.execute(db);

      await sql`
        CREATE INDEX asset_marketplace_active_bids_idx ON asset_marketplace (asset_id, status)
        WHERE listing_type = 'BID' AND status = 'ACTIVE'
      `.execute(db);

      await sql`
        CREATE INDEX asset_marketplace_expires_idx ON asset_marketplace (expires_at)
        WHERE expires_at IS NOT NULL
      `.execute(db);

      console.log('Asset marketplace table created successfully');
      return;
    }

    console.log('Asset marketplace table already exists');
  } catch (error) {
    console.error('Error creating asset_marketplace table:', error);
    throw error;
  }
}
