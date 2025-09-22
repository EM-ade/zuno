import { useEffect, useState, ReactNode } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

interface LoadingScreenProps {
  children: ReactNode;
}

export default function LoadingScreen({ children }: LoadingScreenProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    // This effect runs on route changes
    setIsLoading(true);
    setIsAnimating(true);
    const timer = setTimeout(() => {
      setIsAnimating(false);
    }, 500); // Animation duration

    return () => clearTimeout(timer);
  }, [pathname, searchParams]);

  useEffect(() => {
    if (!isAnimating && isLoading) {
      const timer = setTimeout(() => {
        setIsLoading(false);
      }, 300); // Delay for content to become visible
      return () => clearTimeout(timer);
    }
  }, [isAnimating, isLoading]);

  return (
    <>
      {isLoading && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center bg-[#e3f3ff] transition-opacity duration-300 ${isAnimating ? 'opacity-100' : 'opacity-0'}`}>
          <div className="flex flex-col items-center">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 border-4 border-blue-400 rounded-full animate-spin-slow" style={{ borderTopColor: 'transparent' }}></div>
              <div className="absolute inset-0 border-4 border-blue-600 rounded-full animate-spin-fast animation-delay-200" style={{ borderLeftColor: 'transparent' }}></div>
            </div>
            <p className="mt-4 text-blue-800 text-lg font-semibold">Loading ZUNO...</p>
          </div>
        </div>
      )}
      {children}
    </>
  );
}
