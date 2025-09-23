import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-service";

export async function GET(request: NextRequest) {
  try {
    console.log("Testing collections API...");
    
    // Test basic collections query
    const { data: collections, error, count } = await supabaseServer
      .from("collections")
      .select("*", { count: "exact" })
      .limit(5);

    if (error) {
      console.error("Database error:", error);
      return NextResponse.json({
        success: false,
        error: error.message,
        details: error
      }, { status: 500 });
    }

    console.log(`Found ${count} total collections, returning ${collections?.length} collections`);
    console.log("Sample collections:", collections);

    // Test materialized view
    let materializedViewData = null;
    let materializedViewError = null;

    try {
      const { data: mvData, error: mvError } = await supabaseServer
        .from("collection_stats_enhanced")
        .select("*")
        .limit(5);

      if (mvError) {
        materializedViewError = mvError.message;
        console.error("Materialized view error:", mvError);
      } else {
        materializedViewData = mvData;
        console.log("Materialized view data:", mvData);
      }
    } catch (mvErr) {
      materializedViewError = (mvErr as Error).message;
      console.error("Materialized view exception:", mvErr);
    }

    return NextResponse.json({
      success: true,
      data: {
        totalCollections: count,
        sampleCollections: collections,
        materializedView: {
          available: materializedViewError === null,
          error: materializedViewError,
          sampleData: materializedViewData
        }
      }
    });

  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json({
      success: false,
      error: "Unexpected error occurred",
      details: (error as Error).message
    }, { status: 500 });
  }
}