import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Send, Loader2, ArrowRight, Home, Check, X, CheckCircle2, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { successToast } from '@/lib/successToast';
import { usePresence } from '@/contexts/PresenceContext';
import { useKeyboardAwareChatViewport } from '@/hooks/useKeyboardAwareChatViewport';
import { Linkify } from '@/lib/linkify';
import { SendHousingOfferDialog } from '@/components/rental/SendHousingOfferDialog';
import { formatPrice } from '@/lib/format';

interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

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
  listing_title?: string | null;
  listing_price?: number | null;
  listing_currency?: string | null;
  listing_status?: string | null;
  listing_image?: string | null;
}

const formatTime = (s: string) =>
  new Date(s).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });

const formatDateLabel = (s: string) => {
  const d = new Date(s);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'اليوم';
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'أمس';
  return d.toLocaleDateString('ar', { day: '2-digit', month: 'long', year: 'numeric' });
};

const statusLabel: Record<string, string> = { pending: 'بانتظار الرد', accepted: 'تم القبول', rejected: 'مرفوض' };
const statusClass: Record<string, string> = {
  pending: 'bg-warning/15 text-warning',
  accepted: 'bg-success/15 text-success',
  rejected: 'bg-destructive/15 text-destructive',
};

type TimelineItem =
  | { kind: 'msg'; date: string; msg: ChatMessage }
  | { kind: 'offer'; date: string; offer: OfferRow };

const RequestConversationPage = () => {
  const { id: conversationId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isOnline } = usePresence();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [otherName, setOtherName] = useState('');
  const [otherAvatar, setOtherAvatar] = useState<string | null>(null);
  const [otherId, setOtherId] = useState('');
  const [requesterId, setRequesterId] = useState('');
  const [responderId, setResponderId] = useState('');
  const [requestId, setRequestId] = useState('');
  const [requestStatus, setRequestStatus] = useState<string>('active');
  const [requestInfo, setRequestInfo] = useState<{ category: string; neighborhood: string | null; min_price: number | null; max_price: number | null; currency: string | null } | null>(null);
  const [offerDialogOpen, setOfferDialogOpen] = useState(false);
  const [actingOfferId, setActingOfferId] = useState<string | null>(null);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { scrollToBottom, viewportHeight, viewportOffsetTop } = useKeyboardAwareChatViewport(messagesEndRef, messagesScrollRef);
  const channelRef = useRef(crypto.randomUUID());

  const isRequester = !!user && user.id === requesterId;
  const isResponder = !!user && user.id === responderId;

  const enrichOffers = async (rows: OfferRow[]): Promise<OfferRow[]> => {
    if (rows.length === 0) return rows;
    const listingIds = Array.from(new Set(rows.map(o => o.listing_id)));
    const [listingsRes, imagesRes] = await Promise.all([
      supabase.from('listings').select('id, title, price, currency, status').in('id', listingIds),
      supabase.from('listing_images').select('listing_id, url, is_primary, sort_order').in('listing_id', listingIds),
    ]);
    const lmap = new Map<string, any>((listingsRes.data ?? []).map((l: any) => [l.id, l]));
    const imgMap = new Map<string, string>();
    for (const img of (imagesRes.data ?? []) as any[]) {
      const existing = imgMap.get(img.listing_id);
      if (!existing || img.is_primary) imgMap.set(img.listing_id, img.url);
    }
    return rows.map(o => {
      const l = lmap.get(o.listing_id);
      return {
        ...o,
        listing_title: l?.title ?? null,
        listing_price: l?.price ?? null,
        listing_currency: l?.currency ?? null,
        listing_status: l?.status ?? null,
        listing_image: imgMap.get(o.listing_id) ?? null,
      };
    });
  };

  const loadData = useCallback(async () => {
    if (!user || !conversationId) return;
    setLoading(true);

    const { data: conv, error } = await supabase
      .from('request_conversations')
      .select('*')
      .eq('id', conversationId)
      .single();

    if (error || !conv) { setLoading(false); return; }
    setRequesterId(conv.requester_id);
    setResponderId(conv.responder_id);
    setRequestId(conv.request_id);

    const other = conv.requester_id === user.id ? conv.responder_id : conv.requester_id;
    setOtherId(other);

    const [profileRes, msgsRes, reqRes, offersRes] = await Promise.all([
      supabase.from('profiles').select('full_name, avatar_url').eq('id', other).single(),
      supabase.from('request_messages').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: true }),
      supabase.from('housing_requests').select('category, neighborhood, min_price, max_price, currency, status').eq('id', conv.request_id).maybeSingle(),
      supabase
        .from('housing_request_offers' as any)
        .select('*')
        .eq('housing_request_id', conv.request_id)
        .or(`and(owner_id.eq.${conv.requester_id},requester_id.eq.${conv.responder_id}),and(owner_id.eq.${conv.responder_id},requester_id.eq.${conv.requester_id})`)
        .order('created_at', { ascending: true }),
    ]);

    setOtherName(profileRes.data?.full_name ?? 'مستخدم');
    setOtherAvatar(profileRes.data?.avatar_url ?? null);
    setMessages(msgsRes.data ?? []);
    setRequestInfo(reqRes.data ?? null);
    setRequestStatus((reqRes.data as any)?.status ?? 'active');
    const enriched = await enrichOffers(((offersRes.data as any[]) ?? []) as OfferRow[]);
    setOffers(enriched);
    setLoading(false);

    await supabase
      .from('request_messages')
      .update({ is_read: true })
      .eq('conversation_id', conversationId)
      .neq('sender_id', user.id)
      .eq('is_read', false);

    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('link', `/request-chat/${conversationId}`)
      .eq('is_read', false);
  }, [user, conversationId]);

  useEffect(() => { loadData(); }, [loadData]);

  const refreshOffer = useCallback(async (offerId: string) => {
    const { data } = await supabase
      .from('housing_request_offers' as any)
      .select('*')
      .eq('id', offerId)
      .maybeSingle();
    if (!data) return;
    const [enriched] = await enrichOffers([data as any as OfferRow]);
    setOffers(prev => {
      const idx = prev.findIndex(o => o.id === offerId);
      if (idx === -1) return [...prev, enriched].sort((a, b) => a.created_at.localeCompare(b.created_at));
      const next = prev.slice();
      next[idx] = enriched;
      return next;
    });
  }, []);

  useEffect(() => {
    if (!conversationId || !user || !requestId) return;
    const channel = supabase
      .channel(`req-conv-${channelRef.current}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'request_messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        const msg = payload.new as ChatMessage;
        setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg]);
        if (msg.sender_id !== user.id) {
          supabase.from('request_messages').update({ is_read: true }).eq('id', msg.id);
        }
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'housing_request_offers',
        filter: `housing_request_id=eq.${requestId}`,
      }, (payload) => {
        const row = (payload.new ?? payload.old) as OfferRow;
        // Only care about offers between these two users
        const between =
          (row.owner_id === requesterId && row.requester_id === responderId) ||
          (row.owner_id === responderId && row.requester_id === requesterId);
        if (!between) return;
        if (payload.eventType === 'DELETE') {
          setOffers(prev => prev.filter(o => o.id !== row.id));
        } else {
          refreshOffer(row.id);
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'listings',
      }, (payload) => {
        const row = payload.new as { id: string; status?: string };
        setOffers(prev => prev.map(o => o.listing_id === row.id ? { ...o, listing_status: row.status ?? o.listing_status } : o));
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'housing_requests',
        filter: `id=eq.${requestId}`,
      }, (payload) => {
        const row = payload.new as { status?: string };
        if (row.status) setRequestStatus(row.status);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId, user, requestId, requesterId, responderId, refreshOffer]);

  useEffect(() => {
    scrollToBottom('smooth');
  }, [messages, offers, scrollToBottom]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !conversationId || !user || sending) return;
    setSending(true);
    const text = newMessage.trim();
    setNewMessage('');

    const tempId = `temp-${crypto.randomUUID()}`;
    const optimistic: ChatMessage = {
      id: tempId,
      conversation_id: conversationId,
      sender_id: user.id,
      message: text,
      is_read: false,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimistic]);

    const { data, error } = await supabase
      .from('request_messages')
      .insert({
        conversation_id: conversationId,
        sender_id: user.id,
        message: text,
      })
      .select()
      .single();

    if (error) {
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setNewMessage(text);
      toast.error('تعذر إرسال الرسالة');
      setSending(false);
      return;
    }

    setMessages(prev => {
      const withoutTemp = prev.filter(m => m.id !== tempId);
      if (withoutTemp.find(m => m.id === (data as ChatMessage).id)) return withoutTemp;
      return [...withoutTemp, data as ChatMessage];
    });

    const receiverId = user.id === requesterId ? responderId : requesterId;
    if (receiverId) {
      await supabase.from('notifications').insert({
        user_id: receiverId,
        type: 'new_message',
        title_ar: 'رسالة جديدة',
        body_ar: text.length > 80 ? text.slice(0, 80) + '...' : text,
        link: `/request-chat/${conversationId}`,
      });
    }
    setSending(false);
  };

  const postSystemMessage = async (text: string) => {
    if (!user || !conversationId) return;
    await supabase.from('request_messages').insert({
      conversation_id: conversationId,
      sender_id: user.id,
      message: text,
    });
  };

  const handleAcceptOffer = async (o: OfferRow) => {
    if (actingOfferId) return;
    if (!confirm('قبول هذا العرض؟')) return;
    setActingOfferId(o.id);
    const { error } = await supabase.rpc('accept_housing_request_offer' as any, { _offer_id: o.id });
    if (error) { toast.error(error.message || 'تعذر قبول العرض'); setActingOfferId(null); return; }
    await postSystemMessage(`✅ تم قبول عرض العقار: ${o.listing_title ?? ''}`);
    await supabase.from('notifications').insert({
      user_id: o.owner_id,
      type: 'private_offer_accepted' as any,
      title_ar: 'تم قبول عرضك',
      body_ar: `قبل المستأجر عرضك على: ${o.listing_title ?? ''}`,
      link: `/request-chat/${conversationId}`,
    });
    successToast('تم قبول العرض', { description: 'يمكن للمالك الآن إتمام التأجير' });
    setActingOfferId(null);
    refreshOffer(o.id);
  };

  const handleRejectOffer = async (o: OfferRow) => {
    if (actingOfferId) return;
    if (!confirm('رفض هذا العرض؟')) return;
    setActingOfferId(o.id);
    const { error } = await supabase.rpc('reject_housing_request_offer' as any, { _offer_id: o.id });
    if (error) { toast.error(error.message || 'تعذر رفض العرض'); setActingOfferId(null); return; }
    await postSystemMessage(`❌ تم رفض عرض العقار: ${o.listing_title ?? ''}`);
    await supabase.from('notifications').insert({
      user_id: o.owner_id,
      type: 'private_offer_rejected' as any,
      title_ar: 'تم رفض عرضك',
      body_ar: `بشأن: ${o.listing_title ?? ''}`,
      link: `/request-chat/${conversationId}`,
    });
    toast.success('تم رفض العرض');
    setActingOfferId(null);
    refreshOffer(o.id);
  };

  const handleCompleteRental = async (o: OfferRow) => {
    if (actingOfferId) return;
    if (!confirm('تأكيد إتمام تأجير هذا العقار للمستأجر؟')) return;
    setActingOfferId(o.id);
    const { error } = await supabase.rpc('complete_housing_request_offer' as any, { _offer_id: o.id });
    if (error) { toast.error(error.message || 'تعذر إتمام التأجير'); setActingOfferId(null); return; }
    await postSystemMessage(`🎉 تم إتمام عملية التأجير: ${o.listing_title ?? ''}`);
    await supabase.from('notifications').insert({
      user_id: o.requester_id,
      type: 'system' as any,
      title_ar: 'تم إتمام التأجير',
      body_ar: `تم إتمام تأجير العقار: ${o.listing_title ?? ''}`,
      link: `/request-chat/${conversationId}`,
    });
    successToast('تم إتمام التأجير', { description: 'تم تحديث حالة الإعلان والطلب' });
    setActingOfferId(null);
    refreshOffer(o.id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (loading) return <LoadingSpinner />;

  const online = otherId && isOnline(otherId);
  const initial = otherName.charAt(0) || '؟';

  // Only responder can send property offers (they are the owner/broker on this housing request)
  const canSendOffer = isResponder && requestStatus === 'active';
  const hasAcceptedOffer = offers.some(o => o.status === 'accepted' && (o as any).listing_status !== 'rented');
  const isFulfilled = requestStatus === 'fulfilled';

  // Merged chronological timeline of messages + offers
  const timeline: TimelineItem[] = [
    ...messages.map<TimelineItem>(m => ({ kind: 'msg', date: m.created_at, msg: m })),
    ...offers.map<TimelineItem>(o => ({ kind: 'offer', date: o.created_at, offer: o })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  // Group by date
  const dateGroups: { date: string; items: TimelineItem[] }[] = [];
  let lastDate = '';
  for (const it of timeline) {
    const dk = new Date(it.date).toDateString();
    if (dk !== lastDate) { dateGroups.push({ date: it.date, items: [it] }); lastDate = dk; }
    else dateGroups[dateGroups.length - 1].items.push(it);
  }

  const renderOfferCard = (o: OfferRow) => {
    const mine = user?.id === o.owner_id;
    const canRenterAct = isRequester && o.status === 'pending';
    const canOwnerComplete = isResponder && o.status === 'accepted' && o.listing_status !== 'rented';
    const isRented = o.listing_status === 'rented';
    return (
      <div className={cn('flex mt-3', mine ? 'justify-start' : 'justify-end')}>
        <div className="max-w-[85%] w-full sm:max-w-md rounded-2xl border border-border/60 bg-card overflow-hidden shadow-sm animate-fade-in">
          <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 border-b border-border/40">
            <Home className="h-3.5 w-3.5 text-primary" />
            <span className="text-[11px] font-bold text-primary">عرض عقار</span>
            <span className={cn('mr-auto text-[10px] font-bold rounded-md px-2 py-0.5', statusClass[o.status])}>
              {isRented ? 'تم التأجير' : statusLabel[o.status]}
            </span>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/listings/${o.listing_id}`)}
            className="flex gap-3 p-3 w-full text-right hover:bg-muted/30 transition-colors"
          >
            {o.listing_image ? (
              <img src={o.listing_image} alt={o.listing_title ?? ''} className="h-16 w-16 rounded-lg object-cover shrink-0" />
            ) : (
              <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <Home className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-foreground truncate">{o.listing_title ?? 'إعلان'}</p>
              {(o.proposed_price ?? o.listing_price) != null && (
                <p className="text-[12px] font-bold text-accent mt-0.5">
                  {formatPrice(Number(o.proposed_price ?? o.listing_price), (o.listing_currency ?? 'YER') as any)}
                </p>
              )}
              <p className="text-[10px] text-muted-foreground mt-1">{formatTime(o.created_at)}</p>
            </div>
          </button>
          {o.message && (
            <p className="px-3 pb-2 text-[12px] leading-[1.7] text-foreground/85 whitespace-pre-wrap"><Linkify text={o.message} /></p>
          )}
          <div className="px-3 pb-3 pt-1 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => navigate(`/listings/${o.listing_id}`)} className="h-8 gap-1 text-xs">
              <ExternalLink className="h-3 w-3" /> عرض العقار
            </Button>
            {canRenterAct && (
              <>
                <Button size="sm" onClick={() => handleAcceptOffer(o)} disabled={actingOfferId === o.id} className="h-8 gap-1 text-xs bg-success hover:bg-success/90 text-white">
                  {actingOfferId === o.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} قبول العرض
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleRejectOffer(o)} disabled={actingOfferId === o.id} className="h-8 gap-1 text-xs">
                  <X className="h-3 w-3" /> رفض العرض
                </Button>
              </>
            )}
            {canOwnerComplete && (
              <Button size="sm" onClick={() => handleCompleteRental(o)} disabled={actingOfferId === o.id} className="h-8 gap-1 text-xs bg-success hover:bg-success/90 text-white">
                {actingOfferId === o.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />} تم التأجير
              </Button>
            )}
            {isRequester && o.status === 'accepted' && !isRented && (
              <span className="text-[11px] text-success font-medium self-center">بانتظار إتمام المالك للتأجير</span>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className="fixed inset-x-0 top-0 z-50 flex flex-col bg-background font-tajawal overflow-hidden"
      style={{ height: viewportHeight ? `${viewportHeight}px` : '100dvh', top: `${viewportOffsetTop}px` }}
      dir="rtl"
    >
      <header className="relative shrink-0 z-40 flex items-center gap-3 h-16 px-3 border-b border-border/50 bg-card/90 backdrop-blur-xl">

        <button type="button" onClick={() => navigate(-1)} aria-label="رجوع"
          className="relative z-10 shrink-0 flex h-10 w-10 items-center justify-center rounded-full text-foreground hover:bg-muted active:scale-95 transition">
          <ArrowRight className="h-5 w-5 pointer-events-none" />
        </button>
        <button
          type="button"
          onClick={() => otherId && navigate(`/profile/${otherId}`)}
          className="flex items-center gap-3 flex-1 min-w-0 text-right"
        >
          <div className="relative shrink-0">
            <div className="flex h-11 w-11 items-center justify-center rounded-full overflow-hidden bg-primary/15 text-primary font-semibold">
              {otherAvatar ? <img src={otherAvatar} alt={otherName} className="h-full w-full object-cover" /> : <span>{initial}</span>}
            </div>
            {online && <span className="absolute bottom-0 left-0 h-3 w-3 rounded-full bg-green-500 ring-2 ring-card" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-bold text-foreground truncate leading-tight">{otherName}</p>
            <p className={cn('text-[12px] truncate leading-tight', online ? 'text-green-600 dark:text-green-500' : 'text-muted-foreground')}>
              {online ? 'متصل الآن' : 'بخصوص طلب السكن'}
            </p>
          </div>
        </button>

        {isFulfilled && (
          <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-success/15 text-success text-xs font-bold px-3 py-2">
            <CheckCircle2 className="h-3.5 w-3.5" /> تم التأجير
          </span>
        )}

        {canSendOffer && !hasAcceptedOffer && !isFulfilled && (
          <button
            onClick={() => setOfferDialogOpen(true)}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground text-xs font-bold px-3 py-2 hover:bg-primary/90 transition-all active:scale-95"
          >
            <Home className="h-3.5 w-3.5" /> إرسال عرض عقار
          </button>
        )}
      </header>

      {requestInfo && requestId && (
        <button
          type="button"
          onClick={() => navigate(`/requests/${requestId}`)}
          className="shrink-0 w-full text-right px-4 py-2.5 bg-primary/5 border-b border-border/50 hover:bg-primary/10 transition-colors"
        >
          <p className="text-[11px] text-muted-foreground mb-0.5">المحادثة بخصوص الطلب</p>
          <p className="text-[13px] font-semibold text-foreground truncate">
            {({ room: 'غرفة', apartment: 'شقة', house: 'بيت', floor: 'دور', shop: 'محل', office: 'مكتب', shared: 'سكن مشترك', family: 'عائلي', student: 'طلابي' } as Record<string, string>)[requestInfo.category] ?? requestInfo.category}
            {requestInfo.neighborhood ? ` — ${requestInfo.neighborhood}` : ''}
            {(requestInfo.min_price || requestInfo.max_price) ? ` • ${requestInfo.min_price ?? '—'} – ${requestInfo.max_price ?? '—'} ${requestInfo.currency ?? ''}` : ''}
          </p>
        </button>
      )}


      <div ref={messagesScrollRef} className="flex-1 min-h-0 overflow-y-auto scroll-smooth overscroll-contain px-3 sm:px-6 py-3 bg-muted/30">
        <div className="max-w-3xl mx-auto flex flex-col">
          {timeline.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center mt-8">ابدأ المحادثة...</p>
          ) : dateGroups.map((g, gi) => (
            <div key={gi} className="flex flex-col mt-4 first:mt-0">
              <div className="flex justify-center mb-3">
                <span className="text-[11px] text-muted-foreground bg-card/80 backdrop-blur px-3 py-1 rounded-full border border-border/50 shadow-sm">
                  {formatDateLabel(g.date)}
                </span>
              </div>
              {g.items.map((it, ii) => {
                if (it.kind === 'offer') {
                  return <div key={`o-${it.offer.id}-${ii}`}>{renderOfferCard(it.offer)}</div>;
                }
                const msg = it.msg;
                const isMine = msg.sender_id === user?.id;
                return (
                  <div key={`m-${msg.id}`} className={cn('flex flex-col mt-3 first:mt-0', isMine ? 'items-start' : 'items-end')}>
                    <div
                      className={cn(
                        'relative max-w-[70%] px-3 pt-2 pb-1.5 shadow-sm animate-fade-in rounded-2xl',
                        isMine ? 'bg-primary text-primary-foreground' : 'bg-card text-foreground border border-border/50',
                      )}>
                      <p className="text-[14px] leading-snug whitespace-pre-wrap break-words pe-12"><Linkify text={msg.message} /></p>
                      <span className={cn('absolute bottom-1 left-2 text-[10px] leading-none opacity-60 select-none',
                        isMine ? 'text-primary-foreground' : 'text-muted-foreground')}>
                        {formatTime(msg.created_at)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div
        className="shrink-0 border-t border-border bg-card px-4 pt-3 pb-safe-input"
      >
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-2 rounded-full border border-border bg-background pr-4 pl-1.5 py-1 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all">
            <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyDown={handleKeyDown}
              placeholder="اكتب رسالة..."
              className="min-w-0 flex-1 bg-transparent py-2 text-base sm:text-sm outline-none placeholder:text-muted-foreground" />
            <Button size="icon" onClick={sendMessage} disabled={!newMessage.trim() || sending}
              className="rounded-full h-9 w-9 shrink-0 transition-all active:scale-95">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 -scale-x-100" />}
            </Button>
          </div>
        </div>
      </div>

      {canSendOffer && requesterId && (
        <SendHousingOfferDialog
          open={offerDialogOpen}
          onOpenChange={setOfferDialogOpen}
          housingRequestId={requestId}
          requesterId={requesterId}
          onSent={() => { /* realtime will insert the card */ }}
        />
      )}
    </div>
  );
};

export default RequestConversationPage;
