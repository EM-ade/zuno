import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-service";
import { resolveImageUrl } from "@/utils/resolveImageUrl";
import { redis } from "@/lib/redis-service"; // Import the Redis client

interface CollectionRecord {
  id: string;
  collection_mint_address: string;
  candy_machine_id: string | null;
  name: string;
  symbol: string;
  description: string | null;
  image_uri: string | null;
  price: number;
  total_supply: number;
  minted_count: number;
  status: string;
  created_at: string;
  updated_at: string;
  start_date?: string | null; // From phases, might be needed for status/timeleft
  end_date?: string | null; // From phases, might be needed for status/timeleft
}

const PAGE_SIZE = 12; // Define PAGE_SIZE
const CACHE_TTL = 60; // Cache TTL in seconds

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || String(PAGE_SIZE), 10);
  const search = searchParams.get("search");
  const status = searchParams.get("status") || "active";
  const creator = searchParams.get("creator"); // Assuming creator filter can be passed
  const sortBy = searchParams.get("sortBy") || "created_at";
  const sortOrder = searchParams.get("sortOrder") || "desc";

  // Construct a cache key based on all relevant query parameters
  const cacheKey = `marketplace_collections:${page}:${limit}:${
    search || ""
  }:${status}:${creator || ""}:${sortBy}:${sortOrder}`;

  try {
    // 1. Try to fetch from Redis cache
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      console.log(`Cache Hit for key: ${cacheKey}`);
      return new Response(cachedData, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    console.log(`Cache Miss for key: ${cacheKey}. Fetching from Supabase.`);

    // 2. If not in cache, fetch from Supabase
    const offset = (page - 1) * limit;

    // Use regular collections table directly (skip materialized view for now)
    let query = supabaseServer.from("collections").select(
      "*",
      { count: "exact" }
    );

    // Apply status filters
    if (status && status !== "all") {
      if (status === "live") {
        query = query.in("status", ["active", "live"]);
      } else if (status === "upcoming") {
        query = query.eq("status", "draft");
      } else if (status === "sold_out") {
        query = query.eq("status", "sold_out");
      } else if (status === "ended") {
        query = query.eq("status", "completed");
      } else {
        query = query.eq("status", status);
      }
    }
    
    if (search) {
      const searchTerm = `%${search.toLowerCase()}%`;
      query = query.or(
        `name.ilike.${searchTerm},description.ilike.${searchTerm}`
      );
    }
    
    if (creator) {
      query = query.eq("creator_wallet", creator);
    }

    // Apply sorting
    query = query.order(sortBy, { ascending: sortOrder === "asc" });

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: collections, error, count } = await query;

    if (error) {
      console.error("Error fetching collections from Supabase:", error);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to fetch collections",
          details: error.message,
        },
        { status: 500 }
      );
    }

    // Process collections to add computed fields
    const formattedCollections = (collections || []).map((c: any) => {
      // Calculate actual minted count from items table
      const progress = c.total_supply > 0 
        ? Math.min(100, Math.round((c.minted_count / c.total_supply) * 100))
        : 0;
      
      return {
        ...c,
        image_uri: c.image_uri ? resolveImageUrl(c.image_uri) : null,
        progress: progress,
        mintUrl: `/mint/${c.collection_mint_address || c.candy_machine_id}`,
        displayPrice: `${c.price || 0} SOL`,
        displaySupply: `${c.minted_count || 0}/${c.total_supply}`,
        isSoldOut: (c.minted_count || 0) >= c.total_supply,
        status: c.status,
        computed_status: c.minted_count >= c.total_supply ? 'sold_out' : 
                        c.status === 'active' || c.status === 'live' ? 'live' : 
                        c.status === 'draft' ? 'upcoming' : 'ended',
        items_count: c.total_supply || 0,
        volume: 0,
        floor_price: c.price || 0,
        unique_holders: c.minted_count || 0,
        actual_minted_count: c.minted_count || 0,
        progress_percentage: c.total_supply > 0 ? Math.round((c.minted_count / c.total_supply) * 100) : 0,
        timeLeft: calculateTimeLeft(c)
      };
    });

    const responseData = JSON.stringify({
      success: true,
      collections: formattedCollections,
      pagination: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
      },
      meta: {
        timestamp: Date.now(),
        source: 'collections_table'
      },
    });

    // 3. Store the result in Redis cache with an expiration time
    await redis.setex(cacheKey, CACHE_TTL, responseData);
    console.log(`Data cached for key: ${cacheKey} with TTL: ${CACHE_TTL}s`);

    return new Response(responseData, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error in marketplace collections API route:", err);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch collections",
        details: (err as Error).message,
      },
      { status: 500 }
    );
  }
}

// Helper function to calculate time left
function calculateTimeLeft(collection: any): string | null {
  // For now, return null as we don't have phase data in this endpoint
  // This could be enhanced later to fetch phase data if needed
  return null;
}
