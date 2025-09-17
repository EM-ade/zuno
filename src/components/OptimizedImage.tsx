'use client'
import { useState, useEffect } from 'react'
import Image from 'next/image'

interface OptimizedImageProps {
  src: string
  alt: string
  width?: number
  height?: number
  className?: string
  priority?: boolean
  placeholder?: string
}

export default function OptimizedImage({
  src,
  alt,
  width = 300,
  height = 300,
  className = '',
  priority = false,
  placeholder = 'https://via.placeholder.com/300x300/e2e8f0/64748b?text=Loading...'
}: OptimizedImageProps) {
  const [imageSrc, setImageSrc] = useState(placeholder)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    if (!src || src === placeholder) {
      setIsLoading(false)
      return
    }

    // Preload the image
    const img = new window.Image()
    img.onload = () => {
      setImageSrc(src)
      setIsLoading(false)
      setHasError(false)
    }
    img.onerror = () => {
      setHasError(true)
      setIsLoading(false)
      // Keep placeholder image on error
    }
    img.src = src
  }, [src, placeholder])

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <Image
        src={imageSrc}
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        className={`transition-opacity duration-300 ${
          isLoading ? 'opacity-50' : 'opacity-100'
        } ${hasError ? 'grayscale' : ''}`}
        style={{
          objectFit: 'cover',
          width: '100%',
          height: '100%',
        }}
      />
      
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      )}
      
      {hasError && (
        <div className="absolute top-2 right-2">
          <div className="bg-red-500 text-white text-xs px-2 py-1 rounded">
            Failed to load
          </div>
        </div>
      )}
    </div>
  )
}
