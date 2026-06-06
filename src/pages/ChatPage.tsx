import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { MessageSquare, Search, MoreVertical, Check, CheckCheck, Home, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { usePresence } from '@/contexts/PresenceContext';

type ChatKind = 'listing' | 'request';

interface ConversationItem {
  id: string;
  kind: ChatKind;
  target_id: string; // listing_id or request_id
  target_title: string;
  target_image: string | null;
  other_id: string;
  other_name: string;
  other_avatar: string | null;
  last_message: string | null;
  last_message_at: string | null;
  last_message_sender_id: string | null;
  last_message_is_read: boolean;
  unread_count: number;
  created_at: string;
}

const formatTime = (dateStr: string) => {
  const date = new Date(dateStr);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'أمس';
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (diffDays < 7) return date.toLocaleDateString('en-GB', { weekday: 'long' });
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
};

const avatarPalette = [
  'bg-violet-500', 'bg-emerald-500', 'bg-amber-500', 'bg-sky-500',
  'bg-rose-500', 'bg-indigo-500', 'bg-teal-500', 'bg-fuchsia-500',
];
const getAvatarColor = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return avatarPalette[Math.abs(hash) % avatarPalette.length];
};

type FilterMode = 'all' | 'unread';

interface RowProps {
  item: ConversationItem;
  currentUserId: string;
  onOpen: (item: ConversationItem) => void;
}

const ConversationRow = ({ item, currentUserId, onOpen }: RowProps) => {
  const isUnread = item.unread_count > 0;
  const palette = getAvatarColor(item.other_name);
  const isMine = item.last_message_sender_id === currentUserId;
  const { isOnline } = usePresence();
  const online = isOnline(item.other_id);

  return (
    <button
      onClick={() => onOpen(item)}
      className="relative w-full text-right flex items-center gap-3 px-4 py-3 bg-card transition-colors active:bg-muted/60"
    >
      {/* Target thumb (listing image or icon) */}
      <div className="relative shrink-0">
        <div className="h-14 w-14 rounded-xl overflow-hidden bg-muted flex items-center justify-center">
          {item.target_image ? (
            <img src={item.target_image} alt={item.target_title} className="h-full w-full object-cover" />
          ) : item.kind === 'listing' ? (
            <Home className="h-6 w-6 text-muted-foreground" />
          ) : (
            <FileText className="h-6 w-6 text-muted-foreground" />
          )}
        </div>
        {online && (
          <span className="absolute -bottom-0.5 -left-0.5 h-3.5 w-3.5 rounded-full bg-green-500 ring-2 ring-card" />
        )}
      </div>

      <div className="flex-1 min-w-0 flex flex-col justify-center border-b border-border/50 py-2 -my-2">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <div className="flex items-center gap-2 min-w-0">
            <span className={cn('text-[15px] truncate font-tajawal text-foreground', isUnread ? 'font-bold' : 'font-semibold')}>
              {item.target_title}
            </span>
            <span className={cn(
              'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
              item.kind === 'listing' ? 'bg-primary/10 text-primary' : 'bg-accent/15 text-accent'
            )}>
              {item.kind === 'listing' ? 'إعلان' : 'طلب'}
            </span>
          </div>
          {item.last_message_at && (
            <span className={cn('text-[12px] shrink-0 font-tajawal', isUnread ? 'text-primary font-semibold' : 'text-muted-foreground')}>
              {formatTime(item.last_message_at)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 min-w-0 mb-0.5">
          <div className={cn('h-5 w-5 rounded-full overflow-hidden flex items-center justify-center shrink-0', palette)}>
            {item.other_avatar ? (
              <img src={item.other_avatar} alt={item.other_name} className="h-full w-full object-cover" />
            ) : (
              <span className="text-[10px] font-bold text-white">{item.other_name.charAt(0)}</span>
            )}
          </div>
          <span className="text-[12px] text-muted-foreground truncate">{item.other_name}</span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 min-w-0 flex-1">
            {isMine && item.last_message && (
              <CheckCheck className={cn('h-4 w-4 shrink-0', item.last_message_is_read ? 'text-primary' : 'text-muted-foreground')} />
            )}
            <p className={cn('text-[13px] truncate font-tajawal', isUnread ? 'text-foreground/90 font-medium' : 'text-muted-foreground')}>
              {item.last_message || 'لا توجد رسائل بعد'}
            </p>
          </div>
          {isUnread && (
            <span className="flex h-[20px] min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground shrink-0">
              {item.unread_count > 99 ? '99+' : item.unread_count}
            </span>
          )}
        </div>
      </div>
    </button>
  );
};

const categoryLabel = (c: string) => {
  const map: Record<string, string> = {
    apartment: 'شقة', house: 'منزل', studio: 'استوديو', room: 'غرفة',
    villa: 'فيلا', shop: 'محل', office: 'مكتب', land: 'أرض',
  };
  return map[c] ?? c;
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

    const [listingConvsRes, requestConvsRes] = await Promise.all([
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

    const items: ConversationItem[] = [];

    for (const conv of listingConvsRes.data ?? []) {
      const otherId = conv.owner_id === user.id ? conv.user_id : conv.owner_id;
      const [listingRes, imgRes, profileRes, msgRes, unreadRes] = await Promise.all([
        supabase.from('listings').select('title').eq('id', conv.listing_id).single(),
        supabase.from('listing_images').select('url').eq('listing_id', conv.listing_id).order('sort_order', { ascending: true }).limit(1),
        supabase.from('profiles').select('full_name, avatar_url').eq('id', otherId).single(),
        supabase.from('listing_messages').select('message, created_at, sender_id, is_read').eq('conversation_id', conv.id).order('created_at', { ascending: false }).limit(1),
        supabase.from('listing_messages').select('id', { count: 'exact', head: true }).eq('conversation_id', conv.id).neq('sender_id', user.id).eq('is_read', false),
      ]);
      const lastMsg = msgRes.data?.[0];
      items.push({
        id: conv.id,
        kind: 'listing',
        target_id: conv.listing_id,
        target_title: listingRes.data?.title ?? 'إعلان',
        target_image: imgRes.data?.[0]?.url ?? null,
        other_id: otherId,
        other_name: profileRes.data?.full_name ?? 'مستخدم',
        other_avatar: profileRes.data?.avatar_url ?? null,
        last_message: lastMsg?.message ?? null,
        last_message_at: lastMsg?.created_at ?? conv.created_at,
        last_message_sender_id: lastMsg?.sender_id ?? null,
        last_message_is_read: lastMsg?.is_read ?? false,
        unread_count: unreadRes.count ?? 0,
        created_at: conv.created_at,
      });
    }

    for (const conv of requestConvsRes.data ?? []) {
      const otherId = conv.requester_id === user.id ? conv.responder_id : conv.requester_id;
      const [reqRes, profileRes, msgRes, unreadRes] = await Promise.all([
        supabase.from('housing_requests').select('category, neighborhood, city_name').eq('id', conv.request_id).single(),
        supabase.from('profiles').select('full_name, avatar_url').eq('id', otherId).single(),
        supabase.from('request_messages').select('message, created_at, sender_id, is_read').eq('conversation_id', conv.id).order('created_at', { ascending: false }).limit(1),
        supabase.from('request_messages').select('id', { count: 'exact', head: true }).eq('conversation_id', conv.id).neq('sender_id', user.id).eq('is_read', false),
      ]);
      const lastMsg = msgRes.data?.[0];
      const req = reqRes.data;
      const loc = req?.neighborhood || req?.city_name || '';
      const title = req ? `طلب ${categoryLabel(req.category)}${loc ? ` - ${loc}` : ''}` : 'طلب سكن';
      items.push({
        id: conv.id,
        kind: 'request',
        target_id: conv.request_id,
        target_title: title,
        target_image: null,
        other_id: otherId,
        other_name: profileRes.data?.full_name ?? 'مستخدم',
        other_avatar: profileRes.data?.avatar_url ?? null,
        last_message: lastMsg?.message ?? null,
        last_message_at: lastMsg?.created_at ?? conv.created_at,
        last_message_sender_id: lastMsg?.sender_id ?? null,
        last_message_is_read: lastMsg?.is_read ?? false,
        unread_count: unreadRes.count ?? 0,
        created_at: conv.created_at,
      });
    }

    items.sort((a, b) => new Date(b.last_message_at!).getTime() - new Date(a.last_message_at!).getTime());
    setConversations(items);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  // Realtime updates
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`chat-list-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'listing_messages' }, () => fetchConversations())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'request_messages' }, () => fetchConversations())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'listing_conversations' }, () => fetchConversations())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'request_conversations' }, () => fetchConversations())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchConversations]);

  const filtered = useMemo(() => {
    let list = conversations;
    if (filter === 'unread') list = list.filter(c => c.unread_count > 0);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        c => c.other_name.toLowerCase().includes(q) ||
             c.target_title.toLowerCase().includes(q) ||
             (c.last_message?.toLowerCase().includes(q) ?? false)
      );
    }
    return list;
  }, [conversations, filter, search]);

  const handleOpen = (item: ConversationItem) => {
    if (item.kind === 'listing') navigate(`/chat/${item.id}`);
    else navigate(`/request-chat/${item.id}`);
  };

  return (
    <div className="min-h-screen bg-card font-tajawal pb-24" dir="rtl">
      <header className="sticky top-0 z-40 bg-card">
        <div className="flex items-center justify-between gap-1 px-4 pt-4 pb-3">
          <h1 className="text-[24px] font-bold text-foreground font-tajawal">المحادثات</h1>
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

      <div>
        {loading ? (
          <div className="pt-20"><LoadingSpinner /></div>
        ) : filtered.length === 0 ? (
          <div className="pt-16">
            <EmptyState
              icon={MessageSquare}
              title={search || filter === 'unread' ? 'لا توجد نتائج' : 'لا توجد محادثات'}
              subtitle={search || filter === 'unread' ? 'جرب كلمة بحث أخرى' : 'ابدأ محادثة من صفحة أي إعلان أو طلب'}
            />
          </div>
        ) : (
          <div>
            {filtered.map((c) => (
              <ConversationRow
                key={`${c.kind}-${c.id}`}
                item={c}
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
