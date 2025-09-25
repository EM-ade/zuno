-- Migration to create RPC functions for NFT reservation

-- Drop all existing functions with these names regardless of signature
DO $$
DECLARE
  func RECORD;
BEGIN
  FOR func IN
    SELECT oid, proname, pg_get_function_identity_arguments(oid) as args
    FROM pg_proc
    WHERE proname IN ('reserve_nfts_atomic', 'confirm_nft_reservation')
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS public.' || func.proname || '(' || func.args || ') CASCADE';
  END LOOP;
END;
$$;

-- Function to reserve NFTs atomically
CREATE OR REPLACE FUNCTION public.reserve_nfts_atomic(
    p_collection_id UUID,
    p_quantity INTEGER
)
RETURNS TABLE(
    id UUID,
    name TEXT,
    image_uri TEXT,
    reservation_token TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_reservation_token TEXT;
    v_token_id UUID;
    v_expires_at TIMESTAMPTZ;
BEGIN
    -- Generate a unique reservation token
    v_reservation_token := gen_random_uuid()::TEXT;
    v_expires_at := NOW() + INTERVAL '10 minutes'; -- Reservation expires in 10 minutes
    
    -- Create a reservation token record
    INSERT INTO public.reservation_tokens (token, buyer_wallet, collection_id, quantity, expires_at)
    VALUES (v_reservation_token, 'system', p_collection_id, p_quantity, v_expires_at)
    RETURNING id INTO v_token_id;
    
    -- Reserve the NFTs
    RETURN QUERY
    WITH reserved_items AS (
        UPDATE public.items 
        SET 
            reserved_until = v_expires_at,
            updated_at = NOW()
        WHERE id IN (
            SELECT id 
            FROM public.items 
            WHERE collection_id = p_collection_id 
            AND minted = FALSE 
            AND (reserved_until IS NULL OR reserved_until < NOW())
            ORDER BY item_index 
            LIMIT p_quantity
        )
        RETURNING id, name, image_uri
    )
    INSERT INTO public.nft_reservations (reservation_token_id, item_id, reserved_at)
    SELECT v_token_id, id, NOW()
    FROM reserved_items
    RETURNING 
        (SELECT i.id FROM public.items i WHERE i.id = nft_reservations.item_id),
        (SELECT i.name FROM public.items i WHERE i.id = nft_reservations.item_id),
        (SELECT i.image_uri FROM public.items i WHERE i.id = nft_reservations.item_id),
        v_reservation_token;
    
    -- If we didn't reserve enough items, clean up
    IF (SELECT COUNT(*) FROM public.nft_reservations WHERE reservation_token_id = v_token_id) < p_quantity THEN
        DELETE FROM public.reservation_tokens WHERE id = v_token_id;
        DELETE FROM public.nft_reservations WHERE reservation_token_id = v_token_id;
        RETURN; -- Return empty result set
    END IF;
END;
$$;

-- Function to confirm NFT reservation
-- Drop existing function if it exists with different signature
DROP FUNCTION IF EXISTS public.confirm_nft_reservation(text, text);

CREATE OR REPLACE FUNCTION public.confirm_nft_reservation(
    p_reservation_token TEXT,
    p_buyer_wallet TEXT
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    confirmed_items JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_token_id UUID;
    v_collection_id UUID;
    v_confirmed_items JSONB := '[]'::JSONB;
    v_item_record RECORD;
BEGIN
    -- Initialize return values
    success := TRUE;
    message := '';
    confirmed_items := '[]'::JSONB;
    
    -- Get the reservation token
    SELECT id, collection_id INTO v_token_id, v_collection_id
    FROM public.reservation_tokens
    WHERE token = p_reservation_token
    AND expires_at > NOW()
    AND used = FALSE;
    
    IF NOT FOUND THEN
        success := FALSE;
        message := 'Invalid or expired reservation token';
        RETURN;
    END IF;
    
    -- Confirm the reservations
    UPDATE public.nft_reservations
    SET 
        confirmed = TRUE,
        confirmed_at = NOW(),
        updated_at = NOW()
    WHERE reservation_token_id = v_token_id;
    
    -- Update the reservation token
    UPDATE public.reservation_tokens
    SET 
        buyer_wallet = p_buyer_wallet,
        used = TRUE,
        updated_at = NOW()
    WHERE id = v_token_id;
    
    -- Build the confirmed items list
    FOR v_item_record IN
        SELECT i.id, i.name, i.image_uri
        FROM public.nft_reservations nr
        JOIN public.items i ON nr.item_id = i.id
        WHERE nr.reservation_token_id = v_token_id
    LOOP
        v_confirmed_items := v_confirmed_items || jsonb_build_object(
            'id', v_item_record.id,
            'name', v_item_record.name,
            'image_uri', v_item_record.image_uri
        );
    END LOOP;
    
    confirmed_items := v_confirmed_items;
    message := 'Reservation confirmed successfully';
    
    RETURN;
EXCEPTION
    WHEN OTHERS THEN
        success := FALSE;
        message := SQLERRM;
        confirmed_items := '[]'::JSONB;
        RETURN;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.reserve_nfts_atomic TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_nft_reservation TO anon, authenticated;