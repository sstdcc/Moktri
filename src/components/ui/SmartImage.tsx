import { useState, ImgHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface SmartImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  src?: string;
  alt?: string;
  className?: string;
  /** Wrapper sizing classes (height/aspect/width). */
  wrapperClassName?: string;
  /** Optional fallback node when src is empty or fails. */
  fallback?: React.ReactNode;
  rounded?: string;
}

/**
 * Progressive image: shows a subtle muted placeholder, fades in once loaded.
 * - No layout shift (wrapper controls size).
 * - Respects dark/light via `bg-muted`.
 * - Mobile-first: native lazy loading + async decoding.
 */
export const SmartImage = ({
  src,
  alt = '',
  className,
  wrapperClassName,
  fallback,
  rounded,
  loading = 'lazy',
  decoding = 'async',
  ...rest
}: SmartImageProps) => {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  const showImage = !!src && !errored;

  return (
    <div
      className={cn(
        'relative overflow-hidden bg-muted',
        rounded,
        wrapperClassName,
      )}
    >
      {/* Placeholder shimmer */}
      {!loaded && showImage && (
        <div className="absolute inset-0 animate-pulse bg-muted" aria-hidden />
      )}

      {showImage && (
        <img
          src={src}
          alt={alt}
          loading={loading}
          decoding={decoding}
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
          className={cn(
            'h-full w-full object-cover transition-opacity duration-500 ease-out',
            loaded ? 'opacity-100' : 'opacity-0',
            className,
          )}
          {...rest}
        />
      )}

      {!showImage && fallback && (
        <div className="absolute inset-0 flex items-center justify-center">
          {fallback}
        </div>
      )}
    </div>
  );
};
