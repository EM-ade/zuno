import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-service';

/**
 * Fix image URLs that are pointing to IPFS directories instead of actual image files
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const collectionId = body.collectionId;
    
    // Get all items for the collection
    let query = supabaseServer.from('items').select('*');
    
    if (collectionId) {
      query = query.or(`collection_id.eq.${collectionId},collection_address.eq.${collectionId}`);
    }
    
    const { data: items, error } = await query;
    
    if (error) {
      throw error;
    }
    
    if (!items || items.length === 0) {
      return NextResponse.json({
        message: 'No items found',
        fixed: 0
      });
    }
    
    let fixedCount = 0;
    const fixes = [];
    
    for (const item of items) {
      if (item.image_uri && item.image_uri.includes('ipfs')) {
        // Check if the URL is a directory (doesn't end with an image extension)
        const hasImageExtension = /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(item.image_uri);
        
        if (!hasImageExtension) {
          // This is likely a directory URL, try to construct the actual image URL
          let fixedUrl = item.image_uri;
          
          // Check if the name contains path information
          if (item.name && item.name.includes('/')) {
            // Extract the filename from the name (e.g., "folder/images/nft_2" -> "nft_2")
            const parts = item.name.split('/');
            const imageName = parts[parts.length - 1];
            
            // Construct the full image URL
            // Pattern: base_url/folder_path/filename.extension
            fixedUrl = `${item.image_uri}/${item.name}.png`;
          } else {
            // Try common patterns
            const possiblePaths = [
              `${item.image_uri}/${item.name}.png`,
              `${item.image_uri}/images/${item.name}.png`,
              `${item.image_uri}/${item.name.replace(/\s+/g, '_')}.png`,
              `${item.image_uri}/nft_${item.item_index}.png`
            ];
            
            // Try to find which URL works
            for (const url of possiblePaths) {
              try {
                const response = await fetch(url, { method: 'HEAD' });
                if (response.ok) {
                  fixedUrl = url;
                  break;
                }
              } catch {
                // Continue to next URL
              }
            }
          }
          
          // Update the database if we found a different URL
          if (fixedUrl !== item.image_uri) {
            const { error: updateError } = await supabaseServer
              .from('items')
              .update({ image_uri: fixedUrl })
              .eq('id', item.id);
            
            if (!updateError) {
              fixedCount++;
              fixes.push({
                id: item.id,
                name: item.name,
                oldUrl: item.image_uri,
                newUrl: fixedUrl
              });
            }
          }
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Fixed ${fixedCount} image URLs`,
      totalItems: items.length,
      fixes
    });
    
  } catch (error) {
    console.error('Error fixing image URLs:', error);
    return NextResponse.json({
      error: 'Failed to fix image URLs',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// GET endpoint to check current image URLs
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const collectionId = searchParams.get('collectionId');
    
    let query = supabaseServer.from('items').select('id, name, image_uri, item_index');
    
    if (collectionId) {
      query = query.or(`collection_id.eq.${collectionId},collection_address.eq.${collectionId}`);
    }
    
    query = query.limit(10);
    
    const { data: items, error } = await query;
    
    if (error) {
      throw error;
    }
    
    const analysis = (items || []).map(item => ({
      id: item.id,
      name: item.name,
      imageUri: item.image_uri,
      hasExtension: /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(item.image_uri || ''),
      isDirectory: item.image_uri && !item.image_uri.match(/\.(png|jpg|jpeg|gif|webp|svg)$/i),
      suggestedFix: item.image_uri && !item.image_uri.match(/\.(png|jpg|jpeg|gif|webp|svg)$/i) 
        ? `${item.image_uri}/${item.name}.png`
        : null
    }));
    
    return NextResponse.json({
      items: analysis,
      needsFix: analysis.filter(a => a.isDirectory).length,
      total: analysis.length
    });
    
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to analyze image URLs',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
