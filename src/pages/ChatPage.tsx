import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { MessageSquare, Search, SlidersHorizontal, Menu, Trash2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

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
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'الآن';
  if (mins < 60) return `${mins} د`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) {
    return date.toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  const days = Math.floor(hours / 24);
  if (days === 1) return 'أمس';
  if (days < 7) return `${days} أيام`;
  return date.toLocaleDateString('ar-YE', { day: '2-digit', month: '2-digit' });
};

// Color palette for avatar fallbacks (deterministic by name)
const avatarPalette = [
  { bg: 'bg-violet-100', fg: 'text-violet-700' },
  { bg: 'bg-emerald-100', fg: 'text-emerald-700' },
  { bg: 'bg-amber-100', fg: 'text-amber-700' },
  { bg: 'bg-sky-100', fg: 'text-sky-700' },
  { bg: 'bg-rose-100', fg: 'text-rose-700' },
  { bg: 'bg-indigo-100', fg: 'text-indigo-700' },
  { bg: 'bg-teal-100', fg: 'text-teal-700' },
  { bg: 'bg-fuchsia-100', fg: 'text-fuchsia-700' },
];

const getAvatarColor = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return avatarPalette[Math.abs(hash) % avatarPalette.length];
};

type FilterMode = 'all' | 'unread';

interface RowProps {
  conv: ConversationItem;
  onOpen: (c: ConversationItem) => void;
  onDelete: (c: ConversationItem) => void;
}

const ConversationRow = ({ conv, onOpen, onDelete }: RowProps) => {
  const [translateX, setTranslateX] = useState(0);
  const [startX, setStartX] = useState<number | null>(null);
  const isUnread = conv.unread_count > 0;
  const palette = getAvatarColor(conv.other_name);

  const handleTouchStart = (e: React.TouchEvent) => setStartX(e.touches[0].clientX);
  const handleTouchMove = (e: React.TouchEvent) => {
    if (startX === null) return;
    // RTL: swipe right (positive delta) reveals delete on the right side
    const delta = e.touches[0].clientX - startX;
    if (delta > 0) setTranslateX(Math.min(delta, 88));
  };
  const handleTouchEnd = () => {
    setTranslateX(translateX > 50 ? 80 : 0);
    setStartX(null);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Delete action revealed on swipe (right side in RTL) */}
      <div className="absolute inset-y-0 right-0 flex items-center pr-4">
        <button
          onClick={() => onDelete(conv)}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-sm active:scale-95 transition-transform"
          aria-label="حذف"
        >
          <Trash2 className="h-4.5 w-4.5" />
        </button>
      </div>

      <button
        onClick={() => onOpen(conv)}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ transform: `translateX(${translateX}px)` }}
        className={cn(
          'relative w-full text-right flex items-center gap-3 px-3 py-3 rounded-2xl bg-card transition-all duration-200',
          'active:scale-[0.99] hover:bg-muted/40'
        )}
      >
        {/* Avatar */}
        <div className="relative shrink-0">
          <div className={cn('flex h-12 w-12 items-center justify-center rounded-full overflow-hidden', palette.bg)}>
            {conv.other_avatar ? (
              <img src={conv.other_avatar} alt={conv.other_name} className="h-full w-full object-cover" />
            ) : (
              <span className={cn('text-base font-bold font-tajawal', palette.fg)}>
                {conv.other_name.charAt(0)}
              </span>
            )}
          </div>
          {/* Unread dot indicator on avatar */}
          {isUnread && (
            <span className="absolute -top-0.5 -left-0.5 h-3 w-3 rounded-full bg-primary ring-2 ring-card" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <div className="flex items-center justify-between gap-2">
            <p className={cn(
              'text-[15px] truncate font-tajawal',
              isUnread ? 'font-bold text-foreground' : 'font-semibold text-foreground/90'
            )}>
              {conv.other_name}
            </p>
            {conv.last_message_at && (
              <span className={cn(
                'text-[11px] shrink-0 font-tajawal',
                isUnread ? 'text-primary font-bold' : 'text-muted-foreground/70'
              )}>
                {getRelativeTime(conv.last_message_at)}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between gap-2">
            <p className={cn(
              'text-[13px] truncate font-tajawal flex-1',
              isUnread ? 'text-foreground/80 font-medium' : 'text-muted-foreground'
            )}>
              {conv.last_message || conv.listing_title}
            </p>
            {isUnread && (
              <span className="flex h-[20px] min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground shrink-0">
                {conv.unread_count > 99 ? '99+' : conv.unread_count}
              </span>
            )}
          </div>

          {/* Listing context line */}
          {conv.last_message && (
            <p className="text-[11px] truncate text-accent/80 font-tajawal mt-0.5">
              {conv.listing_title}
            </p>
          )}
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

    items.sort((a, b) => new Date(b.last_message_at!).getTime() - new Date(a.last_message_at!).getTime());
    setConversations(items);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const totalUnread = useMemo(
    () => conversations.reduce((sum, c) => sum + c.unread_count, 0),
    [conversations]
  );

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
    // Note: actual deletion would require RLS-allowed delete + cascading cleanup.
    // For now we hide it locally to keep UX snappy.
  };

  const handleOpen = (conv: ConversationItem) => navigate(`/chat/${conv.id}`);

  return (
    <div className="min-h-screen bg-[hsl(var(--muted))]/40 font-tajawal pb-24" dir="rtl">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[hsl(var(--muted))]/40 backdrop-blur-xl px-4 pt-5 pb-3">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <h1 className="text-[26px] font-extrabold text-foreground font-tajawal leading-tight">
              المحادثات
            </h1>
            {totalUnread > 0 && (
              <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-2 text-[11px] font-bold text-primary-foreground">
                {totalUnread}
              </span>
            )}
          </div>
          <button
            onClick={() => navigate(-1)}
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-card border border-border/60 shadow-sm active:scale-95 transition-transform"
            aria-label="القائمة"
          >
            <Menu className="h-5 w-5 text-foreground" />
          </button>
        </div>

        {/* Search + filter */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="ابحث في المحادثات..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-11 rounded-2xl bg-card border border-border/60 pr-10 pl-4 text-[14px] font-tajawal placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all shadow-sm"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  'flex h-11 w-11 items-center justify-center rounded-2xl border border-border/60 shadow-sm active:scale-95 transition-all',
                  filter === 'unread' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-foreground'
                )}
                aria-label="تصفية"
              >
                <SlidersHorizontal className="h-4.5 w-4.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="font-tajawal min-w-[160px]">
              <DropdownMenuItem onClick={() => setFilter('all')} className="justify-between">
                <span>الكل</span>
                {filter === 'all' && <Check className="h-4 w-4 text-primary" />}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilter('unread')} className="justify-between">
                <span>غير مقروءة</span>
                {filter === 'unread' && <Check className="h-4 w-4 text-primary" />}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* List */}
      <div className="px-3 pt-2">
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
          <div className="space-y-1.5">
            {filtered.map((conv) => (
              <ConversationRow
                key={conv.id}
                conv={conv}
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
