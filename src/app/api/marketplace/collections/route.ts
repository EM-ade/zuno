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

    // Try using materialized view first, fallback to regular table if it fails
    let query;
    let useMaterializedView = true;
    
    try {
      // Try materialized view first
      query = supabaseServer.from("collection_stats_enhanced").select(
        "*",
        { count: "exact" }
      );
    } catch (error) {
      console.log('Materialized view not available, using regular collections table');
      useMaterializedView = false;
      // Fallback to regular collections table
      query = supabaseServer.from("collections").select(
        "*",
        { count: "exact" }
      );
    }

    // Apply filters based on whether we're using materialized view or not
    if (status && status !== "all") {
      if (useMaterializedView) {
        // Use computed_status from materialized view
        if (status === "live") {
          query = query.eq("computed_status", "live");
        } else if (status === "upcoming") {
          query = query.eq("computed_status", "upcoming");
        } else if (status === "ended") {
          query = query.eq("computed_status", "ended");
        } else if (status === "sold_out") {
          query = query.eq("computed_status", "sold_out");
        } else {
          query = query.eq("status", status);
        }
      } else {
        // Use regular status mapping for collections table
        if (status === "live") {
          query = query.in("status", ["active", "live"]);
        } else if (status === "upcoming") {
          query = query.eq("status", "draft");
        } else if (status === "sold_out") {
          query = query.eq("status", "sold_out");
        } else {
          query = query.eq("status", status);
        }
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
      
      // If materialized view failed, try fallback to regular table
      if (useMaterializedView) {
        console.log('Materialized view query failed, trying regular collections table...');
        try {
          const fallbackQuery = supabaseServer.from("collections").select(
            "*",
            { count: "exact" }
          );
          
          // Apply basic status filters for fallback
          if (status && status !== "all") {
            if (status === "live") {
              fallbackQuery.in("status", ["active", "live"]);
            } else if (status === "upcoming") {
              fallbackQuery.eq("status", "draft");
            } else {
              fallbackQuery.eq("status", status);
            }
          }
          
          if (search) {
            const searchTerm = `%${search.toLowerCase()}%`;
            fallbackQuery.or(
              `name.ilike.${searchTerm},description.ilike.${searchTerm}`
            );
          }
          if (creator) {
            fallbackQuery.eq("creator_wallet", creator);
          }
          
          fallbackQuery.order(sortBy, { ascending: sortOrder === "asc" });
          fallbackQuery.range(offset, offset + limit - 1);
          
          const fallbackResult = await fallbackQuery;
          
          if (fallbackResult.error) {
            throw fallbackResult.error;
          }
          
          // Process fallback data
          const fallbackCollections = fallbackResult.data || [];
          const fallbackFormattedCollections = fallbackCollections.map((c: any) => ({
            ...c,
            image_uri: c.image_uri ? resolveImageUrl(c.image_uri) : null,
            progress: c.total_supply > 0 ? Math.min(100, Math.round((c.minted_count / c.total_supply) * 100)) : 0,
            mintUrl: `/mint/${c.collection_mint_address || c.candy_machine_id}`,
            displayPrice: `${c.price || 0} SOL`,
            displaySupply: `${c.minted_count || 0}/${c.total_supply}`,
            isSoldOut: (c.minted_count || 0) >= c.total_supply,
            status: c.status,
            computed_status: c.minted_count >= c.total_supply ? 'sold_out' : 
                            c.status === 'active' ? 'live' : 
                            c.status === 'draft' ? 'upcoming' : 'ended',
            items_count: c.total_supply || 0,
            volume: 0,
            floor_price: c.price || 0,
            unique_holders: c.minted_count || 0,
            actual_minted_count: c.minted_count || 0,
            progress_percentage: c.total_supply > 0 ? Math.round((c.minted_count / c.total_supply) * 100) : 0
          }));
          
          const fallbackResponseData = JSON.stringify({
            success: true,
            collections: fallbackFormattedCollections,
            pagination: {
              total: fallbackResult.count,
              page,
              limit,
              totalPages: Math.ceil((fallbackResult.count || 0) / limit),
            },
            meta: {
              timestamp: Date.now(),
              source: 'fallback_collections_table'
            },
          });
          
          await redis.setex(cacheKey, CACHE_TTL, fallbackResponseData);
          console.log(`Fallback data cached for key: ${cacheKey}`);
          
          return new Response(fallbackResponseData, {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
          
        } catch (fallbackError) {
          console.error('Fallback query also failed:', fallbackError);
          return NextResponse.json(
            {
              success: false,
              error: "Failed to fetch collections",
              details: `Primary query failed: ${error.message}. Fallback also failed: ${(fallbackError as Error).message}`,
            },
            { status: 500 }
          );
        }
      }
      
      return NextResponse.json(
        {
          success: false,
          error: "Failed to fetch collections",
          details: error.message,
        },
        { status: 500 }
      );
    }

    const formattedCollections = (collections || []).map(
      (c: any) => {
        // Handle both materialized view data and regular collections data
        const isFromMaterializedView = useMaterializedView && c.computed_status !== undefined;
        
        return {
          ...c,
          image_uri: c.image_uri
            ? resolveImageUrl(c.image_uri)
            : null,
          progress: isFromMaterializedView 
            ? Math.min(100, Math.round(c.progress_percentage || 0))
            : c.total_supply > 0 
              ? Math.min(100, Math.round((c.minted_count / c.total_supply) * 100))
              : 0,
          mintUrl: `/mint/${
            c.collection_mint_address ||
            c.candy_machine_id
          }`,
          displayPrice: `${c.price || 0} SOL`,
          displaySupply: isFromMaterializedView
            ? `${c.actual_minted_count || c.minted_count || 0}/${c.total_supply}`
            : `${c.minted_count || 0}/${c.total_supply}`,
          isSoldOut: isFromMaterializedView
            ? (c.actual_minted_count || c.minted_count || 0) >= c.total_supply
            : (c.minted_count || 0) >= c.total_supply,
          status: isFromMaterializedView 
            ? (c.computed_status || getCollectionStatus(c))
            : getCollectionStatus(c),
          timeLeft: calculateTimeLeft(c),
          // Include the enhanced stats (use defaults if not from materialized view)
          items_count: c.items_count || c.total_supply || 0,
          volume: c.volume || 0,
          floor_price: c.floor_price || c.price || 0,
          unique_holders: c.unique_holders || 0,
          actual_minted_count: c.actual_minted_count || c.minted_count || 0,
          progress_percentage: c.progress_percentage || 
            (c.total_supply > 0 ? Math.round((c.minted_count / c.total_supply) * 100) : 0)
        };
      }
    );

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
        source: useMaterializedView ? 'materialized_view' : 'collections_table'
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

// Helper functions (moved or re-defined here if not globally available)
function getCollectionStatus(
  collection: CollectionRecord
): "live" | "upcoming" | "ended" {
  const now = new Date();
  const startDate = collection.start_date
    ? new Date(collection.start_date)
    : null;
  const endDate = collection.end_date ? new Date(collection.end_date) : null;

  if (collection.minted_count >= collection.total_supply) {
    return "ended";
  }

  if (startDate && startDate.getTime() > now.getTime()) {
    return "upcoming";
  }

  if (endDate && endDate.getTime() < now.getTime()) {
    return "ended";
  }

  return "live";
}

function calculateTimeLeft(collection: CollectionRecord): string | null {
  const endDate = collection.end_date ? new Date(collection.end_date) : null;
  if (!endDate) return null;

  const now = new Date();
  const diff = endDate.getTime() - now.getTime();

  if (diff <= 0) return "Ended";

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h left`;

  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${minutes}m left`;
}
