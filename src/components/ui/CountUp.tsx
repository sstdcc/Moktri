import { useEffect, useRef, useState } from 'react';

interface CountUpProps {
  value: number;
  duration?: number;
  className?: string;
  formatter?: (n: number) => string;
}

/**
 * Smoothly counts up to `value` on first mount only.
 * Respects prefers-reduced-motion.
 */
export const CountUp = ({ value, duration = 900, className, formatter }: CountUpProps) => {
  const [display, setDisplay] = useState(0);
  const animatedRef = useRef(false);

  useEffect(() => {
    if (animatedRef.current) {
      setDisplay(value);
      return;
    }
    animatedRef.current = true;

    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (reduce || value <= 0) {
      setDisplay(value);
      return;
    }

    const start = performance.now();
    const from = 0;
    const to = value;
    let raf = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <span className={className}>{formatter ? formatter(display) : display}</span>;
};

export default CountUp;
