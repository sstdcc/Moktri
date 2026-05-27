import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Send, Loader2, ArrowRight, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { usePresence } from '@/contexts/PresenceContext';

interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

const formatTime = (dateStr: string) =>
  new Date(dateStr).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });

const formatDateLabel = (dateStr: string) => {
  const d = new Date(dateStr);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return 'اليوم';
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'أمس';
  return d.toLocaleDateString('ar', { day: '2-digit', month: 'long', year: 'numeric' });
};

const ConversationPage = () => {
  const { id: conversationId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isOnline } = usePresence();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [otherName, setOtherName] = useState('');
  const [otherAvatar, setOtherAvatar] = useState<string | null>(null);
  const [otherId, setOtherId] = useState('');
  const [listingTitle, setListingTitle] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [userId, setUserId] = useState('');
  const [listingId, setListingId] = useState('');
  const [listingStatus, setListingStatus] = useState<string>('');
  const [ownerConfirmedAt, setOwnerConfirmedAt] = useState<string | null>(null);
  const [tenantConfirmedAt, setTenantConfirmedAt] = useState<string | null>(null);
  const [confirmingDeal, setConfirmingDeal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const visibleHeight = useVisibleViewportHeight(containerRef);
  const channelRef = useRef(crypto.randomUUID());

  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };

  const loadData = useCallback(async () => {
    if (!user || !conversationId) return;
    setLoading(true);

    const { data: conv } = await supabase
      .from('listing_conversations')
      .select('*')
      .eq('id', conversationId)
      .single();

    if (!conv) { setLoading(false); return; }
    setOwnerId(conv.owner_id);
    setUserId(conv.user_id);
    setListingId(conv.listing_id);

    const other = conv.owner_id === user.id ? conv.user_id : conv.owner_id;
    setOtherId(other);
    const [profileRes, listingRes, msgsRes] = await Promise.all([
      supabase.from('profiles').select('full_name, avatar_url').eq('id', other).single(),
      supabase.from('listings').select('title, status, owner_confirmed_at, tenant_confirmed_at').eq('id', conv.listing_id).single(),
      supabase.from('listing_messages').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: true }),
    ]);

    setOtherName(profileRes.data?.full_name ?? 'مستخدم');
    setOtherAvatar(profileRes.data?.avatar_url ?? null);
    setListingTitle(listingRes.data?.title ?? 'إعلان');
    setListingStatus((listingRes.data as any)?.status ?? '');
    setOwnerConfirmedAt((listingRes.data as any)?.owner_confirmed_at ?? null);
    setTenantConfirmedAt((listingRes.data as any)?.tenant_confirmed_at ?? null);
    setMessages(msgsRes.data ?? []);
    setLoading(false);

    await supabase
      .from('listing_messages')
      .update({ is_read: true })
      .eq('conversation_id', conversationId)
      .neq('sender_id', user.id)
      .eq('is_read', false);

    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('link', `/chat/${conversationId}`)
      .eq('is_read', false);
  }, [user, conversationId]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!conversationId || !user) return;
    const channel = supabase
      .channel(`conv-${channelRef.current}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'listing_messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        const msg = payload.new as ChatMessage;
        setMessages(prev => {
          if (prev.find(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        if (msg.sender_id !== user.id) {
          supabase.from('listing_messages').update({ is_read: true }).eq('id', msg.id);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId, user]);

  useEffect(() => { scrollToBottom(); }, [messages]);
  useEffect(() => { scrollToBottom(false); }, [visibleHeight]);

  const isOwnerSide = !!user && user.id === ownerId;
  const isTenantSide = !!user && user.id === userId;
  const myConfirmed = isOwnerSide ? !!ownerConfirmedAt : !!tenantConfirmedAt;
  const otherConfirmed = isOwnerSide ? !!tenantConfirmedAt : !!ownerConfirmedAt;
  const isRented = listingStatus === 'rented';
  const showConfirmSection = (listingStatus === 'negotiating' || isRented) && (isOwnerSide || isTenantSide);

  const handleConfirmDeal = async () => {
    if (!user || !listingId || !conversationId || confirmingDeal) return;
    if (myConfirmed) return;
    const msg = isOwnerSide ? 'تأكيد التأجير لهذا المستأجر؟' : 'تأكيد الاتفاق على هذا الإعلان؟';
    if (!confirm(msg)) return;
    setConfirmingDeal(true);
    try {
      const { data, error } = await (supabase as any).rpc('confirm_rental_deal', {
        _listing_id: listingId,
        _conversation_id: conversationId,
      });
      if (error) throw error;
      const nowIso = new Date().toISOString();
      if (isOwnerSide) setOwnerConfirmedAt(nowIso); else setTenantConfirmedAt(nowIso);
      if (data?.both_confirmed) {
        setListingStatus('rented');
        toast.success('تم تأكيد الاتفاق وتأجير الإعلان');
      } else {
        toast.success('تم تسجيل تأكيدك، بانتظار الطرف الآخر');
      }
    } catch (e: any) {
      toast.error(e?.message || 'حدث خطأ');
    } finally {
      setConfirmingDeal(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !conversationId || !user || sending) return;
    setSending(true);
    const text = newMessage.trim();
    setNewMessage('');

    const { error } = await supabase.from('listing_messages').insert({
      conversation_id: conversationId,
      sender_id: user.id,
      message: text,
    });

    if (!error) {
      const receiverId = user.id === ownerId ? userId : ownerId;
      if (receiverId) {
        await supabase.from('notifications').insert({
          user_id: receiverId,
          type: 'new_message' as any,
          title_ar: `رسالة جديدة`,
          body_ar: text.length > 80 ? text.slice(0, 80) + '...' : text,
          link: `/chat/${conversationId}`,
        });
      }
    }
    setSending(false);
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

  // Group messages by date and by consecutive sender
  const groups: { date: string; items: ChatMessage[][] }[] = [];
  let lastDate = '';
  let lastSender = '';
  for (const m of messages) {
    const dateKey = new Date(m.created_at).toDateString();
    if (dateKey !== lastDate) {
      groups.push({ date: m.created_at, items: [[m]] });
      lastDate = dateKey;
      lastSender = m.sender_id;
    } else {
      const g = groups[groups.length - 1];
      if (m.sender_id === lastSender) {
        g.items[g.items.length - 1].push(m);
      } else {
        g.items.push([m]);
        lastSender = m.sender_id;
      }
    }
  }

  return (
    <div
      ref={containerRef}
      style={{ height: visibleHeight ? `${visibleHeight}px` : '100%' }}
      className="flex flex-col bg-background font-tajawal overflow-hidden"
      dir="rtl"
    >
      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center gap-3 h-16 px-3 border-b border-border/50 bg-card/90 backdrop-blur-xl">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="رجوع"
          className="relative z-10 shrink-0 flex h-10 w-10 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted active:scale-95"
        >
          <ArrowRight className="h-5 w-5 pointer-events-none" />
        </button>

        <div className="relative shrink-0">
          <div className="flex h-11 w-11 items-center justify-center rounded-full overflow-hidden bg-primary/15 text-primary font-semibold">
            {otherAvatar ? (
              <img src={otherAvatar} alt={otherName} className="h-full w-full object-cover" />
            ) : (
              <span className="text-base">{initial}</span>
            )}
          </div>
          {online && (
            <span className="absolute bottom-0 left-0 h-3 w-3 rounded-full bg-green-500 ring-2 ring-card" />
          )}
        </div>

        <div className="flex-1 min-w-0 flex flex-col">
          <p className="text-[15px] font-bold text-foreground truncate leading-tight">{otherName}</p>
          <p className={cn('text-[12px] truncate leading-tight', online ? 'text-green-600 dark:text-green-500' : 'text-muted-foreground')}>
            {online ? 'متصل الآن' : listingTitle}
          </p>
        </div>

        {showConfirmSection && (
          isRented ? (
            <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-success/15 text-success text-xs font-bold px-3 py-2">
              <CheckCircle2 className="h-3.5 w-3.5" /> تم التأجير
            </span>
          ) : (
            <button
              onClick={handleConfirmDeal}
              disabled={confirmingDeal || myConfirmed}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-success text-white text-xs font-bold px-3 py-2 hover:bg-success/90 disabled:opacity-60 transition-all active:scale-95"
            >
              {confirmingDeal ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              {myConfirmed ? 'بانتظار الطرف الآخر' : (isOwnerSide ? 'تم التأجير' : 'أؤكد الاتفاق')}
            </button>
          )
        )}
      </header>

      {showConfirmSection && !isRented && (myConfirmed || otherConfirmed) && (
        <div className="px-3 sm:px-6 py-2 bg-success/10 border-b border-success/20 text-center text-xs font-medium text-success">
          {myConfirmed && !otherConfirmed && 'تم تسجيل تأكيدك — بانتظار تأكيد الطرف الآخر'}
          {!myConfirmed && otherConfirmed && (isOwnerSide ? 'أكد المستأجر الاتفاق — بانتظار تأكيدك' : 'أكد المالك الاتفاق — بانتظار تأكيدك')}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scroll-smooth px-3 sm:px-6 py-3 bg-muted/30">
        <div className="max-w-3xl mx-auto flex flex-col">
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center mt-8">ابدأ المحادثة...</p>
          ) : (
            groups.map((g, gi) => (
              <div key={gi} className="flex flex-col mt-4 first:mt-0">
                {/* Date separator */}
                <div className="flex justify-center mb-3">
                  <span className="text-[11px] text-muted-foreground bg-card/80 backdrop-blur px-3 py-1 rounded-full border border-border/50 shadow-sm">
                    {formatDateLabel(g.date)}
                  </span>
                </div>

                {g.items.map((block, bi) => {
                  const isMine = block[0].sender_id === user?.id;
                  return (
                    <div key={bi} className={cn('flex flex-col mt-3 first:mt-0', isMine ? 'items-start' : 'items-end')}>
                      {block.map((msg, mi) => {
                        const isFirst = mi === 0;
                        const isLast = mi === block.length - 1;
                        const time = formatTime(msg.created_at);
                        return (
                          <div
                            key={msg.id}
                            className={cn(
                              'relative max-w-[70%] px-3 pt-2 pb-1.5 shadow-sm animate-fade-in mt-0.5 first:mt-0',
                              'rounded-2xl',
                              isMine
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-card text-foreground border border-border/50',
                              isMine && isFirst && 'rounded-br-sm',
                              !isMine && isFirst && 'rounded-bl-sm',
                              isMine && isLast && 'rounded-tr-sm',
                              !isMine && isLast && 'rounded-tl-sm',
                              isMine && !isFirst && !isLast && 'rounded-r-sm',
                              !isMine && !isFirst && !isLast && 'rounded-l-sm'
                            )}
                          >
                            <p className="text-[14px] leading-snug whitespace-pre-wrap break-words pe-12">
                              {msg.message}
                            </p>
                            <span className={cn(
                              'absolute bottom-1 left-2 text-[10px] leading-none opacity-60 select-none',
                              isMine ? 'text-primary-foreground' : 'text-muted-foreground'
                            )}>
                              {time}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-border/50 bg-card/95 backdrop-blur-xl px-2 sm:px-6 py-2 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)]">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-2 rounded-full border border-border bg-background pr-4 pl-1.5 py-1 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="اكتب رسالة..."
              className="flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
            />
            <Button
              size="icon"
              onClick={sendMessage}
              disabled={!newMessage.trim() || sending}
              className="rounded-full h-9 w-9 shrink-0 transition-all active:scale-95"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 -scale-x-100" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConversationPage;
