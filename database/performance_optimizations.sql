-- Performance Optimizations for Zuno NFT Platform
-- Based on your actual schema
-- Run these SQL commands ONE BY ONE in your Supabase SQL editor

-- ============================================
-- 1. ADDITIONAL DATABASE INDEXES FOR FASTER QUERIES
-- ============================================

-- Collections table optimizations
CREATE INDEX IF NOT EXISTS idx_collections_status_created_at ON collections(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_collections_creator_status ON collections(creator_wallet, status);
CREATE INDEX IF NOT EXISTS idx_collections_name_search ON collections USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- Items table optimizations
CREATE INDEX IF NOT EXISTS idx_items_collection_minted ON items(collection_id, minted);
CREATE INDEX IF NOT EXISTS idx_items_minted_created ON items(minted, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_items_collection_address ON items(collection_address);
CREATE INDEX IF NOT EXISTS idx_items_owner_wallet ON items(owner_wallet);

-- Mint transactions optimizations
CREATE INDEX IF NOT EXISTS idx_mint_transactions_buyer_created ON mint_transactions(buyer_wallet, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mint_transactions_collection_status ON mint_transactions(collection_id, status);
CREATE INDEX IF NOT EXISTS idx_mint_transactions_signature ON mint_transactions(transaction_signature);

-- Mint phases optimizations
CREATE INDEX IF NOT EXISTS idx_mint_phases_time_range ON mint_phases(start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_mint_phases_collection_id ON mint_phases(collection_id);
CREATE INDEX IF NOT EXISTS idx_mint_phases_active ON mint_phases(collection_id) WHERE start_time <= NOW() AND (end_time IS NULL OR end_time > NOW());

-- Mint requests optimizations
CREATE INDEX IF NOT EXISTS idx_mint_requests_status_created ON mint_requests(status, created_at DESC);

-- ============================================
-- 2. ENHANCED MATERIALIZED VIEW FOR COMPLEX AGGREGATIONS
-- ============================================
-- Run this as a separate command

DROP MATERIALIZED VIEW IF EXISTS collection_stats_enhanced;
CREATE MATERIALIZED VIEW collection_stats_enhanced AS
SELECT
    c.id,
    c.collection_mint_address,
    c.candy_machine_id,
    c.name,
    c.symbol,
    c.description,
    c.image_uri,
    c.creator_wallet,
    c.price,
    c.total_supply,
    c.minted_count,
    c.status,
    c.created_at,
    c.updated_at,
    COALESCE(item_counts.total_items, 0) as items_count,
    COALESCE(item_counts.actual_minted, c.minted_count, 0) as actual_minted_count,
    COALESCE(mint_stats.total_volume, 0) as volume,
    COALESCE(mint_stats.floor_price, 0) as floor_price,
    COALESCE(mint_stats.unique_holders, 0) as unique_holders,
    CASE
        WHEN COALESCE(item_counts.actual_minted, c.minted_count, 0) >= c.total_supply THEN 'sold_out'
        WHEN c.status = 'active' THEN 'live'
        WHEN c.status = 'draft' THEN 'upcoming'
        ELSE c.status
    END as computed_status,
    -- Progress percentage
    CASE
        WHEN c.total_supply > 0 THEN
            ROUND((COALESCE(item_counts.actual_minted, c.minted_count, 0)::DECIMAL / c.total_supply::DECIMAL) * 100, 2)
        ELSE 0
    END as progress_percentage
FROM collections c
LEFT JOIN (
    SELECT
        collection_id,
        COUNT(*) as total_items,
        COUNT(*) FILTER (WHERE minted = true) as actual_minted
    FROM items
    GROUP BY collection_id
) item_counts ON c.id = item_counts.collection_id
LEFT JOIN (
    SELECT
        collection_id,
        SUM(total_paid) as total_volume,
        MIN(total_paid) as floor_price,
        COUNT(DISTINCT buyer_wallet) as unique_holders
    FROM mint_transactions
    WHERE status = 'completed'
    GROUP BY collection_id
) mint_stats ON c.id = mint_stats.collection_id;

-- Create indexes on materialized view (run separately)
CREATE INDEX IF NOT EXISTS idx_collection_stats_enhanced_creator ON collection_stats_enhanced(creator_wallet);
CREATE INDEX IF NOT EXISTS idx_collection_stats_enhanced_status ON collection_stats_enhanced(computed_status);
CREATE INDEX IF NOT EXISTS idx_collection_stats_enhanced_created_at ON collection_stats_enhanced(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_collection_stats_enhanced_progress ON collection_stats_enhanced(progress_percentage DESC);

-- ============================================
-- 3. FUNCTIONS FOR COMMON OPERATIONS
-- ============================================

-- Function to get collection with all related data in one call
CREATE OR REPLACE FUNCTION get_collection_with_stats(collection_address TEXT)
RETURNS TABLE (
    id UUID,
    collection_mint_address TEXT,
    candy_machine_id TEXT,
    name TEXT,
    symbol TEXT,
    description TEXT,
    image_uri TEXT,
    creator_wallet TEXT,
    price DECIMAL,
    total_supply INTEGER,
    status TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    items_count BIGINT,
    minted_count BIGINT,
    volume DECIMAL,
    floor_price DECIMAL,
    computed_status TEXT,
    active_phases JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cs.*,
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id', mp.id,
                    'name', mp.name,
                    'price', mp.price,
                    'start_time', mp.start_time,
                    'end_time', mp.end_time,
                    'mint_limit', mp.mint_limit
                )
            ) FILTER (WHERE mp.id IS NOT NULL), 
            '[]'::jsonb
        ) as active_phases
    FROM collection_stats cs
    LEFT JOIN mint_phases mp ON cs.id = mp.collection_id
    WHERE cs.collection_mint_address = collection_address 
       OR cs.candy_machine_id = collection_address
    GROUP BY cs.id, cs.collection_mint_address, cs.candy_machine_id, cs.name, 
             cs.symbol, cs.description, cs.image_uri, cs.creator_wallet, 
             cs.price, cs.total_supply, cs.status, cs.created_at, cs.updated_at,
             cs.items_count, cs.minted_count, cs.volume, cs.floor_price, cs.computed_status;
END;
$$ LANGUAGE plpgsql;

-- Function to refresh materialized view (call this periodically)
CREATE OR REPLACE FUNCTION refresh_collection_stats()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY collection_stats;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 4. TRIGGERS FOR REAL-TIME UPDATES
-- ============================================

-- Function to update collection minted count when items are minted
CREATE OR REPLACE FUNCTION update_collection_minted_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.is_minted != NEW.is_minted THEN
        IF NEW.is_minted = true THEN
            -- Item was minted
            UPDATE collections 
            SET minted_count = minted_count + 1,
                updated_at = NOW()
            WHERE id = NEW.collection_id;
        ELSE
            -- Item was unminted (rare case)
            UPDATE collections 
            SET minted_count = GREATEST(0, minted_count - 1),
                updated_at = NOW()
            WHERE id = NEW.collection_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_collection_minted_count ON items;
CREATE TRIGGER trigger_update_collection_minted_count
    AFTER UPDATE ON items
    FOR EACH ROW
    EXECUTE FUNCTION update_collection_minted_count();

-- ============================================
-- 5. PERIODIC MAINTENANCE
-- ============================================

-- Create a function to run periodic maintenance
CREATE OR REPLACE FUNCTION run_periodic_maintenance()
RETURNS void AS $$
BEGIN
    -- Refresh materialized views
    PERFORM refresh_collection_stats();
    
    -- Update collection statuses based on current time and mint progress
    UPDATE collections 
    SET status = CASE 
        WHEN minted_count >= total_supply THEN 'sold_out'
        WHEN status = 'draft' AND EXISTS (
            SELECT 1 FROM mint_phases mp 
            WHERE mp.collection_id = collections.id 
            AND mp.start_time <= NOW()
        ) THEN 'active'
        ELSE status
    END,
    updated_at = NOW()
    WHERE status IN ('draft', 'active');
    
    -- Log maintenance run
    INSERT INTO maintenance_log (operation, completed_at) 
    VALUES ('periodic_maintenance', NOW());
END;
$$ LANGUAGE plpgsql;

-- Create maintenance log table
CREATE TABLE IF NOT EXISTS maintenance_log (
    id SERIAL PRIMARY KEY,
    operation TEXT NOT NULL,
    completed_at TIMESTAMPTZ DEFAULT NOW()
);
