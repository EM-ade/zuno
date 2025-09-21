import { createClient } from '@supabase/supabase-js';
import { envConfig } from '../config/env';

// Database types
export interface CollectionRecord {
  id?: string;
  name: string;
  symbol: string;
  creator_wallet: string;
  collection_mint_address: string;
  candy_machine_id?: string | null;
  total_supply: number;
  royalty_percentage?: number | null;
  image_uri?: string | null;
  description?: string | null;
  twitter_url?: string | null;
  discord_url?: string | null;
  website_url?: string | null;
  instagram_url?: string | null;
  status: 'draft' | 'active' | 'completed' | 'archived';
  created_at?: string;
  updated_at?: string;
}

export interface ItemRecord {
  id?: string;
  collection_id: string;
  name: string;
  description?: string | null;
  image_uri?: string | null;
  metadata_uri?: string | null;
  attributes?: Record<string, unknown>;
  item_index?: number | null;
  owner_wallet?: string | null;
  mint_signature?: string | null;
  is_minted?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface MintPhaseRecord {
  id?: string;
  collection_id: string;
  name: string;
  price: number;
  start_time: string;
  end_time?: string | null; // Changed to optional
  mint_limit?: number | null; // Changed to optional
  phase_type: 'og' | 'whitelist' | 'public' | 'custom'; // Now an enum in DB, matching client type
  allowed_wallets?: string[] | null; // New column, matching client type
  created_at?: string; // Add created_at
  // Removed: whitelist_only and merkle_root (if no longer used)
}

export interface MintTransactionRecord {
  id?: string;
  collection_id: string;
  user_wallet: string;
  phase_id: string | null;
  signature: string;
  amount_paid: number;
  platform_fee: number;
  metadata?: Record<string, unknown>; // Additional metadata for special transactions
  created_at?: string;
}

// Initialize Supabase client
const supabaseUrl = envConfig.supabaseUrl;
const supabaseAnonKey = envConfig.supabaseAnonKey;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase configuration is missing. Please check your environment variables.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server-side client using service role key for privileged writes (RLS bypass)
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
export const supabaseServer = supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey)
  : supabase; // fallback to anon if not provided

export class SupabaseService {
  // Collection operations
  static async createCollection(collection: Omit<CollectionRecord, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabaseServer
      .from('collections')
      .insert([collection])
      .select()
      .single();

    if (error) {
      console.error('Error creating collection:', error);
      throw new Error(`Failed to create collection: ${error.message}`);
    }
    return data;
  }

  static async upsertCollection(collection: Omit<CollectionRecord, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabaseServer
      .from('collections')
      .upsert(collection, { onConflict: 'collection_mint_address' })
      .select()
      .single();

    if (error) {
      console.error('Error upserting collection:', error);
      throw new Error(`Failed to upsert collection: ${error.message}`);
    }
    return data;
  }

  // Items operations
  static async createItems(items: Omit<ItemRecord, 'id' | 'created_at'>[]) {
    const { data, error } = await supabaseServer
      .from('items')
      .insert(items)
      .select();
    if (error) {
      console.error('Error creating items:', error);
      throw new Error(`Failed to create items: ${error.message}`);
    }
    return data;
  }


  static async getCollectionByMintAddress(collectionMintAddress: string) {
    const { data, error } = await supabase
      .from('collections')
      .select('*')
      .eq('collection_mint_address', collectionMintAddress)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
      console.error('Error fetching collection:', error);
      throw new Error(`Failed to fetch collection: ${error.message}`);
    }

    return data;
  }

  static async getCollectionByCandyMachineId(candyMachineId: string) {
    const { data, error } = await supabase
      .from('collections')
      .select('*')
      .eq('candy_machine_id', candyMachineId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
      console.error('Error fetching collection:', error);
      throw new Error(`Failed to fetch collection: ${error.message}`);
    }

    return data;
  }

  static async getCollectionsByStatus(status: CollectionRecord['status']) {
    const { data, error } = await supabase
      .from('collections')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching collections:', error);
      throw new Error(`Failed to fetch collections: ${error.message}`);
    }

    return data || [];
  }

  static async getCollectionsByCreator(creatorWallet: string) {
    // Fetch collections and related stats (minted_count, items_count, floor_price, volume) in a single query
    // using Supabase table joins and PostgREST features.
    const { data, error } = await supabase
      .from('collections')
      .select(`
        *,
        items(count),
        mint_transactions(count)
      `)
      .eq('creator_wallet', creatorWallet)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching creator collections:', error);
      throw new Error(`Failed to fetch creator collections: ${error.message}`);
    }

    // Process the data to flatten the counts
    const collectionsWithStats = data?.map(collection => {
      const itemsCount = (collection.items as { count: number }[])?.length || 0; // Count from joined items
      const mintedCount = (collection.mint_transactions as { count: number }[])?.length || 0; // Count from joined mint_transactions
      
      // For floor_price and volume, if they are not stored directly on collections table,
      // you might need a materialized view or trigger to pre-calculate, or fetch separately if truly needed.
      // For now, we will default them to 0 as they are not directly available via simple join on counts.
      const floor_price = 0; // Placeholder, needs actual calculation
      const volume = 0;      // Placeholder, needs actual calculation

      return {
        ...collection,
        items_count: itemsCount,
        minted_count: mintedCount,
        floor_price: collection.floor_price || floor_price, // Use existing if present, else default
        volume: collection.volume || volume,         // Use existing if present, else default
      };
    });

    return collectionsWithStats || [];
  }

  static async getCollectionMintStats(collectionId: string) {
    // This function will now be simplified or removed as its data is integrated into getCollectionsByCreator
    // For now, let's keep it as a placeholder or to retrieve other stats if needed.
    const { data: collection, error: collectionError } = await supabase
      .from('collections')
      .select('total_supply')
      .eq('id', collectionId)
      .single();

    if (collectionError) {
      console.error('Error fetching collection supply:', collectionError);
      throw new Error(`Failed to fetch collection supply: ${collectionError.message}`);
    }

    // Fetch minted count directly (no longer relying on separate items count for all items)
    const { count: mintedCount, error: mintedError } = await supabase
      .from('mint_transactions')
      .select('id', { count: 'exact' })
      .eq('collection_id', collectionId);

    if (mintedError) {
      console.error('Error counting minted items for stats:', mintedError);
    }
    
    // NOTE: floor_price and volume are more complex and typically require dedicated views or aggregated tables.
    // For now, these are placeholders.
    return {
      minted: mintedCount || 0,
      total_supply: collection?.total_supply || 0,
      floor_price: 0, // Placeholder
      volume: 0,      // Placeholder
      total_sales: mintedCount || 0
    };
  }

  static async getCollectionById(id: string) {
    const { data, error } = await supabase
      .from('collections')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
      console.error('Error fetching collection by ID:', error);
      throw new Error(`Failed to fetch collection: ${error.message}`);
    }

    return data;
  }

  static async updateItem(itemId: string, updateData: Partial<Omit<ItemRecord, 'id' | 'created_at'>>) {
    const finalUpdateData = {
      ...updateData,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabaseServer
      .from('items')
      .update(finalUpdateData)
      .eq('id', itemId)
      .select()
      .single();

    if (error) {
      console.error('Error updating item:', error);
      throw new Error(`Failed to update item: ${error.message}`);
    }

    return data;
  }

  static async updateItemMintStatus(itemId: string, minted: boolean, ownerWallet?: string, mintSignature?: string) {
    const updateData: Partial<ItemRecord> = {
      is_minted: minted, // Use the new, definitive flag
      owner_wallet: minted ? ownerWallet : null,
      mint_signature: minted ? mintSignature : null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseServer
      .from('items')
      .update(updateData)
      .eq('id', itemId)
      .select()
      .single();

    if (error) {
      console.error('Error updating item mint status:', error);
      throw new Error(`Failed to update item mint status: ${error.message}`);
    }

    return data;
  }

  static async getItemsByCollection(
    collectionId: string, 
    page: number = 1, 
    limit: number = 50,
    filters?: { minted?: boolean }
  ) {
    let query = supabase
      .from('items')
      .select('*', { count: 'exact' })
      .eq('collection_id', collectionId);

    // Filter by minted status using is_minted
    if (filters?.minted !== undefined) {
      if (filters.minted) {
        // Get minted items (is_minted is true)
        query = query.eq('is_minted', true);
      } else {
        // Get unminted items (is_minted is false)
        query = query.eq('is_minted', false);
      }
    }

    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching items:', error);
      throw new Error(`Failed to fetch items: ${error.message}`);
    }

    return {
      items: data || [],
      total: count || 0,
      hasNextPage: (count || 0) > limit
    };
  }


  static async updateCollectionStatus(collectionId: string, status: CollectionRecord['status']) {
    const { data, error } = await supabaseServer
      .from('collections')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', collectionId)
      .select()
      .maybeSingle();

    if (error) {
      console.error('Error updating collection status:', error);
      throw new Error(`Failed to update collection status: ${error.message}`);
    }

    // If maybeSingle returned null (no row matched), try fetching by id to report a clearer error
    if (!data) {
      const fetched = await supabase
        .from('collections')
        .select('*')
        .eq('id', collectionId)
        .maybeSingle();
      if (!fetched.data) {
        throw new Error('Collection not found');
      }
      return fetched.data;
    }

    return data;
  }

  // Mint phase operations
  static async createMintPhases(phases: Omit<MintPhaseRecord, 'id'>[]) {
    const { data, error } = await supabase
      .from('mint_phases')
      .insert(phases)
      .select();

    if (error) {
      console.error('Error creating mint phases:', error);
      throw new Error(`Failed to create mint phases: ${error.message}`);
    }

    return data;
  }

  static async createCollectionItem(item: Omit<ItemRecord, 'id'>) {
    const { data, error } = await supabaseServer
      .from('items')
      .insert(item)
      .select()
      .single();

    if (error) {
      console.error('Error creating collection item:', error);
      throw new Error(`Failed to create collection item: ${error.message}`);
    }

    return data;
  }

  static async getMintPhasesByCollectionId(collectionId: string) {
    const { data, error } = await supabase
      .from('mint_phases')
      .select('*')
      .eq('collection_id', collectionId)
      .order('start_time', { ascending: true });

    if (error) {
      console.error('Error fetching mint phases:', error);
      throw new Error(`Failed to fetch mint phases: ${error.message}`);
    }

    return data;
  }

  static async getActiveMintPhase(collectionId: string) {
    const now = new Date().toISOString();
    
    const { data, error } = await supabase
      .from('mint_phases')
      .select('*')
      .eq('collection_id', collectionId)
      .lte('start_time', now)
      .gte('end_time', now)
      .order('start_time', { ascending: true })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
      console.error('Error fetching active mint phase:', error);
      throw new Error(`Failed to fetch active mint phase: ${error.message}`);
    }

    return data;
  }

  // Mint transaction operations
  static async createMintTransaction(transaction: Omit<MintTransactionRecord, 'id' | 'created_at'>) {
    const { data, error } = await supabaseServer
      .from('mint_transactions')
      .insert([transaction])
      .select()
      .single();

    if (error) {
      console.error('Error creating mint transaction:', error);
      throw new Error(`Failed to create mint transaction: ${error.message}`);
    }

    return data;
  }

  static async getMintTransactionsByCollection(collectionId: string) {
    const { data, error } = await supabase
      .from('mint_transactions')
      .select('*')
      .eq('collection_id', collectionId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching mint transactions:', error);
      throw new Error(`Failed to fetch mint transactions: ${error.message}`);
    }

    return data;
  }

  static async getMintCountByCollection(collectionId: string) {
    const { count, error } = await supabase
      .from('mint_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('collection_id', collectionId);

    if (error) {
      console.error('Error counting mint transactions:', error);
      throw new Error(`Failed to count mint transactions: ${error.message}`);
    }

    return count || 0;
  }

  static async getUserMintCount(collectionId: string, userWallet: string) {
    const { count, error } = await supabase
      .from('mint_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('collection_id', collectionId)
      .eq('user_wallet', userWallet);

    if (error) {
      console.error('Error counting user mint transactions:', error);
      throw new Error(`Failed to count user mint transactions: ${error.message}`);
    }

    return count || 0;
  }

  // Get items by their indices
  static async getItemsByIndices(collectionId: string, itemIndices: number[]) {
    const { data, error } = await supabaseServer
      .from('items')
      .select('*')
      .eq('collection_id', collectionId)
      .in('item_index', itemIndices)
      .is('owner_wallet', null) // Only get unminted items
      .order('item_index', { ascending: true });

    if (error) {
      console.error('Error fetching items by indices:', error);
      throw new Error(`Failed to fetch items: ${error.message}`);
    }

    return data || [];
  }

  // Get all unminted items from a collection
  static async getUnmintedItems(collectionId: string) {
    const { data, error } = await supabaseServer
      .from('items')
      .select('*')
      .eq('collection_id', collectionId)
      .is('owner_wallet', null) // Only get unminted items
      .order('item_index', { ascending: true });

    if (error) {
      console.error('Error fetching unminted items:', error);
      throw new Error(`Failed to fetch unminted items: ${error.message}`);
    }

    return data || [];
  }

}