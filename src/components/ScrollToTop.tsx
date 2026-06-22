import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import { getCurrentScrollPoint, scheduleScrollReset, scrollAppTo, scrollAppToTop } from '@/lib/scroll';
import { isPersistentBottomTabPath } from '@/lib/persistentTabs';

const restoredScrollByKey = new Map<string, { top: number; left: number }>();

/**
 * Resets scroll position to the top on route changes.
 * - Skips POP (browser back/forward) so native scroll restoration works.
 * - Resets window scroll plus all internal scroll containers (main, [data-scroll-container]).
 */
const ScrollToTop = () => {
  const { key, pathname, search } = useLocation();
  const navType = useNavigationType();

  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  useEffect(() => {
    if (isPersistentBottomTabPath(pathname)) return;

    if (navType === 'POP') {
      const saved = restoredScrollByKey.get(key);
      if (!saved) return;
      return scheduleScrollReset(() => scrollAppTo(saved));
    }

    return scheduleScrollReset(scrollAppToTop);
  }, [key, pathname, search, navType]);

  useEffect(() => {
    return () => {
      restoredScrollByKey.set(key, getCurrentScrollPoint());
    };
  }, [key]);

  return null;
};

export default ScrollToTop;
