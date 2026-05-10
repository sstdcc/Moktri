import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Lightweight, premium page transition wrapper.
 * - Subtle fade + small upward slide
 * - ~260ms, GPU-friendly transform/opacity only
 * - Automatically disabled when user prefers reduced motion (via CSS)
 * - Re-runs on every route change via the location.pathname key
 */
export const PageTransition = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  return (
    <div
      key={location.pathname}
      className="motion-safe:animate-page-enter will-change-[transform,opacity]"
    >
      {children}
    </div>
  );
};
