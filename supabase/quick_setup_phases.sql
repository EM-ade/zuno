-- Quick setup for phases on your existing collections
-- Run this in Supabase SQL editor

-- First, let's see your collections
SELECT id, name, price FROM collections;

-- Add a simple public phase to all collections without phases
INSERT INTO mint_phases (collection_id, name, phase_type, price, start_time, end_time, mint_limit)
SELECT 
  c.id,
  'Public Sale',
  'public',
  COALESCE(c.price, 0.001), -- Use collection price or default to 0.001 SOL
  NOW(), -- Start immediately
  NULL, -- No end time
  10 -- Max 10 per wallet
FROM collections c
LEFT JOIN mint_phases mp ON c.id = mp.collection_id
WHERE mp.id IS NULL;

-- For testing, add phases to a specific collection
-- Replace with your actual collection ID from the first query
DO $$
DECLARE
  test_collection_id UUID;
BEGIN
  -- Get the first collection ID for testing
  SELECT id INTO test_collection_id FROM collections LIMIT 1;
  
  -- Delete existing phases for clean setup
  DELETE FROM mint_phases WHERE collection_id = test_collection_id;
  
  -- Add three phases
  INSERT INTO mint_phases (collection_id, name, phase_type, price, start_time, end_time, mint_limit)
  VALUES 
    (test_collection_id, 'OG Phase', 'whitelist', 0.0005, NOW(), NOW() + INTERVAL '1 hour', 2),
    (test_collection_id, 'Whitelist', 'whitelist', 0.0008, NOW() + INTERVAL '1 hour', NOW() + INTERVAL '2 hours', 3),
    (test_collection_id, 'Public', 'public', 0.001, NOW() + INTERVAL '2 hours', NULL, 5);
END $$;

-- Check your phases
SELECT 
  c.name as collection,
  mp.name as phase,
  mp.phase_type,
  mp.price,
  mp.start_time,
  mp.end_time,
  mp.mint_limit,
  CASE 
    WHEN NOW() < mp.start_time THEN 'Upcoming'
    WHEN mp.end_time IS NULL OR NOW() < mp.end_time THEN 'Active'
    ELSE 'Ended'
  END as status
FROM mint_phases mp
JOIN collections c ON c.id = mp.collection_id
ORDER BY c.name, mp.start_time;
