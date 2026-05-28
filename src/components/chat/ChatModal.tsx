import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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

interface ChatModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listingId: string;
  ownerId: string;
  listingTitle: string;
  ownerName: string;
}

const getRelativeTime = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'الآن';
  if (mins < 60) return `منذ ${mins} د`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `منذ ${hours} س`;
  const days = Math.floor(hours / 24);
  return `منذ ${days} يوم`;
};

export const ChatModal = ({ open, onOpenChange, listingId, ownerId, listingTitle, ownerName }: ChatModalProps) => {
  const { user } = useAuth();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<string>(crypto.randomUUID());

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const initConversation = useCallback(async () => {
    if (!user || !open) return;
    setLoading(true);

    // Find or create conversation
    const { data: existing } = await supabase
      .from('listing_conversations')
      .select('id')
      .eq('listing_id', listingId)
      .eq('user_id', user.id)
      .maybeSingle();

    let convId: string;
    if (existing) {
      convId = existing.id;
    } else {
      const { data: created, error } = await supabase
        .from('listing_conversations')
        .insert({ listing_id: listingId, owner_id: ownerId, user_id: user.id })
        .select('id')
        .single();
      if (error || !created) { setLoading(false); return; }
      convId = created.id;
    }
    setConversationId(convId);

    // Load messages
    const { data: msgs } = await supabase
      .from('listing_messages')
      .select('*')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true });
    setMessages(msgs ?? []);
    setLoading(false);

    // Mark unread messages as read
    await supabase
      .from('listing_messages')
      .update({ is_read: true })
      .eq('conversation_id', convId)
      .neq('sender_id', user.id)
      .eq('is_read', false);
  }, [user, open, listingId, ownerId]);

  useEffect(() => {
    initConversation();
  }, [initConversation]);

  // Realtime subscription
  useEffect(() => {
    if (!conversationId || !user) return;
    const channel = supabase
      .channel(`chat-${channelRef.current}`)
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
        // Mark as read if not from me
        if (msg.sender_id !== user.id) {
          supabase.from('listing_messages').update({ is_read: true }).eq('id', msg.id);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId, user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
      // Create notification for the other party
      const receiverId = user.id === ownerId ? 
        // find user_id from conversation
        (await supabase.from('listing_conversations').select('user_id').eq('id', conversationId).single()).data?.user_id
        : ownerId;
      
      if (receiverId) {
        await supabase.from('notifications').insert({
          user_id: receiverId,
          type: 'new_message' as any,
          title_ar: `رسالة جديدة من ${user.user_metadata?.full_name || 'مستخدم'}`,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="font-tajawal max-w-md h-[90dvh] max-h-[90dvh] flex flex-col p-0 gap-0 fixed bottom-0 top-auto left-1/2 -translate-x-1/2 translate-y-0 rounded-b-none sm:rounded-b-lg bg-background"
        dir="rtl"
      >
        <DialogHeader className="p-4 border-b border-border shrink-0 bg-background">
          <DialogTitle className="text-right text-sm font-bold">{ownerName}</DialogTitle>
          <p className="text-xs text-muted-foreground text-right">{listingTitle}</p>
        </DialogHeader>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-muted-foreground">ابدأ المحادثة...</p>
            </div>
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

        {/* Input area */}
        <div className="border-t border-border p-3 shrink-0 bg-background pb-[env(safe-area-inset-bottom)]">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="اكتب رسالتك..."
              className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-accent"
            />
            <Button
              size="icon"
              onClick={sendMessage}
              disabled={!newMessage.trim() || sending}
              className="rounded-xl h-10 w-10 shrink-0"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
