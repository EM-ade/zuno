-- Create collection_stats_enhanced materialized view for marketplace
-- This version handles your actual database schema properly
-- Run this SQL in your Supabase SQL Editor

-- Drop existing view if it exists
DROP MATERIALIZED VIEW IF EXISTS collection_stats_enhanced;

-- Create the enhanced materialized view based on your actual schema
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
    -- Items statistics from your items table
    COALESCE(item_counts.total_items, 0) as items_count,
    COALESCE(item_counts.actual_minted, c.minted_count, 0) as actual_minted_count,
    -- Mint transaction statistics from your mint_transactions table
    COALESCE(mint_stats.total_volume, 0) as volume,
    COALESCE(mint_stats.floor_price, c.price, 0) as floor_price,
    COALESCE(mint_stats.unique_holders, 0) as unique_holders,
    -- Phase information from your mint_phases table
    phase_info.earliest_start_time as start_date,
    phase_info.latest_end_time as end_date,
    -- Computed status based on current state
    CASE
        WHEN COALESCE(item_counts.actual_minted, c.minted_count, 0) >= c.total_supply THEN 'sold_out'
        WHEN c.status = 'active' OR c.status = 'live' THEN 'live'
        WHEN c.status = 'draft' THEN 'upcoming'
        WHEN c.status = 'completed' OR c.status = 'sold_out' THEN 'ended'
        ELSE 'upcoming'
    END as computed_status,
    -- Progress percentage
    CASE
        WHEN c.total_supply > 0 THEN
            ROUND((COALESCE(item_counts.actual_minted, c.minted_count, 0)::DECIMAL / c.total_supply::DECIMAL) * 100, 2)
        ELSE 0
    END as progress_percentage
FROM collections c
-- Join with items statistics
LEFT JOIN (
    SELECT
        collection_id,
        COUNT(*) as total_items,
        COUNT(*) FILTER (WHERE minted = true) as actual_minted
    FROM items
    GROUP BY collection_id
) item_counts ON c.id = item_counts.collection_id
-- Join with mint transaction statistics - handle both total_paid and nft_price columns
LEFT JOIN (
    SELECT
        collection_id,
        SUM(COALESCE(total_paid, nft_price * quantity, nft_price, 0)) as total_volume,
        MIN(COALESCE(total_paid, nft_price, 0)) as floor_price,
        COUNT(DISTINCT buyer_wallet) as unique_holders
    FROM mint_transactions
    WHERE status = 'completed'
    GROUP BY collection_id
) mint_stats ON c.id = mint_stats.collection_id
-- Join with phase information from mint_phases table
LEFT JOIN (
    SELECT
        collection_id,
        MIN(start_time) as earliest_start_time,
        MAX(end_time) as latest_end_time
    FROM mint_phases
    GROUP BY collection_id
) phase_info ON c.id = phase_info.collection_id;

-- Create indexes on materialized view for better performance
CREATE INDEX IF NOT EXISTS idx_collection_stats_enhanced_creator ON collection_stats_enhanced(creator_wallet);
CREATE INDEX IF NOT EXISTS idx_collection_stats_enhanced_status ON collection_stats_enhanced(computed_status);
CREATE INDEX IF NOT EXISTS idx_collection_stats_enhanced_created_at ON collection_stats_enhanced(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_collection_stats_enhanced_progress ON collection_stats_enhanced(progress_percentage DESC);
CREATE INDEX IF NOT EXISTS idx_collection_stats_enhanced_collection_mint ON collection_stats_enhanced(collection_mint_address);
CREATE INDEX IF NOT EXISTS idx_collection_stats_enhanced_candy_machine ON collection_stats_enhanced(candy_machine_id) WHERE candy_machine_id IS NOT NULL;

-- Refresh the view to populate it with data
REFRESH MATERIALIZED VIEW collection_stats_enhanced;

-- Create a function to refresh the materialized view (for periodic updates)
CREATE OR REPLACE FUNCTION refresh_collection_stats_enhanced()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY collection_stats_enhanced;
EXCEPTION
    WHEN OTHERS THEN
        -- If concurrent refresh fails, do regular refresh
        REFRESH MATERIALIZED VIEW collection_stats_enhanced;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions (adjust based on your RLS policies)
GRANT SELECT ON collection_stats_enhanced TO anon;
GRANT SELECT ON collection_stats_enhanced TO authenticated;