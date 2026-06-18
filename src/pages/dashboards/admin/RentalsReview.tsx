import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Check, X, ExternalLink, Home, User as UserIcon } from 'lucide-react';
import { toast } from 'sonner';
import { successToast } from '@/lib/successToast';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface PendingRental {
  id: string;
  listing_id: string;
  owner_id: string;
  renter_id: string;
  broker_id: string | null;
  created_at: string;
  status: string;
  listing: { id: string; title: string; status: string; reserved_for_user_id: string | null; source_request_id: string | null } | null;
  owner: { full_name: string } | null;
  renter: { full_name: string } | null;
  broker: { full_name: string } | null;
}

const RentalsReview = () => {
  const [rows, setRows] = useState<PendingRental[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<{ open: boolean; rental: PendingRental | null }>({ open: false, rental: null });
  const [rejectNote, setRejectNote] = useState('');

  const fetchRows = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('rentals')
      .select(`
        id, listing_id, owner_id, renter_id, broker_id, created_at, status,
        listing:listings!rentals_listing_id_fkey(id, title, status, reserved_for_user_id, source_request_id),
        owner:profiles!rentals_owner_id_fkey(full_name),
        renter:profiles!rentals_renter_id_fkey(full_name),
        broker:profiles!rentals_broker_id_fkey(full_name)
      `)
      .eq('status', 'pending_review' as any)
      .order('created_at', { ascending: false });
    if (error) console.error(error);
    setRows((data as any) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const approve = async (r: PendingRental) => {
    setBusyId(r.id);
    try {
      // 1) Mark rental completed
      const { error: rErr } = await supabase
        .from('rentals')
        .update({ status: 'completed' as any })
        .eq('id', r.id);
      if (rErr) throw rErr;

      // 2) Mark listing as rented
      if (r.listing) {
        await supabase
          .from('listings')
          .update({ status: 'rented' as any, last_updated_at: new Date().toISOString() })
          .eq('id', r.listing.id);

        // 3) Close source request if present
        if (r.listing.source_request_id) {
          await supabase
            .from('housing_requests')
            .update({ status: 'completed' as any })
            .eq('id', r.listing.source_request_id);
        }
      }

      // 4) Notifications
      const title = r.listing?.title || 'الإعلان';
      const notifs: any[] = [
        { user_id: r.renter_id, type: 'system', title_ar: 'تم اعتماد الإيجار', body_ar: `تم اعتماد إيجارك للإعلان: ${title}. يمكنك الآن تقييم المالك.`, link: `/profile/${r.owner_id}` },
        { user_id: r.owner_id, type: 'system', title_ar: 'تم اعتماد الإيجار', body_ar: `تم اعتماد إيجار إعلانك: ${title}.`, link: `/profile/${r.renter_id}` },
      ];
      if (r.broker_id) {
        notifs.push({ user_id: r.broker_id, type: 'system', title_ar: 'تم اعتماد الإيجار', body_ar: `تم اعتماد الإيجار الذي شاركت فيه: ${title}.`, link: `/profile/${r.renter_id}` });
      }
      await supabase.from('notifications').insert(notifs);

      successToast('تم اعتماد الإيجار');
      fetchRows();
    } catch (e: any) {
      toast.error(e.message || 'تعذر الاعتماد');
    } finally {
      setBusyId(null);
    }
  };

  const confirmReject = async () => {
    const r = rejectModal.rental;
    if (!r) return;
    setBusyId(r.id);
    try {
      // 1) Cancel rental
      const { error: rErr } = await supabase
        .from('rentals')
        .update({ status: 'cancelled' as any })
        .eq('id', r.id);
      if (rErr) throw rErr;

      // 2) Revert listing back to private_offer (or reserved if still has reservation)
      if (r.listing) {
        const revertTo = r.listing.reserved_for_user_id ? 'private_offer' : 'active';
        await supabase
          .from('listings')
          .update({ status: revertTo as any, last_updated_at: new Date().toISOString() })
          .eq('id', r.listing.id);
      }

      // 3) Notify both parties
      const note = rejectNote ? ` السبب: ${rejectNote}` : '';
      const title = r.listing?.title || 'الإعلان';
      const notifs: any[] = [
        { user_id: r.owner_id, type: 'system', title_ar: 'تم رفض اعتماد الإيجار', body_ar: `لم يتم اعتماد إيجار الإعلان: ${title}.${note}`, link: `/listings/${r.listing_id}` },
        { user_id: r.renter_id, type: 'system', title_ar: 'تم رفض اعتماد الإيجار', body_ar: `لم يتم اعتماد إيجار الإعلان: ${title}.${note}`, link: `/listings/${r.listing_id}` },
      ];
      if (r.broker_id) {
        notifs.push({ user_id: r.broker_id, type: 'system', title_ar: 'تم رفض اعتماد الإيجار', body_ar: `لم يتم اعتماد الإيجار الذي شاركت فيه: ${title}.${note}`, link: `/listings/${r.listing_id}` });
      }
      await supabase.from('notifications').insert(notifs);

      toast.success('تم رفض الاعتماد وإعادة الحالة');
      setRejectModal({ open: false, rental: null });
      setRejectNote('');
      fetchRows();
    } catch (e: any) {
      toast.error(e.message || 'تعذر الرفض');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <h1 className="text-2xl font-bold text-foreground mb-1">مراجعة عقود الإيجار</h1>
      <p className="text-sm text-muted-foreground mb-4">العروض الخاصة بانتظار الاعتماد قبل اكتمال الإيجار.</p>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-accent" /></div>
      ) : rows.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">لا توجد عقود بانتظار المراجعة</p>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.id} className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <Home className="h-4 w-4 text-accent shrink-0" />
                  <span className="font-bold text-foreground line-clamp-1">{r.listing?.title || '—'}</span>
                  <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px]">بانتظار المراجعة</Badge>
                </div>
                <a href={`/listings/${r.listing_id}`} target="_blank" rel="noreferrer">
                  <Button size="sm" variant="ghost" className="h-8"><ExternalLink className="h-4 w-4" /></Button>
                </a>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5"><UserIcon className="h-3.5 w-3.5" /><span>المالك: <span className="text-foreground">{r.owner?.full_name || '—'}</span></span></div>
                <div className="flex items-center gap-1.5"><UserIcon className="h-3.5 w-3.5" /><span>المستأجر: <span className="text-foreground">{r.renter?.full_name || '—'}</span></span></div>
                {r.broker_id && (
                  <div className="flex items-center gap-1.5"><UserIcon className="h-3.5 w-3.5" /><span>الوسيط: <span className="text-foreground">{r.broker?.full_name || '—'}</span></span></div>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                تم الرفع: {format(new Date(r.created_at), 'dd MMM yyyy HH:mm', { locale: ar })}
              </p>
              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  className="bg-success text-success-foreground h-8"
                  disabled={busyId === r.id}
                  onClick={() => approve(r)}
                >
                  <Check className="h-4 w-4 ml-1" /> اعتماد الإيجار
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-8"
                  disabled={busyId === r.id}
                  onClick={() => setRejectModal({ open: true, rental: r })}
                >
                  <X className="h-4 w-4 ml-1" /> رفض
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={rejectModal.open} onOpenChange={(open) => !open && setRejectModal({ open: false, rental: null })}>
        <DialogContent className="font-tajawal" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right">رفض اعتماد الإيجار</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground text-right">{rejectModal.rental?.listing?.title}</p>
          <Textarea
            placeholder="سبب الرفض (اختياري) — سيُرسل للأطراف"
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            className="text-right"
            dir="rtl"
          />
          <DialogFooter className="flex-row-reverse gap-2">
            <Button variant="destructive" onClick={confirmReject} disabled={busyId !== null}>
              {busyId ? <Loader2 className="h-4 w-4 animate-spin" /> : 'تأكيد الرفض'}
            </Button>
            <Button variant="outline" onClick={() => setRejectModal({ open: false, rental: null })}>إلغاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default RentalsReview;
