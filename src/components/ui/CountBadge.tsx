import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface CountBadgeProps {
  count: number;
  className?: string;
  max?: number;
}

/**
 * Smooth count badge — pops in when count goes 0 → >0,
 * fades out when count returns to 0, and re-pops when value increases.
 */
export const CountBadge = ({ count, className, max = 99 }: CountBadgeProps) => {
  const [visible, setVisible] = useState(count > 0);
  const [popKey, setPopKey] = useState(0);
  const prevRef = useRef(count);

  useEffect(() => {
    const prev = prevRef.current;
    if (count > 0) {
      setVisible(true);
      if (count > prev) setPopKey((k) => k + 1);
    } else if (prev > 0) {
      // play out animation, then unmount
      const t = setTimeout(() => setVisible(false), 200);
      return () => clearTimeout(t);
    }
    prevRef.current = count;
  }, [count]);

  if (!visible) return null;

  return (
    <span
      key={popKey}
      className={cn(
        'pointer-events-none select-none origin-center',
        count > 0 ? 'animate-badge-pop' : 'animate-badge-out',
        className,
      )}
    >
      {count > max ? `${max}+` : count}
    </span>
  );
};
