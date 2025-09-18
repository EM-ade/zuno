import { NextRequest } from 'next/server';
import { SupabaseService } from '@/lib/supabase-service';

export async function POST(request: NextRequest) {
  try {
    console.log('=== Starting Image URL Fix Process ===');
    
    const body = await request.json();
    const { collectionId, dryRun = true } = body;
    
    if (!collectionId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Collection ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Get all items for the collection
    const { items } = await SupabaseService.getItemsByCollection(collectionId, 1, 1000);
    console.log(`Found ${items.length} items to check`);
    
    const itemsToFix: Array<{
      id: string;
      name: string;
      currentUrl: string;
      suggestedUrl: string;
      issue: string;
    }> = [];
    
    for (const item of items) {
      if (!item.image_uri) {
        itemsToFix.push({
          id: item.id!,
          name: item.name,
          currentUrl: 'null',
          suggestedUrl: 'needs manual upload',
          issue: 'Missing image_uri'
        });
        continue;
      }
      
      // Check if URL is accessible
      try {
        const response = await fetch(item.image_uri, { method: 'HEAD' });
        if (!response.ok) {
          console.log(`Checking if folder structure exists for: ${item.name}`);
          
          // Try common folder structures
          const possibleUrls = [
            `${item.image_uri}/images/${item.name.toLowerCase().replace(/\s+/g, '_')}.png`,
            `${item.image_uri}/images/${item.name.toLowerCase().replace(/\s+/g, '_')}.jpg`,
            `${item.image_uri}/${item.name.toLowerCase().replace(/\s+/g, '_')}.png`,
            `${item.image_uri}/${item.name.toLowerCase().replace(/\s+/g, '_')}.jpg`,
            `${item.image_uri}/images/nft_${item.item_index || 1}.png`,
            `${item.image_uri}/nft_${item.item_index || 1}.png`
          ];
          
          let foundUrl = null;
          for (const testUrl of possibleUrls) {
            try {
              const testResponse = await fetch(testUrl, { method: 'HEAD' });
              if (testResponse.ok) {
                foundUrl = testUrl;
                break;
              }
            } catch (e) {
              // Continue to next URL
            }
          }
          
          if (foundUrl) {
            itemsToFix.push({
              id: item.id!,
              name: item.name,
              currentUrl: item.image_uri,
              suggestedUrl: foundUrl,
              issue: 'URL points to folder, found correct file'
            });
          } else {
            itemsToFix.push({
              id: item.id!,
              name: item.name,
              currentUrl: item.image_uri,
              suggestedUrl: 'manual check needed',
              issue: 'URL not accessible and no valid file found'
            });
          }
        }
      } catch (error) {
        itemsToFix.push({
          id: item.id!,
          name: item.name,
          currentUrl: item.image_uri,
          suggestedUrl: 'manual check needed',
          issue: `Network error: ${error instanceof Error ? error.message : 'Unknown'}`
        });
      }
    }
    
    console.log(`Found ${itemsToFix.length} items that need fixing`);
    
    if (!dryRun && itemsToFix.length > 0) {
      console.log('Applying fixes to database...');
      let fixedCount = 0;
      
      for (const fix of itemsToFix) {
        if (fix.suggestedUrl !== 'manual check needed' && fix.suggestedUrl !== 'needs manual upload') {
          try {
            // Update the item with the correct URL
            await SupabaseService.updateItem(fix.id, { image_uri: fix.suggestedUrl });
            fixedCount++;
            console.log(`Fixed: ${fix.name} -> ${fix.suggestedUrl}`);
          } catch (error) {
            console.error(`Failed to fix ${fix.name}:`, error);
          }
        }
      }
      
      console.log(`Successfully fixed ${fixedCount} items`);
    }
    
    return new Response(
      JSON.stringify({ 
        success: true,
        dryRun,
        totalItems: items.length,
        itemsNeedingFix: itemsToFix.length,
        itemsToFix: itemsToFix,
        message: dryRun ? 'Dry run completed - no changes made' : `Fixed ${itemsToFix.filter(f => f.suggestedUrl !== 'manual check needed' && f.suggestedUrl !== 'needs manual upload').length} items`
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error fixing image URLs:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
