-- Migration to add unlimited_mint column to mint_phases table

-- Add the unlimited_mint column to mint_phases table
ALTER TABLE mint_phases 
ADD COLUMN IF NOT EXISTS unlimited_mint BOOLEAN DEFAULT FALSE;

-- Add a comment to document the new column
COMMENT ON COLUMN mint_phases.unlimited_mint IS 'When true, allows unlimited mints per wallet for this phase';

-- Update any existing rows to have the default value
UPDATE mint_phases 
SET unlimited_mint = FALSE 
WHERE unlimited_mint IS NULL;

-- Create an index for better performance when querying by unlimited_mint
CREATE INDEX IF NOT EXISTS idx_mint_phases_unlimited_mint ON mint_phases(unlimited_mint);