-- Function to automatically update minted column when owner_wallet is set
CREATE OR REPLACE FUNCTION update_minted_status()
RETURNS TRIGGER AS $$
BEGIN
    -- If owner_wallet is being set (not null) and minted is still false, set minted to true
    IF NEW.owner_wallet IS NOT NULL AND (OLD.owner_wallet IS NULL OR OLD.owner_wallet != NEW.owner_wallet) THEN
        NEW.minted = TRUE;
    END IF;
    
    -- If owner_wallet is being cleared (set to null), set minted to false
    IF NEW.owner_wallet IS NULL AND OLD.owner_wallet IS NOT NULL THEN
        NEW.minted = FALSE;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop the trigger if it exists
DROP TRIGGER IF EXISTS trigger_update_minted_on_owner_wallet ON items;

-- Create the trigger
CREATE TRIGGER trigger_update_minted_on_owner_wallet
    BEFORE UPDATE ON items
    FOR EACH ROW
    EXECUTE FUNCTION update_minted_status();

-- Also create a trigger for INSERT operations
CREATE OR REPLACE FUNCTION set_minted_on_insert()
RETURNS TRIGGER AS $$
BEGIN
    -- If owner_wallet is set during insert, mark as minted
    IF NEW.owner_wallet IS NOT NULL THEN
        NEW.minted = TRUE;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop the insert trigger if it exists
DROP TRIGGER IF EXISTS trigger_set_minted_on_insert ON items;

-- Create the insert trigger
CREATE TRIGGER trigger_set_minted_on_insert
    BEFORE INSERT ON items
    FOR EACH ROW
    EXECUTE FUNCTION set_minted_on_insert();