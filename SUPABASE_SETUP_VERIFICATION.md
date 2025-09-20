# Supabase Database Setup & Verification Guide

## 🔧 Setup Steps

### 1. **Run the Database Migration**
1. Go to your Supabase dashboard: https://supabase.com/dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy the entire content from: `database/migrations/complete_setup.sql`
5. Paste and click **Run**

### 2. **Verify Environment Variables**
Your `.env.local` should have:
```env
# Supabase Configuration
SUPABASE_URL=https://fgtvbsshgoymjtiqmbeu.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_SUPABASE_URL=https://fgtvbsshgoymjtiqmbeu.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Make sure this is commented out or removed:
# USE_LOCAL_DB=true
```

### 3. **Restart Your Development Server**
```bash
# Stop the server (Ctrl+C) and restart
npm run dev
```

## ✅ Verification Steps

### **Test 1: Check Database Tables**
In Supabase SQL Editor, run:
```sql
-- Check if tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';

-- You should see:
-- collections
-- items
-- mint_phases
-- whitelist
-- mint_transactions
```

### **Test 2: Check Sample Data**
```sql
-- Check if sample collection was created
SELECT * FROM collections;

-- Check if sample items exist
SELECT * FROM items;
```

### **Test 3: Create a Collection**
1. Go to http://localhost:3000/creator/create
2. Fill in collection details:
   - Name: "Test Collection"
   - Symbol: "TEST"
   - Description: "Testing database"
   - Upload an image
   - Set price: 0.1 SOL
   - Total Supply: 100
3. Click through to create
4. Check console for logs:
   - "Collection saved to database: [UUID]"
   - "Collection created on-chain but not saved to DB" (if DB error)

### **Test 4: Verify in Database**
After creating a collection, check Supabase:
```sql
-- See your new collection
SELECT * FROM collections ORDER BY created_at DESC LIMIT 1;

-- Check if phases were saved
SELECT * FROM mint_phases WHERE collection_id = (
  SELECT id FROM collections ORDER BY created_at DESC LIMIT 1
);
```

### **Test 5: Upload NFTs**
1. After collection creation, upload some NFTs
2. Check console for: "Saved X items to database for collection..."
3. Verify in database:
```sql
-- Check uploaded items
SELECT * FROM items WHERE collection_address = 'YOUR_COLLECTION_ADDRESS';
```

### **Test 6: Check Marketplace**
1. Go to http://localhost:3000/marketplace
2. Your collection should appear
3. Click on it to go to mint page

### **Test 7: Mint Page**
1. Visit http://localhost:3000/mint/[collection_address]
2. Page should load without 404
3. Collection details should display

## 🐛 Common Issues & Fixes

### **Issue 1: "Collection not found" on mint page**
**Cause**: Collection not in database
**Fix**: Make sure collection creation saves to DB (check console logs)

### **Issue 2: "Database error" in console**
**Cause**: Tables don't exist or wrong schema
**Fix**: Run the complete_setup.sql migration

### **Issue 3: Collections not showing in marketplace**
**Cause**: Database not connected or empty
**Fix**: 
1. Check `.env.local` has correct Supabase credentials
2. Remove `USE_LOCAL_DB=true` line
3. Restart server

### **Issue 4: Items not saving**
**Cause**: Missing collection_id reference
**Fix**: Already fixed in latest code - items now properly link to collections

## 📊 Database Structure

### **Collections Table**
- `id` (UUID) - Primary key
- `collection_mint_address` - Blockchain address
- `candy_machine_id` - Optional candy machine
- `name`, `symbol`, `description` - Basic info
- `price`, `total_supply`, `minted_count` - Mint data
- `status` - draft/active/completed

### **Items Table**
- `id` (UUID) - Primary key
- `collection_id` - Links to collections
- `collection_address` - Blockchain reference
- `name`, `description`, `image_uri` - NFT data
- `minted` - Boolean tracking mint status
- `owner_wallet` - Current owner

### **Mint Phases Table**
- `id` (UUID) - Primary key
- `collection_id` - Links to collections
- `name`, `price`, `start_time`, `end_time` - Phase config

## 🎯 Expected Flow

1. **Create Collection** → Saves to `collections` table
2. **Upload NFTs** → Saves to `items` table with `collection_id`
3. **Marketplace** → Reads from `collections` table
4. **Mint Page** → Reads collection + items from database
5. **Minting** → Updates `items.minted` and `items.owner_wallet`

## 🔍 Debug Checklist

- [ ] Database migration ran successfully
- [ ] Environment variables configured
- [ ] Server restarted after env changes
- [ ] Collections saving to database
- [ ] Items saving with collection_id
- [ ] Marketplace showing collections
- [ ] Mint pages loading without 404
- [ ] Console showing success logs

If all checks pass, your Supabase integration is working correctly!
