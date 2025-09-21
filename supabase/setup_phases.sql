-- Setup Phases for Collections
-- This SQL will add phases to your existing collections

-- First, let's check the mint_phases table structure
-- The table should already exist from your migrations

-- Example: Add phases for a specific collection
-- Replace 'YOUR_COLLECTION_ID' with the actual collection ID from your collections table

-- OG Phase (Early Access)
INSERT INTO mint_phases (
  collection_id,
  name,
  phase_type,
  price,
  start_time,
  end_time,
  mint_limit
) VALUES (
  'YOUR_COLLECTION_ID', -- Replace with actual collection ID
  'OG Phase',
  'whitelist',
  0.05, -- Price in SOL
  NOW(), -- Starts immediately
  NOW() + INTERVAL '1 day', -- Ends in 1 day
  2 -- Max 2 mints per wallet
);

-- Whitelist Phase
INSERT INTO mint_phases (
  collection_id,
  name,
  phase_type,
  price,
  start_time,
  end_time,
  mint_limit
) VALUES (
  'YOUR_COLLECTION_ID', -- Replace with actual collection ID
  'Whitelist',
  'whitelist',
  0.08, -- Price in SOL
  NOW() + INTERVAL '1 day', -- Starts after OG phase
  NOW() + INTERVAL '2 days', -- Ends after 2 days
  3 -- Max 3 mints per wallet
);

-- Public Phase
INSERT INTO mint_phases (
  collection_id,
  name,
  phase_type,
  price,
  start_time,
  end_time,
  mint_limit
) VALUES (
  'YOUR_COLLECTION_ID', -- Replace with actual collection ID
  'Public Sale',
  'public',
  0.1, -- Price in SOL
  NOW() + INTERVAL '2 days', -- Starts after whitelist
  NULL, -- No end time (runs until sold out)
  5 -- Max 5 mints per wallet
);

-- To add phases for all your collections at once:
-- This will add a simple public phase to all collections that don't have phases

INSERT INTO mint_phases (collection_id, name, phase_type, price, start_time, end_time, mint_limit)
SELECT 
  c.id,
  'Public Sale',
  'public',
  c.price, -- Use the collection's price
  NOW(), -- Start immediately
  NULL, -- No end time
  10 -- Max 10 per wallet
FROM collections c
LEFT JOIN mint_phases mp ON c.id = mp.collection_id
WHERE mp.id IS NULL; -- Only for collections without phases

-- Query to check your phases
SELECT 
  c.name as collection_name,
  mp.name as phase_name,
  mp.phase_type,
  mp.price,
  mp.start_time,
  mp.end_time,
  mp.mint_limit
FROM mint_phases mp
JOIN collections c ON c.id = mp.collection_id
ORDER BY c.name, mp.start_time;

-- Update phase for a specific collection (example)
UPDATE mint_phases 
SET 
  price = 0.15,
  mint_limit = 20
WHERE 
  collection_id = 'YOUR_COLLECTION_ID' 
  AND phase_type = 'public';

-- Delete all phases for a collection (to start fresh)
DELETE FROM mint_phases 
WHERE collection_id = 'YOUR_COLLECTION_ID';

-- Add phases with specific dates
INSERT INTO mint_phases (collection_id, name, phase_type, price, start_time, end_time, mint_limit)
VALUES 
  ('YOUR_COLLECTION_ID', 'Early Bird', 'whitelist', 0.05, '2024-01-01 12:00:00', '2024-01-02 12:00:00', 1),
  ('YOUR_COLLECTION_ID', 'Presale', 'whitelist', 0.075, '2024-01-02 12:00:00', '2024-01-03 12:00:00', 2),
  ('YOUR_COLLECTION_ID', 'Public', 'public', 0.1, '2024-01-03 12:00:00', NULL, 5);
