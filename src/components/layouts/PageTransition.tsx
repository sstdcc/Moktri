import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { isPersistentBottomTabPath } from '@/lib/persistentTabs';

/**
 * Lightweight, premium page transition wrapper.
 * - Subtle fade + small upward slide
 * - ~260ms, GPU-friendly transform/opacity only
 * - Automatically disabled when user prefers reduced motion (via CSS)
 * - Re-runs on every route change via the location.pathname key
 */
export const PageTransition = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const disableRouteKey = isPersistentBottomTabPath(location.pathname);
  return (
    <div
      key={disableRouteKey ? 'persistent-bottom-tabs' : location.pathname}
      className={disableRouteKey ? 'h-full min-h-0' : 'motion-safe:animate-page-enter will-change-[transform,opacity]'}
    >
      {children}
    </div>
  );
};
