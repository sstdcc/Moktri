import { RefObject, useEffect, useLayoutEffect, useState } from 'react';

/**
 * Returns the height (in px) available between the top of `ref` and the
 * bottom of the visible viewport (accounts for on-screen keyboard via
 * window.visualViewport). Returns null until first measurement.
 */
export const useVisibleViewportHeight = (ref: RefObject<HTMLElement>) => {
  const [height, setHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;

    const update = () => {
      if (!ref.current) return;
      const top = ref.current.getBoundingClientRect().top;
      const viewportHeight = vv ? vv.height : window.innerHeight;
      const offsetTop = vv ? vv.offsetTop : 0;
      setHeight(Math.max(0, viewportHeight + offsetTop - top));
    };

    update();
    vv?.addEventListener('resize', update);
    vv?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      vv?.removeEventListener('resize', update);
      vv?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, [ref]);

  // Re-measure on scroll of any ancestor that may have changed top
  useEffect(() => {
    const onScroll = () => {
      const el = ref.current;
      if (!el) return;
      const vv = window.visualViewport;
      const top = el.getBoundingClientRect().top;
      const viewportHeight = vv ? vv.height : window.innerHeight;
      const offsetTop = vv ? vv.offsetTop : 0;
      setHeight(Math.max(0, viewportHeight + offsetTop - top));
    };
    window.addEventListener('scroll', onScroll, true);
    return () => window.removeEventListener('scroll', onScroll, true);
  }, [ref]);

  return height;
};
