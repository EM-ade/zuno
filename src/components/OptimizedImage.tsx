'use client'
import { useState, useEffect } from 'react'
import Image, { ImageProps } from 'next/image'

interface OptimizedImageProps extends ImageProps {
  placeholderSrc?: string // Optional prop for a custom placeholder
}

const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  width = 300,
  height = 300,
  className = '',
  priority = false,
  quality = 75,
  sizes = '100vw',
  placeholderSrc = '/placeholder.svg', // Use local SVG as default placeholder
  ...props
}) => {
  const [imageSrc, setImageSrc] = useState(placeholderSrc)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    if (!src || src === placeholderSrc) {
      setIsLoading(false)
      return
    }

    const img = new window.Image()
    img.onload = () => {
      setImageSrc(src)
      setIsLoading(false)
      setHasError(false)
    }
    img.onerror = () => {
      setHasError(true)
      setIsLoading(false)
    }
    img.src = src
  }, [src, placeholderSrc])

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
        {...props}
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

export default OptimizedImage