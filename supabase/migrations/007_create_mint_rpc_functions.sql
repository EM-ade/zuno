-- Migration to create RPC functions for mint operations

-- Drop all existing functions with these names regardless of signature
DO $$
DECLARE
  func RECORD;
BEGIN
  FOR func IN
    SELECT oid, proname, pg_get_function_identity_arguments(oid) as args
    FROM pg_proc
    WHERE proname IN ('confirm_mint_atomic', 'release_expired_nft_reservations', 'release_reserved_items')
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS public.' || func.proname || '(' || func.args || ') CASCADE';
  END LOOP;
END;
$$;

-- Function to confirm mint atomically
CREATE OR REPLACE FUNCTION public.confirm_mint_atomic(
    p_collection_address TEXT,
    p_nft_ids TEXT[],
    p_buyer_wallet TEXT,
    p_transaction_signature TEXT,
    p_reservation_token TEXT,
    p_platform_fee_usd NUMERIC,
    p_sol_price NUMERIC,
    p_idempotency_key TEXT
)
RETURNS TABLE(
    success BOOLEAN,
    minted_count INTEGER,
    minted_nfts JSONB,
    message TEXT,
    error TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_collection_id UUID;
    v_phase_id UUID;
    v_platform_fee_sol NUMERIC;
    v_minted_count INTEGER := 0;
    v_minted_nfts JSONB := '[]'::JSONB;
    v_nft_record RECORD;
    v_item RECORD;
BEGIN
    -- Initialize return values
    success := TRUE;
    minted_count := 0;
    minted_nfts := '[]'::JSONB;
    message := '';
    error := '';
    
    -- Get platform fee in SOL
    v_platform_fee_sol := p_platform_fee_usd / p_sol_price;
    
    -- Get collection ID
    SELECT id INTO v_collection_id 
    FROM public.collections 
    WHERE collection_mint_address = p_collection_address 
    LIMIT 1;
    
    IF NOT FOUND THEN
        success := FALSE;
        error := 'Collection not found';
        RETURN;
    END IF;
    
    -- Get active phase for this collection (simplified - in reality you might want more complex logic)
    SELECT id INTO v_phase_id 
    FROM public.mint_phases 
    WHERE collection_id = v_collection_id 
    AND start_time <= NOW() 
    AND (end_time IS NULL OR end_time > NOW()) 
    LIMIT 1;
    
    -- Update items to mark them as minted
    FOR v_nft_record IN 
        SELECT unnest(p_nft_ids) AS nft_id
    LOOP
        -- Update the item
        UPDATE public.items 
        SET 
            owner_wallet = p_buyer_wallet,
            mint_signature = p_transaction_signature,
            minted = TRUE,
            updated_at = NOW()
        WHERE id = v_nft_record.nft_id::UUID
        AND collection_id = v_collection_id
        AND minted = FALSE;  -- Ensure it wasn't already minted
        
        -- If the update affected a row, increment counter and add to result
        IF FOUND THEN
            v_minted_count := v_minted_count + 1;
            
            -- Get the item details for the response
            SELECT * INTO v_item 
            FROM public.items 
            WHERE id = v_nft_record.nft_id::UUID;
            
            IF FOUND THEN
                v_minted_nfts := v_minted_nfts || jsonb_build_object(
                    'id', v_item.id,
                    'name', v_item.name,
                    'image', v_item.image_uri,
                    'address', v_item.id  -- In a real implementation, this might be an on-chain address
                );
            END IF;
        END IF;
    END LOOP;
    
    -- Record the transaction
    INSERT INTO public.mint_transactions (
        collection_id,
        user_wallet,
        phase_id,
        signature,
        amount_paid,
        platform_fee
    ) VALUES (
        v_collection_id,
        p_buyer_wallet,
        v_phase_id,
        p_transaction_signature,
        v_minted_count * (SELECT COALESCE(MAX(price), 0) FROM public.mint_phases WHERE id = v_phase_id),
        v_platform_fee_sol
    );
    
    -- Update mint_requests to mark as completed
    UPDATE public.mint_requests
    SET 
        status = 'completed',
        response_body = response_body || jsonb_build_object(
            'success', TRUE,
            'minted_count', v_minted_count,
            'minted_nfts', v_minted_nfts,
            'message', 'Mint confirmed successfully'
        ),
        updated_at = NOW()
    WHERE idempotency_key = p_idempotency_key::UUID;
    
    -- Set return values
    minted_count := v_minted_count;
    minted_nfts := v_minted_nfts;
    message := 'Mint confirmed successfully for ' || v_minted_count || ' NFTs';
    
    RETURN;
EXCEPTION
    WHEN OTHERS THEN
        success := FALSE;
        error := SQLERRM;
        message := '';
        minted_count := 0;
        minted_nfts := '[]'::JSONB;
        
        -- Update mint_requests to mark as failed
        UPDATE public.mint_requests
        SET 
            status = 'failed',
            response_body = response_body || jsonb_build_object(
                'success', FALSE,
                'error', SQLERRM,
                'message', 'Failed to confirm mint'
            ),
            updated_at = NOW()
        WHERE idempotency_key = p_idempotency_key::UUID;
        
        RETURN;
END;
$$;

-- Function to release expired NFT reservations
-- Drop existing function if it exists with different signature
DROP FUNCTION IF EXISTS public.release_expired_nft_reservations();

CREATE OR REPLACE FUNCTION public.release_expired_nft_reservations()
RETURNS TABLE(released_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_released_count INTEGER := 0;
BEGIN
    -- Release expired reservations
    WITH expired_reservations AS (
        UPDATE public.nft_reservations nr
        SET 
            confirmed = FALSE,
            confirmed_at = NULL,
            updated_at = NOW()
        FROM public.reservation_tokens rt
        WHERE nr.reservation_token_id = rt.id
        AND rt.expires_at < NOW()
        AND nr.confirmed = FALSE
        RETURNING nr.id
    )
    SELECT COUNT(*) INTO v_released_count FROM expired_reservations;
    
    -- Clean up expired reservation tokens
    DELETE FROM public.reservation_tokens 
    WHERE expires_at < NOW();
    
    released_count := v_released_count;
    RETURN;
EXCEPTION
    WHEN OTHERS THEN
        released_count := 0;
        RETURN;
END;
$$;

-- Function to release reserved items by reservation token
-- Drop existing function if it exists with different signature
DROP FUNCTION IF EXISTS public.release_reserved_items(text);

CREATE OR REPLACE FUNCTION public.release_reserved_items(p_reservation_token TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Release items reserved by this token
    UPDATE public.nft_reservations nr
    SET 
        confirmed = FALSE,
        confirmed_at = NULL,
        updated_at = NOW()
    FROM public.reservation_tokens rt
    WHERE nr.reservation_token_id = rt.id
    AND rt.token = p_reservation_token
    AND nr.confirmed = FALSE;
    
    -- Delete the reservation token
    DELETE FROM public.reservation_tokens 
    WHERE token = p_reservation_token;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.confirm_mint_atomic TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_expired_nft_reservations TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_reserved_items TO anon, authenticated;