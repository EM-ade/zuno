'use client'
import { useState, useEffect } from 'react'
import Image, { ImageProps, StaticImageData } from 'next/image'

interface OptimizedImageProps extends ImageProps {
  placeholderSrc?: string // Optional prop for a custom placeholder
  loading?: 'eager' | 'lazy' // Optional prop to control loading behavior
}

const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  width = 300,
  height = 300,
  className = '',
  priority = false,
  loading = 'lazy',
  quality = 75,
  sizes = '100vw',
  placeholderSrc = '/placeholder.svg', // Use local SVG as default placeholder
  ...props
}) => {
  const [imageSrc, setImageSrc] = useState<string>(placeholderSrc); // Change type to string
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    if (!src) {
      setIsLoading(false);
      return;
    }

    const resolvedSrc = typeof src === 'string' ? src : (src as StaticImageData).src; // Resolve src to string
    if (resolvedSrc === placeholderSrc) {
      setIsLoading(false);
      return;
    }

    const img = new window.Image();
    img.onload = () => {
      setImageSrc(resolvedSrc); // Use resolvedSrc
      setIsLoading(false);
      setHasError(false);
    };
    img.onerror = () => {
      setHasError(true);
      setIsLoading(false);
    };
    img.src = resolvedSrc; // Use the resolved string src
  }, [src, placeholderSrc]);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <Image
        src={imageSrc} // Image component can take a string here
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        {...(!priority && imageSrc !== placeholderSrc && { loading: loading })} // Conditionally apply loading
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