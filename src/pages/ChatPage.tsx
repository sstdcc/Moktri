import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { MessageSquare, Search, MoreVertical, Check, CheckCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { usePresence } from '@/contexts/PresenceContext';

interface ConversationItem {
  id: string;
  listing_id: string;
  owner_id: string;
  user_id: string;
  created_at: string;
  listing_title: string;
  other_id: string;
  other_name: string;
  other_avatar: string | null;
  last_message: string | null;
  last_message_at: string | null;
  last_message_sender_id: string | null;
  last_message_is_read: boolean;
  unread_count: number;
}

interface UserGroupItem {
  other_id: string;
  other_name: string;
  other_avatar: string | null;
  conversations_count: number;
  last_message: string | null;
  last_message_at: string | null;
  last_message_sender_id: string | null;
  last_message_is_read: boolean;
  last_listing_title: string;
  unread_count: number;
}

const formatTime = (dateStr: string) => {
  const date = new Date(dateStr);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'أمس';
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (diffDays < 7) {
    return date.toLocaleDateString('en-GB', { weekday: 'long' });
  }
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
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
  group: UserGroupItem;
  currentUserId: string;
  onOpen: (g: UserGroupItem) => void;
}

const UserGroupRow = ({ group, currentUserId, onOpen }: RowProps) => {
  const isUnread = group.unread_count > 0;
  const palette = getAvatarColor(group.other_name);
  const isMine = group.last_message_sender_id === currentUserId;
  const { isOnline } = usePresence();
  const online = isOnline(group.other_id);
  const navigate = useNavigate();

  const openProfile = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/profile/${group.other_id}`);
  };

  return (
    <div className="relative overflow-hidden">
      <button
        onClick={() => onOpen(group)}
        className="relative w-full text-right flex items-center gap-3 px-4 py-3 bg-card transition-colors active:bg-muted/60"
      >
        {/* Avatar */}
        <div
          role="link"
          tabIndex={0}
          onClick={openProfile}
          className="relative shrink-0 cursor-pointer"
        >
          <div className={cn('flex h-14 w-14 items-center justify-center rounded-full overflow-hidden', palette.bg)}>
            {group.other_avatar ? (
              <img src={group.other_avatar} alt={group.other_name} className="h-full w-full object-cover" />
            ) : (
              <span className={cn('text-xl font-semibold font-tajawal', palette.fg)}>
                {group.other_name.charAt(0)}
              </span>
            )}
          </div>
          {online && (
            <span
              aria-label="متصل الآن"
              className="absolute bottom-0 left-0 h-3.5 w-3.5 rounded-full bg-green-500 ring-2 ring-card"
            />
          )}
        </div>

        <div className="flex-1 min-w-0 flex flex-col justify-center border-b border-border/50 py-2 -my-2">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <div className="flex items-center gap-2 min-w-0">
              <span
                role="link"
                onClick={openProfile}
                className={cn(
                  'text-[16px] truncate font-tajawal text-foreground cursor-pointer hover:underline',
                  isUnread ? 'font-bold' : 'font-semibold'
                )}
              >
                {group.other_name}
              </span>
              {group.conversations_count > 1 && (
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                  {group.conversations_count} محادثات
                </span>
              )}
            </div>
            {group.last_message_at && (
              <span className={cn(
                'text-[12px] shrink-0 font-tajawal',
                isUnread ? 'text-primary font-semibold' : 'text-muted-foreground'
              )}>
                {formatTime(group.last_message_at)}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 min-w-0 flex-1">
              {isMine && group.last_message && (
                <CheckCheck className={cn('h-4 w-4 shrink-0', group.last_message_is_read ? 'text-primary' : 'text-muted-foreground')} />
              )}
              <p className={cn(
                'text-[14px] truncate font-tajawal',
                isUnread ? 'text-foreground/90 font-medium' : 'text-muted-foreground'
              )}>
                {group.last_message || group.last_listing_title}
              </p>
            </div>
            {isUnread && (
              <span className="flex h-[20px] min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground shrink-0">
                {group.unread_count > 99 ? '99+' : group.unread_count}
              </span>
            )}
          </div>
        </div>
      </button>
    </div>
  );
};

interface RequestConvRaw {
  id: string;
  request_id: string;
  requester_id: string;
  responder_id: string;
  created_at: string;
  other_id: string;
  other_name: string;
  other_avatar: string | null;
  request_title: string;
  last_message: string | null;
  last_message_at: string | null;
  last_message_sender_id: string | null;
  last_message_is_read: boolean;
  unread_count: number;
}

const ChatPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [requestConvs, setRequestConvs] = useState<RequestConvRaw[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [filter, setFilter] = useState<FilterMode>('all');

  const fetchConversations = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const [listingRes, requestRes] = await Promise.all([
      supabase
        .from('listing_conversations')
        .select('*')
        .or(`owner_id.eq.${user.id},user_id.eq.${user.id}`)
        .order('created_at', { ascending: false }),
      supabase
        .from('request_conversations')
        .select('*')
        .or(`requester_id.eq.${user.id},responder_id.eq.${user.id}`)
        .order('created_at', { ascending: false }),
    ]);

    const convs = listingRes.data ?? [];
    const reqConvs = requestRes.data ?? [];

    const items: ConversationItem[] = [];
    for (const conv of convs) {
      const otherId = conv.owner_id === user.id ? conv.user_id : conv.owner_id;

      const [listingRow, profileRes, msgRes, unreadRes] = await Promise.all([
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
        listing_title: listingRow.data?.title ?? 'إعلان',
        other_id: otherId,
        other_name: profileRes.data?.full_name ?? 'مستخدم',
        other_avatar: profileRes.data?.avatar_url ?? null,
        last_message: lastMsg?.message ?? null,
        last_message_at: lastMsg?.created_at ?? conv.created_at,
        last_message_sender_id: lastMsg?.sender_id ?? null,
        last_message_is_read: lastMsg?.is_read ?? false,
        unread_count: unreadRes.count ?? 0,
      });
    }

    const reqItems: RequestConvRaw[] = [];
    const categoryLabels: Record<string, string> = {
      room: 'غرفة', apartment: 'شقة', house: 'بيت', floor: 'دور',
      shop: 'محل', office: 'مكتب', shared: 'سكن مشترك', family: 'عائلي', student: 'طلابي',
    };
    for (const conv of reqConvs) {
      const otherId = conv.requester_id === user.id ? conv.responder_id : conv.requester_id;
      const [reqRow, profileRes, msgRes, unreadRes] = await Promise.all([
        supabase.from('housing_requests').select('category, neighborhood').eq('id', conv.request_id).maybeSingle(),
        supabase.from('profiles').select('full_name, avatar_url').eq('id', otherId).single(),
        supabase.from('request_messages').select('message, created_at, sender_id, is_read').eq('conversation_id', conv.id).order('created_at', { ascending: false }).limit(1),
        supabase.from('request_messages').select('id', { count: 'exact', head: true }).eq('conversation_id', conv.id).neq('sender_id', user.id).eq('is_read', false),
      ]);
      const lastMsg = msgRes.data?.[0];
      const cat = reqRow.data?.category ? (categoryLabels[reqRow.data.category] ?? reqRow.data.category) : 'طلب سكن';
      const title = `طلب: ${cat}${reqRow.data?.neighborhood ? ' — ' + reqRow.data.neighborhood : ''}`;
      reqItems.push({
        id: conv.id,
        request_id: conv.request_id,
        requester_id: conv.requester_id,
        responder_id: conv.responder_id,
        created_at: conv.created_at,
        other_id: otherId,
        other_name: profileRes.data?.full_name ?? 'مستخدم',
        other_avatar: profileRes.data?.avatar_url ?? null,
        request_title: title,
        last_message: lastMsg?.message ?? null,
        last_message_at: lastMsg?.created_at ?? conv.created_at,
        last_message_sender_id: lastMsg?.sender_id ?? null,
        last_message_is_read: lastMsg?.is_read ?? false,
        unread_count: unreadRes.count ?? 0,
      });
    }

    items.sort((a, b) => new Date(b.last_message_at!).getTime() - new Date(a.last_message_at!).getTime());
    setConversations(items);
    setRequestConvs(reqItems);
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
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'request_conversations' },
        () => fetchConversations()
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'request_messages' },
        () => fetchConversations()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchConversations]);

  // Group conversations by other user (owner/broker)
  const groups = useMemo<UserGroupItem[]>(() => {
    const map = new Map<string, UserGroupItem>();
    for (const c of conversations) {
      const existing = map.get(c.other_id);
      if (!existing) {
        map.set(c.other_id, {
          other_id: c.other_id,
          other_name: c.other_name,
          other_avatar: c.other_avatar,
          conversations_count: 1,
          last_message: c.last_message,
          last_message_at: c.last_message_at,
          last_message_sender_id: c.last_message_sender_id,
          last_message_is_read: c.last_message_is_read,
          last_listing_title: c.listing_title,
          unread_count: c.unread_count,
        });
      } else {
        existing.conversations_count += 1;
        existing.unread_count += c.unread_count;
        if (c.last_message_at && (!existing.last_message_at || new Date(c.last_message_at) > new Date(existing.last_message_at))) {
          existing.last_message = c.last_message;
          existing.last_message_at = c.last_message_at;
          existing.last_message_sender_id = c.last_message_sender_id;
          existing.last_message_is_read = c.last_message_is_read;
          existing.last_listing_title = c.listing_title;
        }
      }
    }
    // Merge request conversations into the same per-user group (UI grouped by user,
    // data still separate per request).
    for (const rc of requestConvs) {
      const existing = map.get(rc.other_id);
      if (!existing) {
        map.set(rc.other_id, {
          other_id: rc.other_id,
          other_name: rc.other_name,
          other_avatar: rc.other_avatar,
          conversations_count: 1,
          last_message: rc.last_message,
          last_message_at: rc.last_message_at,
          last_message_sender_id: rc.last_message_sender_id,
          last_message_is_read: rc.last_message_is_read,
          last_listing_title: rc.request_title,
          unread_count: rc.unread_count,
        });
      } else {
        existing.conversations_count += 1;
        existing.unread_count += rc.unread_count;
        if (rc.last_message_at && (!existing.last_message_at || new Date(rc.last_message_at) > new Date(existing.last_message_at))) {
          existing.last_message = rc.last_message;
          existing.last_message_at = rc.last_message_at;
          existing.last_message_sender_id = rc.last_message_sender_id;
          existing.last_message_is_read = rc.last_message_is_read;
          existing.last_listing_title = rc.request_title;
        }
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.last_message_at!).getTime() - new Date(a.last_message_at!).getTime()
    );
  }, [conversations, requestConvs]);

  const filtered = useMemo(() => {
    let list = groups;
    if (filter === 'unread') list = list.filter(g => g.unread_count > 0);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        g => g.other_name.toLowerCase().includes(q) ||
             g.last_listing_title.toLowerCase().includes(q) ||
             (g.last_message?.toLowerCase().includes(q) ?? false)
      );
    }
    return list;
  }, [groups, filter, search]);

  const handleOpen = (g: UserGroupItem) => {
    if (g.conversations_count === 1) {
      const conv = conversations.find(c => c.other_id === g.other_id);
      if (conv) { navigate(`/chat/${conv.id}`); return; }
      const rc = requestConvs.find(r => r.other_id === g.other_id);
      if (rc) { navigate(`/request-chat/${rc.id}`); return; }
    }
    navigate(`/chat/user/${g.other_id}`);
  };

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
            {filtered.map((g) => (
              <UserGroupRow
                key={g.other_id}
                group={g}
                currentUserId={user?.id ?? ''}
                onOpen={handleOpen}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatPage;
