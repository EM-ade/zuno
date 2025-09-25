-- Migration to add any missing columns for mint operations

-- Add minted_at column to items table if it doesn't exist
ALTER TABLE public.items 
ADD COLUMN IF NOT EXISTS minted_at TIMESTAMPTZ;

-- Add nft_mint_address column to items table if it doesn't exist
ALTER TABLE public.items 
ADD COLUMN IF NOT EXISTS nft_mint_address TEXT;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_items_minted_at ON public.items(minted_at);
CREATE INDEX IF NOT EXISTS idx_items_nft_mint_address ON public.items(nft_mint_address);

-- Add status column to mint_requests table if it doesn't exist with all possible values
ALTER TABLE public.mint_requests 
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending' 
CHECK (status IN ('pending', 'processing', 'transaction_ready', 'completed', 'failed'));

-- Add processing column to mint_requests table if it doesn't exist
ALTER TABLE public.mint_requests 
ADD COLUMN IF NOT EXISTS processing BOOLEAN NOT NULL DEFAULT FALSE;

-- Create indexes for mint_requests table
CREATE INDEX IF NOT EXISTS idx_mint_requests_processing ON public.mint_requests(processing);
CREATE INDEX IF NOT EXISTS idx_mint_requests_status_processing ON public.mint_requests(status, processing);

-- Add any missing columns to reservation_tokens table
ALTER TABLE public.reservation_tokens 
ADD COLUMN IF NOT EXISTS used BOOLEAN NOT NULL DEFAULT FALSE;

-- Add indexes for reservation_tokens table
CREATE INDEX IF NOT EXISTS idx_reservation_tokens_used ON public.reservation_tokens(used);
CREATE INDEX IF NOT EXISTS idx_reservation_tokens_expires_at ON public.reservation_tokens(expires_at);

-- Add any missing columns to nft_reservations table
ALTER TABLE public.nft_reservations 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Add indexes for nft_reservations table
CREATE INDEX IF NOT EXISTS idx_nft_reservations_expires_at ON public.nft_reservations(expires_at);
CREATE INDEX IF NOT EXISTS idx_nft_reservations_confirmed ON public.nft_reservations(confirmed);

-- Update RLS policies for mint_requests if they don't exist
DROP POLICY IF EXISTS "Allow public read access to mint_requests" ON public.mint_requests;
CREATE POLICY "Allow public read access to mint_requests" ON public.mint_requests
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow insert for service role" ON public.mint_requests;
CREATE POLICY "Allow insert for service role" ON public.mint_requests
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update for service role" ON public.mint_requests;
CREATE POLICY "Allow update for service role" ON public.mint_requests
    FOR UPDATE USING (true) WITH CHECK (true);

-- Comments for documentation
COMMENT ON COLUMN public.items.minted_at IS 'Timestamp when the item was minted';
COMMENT ON COLUMN public.items.nft_mint_address IS 'On-chain address of the minted NFT';
COMMENT ON COLUMN public.mint_requests.processing IS 'Whether the mint request is currently being processed';
COMMENT ON COLUMN public.reservation_tokens.used IS 'Whether the reservation token has been used';
COMMENT ON COLUMN public.nft_reservations.expires_at IS 'When the reservation expires';