import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Check, X, MessageSquare } from 'lucide-react';
import { formatPrice, timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';

interface OfferRow {
  id: string;
  housing_request_id: string;
  listing_id: string;
  owner_id: string;
  requester_id: string;
  proposed_price: number | null;
  message: string | null;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  listing: { title: string; price: number | null; currency: string | null } | null;
  owner: { full_name: string | null } | null;
}

const statusLabels: Record<string, string> = { pending: 'بانتظار', accepted: 'مقبول', rejected: 'مرفوض' };
const statusColors: Record<string, string> = {
  pending: 'bg-warning/10 text-warning',
  accepted: 'bg-success/10 text-success',
  rejected: 'bg-destructive/10 text-destructive',
};

export const HousingRequestOffersList = ({ housingRequestId, onChange }: { housingRequestId: string; onChange?: () => void }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  const fetchOffers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('housing_request_offers' as any)
      .select('*, listing:listings!housing_request_offers_listing_id_fkey(title, price, currency), owner:profiles!housing_request_offers_owner_id_fkey(full_name)')
      .eq('housing_request_id', housingRequestId)
      .order('created_at', { ascending: false });
    if (error) {
      // fallback without joins
      const { data: plain } = await supabase
        .from('housing_request_offers' as any)
        .select('*')
        .eq('housing_request_id', housingRequestId)
        .order('created_at', { ascending: false });
      setOffers(((plain as any[]) ?? []) as OfferRow[]);
    } else {
      setOffers(((data as any[]) ?? []) as OfferRow[]);
    }
    setLoading(false);
  }, [housingRequestId]);

  useEffect(() => { fetchOffers(); }, [fetchOffers]);

  const isRequester = user && offers[0] && user.id === offers[0].requester_id;

  const accept = async (o: OfferRow) => {
    setActingId(o.id);
    const { error } = await supabase.rpc('accept_housing_request_offer' as any, { _offer_id: o.id });
    if (error) { console.error(error); toast.error('تعذر قبول العرض'); setActingId(null); return; }
    await supabase.from('notifications').insert({
      user_id: o.owner_id,
      type: 'private_offer_accepted' as any,
      title_ar: 'تم قبول عرضك',
      body_ar: `قبل المستأجر عرضك على: ${o.listing?.title ?? ''}`,
      link: `/listings/${o.listing_id}`,
    });
    // open / create chat
    const { data: existing } = await supabase
      .from('listing_conversations')
      .select('id')
      .eq('listing_id', o.listing_id)
      .eq('user_id', user!.id)
      .maybeSingle();
    let convId = existing?.id as string | undefined;
    if (!convId) {
      const { data: created } = await supabase
        .from('listing_conversations')
        .insert({ listing_id: o.listing_id, owner_id: o.owner_id, user_id: user!.id })
        .select('id')
        .single();
      convId = created?.id;
    }
    toast.success('تم قبول العرض');
    setActingId(null);
    onChange?.();
    if (convId) navigate(`/chat/${convId}`); else fetchOffers();
  };

  const reject = async (o: OfferRow) => {
    setActingId(o.id);
    const { error } = await supabase.rpc('reject_housing_request_offer' as any, { _offer_id: o.id });
    if (error) { console.error(error); toast.error('تعذر رفض العرض'); setActingId(null); return; }
    await supabase.from('notifications').insert({
      user_id: o.owner_id,
      type: 'private_offer_rejected' as any,
      title_ar: 'تم رفض عرضك',
      body_ar: `بشأن: ${o.listing?.title ?? ''}`,
      link: `/listings/${o.listing_id}`,
    });
    toast.success('تم رفض العرض');
    setActingId(null);
    fetchOffers();
    onChange?.();
  };

  const openChat = async (o: OfferRow) => {
    if (!user) return;
    const { data: existing } = await supabase
      .from('listing_conversations')
      .select('id')
      .eq('listing_id', o.listing_id)
      .eq('user_id', o.requester_id)
      .maybeSingle();
    let convId = existing?.id as string | undefined;
    if (!convId && user.id === o.requester_id) {
      const { data: created } = await supabase
        .from('listing_conversations')
        .insert({ listing_id: o.listing_id, owner_id: o.owner_id, user_id: o.requester_id })
        .select('id')
        .single();
      convId = created?.id;
    }
    if (convId) navigate(`/chat/${convId}`);
    else toast.error('تعذر فتح المحادثة');
  };

  if (loading) return <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>;
  if (offers.length === 0) return null;

  return (
    <div className="space-y-3" dir="rtl">
      <h3 className="text-[14px] font-bold text-foreground">العروض ({offers.length})</h3>
      {offers.map(o => {
        const canAct = user?.id === o.requester_id && o.status === 'pending';
        return (
          <Card
            key={o.id}
            className="overflow-hidden cursor-pointer transition-colors hover:border-accent/40"
            onClick={() => navigate(`/listings/${o.listing_id}`)}
          >
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p
                  className="text-[13px] font-bold truncate flex-1 hover:text-accent"
                  onClick={(e) => { e.stopPropagation(); navigate(`/listings/${o.listing_id}`); }}
                >{o.listing?.title ?? 'إعلان'}</p>
                <Badge className={cn('text-[10px] font-bold rounded-md px-2 py-0.5', statusColors[o.status])}>{statusLabels[o.status]}</Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">من: {o.owner?.full_name ?? 'المالك'}</p>
              {o.proposed_price != null && (
                <p className="text-[12px] font-bold text-accent">{formatPrice(Number(o.proposed_price), 'YER')}</p>
              )}
              {o.message && <p className="text-[12px] text-foreground/85 leading-[1.7]">{o.message}</p>}
              {o.created_at && <p className="text-[10px] text-muted-foreground">{timeAgo(o.created_at)}</p>}
              {canAct && (
                <div className="flex gap-2 pt-1">
                  <Button size="sm" onClick={() => accept(o)} disabled={actingId === o.id} className="flex-1 h-8 gap-1 text-xs">
                    {actingId === o.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} قبول
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => reject(o)} disabled={actingId === o.id} className="flex-1 h-8 gap-1 text-xs">
                    <X className="h-3 w-3" /> رفض
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openChat(o)} className="h-8 gap-1 text-xs">
                    <MessageSquare className="h-3 w-3" /> محادثة
                  </Button>
                </div>
              )}
              {!canAct && o.status === 'accepted' && user?.id === o.requester_id && (
                <Button size="sm" variant="outline" onClick={() => openChat(o)} className="h-8 gap-1 text-xs">
                  <MessageSquare className="h-3 w-3" /> فتح المحادثة
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
