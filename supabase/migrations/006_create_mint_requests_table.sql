-- Migration to create mint_requests table for tracking mint operations

-- Create the mint_requests table
CREATE TABLE IF NOT EXISTS public.mint_requests (
    idempotency_key UUID NOT NULL PRIMARY KEY,
    request_body JSONB NOT NULL,
    response_body JSONB,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'transaction_ready', 'completed', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_mint_requests_status ON public.mint_requests(status);
CREATE INDEX IF NOT EXISTS idx_mint_requests_created_at ON public.mint_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_mint_requests_updated_at ON public.mint_requests(updated_at);

-- Create updated_at trigger function (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_mint_requests_updated_at ON public.mint_requests;
CREATE TRIGGER update_mint_requests_updated_at
    BEFORE UPDATE ON public.mint_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE public.mint_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Allow service role to insert mint requests
CREATE POLICY "Allow service role to insert mint_requests" ON public.mint_requests
    FOR INSERT WITH CHECK (true);

-- Allow service role to update mint requests
CREATE POLICY "Allow service role to update mint_requests" ON public.mint_requests
    FOR UPDATE USING (true) WITH CHECK (true);

-- Allow service role to select mint requests
CREATE POLICY "Allow service role to select mint_requests" ON public.mint_requests
    FOR SELECT USING (true);

-- Add comments for documentation
COMMENT ON TABLE public.mint_requests IS 'Stores mint request data for tracking mint operations';
COMMENT ON COLUMN public.mint_requests.idempotency_key IS 'Unique identifier for idempotent requests';
COMMENT ON COLUMN public.mint_requests.request_body IS 'Original request data';
COMMENT ON COLUMN public.mint_requests.response_body IS 'Response data from processing';
COMMENT ON COLUMN public.mint_requests.status IS 'Current status of the mint request';