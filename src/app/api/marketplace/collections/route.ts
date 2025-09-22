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

    // Use the enhanced materialized view for better performance
    let query = supabaseServer
      .from("collection_stats_enhanced")
      .select("*", { count: "exact" });

    // Apply filters using computed_status for better performance
    if (status) {
      query = query.eq("computed_status", status);
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

    const formattedCollections = (collections || []).map(
      (
        c: CollectionRecord & {
          mint_phases: Array<{ start_time: string; end_time: string | null }>;
        }
      ) => {
        const latestPhase = c.mint_phases?.[0]; // Assuming mint_phases is ordered or we take the first
        const collectionWithDates = {
          ...c,
          start_date: latestPhase?.start_time,
          end_date: latestPhase?.end_time,
        };

        return {
          ...collectionWithDates,
          image_uri: collectionWithDates.image_uri
            ? resolveImageUrl(collectionWithDates.image_uri)
            : null,
          progress:
            collectionWithDates.total_supply > 0
              ? Math.min(
                  100,
                  Math.round(
                    (collectionWithDates.minted_count /
                      collectionWithDates.total_supply) *
                      100
                  )
                )
              : 0,
          mintUrl: `/mint/${
            collectionWithDates.collection_mint_address ||
            collectionWithDates.candy_machine_id
          }`,
          displayPrice: `${collectionWithDates.price} SOL`,
          displaySupply: `${collectionWithDates.minted_count || 0}/${
            collectionWithDates.total_supply
          }`,
          isSoldOut:
            (collectionWithDates.minted_count || 0) >=
            collectionWithDates.total_supply,
          status: getCollectionStatus(collectionWithDates), // Pass typed collection
          timeLeft: calculateTimeLeft(collectionWithDates), // Pass typed collection
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
