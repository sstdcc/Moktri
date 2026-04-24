import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

interface ProfileOption {
  id: string;
  full_name: string;
}

interface FulfillRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string;
  requestCategory: string;
  onCompleted?: () => void;
}

export const FulfillRequestDialog = ({
  open, onOpenChange, requestId, requestCategory, onCompleted,
}: FulfillRequestDialogProps) => {
  const { user } = useAuth();
  const [mode, setMode] = useState<'responder' | 'chat' | 'manual'>('responder');
  const [responders, setResponders] = useState<ProfileOption[]>([]);
  const [chatUsers, setChatUsers] = useState<ProfileOption[]>([]);
  const [brokers, setBrokers] = useState<ProfileOption[]>([]);
  const [selectedOwnerId, setSelectedOwnerId] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [selectedBrokerId, setSelectedBrokerId] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    setLoading(true);

    const load = async () => {
      // Fetch responders who replied to this request
      const { data: resps } = await supabase
        .from('request_responses')
        .select('responder_id, responder:profiles!request_responses_responder_id_fkey(id, full_name)')
        .eq('request_id', requestId);

      const seen = new Set<string>();
      const respList: ProfileOption[] = [];
      (resps ?? []).forEach((r: any) => {
        const p = r.responder;
        if (p && !seen.has(p.id) && p.id !== user.id) {
          seen.add(p.id);
          respList.push({ id: p.id, full_name: p.full_name });
        }
      });
      setResponders(respList);

      // Fetch users the renter has chatted with (as initiator on listing conversations)
      const { data: convs } = await supabase
        .from('listing_conversations')
        .select('owner_id, user_id, owner:profiles!listing_conversations_owner_id_fkey(id, full_name), other:profiles!listing_conversations_user_id_fkey(id, full_name)')
        .or(`owner_id.eq.${user.id},user_id.eq.${user.id}`)
        .limit(100);

      const chatSeen = new Set<string>();
      const chatList: ProfileOption[] = [];
      (convs ?? []).forEach((c: any) => {
        const p = c.owner_id === user.id ? c.other : c.owner;
        if (p && !chatSeen.has(p.id) && p.id !== user.id) {
          chatSeen.add(p.id);
          chatList.push({ id: p.id, full_name: p.full_name });
        }
      });
      setChatUsers(chatList);

      // Fetch verified brokers
      const { data: brokerData } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'broker')
        .eq('verification_badge', 'verified')
        .neq('id', user.id)
        .limit(50);
      setBrokers((brokerData as ProfileOption[]) ?? []);

      setLoading(false);
    };
    load();
  }, [open, user, requestId]);

  const resolveByPhone = async (phone: string): Promise<string | null> => {
    // Phone numbers are private; resolve via SECURITY DEFINER RPC that returns only the user id.
    const { data } = await supabase.rpc('find_user_id_by_phone', { _phone: phone.trim() });
    return (data as string | null) ?? null;
  };

  const handleSubmit = async () => {
    if (!user) return;
    setSubmitting(true);

    let ownerId: string | null = null;

    if (mode === 'responder' || mode === 'chat') {
      ownerId = selectedOwnerId;
    } else {
      if (!manualPhone.trim()) {
        toast.error('أدخل رقم هاتف المالك');
        setSubmitting(false);
        return;
      }
      ownerId = await resolveByPhone(manualPhone);
      if (!ownerId) {
        toast.error('لم يتم العثور على مستخدم بهذا الرقم');
        setSubmitting(false);
        return;
      }
    }

    if (!ownerId) {
      toast.error('اختر المالك أو الوسيط الذي تعاملت معه');
      setSubmitting(false);
      return;
    }

    if (ownerId === user.id) {
      toast.error('لا يمكنك اختيار نفسك');
      setSubmitting(false);
      return;
    }

    // Try to find a listing for that owner — prefer one tied to this request / reserved for this renter
    const { data: ownerListings } = await supabase
      .from('listings')
      .select('id, status, reserved_for_user_id, source_request_id')
      .eq('owner_id', ownerId)
      .in('status', ['active', 'reserved', 'private_offer', 'rented'])
      .limit(20);

    // Prioritize private offer reserved for this renter, originating from this request
    const matched = (ownerListings ?? []).find((l: any) =>
      l.reserved_for_user_id === user.id && (l.source_request_id === requestId || l.status === 'private_offer' || l.status === 'reserved')
    ) ?? ownerListings?.[0];

    const listingId = matched?.id;
    const isPrivateOffer = !!(matched as any)?.reserved_for_user_id
      && ((matched as any)?.status === 'private_offer' || (matched as any)?.status === 'reserved');

    // No listing yet → trigger private offer request flow
    if (!listingId) {
      const { error: notifErr } = await supabase.from('notifications').insert({
        user_id: ownerId,
        type: 'private_offer_request' as any,
        title_ar: 'طلب إنشاء إعلان خاص',
        body_ar: 'مستأجر يريد إتمام صفقة معك. أنشئ إعلاناً خاصاً به لتأكيد التعامل.',
        link: `/listings/new?private_for=${user.id}&from_request=${requestId}`,
      });

      if (notifErr) {
        console.error(notifErr);
        toast.error('تعذر إرسال طلب الإعلان للمالك');
        setSubmitting(false);
        return;
      }

      toast.success('تم إرسال طلب للمالك لإنشاء إعلان خاص بك. ستصلك إشعار عند إنشائه.');
      onOpenChange(false);
      onCompleted?.();
      setSubmitting(false);
      resetState();
      return;
    }

    const brokerId = selectedBrokerId || null;

    // Private offer → must go through admin review; do NOT complete, do NOT close request, do NOT unlock ratings yet
    if (isPrivateOffer) {
      const { error: rentalErr } = await supabase.from('rentals').insert({
        listing_id: listingId,
        owner_id: ownerId,
        renter_id: user.id,
        broker_id: brokerId,
        status: 'pending_review' as any,
      });
      if (rentalErr) {
        console.error(rentalErr);
        toast.error('تعذر رفع الإيجار للمراجعة');
        setSubmitting(false);
        return;
      }

      // Keep listing reserved (do NOT mark as rented yet)
      await supabase
        .from('listings')
        .update({ status: 'reserved' as any, last_updated_at: new Date().toISOString() })
        .eq('id', listingId);

      // Notify admins
      const { data: admins } = await supabase
        .from('profiles')
        .select('id')
        .in('role', ['admin', 'moderator']);
      if (admins?.length) {
        await supabase.from('notifications').insert(
          admins.map((a: any) => ({
            user_id: a.id,
            type: 'rental_pending_review' as any,
            title_ar: 'إيجار عرض خاص بانتظار المراجعة',
            body_ar: 'طلب اعتماد إيجار عرض خاص بحاجة لمراجعتك.',
            link: '/dashboard/admin/rentals',
          }))
        );
      }

      toast.success('تم رفع الإيجار للمراجعة من الإدارة. سيتم اعتماده قريباً.');
      onOpenChange(false);
      onCompleted?.();
      setSubmitting(false);
      resetState();
      return;
    }

    // Normal flow: create completed rental
    const { error: rentalErr } = await supabase.from('rentals').insert({
      listing_id: listingId,
      owner_id: ownerId,
      renter_id: user.id,
      broker_id: brokerId,
      status: 'completed' as any,
    });

    if (rentalErr) {
      console.error(rentalErr);
      toast.error('تعذر إنشاء سجل الإيجار');
      setSubmitting(false);
      return;
    }

    // Update housing request status to fulfilled
    await supabase
      .from('housing_requests')
      .update({ status: 'fulfilled' as any })
      .eq('id', requestId);

    toast.success('تم تأكيد إتمام الطلب بنجاح');
    onOpenChange(false);
    onCompleted?.();
    setSubmitting(false);
    resetState();
  };

  const resetState = () => {
    setMode('responder');
    setSelectedOwnerId('');
    setManualPhone('');
    setSelectedBrokerId('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md font-tajawal" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-base font-bold">تم تنفيذ الطلب</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            حدد المالك أو الوسيط الذي تعاملت معه لإتمام الطلب
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Mode toggle */}
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant={mode === 'responder' ? 'default' : 'outline'}
                size="sm"
                className="text-xs"
                onClick={() => { setMode('responder'); setSelectedOwnerId(''); }}
              >
                من الردود
              </Button>
              <Button
                variant={mode === 'chat' ? 'default' : 'outline'}
                size="sm"
                className="text-xs"
                onClick={() => { setMode('chat'); setSelectedOwnerId(''); }}
              >
                من المحادثات
              </Button>
              <Button
                variant={mode === 'manual' ? 'default' : 'outline'}
                size="sm"
                className="text-xs"
                onClick={() => { setMode('manual'); setSelectedOwnerId(''); }}
              >
                إدخال يدوي
              </Button>
            </div>

            {/* Owner selection */}
            {mode === 'responder' ? (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">المالك / المتعامل</Label>
                {responders.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">لا يوجد مستجيبون - جرّب من المحادثات أو الإدخال اليدوي</p>
                ) : (
                  <Select value={selectedOwnerId} onValueChange={setSelectedOwnerId}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="اختر المالك" />
                    </SelectTrigger>
                    <SelectContent>
                    {responders.map((p) => (
                      <SelectItem key={p.id} value={p.id} className="text-xs">
                        {p.full_name}
                      </SelectItem>
                    ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            ) : mode === 'chat' ? (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">من محادثاتك</Label>
                {chatUsers.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">لا توجد محادثات سابقة - استخدم الإدخال اليدوي</p>
                ) : (
                  <Select value={selectedOwnerId} onValueChange={setSelectedOwnerId}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="اختر من المحادثات" />
                    </SelectTrigger>
                    <SelectContent>
                    {chatUsers.map((p) => (
                      <SelectItem key={p.id} value={p.id} className="text-xs">
                        {p.full_name}
                      </SelectItem>
                    ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">رقم هاتف المالك</Label>
                <Input
                  type="tel"
                  placeholder="مثال: 777123456"
                  value={manualPhone}
                  onChange={(e) => setManualPhone(e.target.value)}
                  className="h-9 text-xs"
                  dir="ltr"
                />
              </div>
            )}


            {/* Optional broker */}
            {brokers.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">الوسيط (اختياري)</Label>
                <Select value={selectedBrokerId} onValueChange={setSelectedBrokerId}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="بدون وسيط" />
                  </SelectTrigger>
                  <SelectContent>
                    {brokers.map((b) => (
                      <SelectItem key={b.id} value={b.id} className="text-xs">
                        {b.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 h-9 text-xs gap-1"
              >
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                تأكيد الإتمام
              </Button>
              <Button
                variant="outline"
                onClick={() => { onOpenChange(false); resetState(); }}
                className="h-9 text-xs"
              >
                إلغاء
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
