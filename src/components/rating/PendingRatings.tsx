import { useEffect, useState, useCallback } from 'react';
import { Star, User as UserIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { RatingDialog } from './RatingDialog';

interface PendingItem {
  rental_id: string;
  listing_id: string;
  listing_title: string;
  completed_at: string | null;
  other_user_id: string;
  other_user_name: string;
  other_user_avatar: string | null;
  other_role_label: string;
}

export const PendingRatings = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<{ open: boolean; userId: string; userName: string }>({ open: false, userId: '', userName: '' });

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // Fetch all completed rentals where the current user is a party
    const { data: rentals } = await supabase
      .from('rentals')
      .select(`
        id, listing_id, completed_at, owner_id, renter_id, broker_id,
        listing:listings!rentals_listing_id_fkey(title),
        owner:profiles!rentals_owner_id_fkey(id, full_name, avatar_url),
        renter:profiles!rentals_renter_id_fkey(id, full_name, avatar_url),
        broker:profiles!rentals_broker_id_fkey(id, full_name, avatar_url)
      `)
      .eq('status', 'completed')
      .or(`owner_id.eq.${user.id},renter_id.eq.${user.id},broker_id.eq.${user.id}`);

    if (!rentals || rentals.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }

    // Fetch all ratings made by current user for these rentals
    const rentalIds = rentals.map((r: any) => r.id);
    const { data: myRatings } = await supabase
      .from('user_ratings')
      .select('rental_id, rated_user_id')
      .eq('rater_id', user.id)
      .in('rental_id', rentalIds);

    const ratedSet = new Set((myRatings ?? []).map((r: any) => `${r.rental_id}:${r.rated_user_id}`));

    // Build pending list: for each rental, list each allowed counterpart not yet rated
    const pending: PendingItem[] = [];
    rentals.forEach((r: any) => {
      const targets: { id: string; name: string; avatar: string | null; role: string }[] = [];
      const isOwner = r.owner_id === user.id;
      const isRenter = r.renter_id === user.id;
      const isBroker = r.broker_id === user.id;

      if (isRenter) {
        if (r.owner) targets.push({ id: r.owner.id, name: r.owner.full_name, avatar: r.owner.avatar_url, role: 'المالك' });
        if (r.broker) targets.push({ id: r.broker.id, name: r.broker.full_name, avatar: r.broker.avatar_url, role: 'الوسيط' });
      }
      if (isOwner && r.renter) {
        targets.push({ id: r.renter.id, name: r.renter.full_name, avatar: r.renter.avatar_url, role: 'المستأجر' });
      }
      if (isBroker && r.renter) {
        targets.push({ id: r.renter.id, name: r.renter.full_name, avatar: r.renter.avatar_url, role: 'المستأجر' });
      }

      targets.forEach((t) => {
        if (!ratedSet.has(`${r.id}:${t.id}`)) {
          pending.push({
            rental_id: r.id,
            listing_id: r.listing_id,
            listing_title: r.listing?.title ?? 'إعلان',
            completed_at: r.completed_at,
            other_user_id: t.id,
            other_user_name: t.name,
            other_user_avatar: t.avatar,
            other_role_label: t.role,
          });
        }
      });
    });

    setItems(pending);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  if (loading || items.length === 0) return null;

  const getInitials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();

  return (
    <div className="rounded-2xl border border-accent/30 bg-accent/5 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Star className="h-5 w-5 text-accent fill-accent" />
        <h2 className="text-base font-bold text-foreground">بانتظار تقييمك</h2>
        <span className="mr-auto text-[11px] bg-accent text-white rounded-full px-2 py-0.5 font-bold">{items.length}</span>
      </div>
      <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
        ساعد المجتمع بمشاركة تجربتك. التقييم اختياري.
      </p>
      <div className="space-y-2.5">
        {items.map((it) => (
          <div key={`${it.rental_id}:${it.other_user_id}`} className="rounded-xl bg-card border border-border p-3">
            <div className="flex items-center gap-2.5">
              <div className="h-11 w-11 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
                {it.other_user_avatar ? (
                  <img src={it.other_user_avatar} alt="" className="h-full w-full object-cover" />
                ) : it.other_user_name ? (
                  <span className="text-sm font-bold text-muted-foreground">{getInitials(it.other_user_name)}</span>
                ) : (
                  <UserIcon className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="text-sm font-semibold text-foreground truncate">{it.other_user_name}</p>
                  <span className="text-[10px] font-bold bg-accent/10 text-accent rounded-md px-1.5 py-0.5 shrink-0">
                    {it.other_role_label}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                  {it.listing_title}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              className="w-full mt-3 h-8 text-xs bg-accent hover:bg-accent/90 text-white"
              onClick={() => setDialog({ open: true, userId: it.other_user_id, userName: it.other_user_name })}
            >
              قيّم الآن
            </Button>
          </div>
        ))}
      </div>

      <RatingDialog
        open={dialog.open}
        onOpenChange={(o) => setDialog((p) => ({ ...p, open: o }))}
        ratedUserId={dialog.userId}
        ratedUserName={dialog.userName}
        onSaved={load}
      />
    </div>
  );
};
