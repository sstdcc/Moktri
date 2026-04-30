import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { RatingStars } from './RatingStars';
import { RatingDialog } from './RatingDialog';
import { Star, MessageSquarePlus } from 'lucide-react';
import { timeAgo } from '@/lib/format';

interface Props {
  userId: string;
  userName: string;
}

interface ReviewRow {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  rater_id: string;
  rater?: { full_name: string; avatar_url: string | null } | null;
}

export const UserRatingsSection = ({ userId, userName }: Props) => {
  const { user } = useAuth();
  const [stats, setStats] = useState({ average: 0, total: 0 });
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [statsRes, reviewsRes] = await Promise.all([
      supabase.rpc('get_user_rating_stats', { p_user_id: userId }),
      supabase
        .from('user_ratings')
        .select('id, rating, comment, created_at, rater_id, rater:profiles!user_ratings_rater_id_fkey(full_name, avatar_url)')
        .eq('rated_user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);
    const s = statsRes.data?.[0];
    setStats({ average: Number(s?.average_rating ?? 0), total: Number(s?.total_reviews ?? 0) });
    setReviews((reviewsRes.data as any) ?? []);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const isSelf = user?.id === userId;
  const displayed = showAll ? reviews : reviews.slice(0, 3);

  const initials = (n?: string) => n?.split(' ').map(w => w[0]).join('').slice(0, 2) || '؟';

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-3 mb-4 flex-nowrap">
          <h3 className="font-cairo font-semibold text-base shrink-0 leading-none">التقييمات</h3>
          <div dir="ltr" className="flex items-center gap-2 min-w-0 flex-1">
            <RatingStars value={stats.average} size="sm" readOnly />
            <span className="text-sm font-semibold leading-none text-foreground">
              {stats.average.toFixed(1)}
            </span>
            <span className="text-xs text-muted-foreground leading-none">
              ({stats.total})
            </span>
          </div>
          {user && !isSelf && (
            <Button
              size="sm"
              onClick={() => setDialogOpen(true)}
              className="shrink-0 w-auto h-9 px-4 rounded-xl gap-1.5 text-xs font-semibold"
            >
              <MessageSquarePlus className="h-4 w-4" />
              قيّم
            </Button>
          )}
        </div>

        {loading ? (
          <p className="text-xs text-muted-foreground text-center py-4">جاري التحميل...</p>
        ) : reviews.length === 0 ? (
          <div className="flex flex-col items-center py-6 gap-2">
            <Star className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">لا توجد تقييمات بعد</p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayed.map((r) => (
              <div key={r.id} className="border-t border-border pt-3 first:border-t-0 first:pt-0">
                <div className="flex items-start gap-2.5">
                  <Link to={`/profile/${r.rater_id}`}>
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={r.rater?.avatar_url ?? undefined} />
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {initials(r.rater?.full_name)}
                      </AvatarFallback>
                    </Avatar>
                  </Link>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <Link to={`/profile/${r.rater_id}`} className="text-sm font-semibold truncate hover:underline">
                        {r.rater?.full_name || 'مستخدم'}
                      </Link>
                      <span className="text-[11px] text-muted-foreground">{timeAgo(r.created_at)}</span>
                    </div>
                    <RatingStars value={r.rating} size="sm" readOnly className="mt-1" />
                    {r.comment && <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{r.comment}</p>}
                  </div>
                </div>
              </div>
            ))}
            {reviews.length > 3 && !showAll && (
              <Button variant="outline" size="sm" className="w-full" onClick={() => setShowAll(true)}>
                عرض كل التقييمات ({reviews.length})
              </Button>
            )}
          </div>
        )}
      </CardContent>

      <RatingDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        ratedUserId={userId}
        ratedUserName={userName}
        onSaved={load}
      />
    </Card>
  );
};
