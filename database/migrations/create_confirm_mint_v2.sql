-- Drop any existing conflicting functions and create a clean confirm_mint_v2 function
-- This avoids parameter type conflicts

DROP FUNCTION IF EXISTS confirm_mint_v2(TEXT, TEXT[], TEXT, TEXT, TEXT, DECIMAL, DECIMAL, TEXT);

CREATE OR REPLACE FUNCTION confirm_mint_v2(
    p_collection_address TEXT,
    p_nft_ids TEXT[],
    p_buyer_wallet TEXT,
    p_transaction_signature TEXT,
    p_reservation_token TEXT DEFAULT NULL,
    p_platform_fee_usd DECIMAL DEFAULT 1.25,
    p_sol_price DECIMAL DEFAULT 50,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_collection_id UUID;
    v_collection_record RECORD;
    v_item_record RECORD;
    v_updated_items TEXT[] := '{}';
    v_nft_details JSON[] := '{}';
    v_minted_count INT := 0;
    v_platform_fee_sol DECIMAL;
    v_total_nft_cost DECIMAL := 0;
    v_total_platform_commission DECIMAL := 0;
    v_total_paid DECIMAL := 0;
    v_result JSON;
BEGIN
    -- Calculate platform fee in SOL
    v_platform_fee_sol := p_platform_fee_usd / p_sol_price;
    
    -- Get collection details
    SELECT * INTO v_collection_record
    FROM collections 
    WHERE collection_mint_address = p_collection_address;
    
    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Collection not found',
            'minted_count', 0,
            'minted_nfts', '[]'::JSON
        );
    END IF;
    
    v_collection_id := v_collection_record.id;
    
    -- Check if this transaction has already been processed (idempotency)
    IF p_idempotency_key IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM mint_transactions 
            WHERE transaction_signature = p_transaction_signature
        ) THEN
            -- Already processed, return existing result
            SELECT json_build_object(
                'success', true,
                'message', 'Already processed',
                'minted_count', array_length(p_nft_ids, 1),
                'minted_nfts', json_agg(
                    json_build_object(
                        'id', id,
                        'name', name,
                        'image', COALESCE(image_uri, ''),
                        'address', COALESCE(mint_signature, '')
                    )
                )
            ) INTO v_result
            FROM items 
            WHERE collection_id = v_collection_id 
            AND mint_signature = p_transaction_signature;
            
            RETURN v_result;
        END IF;
    END IF;
    
    -- Process each NFT ID
    FOR i IN 1..array_length(p_nft_ids, 1) LOOP
        -- Find an unminted item for this collection
        SELECT * INTO v_item_record
        FROM items 
        WHERE collection_id = v_collection_id 
        AND minted = false 
        AND (owner_wallet IS NULL OR owner_wallet = p_buyer_wallet)
        ORDER BY item_index NULLS LAST, created_at
        LIMIT 1;
        
        IF FOUND THEN
            -- Mark item as minted
            UPDATE items 
            SET 
                minted = true,
                owner_wallet = p_buyer_wallet,
                mint_signature = p_transaction_signature,
                nft_address = p_nft_ids[i],
                updated_at = NOW()
            WHERE id = v_item_record.id;
            
            -- Add to results
            v_updated_items := array_append(v_updated_items, v_item_record.id::TEXT);
            v_nft_details := array_append(v_nft_details, json_build_object(
                'id', p_nft_ids[i],
                'name', v_item_record.name,
                'image', COALESCE(v_item_record.image_uri, ''),
                'address', p_nft_ids[i]
            ));
            v_minted_count := v_minted_count + 1;
            
            -- Calculate costs
            v_total_nft_cost := v_total_nft_cost + COALESCE(v_collection_record.price, 0);
        END IF;
    END LOOP;
    
    -- Calculate payment breakdown
    v_total_platform_commission := v_total_nft_cost * 0.05; -- 5% of NFT price
    v_total_paid := v_total_nft_cost + v_platform_fee_sol; -- NFT cost + fixed platform fee
    
    -- Create mint transaction record
    INSERT INTO mint_transactions (
        collection_id,
        buyer_wallet,
        transaction_signature,
        quantity,
        nft_price,
        platform_fee,
        total_paid,
        status,
        created_at
    ) VALUES (
        v_collection_id,
        p_buyer_wallet,
        p_transaction_signature,
        v_minted_count,
        COALESCE(v_collection_record.price, 0),
        v_platform_fee_sol,
        v_total_paid,
        'completed',
        NOW()
    );
    
    -- Update collection minted count
    UPDATE collections 
    SET 
        minted_count = (
            SELECT COUNT(*) 
            FROM items 
            WHERE collection_id = v_collection_id AND minted = true
        ),
        updated_at = NOW()
    WHERE id = v_collection_id;
    
    -- Return success result
    RETURN json_build_object(
        'success', true,
        'message', format('Successfully minted %s NFT(s)', v_minted_count),
        'minted_count', v_minted_count,
        'minted_nfts', array_to_json(v_nft_details)
    );
    
EXCEPTION WHEN OTHERS THEN
    -- Log error and return failure
    RAISE LOG 'Error in confirm_mint_v2: %', SQLERRM;
    RETURN json_build_object(
        'success', false,
        'error', SQLERRM,
        'minted_count', 0,
        'minted_nfts', '[]'::JSON
    );
END;
$$ LANGUAGE plpgsql;