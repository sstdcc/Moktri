import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface RatingDisplayProps {
  userId: string;
  variant?: 'compact' | 'full';
  size?: 'sm' | 'md';
  className?: string;
}

interface Stats {
  average_rating: number;
  total_reviews: number;
}

// Simple in-memory cache to avoid re-fetching on listing grids
const cache = new Map<string, Stats>();
const inflight = new Map<string, Promise<Stats>>();

const fetchStats = (userId: string): Promise<Stats> => {
  if (cache.has(userId)) return Promise.resolve(cache.get(userId)!);
  if (inflight.has(userId)) return inflight.get(userId)!;
  const p = supabase
    .rpc('get_user_rating_stats', { p_user_id: userId })
    .then(({ data }) => {
      const row = data?.[0];
      const stats: Stats = {
        average_rating: Number(row?.average_rating ?? 0),
        total_reviews: Number(row?.total_reviews ?? 0),
      };
      cache.set(userId, stats);
      inflight.delete(userId);
      return stats;
    });
  inflight.set(userId, p);
  return p;
};

export const RatingDisplay = ({
  userId, variant = 'full', size = 'sm', className,
}: RatingDisplayProps) => {
  const [stats, setStats] = useState<Stats | null>(cache.get(userId) ?? null);

  useEffect(() => {
    let active = true;
    fetchStats(userId).then((s) => { if (active) setStats(s); });
    return () => { active = false; };
  }, [userId]);

  if (!stats || stats.total_reviews === 0) return null;

  const star = size === 'md' ? 'h-4 w-4' : 'h-3.5 w-3.5';
  const text = size === 'md' ? 'text-sm' : 'text-xs';

  return (
    <span
      dir="ltr"
      className={cn('inline-flex items-center gap-1 font-tajawal font-semibold text-foreground', text, className)}
    >
      <Star className={cn(star, 'fill-accent text-accent')} />
      <span>{stats.average_rating.toFixed(1)}</span>
      {variant === 'full' && (
        <span className="text-muted-foreground font-normal">({stats.total_reviews})</span>
      )}
    </span>
  );
};
