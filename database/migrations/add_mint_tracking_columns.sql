-- Add mint tracking columns to items table
-- This migration adds owner_wallet and mint_signature columns to track NFT ownership

-- Add owner_wallet column (nullable, stores wallet address of NFT owner)
ALTER TABLE items 
ADD COLUMN IF NOT EXISTS owner_wallet TEXT DEFAULT NULL;

-- Add mint_signature column (nullable, stores the transaction signature)
ALTER TABLE items 
ADD COLUMN IF NOT EXISTS mint_signature TEXT DEFAULT NULL;

-- Add updated_at column if it doesn't exist
ALTER TABLE items 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create index for faster queries on minted status
CREATE INDEX IF NOT EXISTS idx_items_owner_wallet ON items(owner_wallet);
CREATE INDEX IF NOT EXISTS idx_items_minted_status ON items(collection_id, owner_wallet) WHERE owner_wallet IS NOT NULL;

-- Add trigger to automatically update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS update_items_updated_at ON items;
CREATE TRIGGER update_items_updated_at 
    BEFORE UPDATE ON items 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add social media columns to collections table
ALTER TABLE collections 
ADD COLUMN IF NOT EXISTS twitter_url TEXT DEFAULT NULL;

ALTER TABLE collections 
ADD COLUMN IF NOT EXISTS discord_url TEXT DEFAULT NULL;

ALTER TABLE collections 
ADD COLUMN IF NOT EXISTS website_url TEXT DEFAULT NULL;

ALTER TABLE collections 
ADD COLUMN IF NOT EXISTS instagram_url TEXT DEFAULT NULL;

-- Add collection description if not exists
ALTER TABLE collections 
ADD COLUMN IF NOT EXISTS description TEXT DEFAULT NULL;

-- Add updated_at to collections if not exists
ALTER TABLE collections 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add trigger for collections updated_at
DROP TRIGGER IF EXISTS update_collections_updated_at ON collections;
CREate TRIGGER update_collections_updated_at 
    BEFORE UPDATE ON collections 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
