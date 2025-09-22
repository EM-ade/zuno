-- Fix for marketplace error: Create collection_stats_enhanced materialized view
-- Run this in your Supabase SQL Editor

-- Drop existing view if it exists
DROP MATERIALIZED VIEW IF EXISTS collection_stats_enhanced;

-- Create the enhanced materialized view
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

-- Create indexes on materialized view for better performance
CREATE INDEX IF NOT EXISTS idx_collection_stats_enhanced_creator ON collection_stats_enhanced(creator_wallet);
CREATE INDEX IF NOT EXISTS idx_collection_stats_enhanced_status ON collection_stats_enhanced(computed_status);
CREATE INDEX IF NOT EXISTS idx_collection_stats_enhanced_created_at ON collection_stats_enhanced(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_collection_stats_enhanced_progress ON collection_stats_enhanced(progress_percentage DESC);

-- Refresh the view to populate it with data
REFRESH MATERIALIZED VIEW collection_stats_enhanced;
