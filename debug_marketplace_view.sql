-- Step 1: First, let's create the materialized view
-- Copy and run the entire create_marketplace_view.sql file first

-- Step 2: Then run this debug script
-- Check if the materialized view exists
SELECT 
    schemaname,
    matviewname,
    hasindexes,
    ispopulated
FROM pg_matviews 
WHERE matviewname = 'collection_stats_enhanced';

-- Step 3: If it exists but shows ispopulated = false, refresh it
REFRESH MATERIALIZED VIEW collection_stats_enhanced;

-- Step 4: Check if data is properly populated
SELECT 
    id, 
    name, 
    status,
    computed_status,
    total_supply,
    items_count,
    actual_minted_count,
    progress_percentage,
    created_at
FROM collection_stats_enhanced 
ORDER BY created_at DESC
LIMIT 10;

-- Step 5: Alternative - if the materialized view approach doesn't work,
-- we can also make the API work directly with your collections table.
-- First, let's see what your collections actually look like:
SELECT 
    id, 
    name, 
    symbol,
    description,
    status,
    total_supply,
    minted_count,
    price,
    image_uri,
    collection_mint_address,
    candy_machine_id,
    creator_wallet,
    created_at
FROM collections 
WHERE status IN ('active', 'draft', 'live')
ORDER BY created_at DESC;