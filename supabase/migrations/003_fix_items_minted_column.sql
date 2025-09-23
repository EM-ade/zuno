-- Migration to fix items table minted column naming
-- The column should be named 'minted' not 'is_minted'

-- First, check if 'is_minted' column exists and 'minted' doesn't exist
-- If so, rename 'is_minted' to 'minted'
DO $$
BEGIN
    -- If 'is_minted' exists but 'minted' doesn't, rename the column
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'items' AND column_name = 'is_minted'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'items' AND column_name = 'minted'
    ) THEN
        ALTER TABLE items RENAME COLUMN is_minted TO minted;
    END IF;
    
    -- If neither column exists, add the 'minted' column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'items' AND column_name = 'minted'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'items' AND column_name = 'is_minted'
    ) THEN
        ALTER TABLE items ADD COLUMN minted BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;
    
    -- If both columns exist, keep 'minted' and drop 'is_minted'
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'items' AND column_name = 'is_minted'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'items' AND column_name = 'minted'
    ) THEN
        -- Copy data from is_minted to minted if needed
        UPDATE items SET minted = is_minted WHERE minted IS DISTINCT FROM is_minted;
        -- Drop the old column
        ALTER TABLE items DROP COLUMN is_minted;
    END IF;
END $$;

-- Ensure the index exists on the correct column
DROP INDEX IF EXISTS idx_items_is_minted;
CREATE INDEX IF NOT EXISTS idx_items_minted ON items(minted);

-- Add missing columns that should exist based on the user's schema
ALTER TABLE items ADD COLUMN IF NOT EXISTS owner_wallet TEXT;
ALTER TABLE items ADD COLUMN IF NOT EXISTS mint_signature TEXT;
ALTER TABLE items ADD COLUMN IF NOT EXISTS minted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE items ADD COLUMN IF NOT EXISTS nft_mint_address TEXT;