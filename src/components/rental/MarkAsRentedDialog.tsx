import { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, User as UserIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { createNotificationService, type CreateNotificationInput } from '@/services';

interface ProfileOption {
  id: string;
  full_name: string;
}

// UI guard for the generic «تعيين كمؤجر» action: hidden while the listing is
// CURRENTLY rented (one active rental at a time) or reserved (the dedicated
// confirm-delivery flow covers reserved). Re-listing the listing later brings
// the action back, enabling future rentals of the same listing.
export const canShowMarkRentedAction = (status?: string | null): boolean =>
  status !== 'rented' && status !== 'reserved';

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
  const [extName, setExtName] = useState('');
  const [extPhone, setExtPhone] = useState('');
  const [mode, setMode] = useState<'chat' | 'manual' | 'external'>('chat');

  useEffect(() => {
    if (!open || !user) return;
    const load = async () => {
      setLoading(true);
      // Fetch chat participants for this listing
      const { data: convs } = await supabase
        .from('listing_conversations')
        .select('user_id, profiles:user_id(id, full_name)')
        .eq('listing_id', listingId)
        .eq('owner_id', user.id);

      const renters: ProfileOption[] = [];
      const seen = new Set<string>();
      (convs || []).forEach((c: any) => {
        const p = c.profiles;
        if (p && !seen.has(p.id)) {
          seen.add(p.id);
          renters.push({ id: p.id, full_name: p.full_name });
        }
      });

      // Ensure reserved renter is included and preselected
      if (reservedRenterId && !seen.has(reservedRenterId)) {
        const { data: rp } = await supabase
          .from('profiles')
          .select('id, full_name')
          .eq('id', reservedRenterId)
          .maybeSingle();
        if (rp) {
          renters.unshift({ id: rp.id, full_name: rp.full_name });
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
        .select('id, full_name')
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
    // Phone numbers are private; use SECURITY DEFINER RPC that returns only the user id.
    const { data } = await supabase.rpc('find_user_id_by_phone', { _phone: cleaned });
    return (data as string | null) || null;
  };

  const handleSubmit = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      const isExternal = mode === 'external';

      // Client-side pre-validation (the RPC re-validates authoritatively).
      let externalName = '';
      let externalPhone = '';
      if (isExternal) {
        externalName = extName.trim();
        externalPhone = extPhone.trim();
        if (!externalName || !/^[+0-9][0-9\s-]{6,19}$/.test(externalPhone)) {
          toast.error('أدخل اسم المستأجر ورقم جوال صحيح');
          return;
        }
      }

      let finalRenterId: string | null = renterId;
      if (!isExternal) {
        if (mode === 'manual') {
          const found = await resolveRenterByPhone(manualPhone);
          if (!found) {
            toast.error('لم يتم العثور على المستأجر', { description: 'تأكد من رقم الهاتف المسجّل في التطبيق' });
            return;
          }
          finalRenterId = found;
        }
        if (!finalRenterId) {
          toast.error('اختر المستأجر');
          return;
        }
        if (finalRenterId === user.id) {
          toast.error('لا يمكن تعيين نفسك كمستأجر');
          return;
        }
      } else {
        finalRenterId = null;
      }

      // Single ATOMIC call: the rental INSERT and the listings.status='rented'
      // UPDATE happen in ONE database transaction (mark_listing_rented RPC).
      // Any validation/ownership/status failure rolls back both writes, so a
      // completed rental can never be left on an ACTIVE listing.
      const rpc = supabase.rpc as unknown as (
        fn: 'mark_listing_rented',
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message?: string } | null }>;
      const { data: rpcData, error: rpcError } = await rpc('mark_listing_rented', {
        p_listing_id: listingId,
        p_renter_id: isExternal ? null : finalRenterId,
        p_broker_id: brokerId !== 'none' ? brokerId : null,
        p_external_tenant_name: isExternal ? externalName : null,
        p_external_tenant_phone: isExternal ? externalPhone : null,
      });
      if (rpcError) throw new Error(rpcError.message || 'تعذر إكمال العملية');
      const result = rpcData as { ok?: boolean; rental_id?: string; rental_status?: string; listing_status?: string } | null;
      if (!result?.ok) throw new Error('تعذر إكمال العملية');

      const pendingReview = result.rental_status === 'pending_review';

      if (pendingReview) {
        // Private offer: keep listing reserved; notify admins for review.
        const { data: admins } = await supabase
          .from('profiles')
          .select('id')
          .in('role', ['admin', 'moderator']);
        if (admins && admins.length) {
          createNotificationService(supabase).createMany(
            admins.map((a: any) => ({
              type: 'rental_pending_review' as const,
              recipientId: a.id,
              payload: {
                titleAr: 'إيجار عرض خاص بانتظار المراجعة',
                bodyAr: `طلب اعتماد إيجار للإعلان: ${listingTitle}.`,
                link: '/dashboard/admin/rentals',
              },
            }))
          ).catch(console.error);
        }

        toast.success('تم رفع الإيجار للمراجعة', { description: 'سيتم اعتماده من قبل الإدارة قريباً' });
      } else {
        // Normal flow: complete immediately. External tenants have no account
        // to notify — only an optional broker.
        const notifInputs: CreateNotificationInput[] = [];
        if (!isExternal && finalRenterId) {
          notifInputs.push({ type: 'system' as const, recipientId: finalRenterId, payload: { titleAr: 'تم إكمال الإيجار', bodyAr: `تم تعيينك كمستأجر للإعلان: ${listingTitle}. يمكنك الآن تقييم المالك.`, link: `/profile/${user.id}` } });
        }
        if (brokerId !== 'none') {
          notifInputs.push({ type: 'system' as const, recipientId: brokerId, payload: { titleAr: 'تم إكمال الإيجار', bodyAr: isExternal ? `تم تسجيل إيجار (مستأجر خارجي) للإعلان: ${listingTitle}.` : `تم تعيينك كوسيط في الإعلان: ${listingTitle}.`, link: isExternal ? `/listings/${listingId}` : `/profile/${finalRenterId}` } });
        }
        if (notifInputs.length) {
          createNotificationService(supabase).createMany(notifInputs).catch(console.error);
        }

        toast.success('تم تسجيل الإيجار', {
          description: isExternal
            ? 'حُفظت بيانات المستأجر الخارجي مع الإيجار فقط، دون إنشاء حساب'
            : 'يمكن الآن للأطراف تقييم بعضهم',
        });
      }

      // SUCCESS ONLY: caller dismisses/cleans up the reminder notification.
      onCompleted?.();
      onOpenChange(false);
      setRenterId(''); setBrokerId('none'); setManualPhone(''); setMode('chat'); setExtName(''); setExtPhone('');
    } catch (e: any) {
      // FAILURE: no success message, dialog stays open, reminder notification
      // intentionally kept available.
      toast.error(e.message || 'تعذر إكمال العملية');
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
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setMode('chat')}
                className={`flex-1 rounded-xl px-1 py-2 text-[11px] font-bold transition-all ${mode === 'chat' ? 'bg-accent text-white' : 'bg-muted text-muted-foreground'}`}
              >
                من المحادثات
              </button>
              <button
                type="button"
                onClick={() => setMode('manual')}
                className={`flex-1 rounded-xl px-1 py-2 text-[11px] font-bold transition-all ${mode === 'manual' ? 'bg-accent text-white' : 'bg-muted text-muted-foreground'}`}
              >
                برقم الهاتف
              </button>
              <button
                type="button"
                onClick={() => setMode('external')}
                className={`flex-1 rounded-xl px-1 py-2 text-[11px] font-bold transition-all ${mode === 'external' ? 'bg-accent text-white' : 'bg-muted text-muted-foreground'}`}
              >
                تم التأجير من خارج مكتري
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
            ) : mode === 'manual' ? (
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
            ) : (
              <div className="space-y-2">
                <Label className="text-right block">اسم المستأجر *</Label>
                <Input
                  type="text"
                  placeholder="الاسم الكامل"
                  value={extName}
                  onChange={(e) => setExtName(e.target.value)}
                  className="text-right"
                />
                <Label className="text-right block">رقم جوال المستأجر *</Label>
                <Input
                  type="tel"
                  dir="ltr"
                  placeholder="+967xxxxxxxxx"
                  value={extPhone}
                  onChange={(e) => setExtPhone(e.target.value)}
                  className="text-left"
                />
                <p className="text-[11px] text-muted-foreground text-right">
                  يُحفظ الاسم والرقم كبيانات لهذا الإيجار فقط، دون إنشاء حساب في مكتري. يمكن للمستأجر التسجيل لاحقاً بنفس الرقم بشكل طبيعي.
                </p>
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
              للعروض الخاصة: سيتم رفع الإيجار <span className="font-bold">للمراجعة من الإدارة</span> قبل اعتماده. للإعلانات العادية: يتم تعيينه كمكتمل فوراً.
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
