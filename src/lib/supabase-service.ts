import { createClient } from '@supabase/supabase-js';
import { envConfig } from '../config/env';

// Database types
export interface CollectionRecord {
  id?: string;
  collection_mint_address: string;
  candy_machine_id: string;
  name: string;
  symbol: string;
  description: string | null;
  total_supply: number;
  royalty_percentage: number | null;
  image_uri: string | null;
  creator_wallet: string;
  status: 'draft' | 'active' | 'completed' | 'archived';
  created_at?: string;
  updated_at?: string;
}

export interface MintPhaseRecord {
  id?: string;
  collection_id: string;
  name: string;
  price: number;
  start_time: string;
  end_time: string | null;
  mint_limit: number | null;
  phase_type: 'whitelist' | 'public';
  merkle_root: string | null;
  allow_list: string[] | null;
}

export interface MintTransactionRecord {
  id?: string;
  collection_id: string;
  user_wallet: string;
  phase_id: string | null;
  signature: string;
  amount_paid: number;
  platform_fee: number;
  created_at?: string;
}

// Initialize Supabase client
const supabaseUrl = envConfig.supabaseUrl;
const supabaseAnonKey = envConfig.supabaseAnonKey;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase configuration is missing. Please check your environment variables.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export class SupabaseService {
  // Collection operations
  static async createCollection(collection: Omit<CollectionRecord, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
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

    return data;
  }

  static async updateCollectionStatus(collectionId: string, status: CollectionRecord['status']) {
    const { data, error } = await supabase
      .from('collections')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', collectionId)
      .select()
      .single();

    if (error) {
      console.error('Error updating collection status:', error);
      throw new Error(`Failed to update collection status: ${error.message}`);
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
    const { data, error } = await supabase
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
}