import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Send, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

const getRelativeTime = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'الآن';
  if (mins < 60) return `${mins} د`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} س`;
  const days = Math.floor(hours / 24);
  return `${days} يوم`;
};

const ConversationPage = () => {
  const { id: conversationId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [otherName, setOtherName] = useState('');
  const [listingTitle, setListingTitle] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [userId, setUserId] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef(crypto.randomUUID());

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadData = useCallback(async () => {
    if (!user || !conversationId) return;
    setLoading(true);

    // Get conversation info
    const { data: conv } = await supabase
      .from('listing_conversations')
      .select('*')
      .eq('id', conversationId)
      .single();

    if (!conv) { setLoading(false); return; }
    setOwnerId(conv.owner_id);
    setUserId(conv.user_id);

    const otherId = conv.owner_id === user.id ? conv.user_id : conv.owner_id;
    const [profileRes, listingRes, msgsRes] = await Promise.all([
      supabase.from('profiles').select('full_name').eq('id', otherId).single(),
      supabase.from('listings').select('title').eq('id', conv.listing_id).single(),
      supabase.from('listing_messages').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: true }),
    ]);

    setOtherName(profileRes.data?.full_name ?? 'مستخدم');
    setListingTitle(listingRes.data?.title ?? 'إعلان');
    setMessages(msgsRes.data ?? []);
    setLoading(false);

    // Mark as read
    await supabase
      .from('listing_messages')
      .update({ is_read: true })
      .eq('conversation_id', conversationId)
      .neq('sender_id', user.id)
      .eq('is_read', false);

    // Mark notifications as read
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('link', `/chat/${conversationId}`)
      .eq('is_read', false);
  }, [user, conversationId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Realtime
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

  return (
    <div className="flex flex-col h-screen bg-background font-tajawal" dir="rtl">
      <PageHeader title={otherName} showBack />
      <p className="text-xs text-muted-foreground text-center py-1 border-b border-border bg-card">{listingTitle}</p>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center mt-8">ابدأ المحادثة...</p>
        ) : (
          messages.map((msg) => {
            const isMine = msg.sender_id === user?.id;
            return (
              <div key={msg.id} className={cn('flex', isMine ? 'justify-start' : 'justify-end')}>
                <div className={cn(
                  'max-w-[75%] rounded-2xl px-4 py-2.5',
                  isMine
                    ? 'bg-accent text-white rounded-br-sm'
                    : 'bg-muted text-foreground rounded-bl-sm'
                )}>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                  <p className={cn('text-[10px] mt-1', isMine ? 'text-white/60' : 'text-muted-foreground')}>
                    {getRelativeTime(msg.created_at)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-3 bg-card">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="اكتب رسالتك..."
            className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-accent"
          />
          <Button size="icon" onClick={sendMessage} disabled={!newMessage.trim() || sending} className="rounded-xl h-10 w-10 shrink-0">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ConversationPage;
