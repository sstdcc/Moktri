import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Send, Loader2, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePresence } from '@/contexts/PresenceContext';
import { useKeyboardAwareChatViewport } from '@/hooks/useKeyboardAwareChatViewport';

interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  message: string;
  is_read: boolean;
  created_at: string;
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

const RequestConversationPage = () => {
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
  const [requesterId, setRequesterId] = useState('');
  const [responderId, setResponderId] = useState('');
  const [requestId, setRequestId] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { viewportHeight, scrollToBottom } = useKeyboardAwareChatViewport(messagesEndRef);
  const channelRef = useRef(crypto.randomUUID());

  const loadData = useCallback(async () => {
    if (!user || !conversationId) return;
    setLoading(true);

    const { data: conv, error } = await (supabase as any)
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

    const [profileRes, msgsRes] = await Promise.all([
      supabase.from('profiles').select('full_name, avatar_url').eq('id', other).single(),
      (supabase as any).from('request_messages').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: true }),
    ]);

    setOtherName(profileRes.data?.full_name ?? 'مستخدم');
    setOtherAvatar(profileRes.data?.avatar_url ?? null);
    setMessages(msgsRes.data ?? []);
    setLoading(false);

    await (supabase as any)
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

  useEffect(() => {
    if (!conversationId || !user) return;
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
          (supabase as any).from('request_messages').update({ is_read: true }).eq('id', msg.id);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId, user]);

  useEffect(() => {
    scrollToBottom('smooth');
  }, [messages, scrollToBottom]);

  useEffect(() => {
    scrollToBottom('smooth');
  }, [viewportHeight, scrollToBottom]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !conversationId || !user || sending) return;
    setSending(true);
    const text = newMessage.trim();
    setNewMessage('');
    const { error } = await (supabase as any).from('request_messages').insert({
      conversation_id: conversationId,
      sender_id: user.id,
      message: text,
    });
    if (!error) {
      const receiverId = user.id === requesterId ? responderId : requesterId;
      if (receiverId) {
        await supabase.from('notifications').insert({
          user_id: receiverId,
          type: 'new_message' as any,
          title_ar: 'رسالة جديدة',
          body_ar: text.length > 80 ? text.slice(0, 80) + '...' : text,
          link: `/request-chat/${conversationId}`,
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

  // Group by date and consecutive sender
  const groups: { date: string; items: ChatMessage[][] }[] = [];
  let lastDate = ''; let lastSender = '';
  for (const m of messages) {
    const dateKey = new Date(m.created_at).toDateString();
    if (dateKey !== lastDate) {
      groups.push({ date: m.created_at, items: [[m]] });
      lastDate = dateKey; lastSender = m.sender_id;
    } else {
      const g = groups[groups.length - 1];
      if (m.sender_id === lastSender) g.items[g.items.length - 1].push(m);
      else { g.items.push([m]); lastSender = m.sender_id; }
    }
  }

  return (
    <div
      style={{ height: viewportHeight }}
      className="flex flex-col bg-background font-tajawal overflow-hidden"
      dir="rtl"
    >
      <header className="sticky top-0 shrink-0 z-40 flex items-center gap-3 h-16 px-3 border-b border-border/50 bg-card/90 backdrop-blur-xl">

        <button type="button" onClick={() => navigate(-1)} aria-label="رجوع"
          className="relative z-10 shrink-0 flex h-10 w-10 items-center justify-center rounded-full text-foreground hover:bg-muted active:scale-95 transition">
          <ArrowRight className="h-5 w-5 pointer-events-none" />
        </button>
        <button
          type="button"
          onClick={() => requestId && navigate(`/requests/${requestId}`)}
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
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto scroll-smooth overscroll-contain px-3 sm:px-6 py-3 bg-muted/30">
        <div className="max-w-3xl mx-auto flex flex-col">
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center mt-8">ابدأ المحادثة...</p>
          ) : groups.map((g, gi) => (
            <div key={gi} className="flex flex-col mt-4 first:mt-0">
              <div className="flex justify-center mb-3">
                <span className="text-[11px] text-muted-foreground bg-card/80 backdrop-blur px-3 py-1 rounded-full border border-border/50 shadow-sm">
                  {formatDateLabel(g.date)}
                </span>
              </div>
              {g.items.map((block, bi) => {
                const isMine = block[0].sender_id === user?.id;
                return (
                  <div key={bi} className={cn('flex flex-col mt-3 first:mt-0', isMine ? 'items-start' : 'items-end')}>
                    {block.map((msg) => (
                      <div key={msg.id}
                        className={cn(
                          'relative max-w-[70%] px-3 pt-2 pb-1.5 shadow-sm animate-fade-in mt-0.5 first:mt-0 rounded-2xl',
                          isMine ? 'bg-primary text-primary-foreground' : 'bg-card text-foreground border border-border/50',
                        )}>
                        <p className="text-[14px] leading-snug whitespace-pre-wrap break-words pe-12">{msg.message}</p>
                        <span className={cn('absolute bottom-1 left-2 text-[10px] leading-none opacity-60 select-none',
                          isMine ? 'text-primary-foreground' : 'text-muted-foreground')}>
                          {formatTime(msg.created_at)}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="shrink-0 border-t border-border bg-card px-4 pt-3 pb-safe-input">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-2 rounded-full border border-border bg-background pr-4 pl-1.5 py-1 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all">
            <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyDown={handleKeyDown}
              placeholder="اكتب رسالة..."
              className="flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground" />
            <Button size="icon" onClick={sendMessage} disabled={!newMessage.trim() || sending}
              className="rounded-full h-9 w-9 shrink-0 transition-all active:scale-95">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 -scale-x-100" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RequestConversationPage;
