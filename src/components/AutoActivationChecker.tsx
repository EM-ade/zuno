'use client'

import { useEffect } from 'react'

export default function AutoActivationChecker() {
  useEffect(() => {
    const checkAutoActivation = async () => {
      try {
        // Only run this check occasionally to avoid excessive API calls
        const lastCheck = localStorage.getItem('lastAutoActivationCheck')
        const now = Date.now()
        const fiveMinutes = 5 * 60 * 1000 // 5 minutes in milliseconds
        
        if (lastCheck && (now - parseInt(lastCheck)) < fiveMinutes) {
          return // Skip if checked recently
        }
        
        const response = await fetch('/api/collections/auto-activate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        })
        
        if (response.ok) {
          const data = await response.json()
          if (data.activated > 0) {
            console.log(`Auto-activated ${data.activated} collections:`, data.collections)
          }
        }
        
        localStorage.setItem('lastAutoActivationCheck', now.toString())
      } catch (error) {
        console.error('Auto-activation check failed:', error)
      }
    }
    
    // Run check on component mount
    checkAutoActivation()
    
    // Set up interval to check every 10 minutes
    const interval = setInterval(checkAutoActivation, 10 * 60 * 1000)
    
    return () => clearInterval(interval)
  }, [])
  
  return null // This component doesn't render anything
}
