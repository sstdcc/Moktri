import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { MessageSquare, Search, Camera, MoreVertical, Trash2, Check, CheckCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { usePresence } from '@/contexts/PresenceContext';

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
  last_message_sender_id: string | null;
  last_message_is_read: boolean;
  unread_count: number;
}

const formatTime = (dateStr: string) => {
  const date = new Date(dateStr);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return date.toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'أمس';
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (diffDays < 7) {
    return date.toLocaleDateString('ar-YE', { weekday: 'long' });
  }
  return date.toLocaleDateString('ar-YE', { day: '2-digit', month: '2-digit', year: '2-digit' });
};

// Color palette for avatar fallbacks
const avatarPalette = [
  { bg: 'bg-violet-500', fg: 'text-white' },
  { bg: 'bg-emerald-500', fg: 'text-white' },
  { bg: 'bg-amber-500', fg: 'text-white' },
  { bg: 'bg-sky-500', fg: 'text-white' },
  { bg: 'bg-rose-500', fg: 'text-white' },
  { bg: 'bg-indigo-500', fg: 'text-white' },
  { bg: 'bg-teal-500', fg: 'text-white' },
  { bg: 'bg-fuchsia-500', fg: 'text-white' },
];

const getAvatarColor = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return avatarPalette[Math.abs(hash) % avatarPalette.length];
};

type FilterMode = 'all' | 'unread';

interface RowProps {
  conv: ConversationItem;
  currentUserId: string;
  onOpen: (c: ConversationItem) => void;
  onDelete: (c: ConversationItem) => void;
}

const ConversationRow = ({ conv, currentUserId, onOpen, onDelete }: RowProps) => {
  const [translateX, setTranslateX] = useState(0);
  const [startX, setStartX] = useState<number | null>(null);
  const isUnread = conv.unread_count > 0;
  const palette = getAvatarColor(conv.other_name);
  const isMine = conv.last_message_sender_id === currentUserId;
  const otherUserId = conv.owner_id === currentUserId ? conv.user_id : conv.owner_id;
  const { isOnline } = usePresence();
  const online = isOnline(otherUserId);

  const handleTouchStart = (e: React.TouchEvent) => setStartX(e.touches[0].clientX);
  const handleTouchMove = (e: React.TouchEvent) => {
    if (startX === null) return;
    const delta = e.touches[0].clientX - startX;
    if (delta > 0) setTranslateX(Math.min(delta, 88));
  };
  const handleTouchEnd = () => {
    setTranslateX(translateX > 50 ? 80 : 0);
    setStartX(null);
  };

  return (
    <div className="relative overflow-hidden">
      {/* Delete action */}
      <div className="absolute inset-y-0 right-0 flex items-center pr-4">
        <button
          onClick={() => onDelete(conv)}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive text-destructive-foreground active:scale-95 transition-transform"
          aria-label="حذف"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <button
        onClick={() => onOpen(conv)}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ transform: `translateX(${translateX}px)` }}
        className="relative w-full text-right flex items-center gap-3 px-4 py-3 bg-card transition-colors active:bg-muted/60"
      >
        {/* Avatar - 56px like WhatsApp */}
        <div className="relative shrink-0">
          <div className={cn('flex h-14 w-14 items-center justify-center rounded-full overflow-hidden', palette.bg)}>
            {conv.other_avatar ? (
              <img src={conv.other_avatar} alt={conv.other_name} className="h-full w-full object-cover" />
            ) : (
              <span className={cn('text-xl font-semibold font-tajawal', palette.fg)}>
                {conv.other_name.charAt(0)}
              </span>
            )}
          </div>
        </div>

        {/* Content with bottom divider like WhatsApp */}
        <div className="flex-1 min-w-0 flex flex-col justify-center border-b border-border/50 py-2 -my-2">
          {/* Top row: Name + Time */}
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <p className={cn(
              'text-[16px] truncate font-tajawal text-foreground',
              isUnread ? 'font-bold' : 'font-semibold'
            )}>
              {conv.other_name}
            </p>
            {conv.last_message_at && (
              <span className={cn(
                'text-[12px] shrink-0 font-tajawal',
                isUnread ? 'text-primary font-semibold' : 'text-muted-foreground'
              )}>
                {formatTime(conv.last_message_at)}
              </span>
            )}
          </div>

          {/* Bottom row: Last message + Unread badge */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 min-w-0 flex-1">
              {/* Read receipts for own messages */}
              {isMine && conv.last_message && (
                conv.last_message_is_read ? (
                  <CheckCheck className="h-4 w-4 text-primary shrink-0" />
                ) : (
                  <CheckCheck className="h-4 w-4 text-muted-foreground shrink-0" />
                )
              )}
              <p className={cn(
                'text-[14px] truncate font-tajawal',
                isUnread ? 'text-foreground/90 font-medium' : 'text-muted-foreground'
              )}>
                {conv.last_message || conv.listing_title}
              </p>
            </div>
            {isUnread && (
              <span className="flex h-[20px] min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground shrink-0">
                {conv.unread_count > 99 ? '99+' : conv.unread_count}
              </span>
            )}
          </div>
        </div>
      </button>
    </div>
  );
};

const ChatPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [filter, setFilter] = useState<FilterMode>('all');

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

    const items: ConversationItem[] = [];
    for (const conv of convs) {
      const otherId = conv.owner_id === user.id ? conv.user_id : conv.owner_id;

      const [listingRes, profileRes, msgRes, unreadRes] = await Promise.all([
        supabase.from('listings').select('title').eq('id', conv.listing_id).single(),
        supabase.from('profiles').select('full_name, avatar_url').eq('id', otherId).single(),
        supabase.from('listing_messages').select('message, created_at, sender_id, is_read').eq('conversation_id', conv.id).order('created_at', { ascending: false }).limit(1),
        supabase.from('listing_messages').select('id', { count: 'exact', head: true }).eq('conversation_id', conv.id).neq('sender_id', user.id).eq('is_read', false),
      ]);

      const lastMsg = msgRes.data?.[0];
      items.push({
        id: conv.id,
        listing_id: conv.listing_id,
        owner_id: conv.owner_id,
        user_id: conv.user_id,
        created_at: conv.created_at,
        listing_title: listingRes.data?.title ?? 'إعلان',
        other_name: profileRes.data?.full_name ?? 'مستخدم',
        other_avatar: profileRes.data?.avatar_url ?? null,
        last_message: lastMsg?.message ?? null,
        last_message_at: lastMsg?.created_at ?? conv.created_at,
        last_message_sender_id: lastMsg?.sender_id ?? null,
        last_message_is_read: lastMsg?.is_read ?? false,
        unread_count: unreadRes.count ?? 0,
      });
    }

    items.sort((a, b) => new Date(b.last_message_at!).getTime() - new Date(a.last_message_at!).getTime());
    setConversations(items);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Realtime: listen for new/updated messages and update the list in place (WhatsApp-like)
  useEffect(() => {
    if (!user) return;

    const handleNewMessage = async (conversationId: string, message: string, createdAt: string, senderId: string, isRead: boolean) => {
      setConversations(prev => {
        const idx = prev.findIndex(c => c.id === conversationId);
        if (idx === -1) {
          // New conversation we don't know about — refetch to pick it up
          fetchConversations();
          return prev;
        }
        const existing = prev[idx];
        const isIncoming = senderId !== user.id;
        const updated: ConversationItem = {
          ...existing,
          last_message: message,
          last_message_at: createdAt,
          last_message_sender_id: senderId,
          last_message_is_read: isRead,
          unread_count: isIncoming ? existing.unread_count + 1 : existing.unread_count,
        };
        // Move to top
        const next = [updated, ...prev.slice(0, idx), ...prev.slice(idx + 1)];
        return next;
      });
    };

    const handleMessageUpdate = (conversationId: string, isRead: boolean, senderId: string) => {
      setConversations(prev => prev.map(c => {
        if (c.id !== conversationId) return c;
        // If incoming messages got marked read, reset unread count
        const isIncoming = senderId !== user.id;
        return {
          ...c,
          last_message_is_read: c.last_message_sender_id === senderId ? isRead : c.last_message_is_read,
          unread_count: isIncoming && isRead ? 0 : c.unread_count,
        };
      }));
    };

    const channel = supabase
      .channel(`chat-list-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'listing_messages' },
        (payload) => {
          const m = payload.new as { conversation_id: string; message: string; created_at: string; sender_id: string; is_read: boolean };
          handleNewMessage(m.conversation_id, m.message, m.created_at, m.sender_id, m.is_read);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'listing_messages' },
        (payload) => {
          const m = payload.new as { conversation_id: string; is_read: boolean; sender_id: string };
          handleMessageUpdate(m.conversation_id, m.is_read, m.sender_id);
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'listing_conversations' },
        () => fetchConversations()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchConversations]);

  const filtered = useMemo(() => {
    let list = conversations;
    if (filter === 'unread') list = list.filter(c => c.unread_count > 0);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        c => c.other_name.toLowerCase().includes(q) ||
             c.listing_title.toLowerCase().includes(q) ||
             (c.last_message?.toLowerCase().includes(q) ?? false)
      );
    }
    return list;
  }, [conversations, filter, search]);

  const handleDelete = async (conv: ConversationItem) => {
    setConversations(prev => prev.filter(c => c.id !== conv.id));
    toast.success('تم حذف المحادثة');
  };

  const handleOpen = (conv: ConversationItem) => navigate(`/chat/${conv.id}`);

  return (
    <div className="min-h-screen bg-card font-tajawal pb-24" dir="rtl">
      {/* Header - WhatsApp style */}
      <header className="sticky top-0 z-40 bg-card">
        <div className="flex items-center justify-between gap-1 px-4 pt-4 pb-3">
          <h1 className="text-[24px] font-bold text-foreground font-tajawal">
            المحادثات
          </h1>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowSearch(s => !s)}
              className="flex h-10 w-10 items-center justify-center rounded-full active:bg-muted/60 transition-colors"
              aria-label="بحث"
            >
              <Search className="h-[22px] w-[22px] text-foreground" />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex h-10 w-10 items-center justify-center rounded-full active:bg-muted/60 transition-colors"
                  aria-label="المزيد"
                >
                  <MoreVertical className="h-[22px] w-[22px] text-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="font-tajawal min-w-[180px]">
                <DropdownMenuItem onClick={() => setFilter('all')} className="justify-between">
                  <span>عرض الكل</span>
                  {filter === 'all' && <Check className="h-4 w-4 text-primary" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilter('unread')} className="justify-between">
                  <span>غير المقروءة فقط</span>
                  {filter === 'unread' && <Check className="h-4 w-4 text-primary" />}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Search bar */}
        {showSearch && (
          <div className="px-4 pb-3">
            <div className="relative">
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="ابحث في المحادثات..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
                className="w-full h-10 rounded-full bg-muted/60 pr-11 pl-4 text-[14px] font-tajawal placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
              />
            </div>
          </div>
        )}

        {/* Filter chip when active */}
        {filter === 'unread' && (
          <div className="px-4 pb-3 flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-3 py-1 text-[12px] font-semibold"
            >
              غير المقروءة
              <span className="text-[14px] leading-none">×</span>
            </button>
          </div>
        )}
      </header>

      {/* List */}
      <div>
        {loading ? (
          <div className="pt-20"><LoadingSpinner /></div>
        ) : filtered.length === 0 ? (
          <div className="pt-16">
            <EmptyState
              icon={MessageSquare}
              title={search || filter === 'unread' ? 'لا توجد نتائج' : 'لا توجد محادثات'}
              subtitle={search || filter === 'unread' ? 'جرب كلمة بحث أخرى' : 'ابدأ محادثة من صفحة أي إعلان'}
            />
          </div>
        ) : (
          <div>
            {filtered.map((conv) => (
              <ConversationRow
                key={conv.id}
                conv={conv}
                currentUserId={user?.id ?? ''}
                onOpen={handleOpen}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatPage;
