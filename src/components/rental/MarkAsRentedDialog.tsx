import { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, User as UserIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

interface ProfileOption {
  id: string;
  full_name: string;
  phone?: string | null;
}

interface MarkAsRentedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listingId: string;
  listingTitle: string;
  reservedRenterId?: string;
  onCompleted?: () => void;
}

export const MarkAsRentedDialog = ({ open, onOpenChange, listingId, listingTitle, reservedRenterId, onCompleted }: MarkAsRentedDialogProps) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [chatRenters, setChatRenters] = useState<ProfileOption[]>([]);
  const [brokers, setBrokers] = useState<ProfileOption[]>([]);
  const [renterId, setRenterId] = useState<string>('');
  const [brokerId, setBrokerId] = useState<string>('none');
  const [manualPhone, setManualPhone] = useState('');
  const [mode, setMode] = useState<'chat' | 'manual'>('chat');

  useEffect(() => {
    if (!open || !user) return;
    const load = async () => {
      setLoading(true);
      // Fetch chat participants for this listing
      const { data: convs } = await supabase
        .from('listing_conversations')
        .select('user_id, profiles:user_id(id, full_name, phone)')
        .eq('listing_id', listingId)
        .eq('owner_id', user.id);

      const renters: ProfileOption[] = [];
      const seen = new Set<string>();
      (convs || []).forEach((c: any) => {
        const p = c.profiles;
        if (p && !seen.has(p.id)) {
          seen.add(p.id);
          renters.push({ id: p.id, full_name: p.full_name, phone: p.phone });
        }
      });

      // Ensure reserved renter is included and preselected
      if (reservedRenterId && !seen.has(reservedRenterId)) {
        const { data: rp } = await supabase
          .from('profiles')
          .select('id, full_name, phone')
          .eq('id', reservedRenterId)
          .maybeSingle();
        if (rp) {
          renters.unshift({ id: rp.id, full_name: rp.full_name, phone: rp.phone });
          seen.add(rp.id);
        }
      }
      setChatRenters(renters);
      if (reservedRenterId) {
        setRenterId(reservedRenterId);
        setMode('chat');
      }

      // Fetch verified brokers
      const { data: brokerData } = await supabase
        .from('profiles')
        .select('id, full_name, phone')
        .eq('role', 'broker')
        .order('full_name');
      setBrokers((brokerData || []) as ProfileOption[]);
      setLoading(false);
    };
    load();
  }, [open, user, listingId, reservedRenterId]);

  const resolveRenterByPhone = async (phone: string): Promise<string | null> => {
    const cleaned = phone.trim();
    if (!cleaned) return null;
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('phone', cleaned)
      .maybeSingle();
    return data?.id || null;
  };

  const handleSubmit = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      let finalRenterId = renterId;
      if (mode === 'manual') {
        const found = await resolveRenterByPhone(manualPhone);
        if (!found) {
          toast({ title: 'لم يتم العثور على المستأجر', description: 'تأكد من رقم الهاتف المسجّل في التطبيق', variant: 'destructive' });
          setSubmitting(false);
          return;
        }
        finalRenterId = found;
      }
      if (!finalRenterId) {
        toast({ title: 'اختر المستأجر', variant: 'destructive' });
        setSubmitting(false);
        return;
      }
      if (finalRenterId === user.id) {
        toast({ title: 'لا يمكن تعيين نفسك كمستأجر', variant: 'destructive' });
        setSubmitting(false);
        return;
      }

      // Determine if this is a private offer (needs admin review before completion)
      const { data: listingRow } = await supabase
        .from('listings')
        .select('source_request_id, status, reserved_for_user_id')
        .eq('id', listingId)
        .maybeSingle();
      const isPrivateOffer = !!(listingRow as any)?.reserved_for_user_id
        && ((listingRow as any)?.status === 'private_offer' || (listingRow as any)?.status === 'reserved');
      const sourceRequestId = (listingRow as any)?.source_request_id as string | null | undefined;

      const rentalStatus = isPrivateOffer ? 'pending_review' : 'completed';

      // Insert rental
      const { error: insertError } = await supabase.from('rentals').insert({
        listing_id: listingId,
        owner_id: user.id,
        renter_id: finalRenterId,
        broker_id: brokerId !== 'none' ? brokerId : null,
        status: rentalStatus as any,
      });
      if (insertError) throw insertError;

      if (isPrivateOffer) {
        // Keep listing as reserved; do NOT close housing request yet
        await supabase
          .from('listings')
          .update({ status: 'reserved', last_updated_at: new Date().toISOString() })
          .eq('id', listingId);

        // Notify admins/moderators for review
        const { data: admins } = await supabase
          .from('profiles')
          .select('id')
          .in('role', ['admin', 'moderator']);
        if (admins && admins.length) {
          await supabase.from('notifications').insert(
            admins.map((a: any) => ({
              user_id: a.id,
              type: 'rental_pending_review' as any,
              title_ar: 'إيجار عرض خاص بانتظار المراجعة',
              body_ar: `طلب اعتماد إيجار للإعلان: ${listingTitle}.`,
              link: '/dashboard/admin/rentals',
            }))
          );
        }

        toast({ title: 'تم رفع الإيجار للمراجعة', description: 'سيتم اعتماده من قبل الإدارة قريباً' });
      } else {
        // Normal flow: complete immediately
        await supabase
          .from('listings')
          .update({ status: 'rented', last_updated_at: new Date().toISOString() })
          .eq('id', listingId);

        if (sourceRequestId) {
          await supabase
            .from('housing_requests')
            .update({ status: 'fulfilled' })
            .eq('id', sourceRequestId);
        }

        const notifs: any[] = [
          { user_id: finalRenterId, type: 'system', title_ar: 'تم إكمال الإيجار', body_ar: `تم تعيينك كمستأجر للإعلان: ${listingTitle}. يمكنك الآن تقييم المالك.`, link: `/profile/${user.id}` },
        ];
        if (brokerId !== 'none') {
          notifs.push({ user_id: brokerId, type: 'system', title_ar: 'تم إكمال الإيجار', body_ar: `تم تعيينك كوسيط في الإعلان: ${listingTitle}.`, link: `/profile/${finalRenterId}` });
        }
        await supabase.from('notifications').insert(notifs);

        toast({ title: 'تم تسجيل الإيجار', description: 'يمكن الآن للأطراف تقييم بعضهم' });
      }
      onCompleted?.();
      onOpenChange(false);
      // reset
      setRenterId(''); setBrokerId('none'); setManualPhone(''); setMode('chat');
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message || 'تعذر إكمال العملية', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="font-tajawal max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-success" />
            تعيين الإعلان كمؤجَّر
          </DialogTitle>
          <DialogDescription className="text-right">
            اختر المستأجر لإكمال عملية الإيجار وتفعيل التقييم بين الطرفين.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-accent" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Mode toggle */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode('chat')}
                className={`flex-1 rounded-xl px-3 py-2 text-xs font-bold transition-all ${mode === 'chat' ? 'bg-accent text-white' : 'bg-muted text-muted-foreground'}`}
              >
                من المحادثات
              </button>
              <button
                type="button"
                onClick={() => setMode('manual')}
                className={`flex-1 rounded-xl px-3 py-2 text-xs font-bold transition-all ${mode === 'manual' ? 'bg-accent text-white' : 'bg-muted text-muted-foreground'}`}
              >
                برقم الهاتف
              </button>
            </div>

            {mode === 'chat' ? (
              <div className="space-y-2">
                <Label className="text-right block">المستأجر *</Label>
                {chatRenters.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-right py-2">
                    لا توجد محادثات على هذا الإعلان. استخدم خيار "برقم الهاتف".
                  </p>
                ) : (
                  <Select value={renterId} onValueChange={setRenterId}>
                    <SelectTrigger className="text-right"><SelectValue placeholder="اختر المستأجر" /></SelectTrigger>
                    <SelectContent className="font-tajawal">
                      {chatRenters.map(r => (
                        <SelectItem key={r.id} value={r.id} className="text-right">
                          <div className="flex items-center gap-2"><UserIcon className="h-4 w-4" />{r.full_name}</div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Label className="text-right block">رقم هاتف المستأجر *</Label>
                <Input
                  type="tel"
                  dir="ltr"
                  placeholder="+967xxxxxxxxx"
                  value={manualPhone}
                  onChange={(e) => setManualPhone(e.target.value)}
                  className="text-left"
                />
                <p className="text-[11px] text-muted-foreground text-right">يجب أن يكون المستأجر مسجلاً في التطبيق بنفس الرقم.</p>
              </div>
            )}

            {/* Broker (optional) */}
            <div className="space-y-2">
              <Label className="text-right block">الوسيط (اختياري)</Label>
              <Select value={brokerId} onValueChange={setBrokerId}>
                <SelectTrigger className="text-right"><SelectValue placeholder="بدون وسيط" /></SelectTrigger>
                <SelectContent className="font-tajawal">
                  <SelectItem value="none" className="text-right">بدون وسيط</SelectItem>
                  {brokers.map(b => (
                    <SelectItem key={b.id} value={b.id} className="text-right">{b.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-xl bg-accent/5 border border-accent/20 p-3 text-xs text-foreground/80 text-right">
              سيتم تعيين حالة الإيجار إلى <span className="font-bold text-success">مكتمل</span> فوراً، وتفعيل التقييم بين الأطراف المسموح بها.
            </div>
          </div>
        )}

        <DialogFooter className="flex-row-reverse gap-2">
          <Button onClick={handleSubmit} disabled={submitting || loading} className="flex-1">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'تأكيد الإيجار'}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting} className="flex-1">إلغاء</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
