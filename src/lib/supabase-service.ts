import { createClient } from "@supabase/supabase-js";
import { envConfig } from "../config/env";

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
  status: "draft" | "active" | "completed" | "archived";
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
  minted?: boolean;
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
  phase_type: "og" | "whitelist" | "public" | "custom"; // Now an enum in DB, matching client type
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
  throw new Error(
    "Supabase configuration is missing. Please check your environment variables."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server-side client using service role key for privileged writes (RLS bypass)
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
export const supabaseServer = supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey)
  : supabase; // fallback to anon if not provided

export class SupabaseService {
  // Collection operations
  static async createCollection(
    collection: Omit<CollectionRecord, "id" | "created_at" | "updated_at">
  ) {
    const { data, error } = await supabaseServer
      .from("collections")
      .insert([collection])
      .select()
      .single();

    if (error) {
      console.error("Error creating collection:", error);
      throw new Error(`Failed to create collection: ${error.message}`);
    }
    return data;
  }

  static async upsertCollection(
    collection: Omit<CollectionRecord, "id" | "created_at" | "updated_at">
  ) {
    const { data, error } = await supabaseServer
      .from("collections")
      .upsert(collection, { onConflict: "collection_mint_address" })
      .select()
      .single();

    if (error) {
      console.error("Error upserting collection:", error);
      throw new Error(`Failed to upsert collection: ${error.message}`);
    }
    return data;
  }

  // Items operations
  static async createItems(items: Omit<ItemRecord, "id" | "created_at">[]) {
    const { data, error } = await supabaseServer
      .from("items")
      .insert(items)
      .select();
    if (error) {
      console.error("Error creating items:", error);
      throw new Error(`Failed to create items: ${error.message}`);
    }
    return data;
  }

  static async getCollectionByMintAddress(collectionMintAddress: string) {
    const { data, error } = await supabase
      .from("collections")
      .select("*")
      .eq("collection_mint_address", collectionMintAddress)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 is "not found"
      console.error("Error fetching collection:", error);
      throw new Error(`Failed to fetch collection: ${error.message}`);
    }

    return data;
  }

  static async getCollectionByCandyMachineId(candyMachineId: string) {
    const { data, error } = await supabase
      .from("collections")
      .select("*")
      .eq("candy_machine_id", candyMachineId)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 is "not found"
      console.error("Error fetching collection:", error);
      throw new Error(`Failed to fetch collection: ${error.message}`);
    }

    return data;
  }

  static async getCollectionsByStatus(status: CollectionRecord["status"]) {
    const { data, error } = await supabase
      .from("collections")
      .select("*")
      .eq("status", status)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching collections:", error);
      throw new Error(`Failed to fetch collections: ${error.message}`);
    }

    return data || [];
  }

  static async getCollectionsByCreator(creatorWallet: string) {
    // Fetch collections and related stats (minted_count, items_count, floor_price, volume) in a single query
    // using Supabase table joins and PostgREST features.
    const { data, error } = await supabase
      .from("collections")
      .select(
        `
        *,
        items(count),
        mint_transactions(count)
      `
      )
      .eq("creator_wallet", creatorWallet)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching creator collections:", error);
      throw new Error(`Failed to fetch creator collections: ${error.message}`);
    }

    // Process the data efficiently
    const collectionsWithStats = data?.map((collection) => {
      // Get actual counts from the aggregated data
      const itemsCount = Array.isArray(collection.items)
        ? collection.items.length
        : 0;
      const mintedCount = Array.isArray(collection.mint_transactions)
        ? collection.mint_transactions.length
        : 0;

      return {
        ...collection,
        items_count: itemsCount,
        minted_count: mintedCount,
        floor_price: collection.floor_price || 0,
        volume: collection.volume || 0,
        // Remove the nested objects to clean up the response
        items: undefined,
        mint_transactions: undefined,
      };
    });

    return collectionsWithStats || [];
  }

  static async getCollectionMintStats(collectionId: string) {
    // This function will now be simplified or removed as its data is integrated into getCollectionsByCreator
    // For now, let's keep it as a placeholder or to retrieve other stats if needed.
    const { data: collection, error: collectionError } = await supabase
      .from("collections")
      .select("total_supply")
      .eq("id", collectionId)
      .single();

    if (collectionError) {
      console.error("Error fetching collection supply:", collectionError);
      throw new Error(
        `Failed to fetch collection supply: ${collectionError.message}`
      );
    }

    // Fetch minted count directly (no longer relying on separate items count for all items)
    const { count: mintedCount, error: mintedError } = await supabase
      .from("mint_transactions")
      .select("id", { count: "exact" })
      .eq("collection_id", collectionId);

    if (mintedError) {
      console.error("Error counting minted items for stats:", mintedError);
    }

    // NOTE: floor_price and volume are more complex and typically require dedicated views or aggregated tables.
    // For now, these are placeholders.
    return {
      minted: mintedCount || 0,
      total_supply: collection?.total_supply || 0,
      floor_price: 0, // Placeholder
      volume: 0, // Placeholder
      total_sales: mintedCount || 0,
    };
  }

  static async getCollectionById(id: string) {
    const { data, error } = await supabase
      .from("collections")
      .select("*")
      .eq("id", id)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 is "not found"
      console.error("Error fetching collection by ID:", error);
      throw new Error(`Failed to fetch collection: ${error.message}`);
    }

    return data;
  }

  static async updateItem(
    itemId: string,
    updateData: Partial<Omit<ItemRecord, "id" | "created_at">>
  ) {
    const finalUpdateData = {
      ...updateData,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseServer
      .from("items")
      .update(finalUpdateData)
      .eq("id", itemId)
      .select()
      .single();

    if (error) {
      console.error("Error updating item:", error);
      throw new Error(`Failed to update item: ${error.message}`);
    }

    return data;
  }

  static async updateItemMintStatus(
    itemId: string,
    minted: boolean,
    ownerWallet?: string,
    mintSignature?: string
  ) {
    const updateData: Partial<ItemRecord> = {
      minted: minted, // Use the minted column
      owner_wallet: minted ? ownerWallet : null,
      mint_signature: minted ? mintSignature : null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseServer
      .from("items")
      .update(updateData)
      .eq("id", itemId)
      .select()
      .single();

    if (error) {
      console.error("Error updating item mint status:", error);
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
      .from("items")
      .select("*", { count: "exact" })
      .eq("collection_id", collectionId);

    // Filter by minted status using minted column
    if (filters?.minted !== undefined) {
      if (filters.minted) {
        // Get minted items (minted is true)
        query = query.eq("minted", true);
      } else {
        // Get unminted items (minted is false)
        query = query.eq("minted", false);
      }
    }

    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error("Error fetching items:", error);
      throw new Error(`Failed to fetch items: ${error.message}`);
    }

    return {
      items: data || [],
      total: count || 0,
      hasNextPage: (count || 0) > limit,
    };
  }

  static async updateCollectionStatus(
    collectionId: string,
    status: CollectionRecord["status"]
  ) {
    const { data, error } = await supabaseServer
      .from("collections")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", collectionId)
      .select()
      .maybeSingle();

    if (error) {
      console.error("Error updating collection status:", error);
      throw new Error(`Failed to update collection status: ${error.message}`);
    }

    // If maybeSingle returned null (no row matched), try fetching by id to report a clearer error
    if (!data) {
      const fetched = await supabase
        .from("collections")
        .select("*")
        .eq("id", collectionId)
        .maybeSingle();
      if (!fetched.data) {
        throw new Error("Collection not found");
      }
      return fetched.data;
    }

    return data;
  }

  // Mint phase operations
  static async createMintPhases(phases: Omit<MintPhaseRecord, "id">[]) {
    const { data, error } = await supabase
      .from("mint_phases")
      .insert(phases)
      .select();

    if (error) {
      console.error("Error creating mint phases:", error);
      throw new Error(`Failed to create mint phases: ${error.message}`);
    }

    return data;
  }

  static async createCollectionItem(item: Omit<ItemRecord, "id">) {
    const { data, error } = await supabaseServer
      .from("items")
      .insert(item)
      .select()
      .single();

    if (error) {
      console.error("Error creating collection item:", error);
      throw new Error(`Failed to create collection item: ${error.message}`);
    }

    return data;
  }

  static async getMintPhasesByCollectionId(collectionId: string) {
    const { data, error } = await supabase
      .from("mint_phases")
      .select("*")
      .eq("collection_id", collectionId)
      .order("start_time", { ascending: true });

    if (error) {
      console.error("Error fetching mint phases:", error);
      throw new Error(`Failed to fetch mint phases: ${error.message}`);
    }

    return data;
  }

  static async getActiveMintPhase(collectionId: string) {
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("mint_phases")
      .select("*")
      .eq("collection_id", collectionId)
      .lte("start_time", now)
      .gte("end_time", now)
      .order("start_time", { ascending: true })
      .limit(1)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 is "not found"
      console.error("Error fetching active mint phase:", error);
      throw new Error(`Failed to fetch active mint phase: ${error.message}`);
    }

    return data;
  }

  // Mint transaction operations
  static async createMintTransaction(
    transaction: Omit<MintTransactionRecord, "id" | "created_at">
  ) {
    const { data, error } = await supabaseServer
      .from("mint_transactions")
      .insert([transaction])
      .select()
      .single();

    if (error) {
      console.error("Error creating mint transaction:", error);
      throw new Error(`Failed to create mint transaction: ${error.message}`);
    }

    return data;
  }

  static async getMintTransactionsByCollection(collectionId: string) {
    const { data, error } = await supabase
      .from("mint_transactions")
      .select("*")
      .eq("collection_id", collectionId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching mint transactions:", error);
      throw new Error(`Failed to fetch mint transactions: ${error.message}`);
    }

    return data;
  }

  static async getMintCountByCollection(collectionId: string) {
    const { count, error } = await supabase
      .from("mint_transactions")
      .select("*", { count: "exact", head: true })
      .eq("collection_id", collectionId);

    if (error) {
      console.error("Error counting mint transactions:", error);
      throw new Error(`Failed to count mint transactions: ${error.message}`);
    }

    return count || 0;
  }

  static async getUserMintCount(collectionId: string, userWallet: string) {
    const { count, error } = await supabase
      .from("mint_transactions")
      .select("*", { count: "exact", head: true })
      .eq("collection_id", collectionId)
      .eq("user_wallet", userWallet);

    if (error) {
      console.error("Error counting user mint transactions:", error);
      throw new Error(
        `Failed to count user mint transactions: ${error.message}`
      );
    }

    return count || 0;
  }

  // Get items by their indices
  static async getItemsByIndices(collectionId: string, itemIndices: number[]) {
    const { data, error } = await supabaseServer
      .from("items")
      .select("*")
      .eq("collection_id", collectionId)
      .in("item_index", itemIndices)
      .is("owner_wallet", null) // Only get unminted items
      .order("item_index", { ascending: true });

    if (error) {
      console.error("Error fetching items by indices:", error);
      throw new Error(`Failed to fetch items: ${error.message}`);
    }

    return data || [];
  }

  // Get all unminted items from a collection
  static async getUnmintedItems(collectionId: string) {
    const { data, error } = await supabaseServer
      .from("items")
      .select("*")
      .eq("collection_id", collectionId)
      .is("owner_wallet", null) // Only get unminted items
      .order("item_index", { ascending: true });

    if (error) {
      console.error("Error fetching unminted items:", error);
      throw new Error(`Failed to fetch unminted items: ${error.message}`);
    }

    return data || [];
  }

  // Batch minting methods
  static async getAvailableItemsForMinting(
    collectionId: string,
    quantity: number
  ) {
    try {
      // First, try to get unminted items that aren't reserved
      let { data, error } = await supabaseServer // Use supabaseServer for consistent access
        .from("items")
        .select("*")
        .eq("collection_id", collectionId)
        .eq("minted", false) // Only get items that haven't been minted
        .is("owner_wallet", null) // Only get items that aren't reserved
        .order("item_index", { ascending: true }) // Get items in sequential order
        .limit(quantity);

      // If we don't have enough items and there might be reserved items, 
      // also get items that were reserved more than 10 minutes ago (likely abandoned)
      if ((!data || data.length < quantity) && quantity > 0) {
        const { data: reservedData, error: reservedError } = await supabaseServer
          .from("items")
          .select("*")
          .eq("collection_id", collectionId)
          .eq("minted", false)
          .not("owner_wallet", "is", null) // Get items that are reserved
          .lt("updated_at", new Date(Date.now() - 10 * 60 * 1000).toISOString()) // Reserved more than 10 minutes ago
          .order("item_index", { ascending: true })
          .limit(quantity);

        if (!reservedError && reservedData && reservedData.length > 0) {
          // Combine the results, prioritizing unreserved items
          const combinedData = [...(data || []), ...reservedData];
          // Sort by item_index to maintain sequential order
          combinedData.sort((a, b) => {
            const indexA = a.item_index || 0;
            const indexB = b.item_index || 0;
            return indexA - indexB;
          });
          // Take only the quantity needed
          data = combinedData.slice(0, quantity);
        }
      }

      if (error) {
        console.error("Error fetching available items:", error);
        throw error;
      }

      // Double-check that all items are unminted
      const unmintedItems = data ? data.filter(item => item.minted === false) : [];
      
      // Return only the requested quantity or fewer if not enough available
      return unmintedItems.slice(0, quantity);
    } catch (error) {
      console.error("Error in getAvailableItemsForMinting:", error);
      throw error;
    }
  }

  static async reserveItemsForMinting(
    itemIds: string[],
    buyerWallet: string,
    idempotencyKey: string
  ) {
    try {
      const { error } = await supabaseServer
        .from("items")
        .update({
          owner_wallet: buyerWallet, // Temporarily reserve to this wallet
          mint_signature: idempotencyKey, // Use mint_signature field to store idempotency key temporarily
          updated_at: new Date().toISOString(),
        })
        .in("id", itemIds)
        .eq("minted", false) // Only reserve items that haven't been minted
        .or("owner_wallet.is.null,updated_at.lt." + new Date(Date.now() - 10 * 60 * 1000).toISOString()); // Only reserve items that aren't reserved or were reserved more than 10 minutes ago

      if (error) {
        console.error("Error reserving items:", error);
        throw error;
      }

      return { success: true };
    } catch (error) {
      console.error("Error in reserveItemsForMinting:", error);
      throw error;
    }
  }

  static async finalizeBatchMint({
    collectionId,
    itemIds,
    buyerWallet,
    transactionSignature,
    idempotencyKey,
  }: {
    collectionId: string;
    itemIds: string[];
    buyerWallet: string;
    transactionSignature: string;
    idempotencyKey: string;
  }) {
    try {
      // Update items to mark as minted with actual transaction signature
      const { data: updatedItems, error: itemsError } = await supabaseServer
        .from("items")
        .update({
          minted: true, // Mark items as minted
          owner_wallet: buyerWallet,
          mint_signature: transactionSignature,
          updated_at: new Date().toISOString(),
        })
        .in("id", itemIds)
        .eq("mint_signature", idempotencyKey) // Match the temporary idempotency key
        .select();

      if (itemsError) {
        console.error("Error finalizing items:", itemsError);
        throw itemsError;
      }

      // Create mint transaction record
      const { error: transactionError } = await supabaseServer
        .from("mint_transactions")
        .insert({
          collection_id: collectionId,
          user_wallet: buyerWallet,
          signature: transactionSignature,
          amount_paid: 0, // Will be calculated based on phase price
          platform_fee: 0, // Will be calculated
          metadata: {
            batch_mint: true,
            item_count: itemIds.length,
            idempotency_key: idempotencyKey,
          },
        });

      if (transactionError) {
        console.error("Error creating mint transaction:", transactionError);
        // Don't throw here as the items are already updated
      }

      return {
        success: true,
        mintedItems: updatedItems,
      };
    } catch (error) {
      console.error("Error in finalizeBatchMint:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
