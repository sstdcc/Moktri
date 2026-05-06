import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Send } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  housingRequestId: string;
  requesterId: string;
  onSent?: () => void;
}

interface ListingOpt { id: string; title: string; }

export const SendHousingOfferDialog = ({ open, onOpenChange, housingRequestId, requesterId, onSent }: Props) => {
  const { user } = useAuth();
  const [listings, setListings] = useState<ListingOpt[]>([]);
  const [listingId, setListingId] = useState('');
  const [price, setPrice] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    setLoading(true);
    supabase
      .from('listings')
      .select('id, title, status')
      .eq('owner_id', user.id)
      .in('status', ['active', 'draft', 'negotiating'] as any)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setListings(((data as any[]) ?? []).map(l => ({ id: l.id, title: l.title })));
        setLoading(false);
      });
  }, [open, user]);

  const handleSubmit = async () => {
    if (!user || !listingId) return;
    setSubmitting(true);
    const { error } = await supabase.from('housing_request_offers' as any).insert({
      housing_request_id: housingRequestId,
      listing_id: listingId,
      owner_id: user.id,
      requester_id: requesterId,
      proposed_price: price ? Number(price) : null,
      message: message.trim() || null,
    });
    if (error) {
      console.error(error);
      const dup = error.code === '23505' || /duplicate/i.test(error.message);
      toast.error(dup ? 'لديك عرض معلّق على هذا الطلب بالفعل' : 'تعذر إرسال العرض');
      setSubmitting(false);
      return;
    }

    const listingTitle = listings.find(l => l.id === listingId)?.title ?? '';
    await supabase.from('notifications').insert({
      user_id: requesterId,
      type: 'private_offer_created' as any,
      title_ar: 'لديك عرض جديد',
      body_ar: `تم إرسال عرض على طلبك: ${listingTitle}`,
      link: `/requests/${housingRequestId}`,
    });

    toast.success('تم إرسال العرض');
    setListingId(''); setPrice(''); setMessage('');
    onOpenChange(false);
    setSubmitting(false);
    onSent?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="font-tajawal">
        <DialogHeader><DialogTitle>إرسال عرض</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>اختر إعلاناً</Label>
            <Select value={listingId} onValueChange={setListingId} disabled={loading}>
              <SelectTrigger><SelectValue placeholder={loading ? 'جاري التحميل...' : 'اختر من إعلاناتك'} /></SelectTrigger>
              <SelectContent>
                {listings.map(l => <SelectItem key={l.id} value={l.id}>{l.title}</SelectItem>)}
                {!loading && listings.length === 0 && <div className="p-2 text-xs text-muted-foreground">لا توجد إعلانات متاحة</div>}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>السعر المقترح (اختياري)</Label>
            <Input type="number" inputMode="numeric" value={price} onChange={e => setPrice(e.target.value)} placeholder="مثال: 50000" />
          </div>
          <div className="space-y-1">
            <Label>رسالة (اختياري)</Label>
            <Textarea rows={3} value={message} onChange={e => setMessage(e.target.value)} placeholder="اكتب رسالة قصيرة..." />
          </div>
          <div className="flex gap-2 pt-1">
            <Button onClick={handleSubmit} disabled={submitting || !listingId} className="flex-1 gap-1">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              إرسال
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
