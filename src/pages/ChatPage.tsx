import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConversationItem {
  id: string;
  listing_id: string;
  owner_id: string;
  user_id: string;
  created_at: string;
  listing_title: string;
  other_name: string;
  other_avatar: string | null;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
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

const ChatPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConversations = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data: convs } = await supabase
      .from('listing_conversations')
      .select('*')
      .or(`owner_id.eq.${user.id},user_id.eq.${user.id}`)
      .order('created_at', { ascending: false });

    if (!convs || convs.length === 0) {
      setConversations([]);
      setLoading(false);
      return;
    }

    // Get listing titles and other user info
    const items: ConversationItem[] = [];
    for (const conv of convs) {
      const otherId = conv.owner_id === user.id ? conv.user_id : conv.owner_id;
      
      const [listingRes, profileRes, msgRes, unreadRes] = await Promise.all([
        supabase.from('listings').select('title').eq('id', conv.listing_id).single(),
        supabase.from('profiles').select('full_name, avatar_url').eq('id', otherId).single(),
        supabase.from('listing_messages').select('message, created_at').eq('conversation_id', conv.id).order('created_at', { ascending: false }).limit(1),
        supabase.from('listing_messages').select('id', { count: 'exact', head: true }).eq('conversation_id', conv.id).neq('sender_id', user.id).eq('is_read', false),
      ]);

      items.push({
        id: conv.id,
        listing_id: conv.listing_id,
        owner_id: conv.owner_id,
        user_id: conv.user_id,
        created_at: conv.created_at,
        listing_title: listingRes.data?.title ?? 'إعلان',
        other_name: profileRes.data?.full_name ?? 'مستخدم',
        other_avatar: profileRes.data?.avatar_url ?? null,
        last_message: msgRes.data?.[0]?.message ?? null,
        last_message_at: msgRes.data?.[0]?.created_at ?? conv.created_at,
        unread_count: unreadRes.count ?? 0,
      });
    }

    // Sort by last message
    items.sort((a, b) => new Date(b.last_message_at!).getTime() - new Date(a.last_message_at!).getTime());
    setConversations(items);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="min-h-screen bg-background font-tajawal" dir="rtl">
      <PageHeader title="المحادثات" showBack />

      <div className="p-4">
        {conversations.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="لا توجد محادثات"
            subtitle="ابدأ محادثة من صفحة أي إعلان"
          />
        ) : (
          <div className="space-y-2">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => navigate(`/chat/${conv.id}`)}
                className={cn(
                  'w-full flex gap-3 rounded-xl p-4 text-right transition-colors',
                  conv.unread_count > 0 ? 'bg-accent/5 border border-accent/20' : 'bg-card'
                )}
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 overflow-hidden">
                  {conv.other_avatar ? (
                    <img src={conv.other_avatar} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-lg font-bold text-primary">{conv.other_name.charAt(0)}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-foreground truncate">{conv.other_name}</p>
                    {conv.last_message_at && (
                      <span className="text-[10px] text-muted-foreground shrink-0">{getRelativeTime(conv.last_message_at)}</span>
                    )}
                  </div>
                  <p className="text-xs text-accent truncate mt-0.5">{conv.listing_title}</p>
                  {conv.last_message && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{conv.last_message}</p>
                  )}
                </div>
                {conv.unread_count > 0 && (
                  <div className="flex items-center">
                    <span className="bg-accent text-white text-[10px] font-bold rounded-full h-5 min-w-[20px] flex items-center justify-center px-1">
                      {conv.unread_count}
                    </span>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatPage;
