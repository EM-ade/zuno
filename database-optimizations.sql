-- Critical Database Indexes for Performance
-- Run these to dramatically improve query performance

-- Collections table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_collections_status ON collections(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_collections_creator_wallet ON collections(creator_wallet);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_collections_created_at ON collections(created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_collections_status_created_at ON collections(status, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_collections_minted_total ON collections(minted_count, total_supply);

-- Items table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_items_collection_id ON items(collection_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_items_collection_address ON items(collection_address);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_items_minted ON items(minted);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_items_collection_minted ON items(collection_id, minted);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_items_owner_wallet ON items(owner_wallet);

-- Mint phases indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mint_phases_collection_id ON mint_phases(collection_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mint_phases_times ON mint_phases(start_time, end_time);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mint_phases_active ON mint_phases(collection_id, start_time, end_time);

-- Mint transactions indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mint_transactions_collection_id ON mint_transactions(collection_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mint_transactions_buyer ON mint_transactions(buyer_wallet);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mint_transactions_status ON mint_transactions(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mint_transactions_created_at ON mint_transactions(created_at DESC);

-- Composite indexes for common queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_collections_status_supply_created ON collections(status, total_supply, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_items_collection_minted_index ON items(collection_id, minted, item_index);

-- JSONB indexes for metadata queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_collections_metadata_gin ON collections USING GIN(metadata);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_items_attributes_gin ON items USING GIN(attributes);

-- Partial indexes for better performance on filtered queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_collections_active_status ON collections(created_at DESC) WHERE status IN ('active', 'live');
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_items_unminted ON items(collection_id, item_index) WHERE minted = false;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mint_transactions_pending ON mint_transactions(created_at DESC) WHERE status = 'pending';
