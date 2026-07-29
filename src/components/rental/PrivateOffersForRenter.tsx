import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { createNotificationService } from '@/services';
import { Button } from '@/components/ui/button';
import { Loader2, Gift, Check, X } from 'lucide-react';
import { formatPrice } from '@/lib/format';

interface OfferRow {
  id: string;
  title: string;
  price: number;
  currency: string | null;
  status: string;
  source_request_id: string | null;
  owner_id: string;
  owner: { full_name: string } | null;
}

export const PrivateOffersForRenter = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  const fetchOffers = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('listings')
      .select('id, title, price, currency, status, source_request_id, owner_id, owner:profiles!listings_owner_id_fkey(full_name)')
      .eq('reserved_for_user_id', user.id)
      .in('status', ['private_offer'] as any)
      .order('offered_at' as any, { ascending: false });
    setOffers((data as any[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchOffers(); }, [fetchOffers]);

  const handleAccept = async (offer: OfferRow) => {
    if (!user) return;
    setActingId(offer.id);
    const { error } = await supabase
      .from('listings')
      .update({ status: 'reserved' as any })
      .eq('id', offer.id);

    if (error) {
      console.error(error);
      toast.error('تعذر قبول العرض');
      setActingId(null);
      return;
    }

    createNotificationService(supabase).create('private_offer_accepted', offer.owner_id, {
      titleAr: 'تم قبول العرض الخاص',
      bodyAr: 'قبل المستأجر العرض. أكّد إتمام الإيجار من لوحة التحكم عند تسليم العقار.',
      link: `/listings/${offer.id}`,
    }).catch(console.error);

    toast.success('تم قبول العرض. ينتظر المالك تأكيد التسليم.');
    setActingId(null);
    fetchOffers();
  };

  const handleReject = async (offer: OfferRow) => {
    if (!user) return;
    setActingId(offer.id);
    const { error } = await supabase
      .from('listings')
      .update({
        status: 'draft' as any,
        reserved_for_user_id: null,
        source_request_id: null,
      } as any)
      .eq('id', offer.id);

    if (error) {
      console.error(error);
      toast.error('تعذر رفض العرض');
      setActingId(null);
      return;
    }

    createNotificationService(supabase).create('private_offer_rejected', offer.owner_id, {
      titleAr: 'تم رفض العرض الخاص',
      bodyAr: 'رفض المستأجر العرض. يمكنك تعديل الإعلان ونشره للجميع.',
      link: `/listings/${offer.id}/edit`,
    }).catch(console.error);

    toast.success('تم رفض العرض.');
    setActingId(null);
    fetchOffers();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (offers.length === 0) return null;

  return (
    <section className="space-y-3" dir="rtl">
      <div className="flex items-center gap-2">
        <Gift className="h-4 w-4 text-accent" />
        <h2 className="text-sm font-bold text-foreground font-tajawal">عروض خاصة لك</h2>
      </div>
      <div className="space-y-2">
        {offers.map((offer) => (
          <div
            key={offer.id}
            className="rounded-2xl border border-accent/30 bg-accent/5 p-3 space-y-2"
          >
            <div
              className="cursor-pointer"
              onClick={() => navigate(`/listings/${offer.id}`)}
            >
              <p className="text-sm font-bold text-foreground font-tajawal line-clamp-1">
                {offer.title}
              </p>
              <p className="text-xs text-muted-foreground font-tajawal mt-0.5">
                من: {offer.owner?.full_name || 'المالك'}
              </p>
              <p className="text-sm font-bold text-accent font-tajawal mt-1">
                {formatPrice(offer.price, offer.currency || 'YER')}
              </p>
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                onClick={() => handleAccept(offer)}
                disabled={actingId === offer.id}
                className="flex-1 h-8 text-xs gap-1"
              >
                {actingId === offer.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Check className="h-3 w-3" />
                )}
                قبول
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleReject(offer)}
                disabled={actingId === offer.id}
                className="flex-1 h-8 text-xs gap-1"
              >
                <X className="h-3 w-3" />
                رفض
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
