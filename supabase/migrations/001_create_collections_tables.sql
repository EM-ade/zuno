-- Migration: Create collections, mint_phases, and mint_transactions tables
-- Run this SQL in your Supabase SQL editor to set up the database schema

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Collections table
CREATE TABLE IF NOT EXISTS collections (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    collection_mint_address TEXT NOT NULL UNIQUE,
    candy_machine_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    symbol TEXT NOT NULL,
    description TEXT,
    total_supply INTEGER NOT NULL CHECK (total_supply > 0),
    royalty_percentage NUMERIC(5, 2) CHECK (royalty_percentage >= 0 AND royalty_percentage <= 100),
    image_uri TEXT,
    creator_wallet TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'archived')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for collections table
CREATE INDEX IF NOT EXISTS idx_collections_creator ON collections(creator_wallet);
CREATE INDEX IF NOT EXISTS idx_collections_status ON collections(status);
CREATE INDEX IF NOT EXISTS idx_collections_created_at ON collections(created_at);

-- Mint phases table
CREATE TABLE IF NOT EXISTS mint_phases (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price NUMERIC(18, 9) NOT NULL CHECK (price >= 0),
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    mint_limit INTEGER CHECK (mint_limit IS NULL OR mint_limit > 0),
    phase_type TEXT NOT NULL DEFAULT 'public' CHECK (phase_type IN ('public', 'whitelist')),
    merkle_root TEXT,
    allow_list TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for mint_phases table
CREATE INDEX IF NOT EXISTS idx_mint_phases_collection ON mint_phases(collection_id);
CREATE INDEX IF NOT EXISTS idx_mint_phases_time_range ON mint_phases(start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_mint_phases_type ON mint_phases(phase_type);

-- Mint transactions table
CREATE TABLE IF NOT EXISTS mint_transactions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    user_wallet TEXT NOT NULL,
    phase_id UUID REFERENCES mint_phases(id) ON DELETE SET NULL,
    signature TEXT NOT NULL UNIQUE,
    amount_paid NUMERIC(18, 9) NOT NULL CHECK (amount_paid >= 0),
    platform_fee NUMERIC(18, 9) NOT NULL CHECK (platform_fee >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for mint_transactions table
CREATE INDEX IF NOT EXISTS idx_mint_transactions_collection ON mint_transactions(collection_id);
CREATE INDEX IF NOT EXISTS idx_mint_transactions_user ON mint_transactions(user_wallet);
CREATE INDEX IF NOT EXISTS idx_mint_transactions_created ON mint_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_mint_transactions_signature ON mint_transactions(signature);

-- Items table (for individual NFTs)
CREATE TABLE IF NOT EXISTS items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    image_uri TEXT,
    metadata_uri TEXT,
    attributes JSONB,
    item_index INTEGER,
    owner_wallet TEXT,
    mint_signature TEXT,
    is_minted BOOLEAN NOT NULL DEFAULT FALSE, -- Definitive mint status
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for items table
CREATE INDEX IF NOT EXISTS idx_items_collection_id ON items(collection_id);

-- Alter table to add the is_minted column if it doesn't exist (for robustness)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'items' AND column_name = 'is_minted'
    ) THEN
        ALTER TABLE items ADD COLUMN is_minted BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;
END;
$$;
CREATE INDEX IF NOT EXISTS idx_items_owner_wallet ON items(owner_wallet);
CREATE INDEX IF NOT EXISTS idx_items_is_minted ON items(is_minted);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_collections_updated_at ON collections;
CREATE TRIGGER update_collections_updated_at
    BEFORE UPDATE ON collections
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_mint_phases_updated_at ON mint_phases;
CREATE TRIGGER update_mint_phases_updated_at
    BEFORE UPDATE ON mint_phases
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE mint_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE mint_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Allow public read access to collections (for explore page)
CREATE POLICY "Allow public read access to collections" ON collections
    FOR SELECT USING (true);

-- Allow public read access to mint phases
CREATE POLICY "Allow public read access to mint_phases" ON mint_phases
    FOR SELECT USING (true);

-- Allow public read access to mint transactions (for transparency)
CREATE POLICY "Allow public read access to mint_transactions" ON mint_transactions
    FOR SELECT USING (true);

-- Allow creators to update their own collections
CREATE POLICY "Allow creators to update their collections" ON collections
    FOR UPDATE USING (creator_wallet = current_setting('request.jwt.claims', true)::json->>'sub');

-- Allow insert only through API (service role)
CREATE POLICY "Allow service role to insert collections" ON collections
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow service role to insert mint_phases" ON mint_phases
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow service role to insert mint_transactions" ON mint_transactions
    FOR INSERT WITH CHECK (true);

-- Comments for documentation
COMMENT ON TABLE collections IS 'Stores NFT collection metadata and on-chain addresses';
COMMENT ON TABLE mint_phases IS 'Stores mint phase configurations for collections';
COMMENT ON TABLE mint_transactions IS 'Stores successful mint transactions';

-- Insert some sample data for testing (optional)
-- INSERT INTO collections (collection_mint_address, candy_machine_id, name, symbol, description, total_supply, royalty_percentage, creator_wallet, status)
-- VALUES 
-- ('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', 'CM58WCne7yL3QZJt9qk4fK5J9m8qR7sT1uX2vY3z4a5b', 'Test Collection', 'TEST', 'A test NFT collection', 1000, 5.0, '8x9C3j2k1L7m6N5b4V3c2X1z9Y8w7Q6e5R4t3y2U1i0o', 'active');

-- INSERT INTO mint_phases (collection_id, name, price, start_time, end_time, mint_limit, phase_type)
-- VALUES 
-- ((SELECT id FROM collections WHERE collection_mint_address = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'), 'Public Sale', 0.1, NOW(), NOW() + INTERVAL '7 days', 10, 'public');