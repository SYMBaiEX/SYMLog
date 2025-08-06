'use client';

import { ImageIcon } from 'lucide-react';
import { memo, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface LazyImageProps
  extends Omit<
    React.ImgHTMLAttributes<HTMLImageElement>,
    'onLoad' | 'onError'
  > {
  src: string;
  alt: string;
  placeholder?: string;
  className?: string;
  onLoad?: () => void;
  onError?: () => void;
  threshold?: number;
  rootMargin?: string;
}

// URL validation for security
const isValidImageUrl = (url: string): boolean => {
  try {
    // Allow data URLs for base64 images
    if (url.startsWith('data:image/')) {
      return true;
    }

    // Allow http/https URLs
    const parsedUrl = new URL(url);
    return ['http:', 'https:'].includes(parsedUrl.protocol);
  } catch {
    return false;
  }
};

function LazyImageComponent({
  src,
  alt,
  placeholder = '/images/placeholder.svg',
  className,
  onLoad,
  onError,
  threshold = 0.1,
  rootMargin = '50px',
  ...props
}: LazyImageProps) {
  const [imageSrc, setImageSrc] = useState<string>(placeholder);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const [isIntersecting, setIsIntersecting] = useState(false);

  // Validate src on mount and when it changes
  useEffect(() => {
    if (!isValidImageUrl(src)) {
      console.warn(`Invalid image URL provided to LazyImage: ${src}`);
      setHasError(true);
      setIsLoading(false);
    }
  }, [src]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsIntersecting(true);
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold,
        rootMargin,
      }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => {
      if (imgRef.current) {
        observer.unobserve(imgRef.current);
      }
    };
  }, [threshold, rootMargin]);

  useEffect(() => {
    if (!isIntersecting || hasError || !isValidImageUrl(src)) return;

    let isMounted = true;

    // Create a new image to preload
    const img = new Image();

    img.onload = () => {
      if (isMounted) {
        setImageSrc(src);
        setIsLoading(false);
        onLoad?.();
      }
    };

    img.onerror = () => {
      if (isMounted) {
        console.warn(`Failed to load image: ${src}`);
        setHasError(true);
        setIsLoading(false);
        onError?.();
      }
    };

    // Start loading the image with timeout protection
    try {
      img.src = src;
    } catch (error) {
      console.warn(`Error setting image src: ${src}`, error);
      setHasError(true);
      setIsLoading(false);
    }

    return () => {
      isMounted = false;
      img.onload = null;
      img.onerror = null;
    };
  }, [src, isIntersecting, onLoad, onError, hasError]);

  return (
    <div className={cn('relative overflow-hidden', className)}>
      {isLoading && !hasError && (
        <div className="absolute inset-0 flex animate-pulse items-center justify-center bg-muted/10 backdrop-blur-sm">
          <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
        </div>
      )}

      {hasError ? (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/20">
          <div className="text-center">
            <ImageIcon className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
            <p className="text-muted-foreground text-xs">
              Failed to load image
            </p>
          </div>
        </div>
      ) : (
        <img
          alt={alt}
          className={cn(
            'transition-opacity duration-300',
            isLoading ? 'opacity-0' : 'opacity-100',
            className
          )}
          ref={imgRef}
          src={imageSrc}
          {...props}
        />
      )}
    </div>
  );
}

// Memoize to prevent unnecessary re-renders
export const LazyImage = memo(LazyImageComponent, (prevProps, nextProps) => {
  return (
    prevProps.src === nextProps.src &&
    prevProps.alt === nextProps.alt &&
    prevProps.className === nextProps.className
  );
});
