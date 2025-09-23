'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase-service'

interface ProgressUpdate {
  collection_id: string
  minted_count: number
  total_supply: number
  progress: number
}

export function useRealtimeProgress(collectionId: string | null) {
  const [progress, setProgress] = useState<ProgressUpdate | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  const fetchInitialProgress = useCallback(async () => {
    if (!collectionId) return

    try {
      // Get current minted count from items where minted = TRUE
      const { count: mintedCount } = await supabase
        .from('items')
        .select('*', { count: 'exact', head: true })
        .eq('collection_id', collectionId)
        .eq('minted', true) // Check the 'minted' column, not 'is_minted'
      
      // Also get total items count for this collection
      const { count: totalItems } = await supabase
        .from('items')
        .select('*', { count: 'exact', head: true })
        .eq('collection_id', collectionId)

      // Get collection info
      const { data: collection } = await supabase
        .from('collections')
        .select('total_supply')
        .eq('id', collectionId)
        .single()

      if (collection) {
        const actualTotalItems = totalItems || collection.total_supply;
        const progressData = {
          collection_id: collectionId,
          minted_count: mintedCount || 0,
          total_supply: actualTotalItems,
          progress: actualTotalItems > 0 
            ? Math.min(100, ((mintedCount || 0) / actualTotalItems) * 100)
            : 0
        }
        
        console.log('Progress calculation:', {
          collectionId,
          mintedCount,
          totalItems,
          collectionTotalSupply: collection.total_supply,
          actualTotalUsed: actualTotalItems,
          progressPercentage: progressData.progress
        });
        
        setProgress(progressData)
      }
    } catch (error) {
      console.error('Error fetching initial progress:', error)
    }
  }, [collectionId])

  useEffect(() => {
    if (!collectionId) return

    // Fetch initial progress
    fetchInitialProgress()

    // Set up real-time subscription for items table changes
    const itemsSubscription = supabase
      .channel(`items-${collectionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'items',
          filter: `collection_id=eq.${collectionId}`
        },
        async (payload) => {
          console.log('Items table change detected:', payload)
          // Refetch progress when items change
          await fetchInitialProgress()
        }
      )
      .subscribe((status) => {
        console.log('Items subscription status:', status)
        setIsConnected(status === 'SUBSCRIBED')
      })

    // Set up real-time subscription for mint_transactions table
    const transactionsSubscription = supabase
      .channel(`transactions-${collectionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'mint_transactions',
          filter: `collection_id=eq.${collectionId}`
        },
        async (payload) => {
          console.log('New mint transaction detected:', payload)
          // Refetch progress when new mints happen
          await fetchInitialProgress()
        }
      )
      .subscribe()

    // Cleanup subscriptions
    return () => {
      supabase.removeChannel(itemsSubscription)
      supabase.removeChannel(transactionsSubscription)
    }
  }, [collectionId, fetchInitialProgress])

  // Fallback polling for critical updates (every 10 seconds)
  useEffect(() => {
    if (!collectionId) return

    const interval = setInterval(() => {
      fetchInitialProgress()
    }, 10000) // Poll every 10 seconds as backup

    return () => clearInterval(interval)
  }, [collectionId, fetchInitialProgress])

  return {
    progress,
    isConnected,
    refetch: fetchInitialProgress
  }
}
