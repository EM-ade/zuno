-- Complete Database Setup for Zuno NFT Platform
-- Run this entire script in your Supabase SQL editor

-- ============================================
-- 1. COLLECTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS collections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    collection_mint_address TEXT UNIQUE NOT NULL,
    candy_machine_id TEXT,
    name TEXT NOT NULL,
    symbol TEXT,
    description TEXT,
    image_uri TEXT,
    creator_wallet TEXT NOT NULL,
    update_authority TEXT,
    price DECIMAL(10, 4) DEFAULT 0,
    total_supply INTEGER DEFAULT 0,
    minted_count INTEGER DEFAULT 0,
    royalty_percentage DECIMAL(5, 2) DEFAULT 5.0,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'live', 'completed', 'paused', 'sold_out')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for collections
CREATE INDEX IF NOT EXISTS idx_collections_mint_address ON collections(collection_mint_address);
CREATE INDEX IF NOT EXISTS idx_collections_candy_machine ON collections(candy_machine_id);
CREATE INDEX IF NOT EXISTS idx_collections_creator ON collections(creator_wallet);
CREATE INDEX IF NOT EXISTS idx_collections_status ON collections(status);

-- ============================================
-- 2. ITEMS TABLE (NFTs)
-- ============================================
CREATE TABLE IF NOT EXISTS items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    collection_id UUID REFERENCES collections(id) ON DELETE CASCADE,
    collection_address TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    image_uri TEXT,
    metadata_uri TEXT,
    attributes JSONB DEFAULT '[]',
    item_index INTEGER,
    minted BOOLEAN DEFAULT FALSE,
    owner_wallet TEXT,
    mint_signature TEXT,
    nft_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(collection_address, item_index)
);

-- Create indexes for items
CREATE INDEX IF NOT EXISTS idx_items_collection ON items(collection_id);
CREATE INDEX IF NOT EXISTS idx_items_collection_address ON items(collection_address);
CREATE INDEX IF NOT EXISTS idx_items_minted ON items(minted);
CREATE INDEX IF NOT EXISTS idx_items_owner ON items(owner_wallet);
CREATE INDEX IF NOT EXISTS idx_items_collection_minted ON items(collection_address, minted);

-- ============================================
-- 3. MINT PHASES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS mint_phases (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    collection_id UUID REFERENCES collections(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    price DECIMAL(10, 4) NOT NULL,
    mint_limit INTEGER,
    whitelist_only BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for mint phases
CREATE INDEX IF NOT EXISTS idx_phases_collection ON mint_phases(collection_id);
CREATE INDEX IF NOT EXISTS idx_phases_active ON mint_phases(start_time, end_time);

-- ============================================
-- 4. WHITELIST TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS whitelist (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    phase_id UUID REFERENCES mint_phases(id) ON DELETE CASCADE,
    wallet_address TEXT NOT NULL,
    mint_limit INTEGER DEFAULT 1,
    minted_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(phase_id, wallet_address)
);

-- Create indexes for whitelist
CREATE INDEX IF NOT EXISTS idx_whitelist_phase ON whitelist(phase_id);
CREATE INDEX IF NOT EXISTS idx_whitelist_wallet ON whitelist(wallet_address);

-- ============================================
-- 5. MINT TRANSACTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS mint_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    collection_id UUID REFERENCES collections(id),
    phase_id UUID REFERENCES mint_phases(id),
    buyer_wallet TEXT NOT NULL,
    seller_wallet TEXT,
    transaction_signature TEXT UNIQUE,
    quantity INTEGER DEFAULT 1,
    nft_price DECIMAL(10, 4),
    platform_fee DECIMAL(10, 4),
    total_paid DECIMAL(10, 4),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for transactions
CREATE INDEX IF NOT EXISTS idx_transactions_collection ON mint_transactions(collection_id);
CREATE INDEX IF NOT EXISTS idx_transactions_buyer ON mint_transactions(buyer_wallet);
CREATE INDEX IF NOT EXISTS idx_transactions_signature ON mint_transactions(transaction_signature);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON mint_transactions(status);

-- ============================================
-- 6. UPDATE TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add update triggers to all tables
DROP TRIGGER IF EXISTS update_collections_updated_at ON collections;
CREATE TRIGGER update_collections_updated_at
    BEFORE UPDATE ON collections
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_items_updated_at ON items;
CREATE TRIGGER update_items_updated_at
    BEFORE UPDATE ON items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 7. AUTOMATIC MINTED COUNT UPDATE
-- ============================================

-- Function to update minted_count in collections
CREATE OR REPLACE FUNCTION update_collection_minted_count()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the minted_count in collections table
    UPDATE collections
    SET minted_count = (
        SELECT COUNT(*)
        FROM items
        WHERE collection_address = NEW.collection_address
        AND minted = true
    )
    WHERE collection_mint_address = NEW.collection_address;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update minted count when items are minted
DROP TRIGGER IF EXISTS update_minted_count_trigger ON items;
CREATE TRIGGER update_minted_count_trigger
    AFTER INSERT OR UPDATE OF minted ON items
    FOR EACH ROW
    WHEN (NEW.minted = true)
    EXECUTE FUNCTION update_collection_minted_count();

-- ============================================
-- 8. VIEWS FOR EASIER QUERYING
-- ============================================

-- View for collection statistics
CREATE OR REPLACE VIEW collection_stats AS
SELECT 
    c.id,
    c.collection_mint_address,
    c.name,
    c.total_supply,
    c.minted_count,
    c.price,
    c.status,
    COUNT(DISTINCT mt.buyer_wallet) as unique_holders,
    SUM(mt.total_paid) as total_volume,
    COUNT(mt.id) as total_transactions
FROM collections c
LEFT JOIN mint_transactions mt ON mt.collection_id = c.id AND mt.status = 'completed'
GROUP BY c.id;

-- View for active phases
CREATE OR REPLACE VIEW active_phases AS
SELECT 
    mp.*,
    c.collection_mint_address,
    c.name as collection_name
FROM mint_phases mp
JOIN collections c ON c.id = mp.collection_id
WHERE mp.start_time <= NOW()
AND (mp.end_time IS NULL OR mp.end_time > NOW());

-- ============================================
-- 9. ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE mint_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE whitelist ENABLE ROW LEVEL SECURITY;
ALTER TABLE mint_transactions ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access
CREATE POLICY "Allow public read access to collections" ON collections
    FOR SELECT USING (true);

CREATE POLICY "Allow public read access to items" ON items
    FOR SELECT USING (true);

CREATE POLICY "Allow public read access to mint phases" ON mint_phases
    FOR SELECT USING (true);

CREATE POLICY "Allow public read access to transactions" ON mint_transactions
    FOR SELECT USING (true);

-- Create policies for authenticated write access (for your server)
CREATE POLICY "Allow authenticated insert to collections" ON collections
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow authenticated update to collections" ON collections
    FOR UPDATE USING (true);

CREATE POLICY "Allow authenticated insert to items" ON items
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow authenticated update to items" ON items
    FOR UPDATE USING (true);

CREATE POLICY "Allow authenticated insert to mint_phases" ON mint_phases
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow authenticated insert to whitelist" ON whitelist
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow authenticated insert to mint_transactions" ON mint_transactions
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow authenticated update to mint_transactions" ON mint_transactions
    FOR UPDATE USING (true);

-- ============================================
-- 10. SAMPLE DATA (Optional - Remove in production)
-- ============================================

-- Insert a sample collection for testing
INSERT INTO collections (
    collection_mint_address,
    candy_machine_id,
    name,
    symbol,
    description,
    image_uri,
    creator_wallet,
    price,
    total_supply,
    status
) VALUES (
    'SampleCollection123456789',
    'CandyMachine123456789',
    'Zuno Genesis Collection',
    'ZUNO',
    'The first ever Zuno collection with exclusive benefits.',
    '/placeholder.svg',
    'creator_wallet_address',
    0.1,
    10000,
    'active'
) ON CONFLICT (collection_mint_address) DO NOTHING;

-- Get the collection ID for adding items
DO $$
DECLARE
    collection_uuid UUID;
BEGIN
    SELECT id INTO collection_uuid FROM collections WHERE collection_mint_address = 'SampleCollection123456789';
    
    IF collection_uuid IS NOT NULL THEN
        -- Insert sample items
        INSERT INTO items (collection_id, collection_address, name, description, image_uri, item_index, minted)
        VALUES 
            (collection_uuid, 'SampleCollection123456789', 'Sample NFT #1', 'First NFT', '/placeholder.svg', 0, false),
            (collection_uuid, 'SampleCollection123456789', 'Sample NFT #2', 'Second NFT', '/placeholder.svg', 1, false),
            (collection_uuid, 'SampleCollection123456789', 'Sample NFT #3', 'Third NFT', '/placeholder.svg', 2, false)
        ON CONFLICT DO NOTHING;
        
        -- Insert a sample phase
        INSERT INTO mint_phases (collection_id, name, start_time, price)
        VALUES (collection_uuid, 'Public Sale', NOW(), 0.5)
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- ============================================
-- 11. GRANT PERMISSIONS
-- ============================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Grant permissions to anon (public) users
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;

-- Grant permissions to authenticated users
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Run these to verify everything was created:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
-- SELECT * FROM collections;
-- SELECT * FROM collection_stats;
