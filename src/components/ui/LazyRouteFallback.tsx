import { useEffect, useState } from 'react';

/**
 * Lazy route fallback that avoids visual flashes during tab switches.
 * - Renders a transparent placeholder for the first 300ms
 * - Only after that does a subtle spinner fade in (for genuinely slow chunks)
 * - Preserves layout height so there's no jump when the real page mounts
 */
export const LazyRouteFallback = () => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShow(true), 300);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className="min-h-[60vh] w-full bg-background"
      aria-hidden={!show}
    >
      {show && (
        <div className="flex h-[60vh] items-center justify-center motion-safe:animate-fade-in">
          <div className="h-6 w-6 rounded-full border-2 border-muted border-t-primary animate-spin opacity-70" />
        </div>
      )}
    </div>
  );
};
