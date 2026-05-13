import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * Resets scroll position to the top on route changes.
 * - Skips POP (browser back/forward) so native scroll restoration works.
 * - Resets window scroll plus all internal scroll containers (main, [data-scroll-container]).
 */
const ScrollToTop = () => {
  const { pathname } = useLocation();
  const navType = useNavigationType();

  useEffect(() => {
    if (navType === 'POP') return;

    const reset = () => {
      try {
        window.scrollTo({ top: 0, left: 0 });
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
        document
          .querySelectorAll<HTMLElement>('main, [data-scroll-container]')
          .forEach((el) => {
            el.scrollTop = 0;
            el.scrollLeft = 0;
          });
      } catch {
        /* noop */
      }
    };

    reset();
    // Run again after the new page renders (lazy routes, transitions)
    const r1 = requestAnimationFrame(reset);
    const r2 = requestAnimationFrame(() => requestAnimationFrame(reset));

    return () => {
      cancelAnimationFrame(r1);
      cancelAnimationFrame(r2);
    };
  }, [pathname, navType]);

  return null;
};

export default ScrollToTop;
