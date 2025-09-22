-- Script to refresh the collection_stats_enhanced materialized view
-- This will update it with the latest data from your collections

-- Drop and recreate the materialized view to ensure it's fresh
DROP MATERIALIZED VIEW IF EXISTS collection_stats_enhanced;

-- Recreate the materialized view (copy from create_marketplace_view.sql)
CREATE MATERIALIZED VIEW collection_stats_enhanced AS
SELECT
    c.id,
    c.name,
    c.symbol,
    c.description,
    c.image_uri,
    c.total_supply,
    c.status,
    c.candy_machine_id,
    c.collection_mint_address,
    c.creator_wallet,
    c.created_at,
    c.updated_at,
    -- Use actual minted count from items table if available, fallback to collection minted_count
    COALESCE(item_counts.actual_minted, c.minted_count, 0) as minted_count,
    -- Floor price and volume from transactions
    COALESCE(tx_stats.floor_price, 0) as floor_price,
    COALESCE(tx_stats.total_volume, 0) as volume,
    COALESCE(tx_stats.unique_holders, 0) as unique_holders,
    -- Phase information
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
) tx_stats ON c.id = tx_stats.collection_id
-- Join with phase information
LEFT JOIN (
    SELECT
        collection_id,
        MIN(start_time) as earliest_start_time,
        MAX(end_time) as latest_end_time
    FROM mint_phases
    GROUP BY collection_id
) phase_info ON c.id = phase_info.collection_id
WHERE c.status != 'archived';

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_collection_stats_enhanced_status ON collection_stats_enhanced(computed_status);
CREATE INDEX IF NOT EXISTS idx_collection_stats_enhanced_created ON collection_stats_enhanced(created_at);
CREATE INDEX IF NOT EXISTS idx_collection_stats_enhanced_volume ON collection_stats_enhanced(volume);

-- Verify the refresh worked
SELECT 
    computed_status,
    COUNT(*) as count
FROM collection_stats_enhanced 
GROUP BY computed_status 
ORDER BY computed_status;

SELECT 'Materialized view refreshed successfully!' as result;