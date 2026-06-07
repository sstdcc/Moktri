import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { MessageSquare, ArrowRight, CheckCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePresence } from '@/contexts/PresenceContext';

interface ListingConversationItem {
  kind: 'listing' | 'request';
  id: string;
  listing_id: string;
  listing_title: string;
  listing_image: string | null;
  last_message: string | null;
  last_message_at: string | null;
  last_message_sender_id: string | null;
  last_message_is_read: boolean;
  unread_count: number;
}

const categoryLabels: Record<string, string> = {
  room: 'غرفة', apartment: 'شقة', house: 'بيت', floor: 'دور',
  shop: 'محل', office: 'مكتب', shared: 'سكن مشترك', family: 'عائلي', student: 'طلابي',
};

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

const ChatUserPage = () => {
  const { userId } = useParams<{ userId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isOnline } = usePresence();

  const [items, setItems] = useState<ListingConversationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [otherName, setOtherName] = useState('مستخدم');
  const [otherAvatar, setOtherAvatar] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user || !userId) return;
    setLoading(true);

    const [profileRes, convsRes] = await Promise.all([
      supabase.from('profiles').select('full_name, avatar_url').eq('id', userId).single(),
      supabase
        .from('listing_conversations')
        .select('*')
        .or(`and(owner_id.eq.${user.id},user_id.eq.${userId}),and(owner_id.eq.${userId},user_id.eq.${user.id})`)
        .order('created_at', { ascending: false }),
    ]);

    if (profileRes.data) {
      setOtherName(profileRes.data.full_name ?? 'مستخدم');
      setOtherAvatar(profileRes.data.avatar_url ?? null);
    }

    const convs = convsRes.data ?? [];
    if (convs.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }

    const result: ListingConversationItem[] = [];
    for (const conv of convs) {
      const [listingRes, imgRes, msgRes, unreadRes] = await Promise.all([
        supabase.from('listings').select('title').eq('id', conv.listing_id).single(),
        supabase.from('listing_images').select('url').eq('listing_id', conv.listing_id).order('sort_order', { ascending: true }).limit(1),
        supabase.from('listing_messages').select('message, created_at, sender_id, is_read').eq('conversation_id', conv.id).order('created_at', { ascending: false }).limit(1),
        supabase.from('listing_messages').select('id', { count: 'exact', head: true }).eq('conversation_id', conv.id).neq('sender_id', user.id).eq('is_read', false),
      ]);
      const lastMsg = msgRes.data?.[0];
      result.push({
        id: conv.id,
        listing_id: conv.listing_id,
        listing_title: listingRes.data?.title ?? 'إعلان',
        listing_image: imgRes.data?.[0]?.url ?? null,
        last_message: lastMsg?.message ?? null,
        last_message_at: lastMsg?.created_at ?? conv.created_at,
        last_message_sender_id: lastMsg?.sender_id ?? null,
        last_message_is_read: lastMsg?.is_read ?? false,
        unread_count: unreadRes.count ?? 0,
      });
    }

    result.sort((a, b) => new Date(b.last_message_at!).getTime() - new Date(a.last_message_at!).getTime());
    setItems(result);
    setLoading(false);
  }, [user, userId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const online = userId ? isOnline(userId) : false;
  const palette = useMemo(() => getAvatarColor(otherName), [otherName]);

  return (
    <div className="min-h-screen bg-card font-tajawal pb-24" dir="rtl">
      <header className="sticky top-0 z-40 bg-card border-b border-border/50">
        <div className="flex items-center gap-3 px-3 py-3">
          <button
            type="button"
            onClick={() => navigate('/chat')}
            className="relative z-10 shrink-0 flex h-10 w-10 items-center justify-center rounded-full active:bg-muted/60"
            aria-label="رجوع"
          >
            <ArrowRight className="h-5 w-5 text-foreground pointer-events-none" />
          </button>
          <Link to={`/profile/${userId}`} className="flex items-center gap-3 flex-1 min-w-0">
            <div className="relative shrink-0">
              <div className={cn('flex h-11 w-11 items-center justify-center rounded-full overflow-hidden', palette)}>
                {otherAvatar ? (
                  <img src={otherAvatar} alt={otherName} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-lg font-semibold text-white">{otherName.charAt(0)}</span>
                )}
              </div>
              {online && (
                <span className="absolute bottom-0 left-0 h-3 w-3 rounded-full bg-green-500 ring-2 ring-card" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[16px] font-bold text-foreground truncate">{otherName}</p>
              <p className="text-[12px] text-muted-foreground">
                {online ? 'متصل الآن' : `${items.length} محادثة`}
              </p>
            </div>
          </Link>
        </div>
      </header>

      <div className="px-4 pt-3 pb-2">
        <p className="text-[13px] text-muted-foreground">المحادثات حول الإعلانات</p>
      </div>

      {loading ? (
        <div className="pt-20"><LoadingSpinner /></div>
      ) : items.length === 0 ? (
        <div className="pt-16">
          <EmptyState icon={MessageSquare} title="لا توجد محادثات" subtitle="" />
        </div>
      ) : (
        <div>
          {items.map((it) => {
            const isUnread = it.unread_count > 0;
            const isMine = it.last_message_sender_id === user?.id;
            return (
              <button
                key={it.id}
                onClick={() => navigate(`/chat/${it.id}`)}
                className="w-full text-right flex items-center gap-3 px-4 py-3 bg-card active:bg-muted/60 transition-colors"
              >
                <div className="h-14 w-14 rounded-xl overflow-hidden bg-muted shrink-0">
                  {it.listing_image ? (
                    <img src={it.listing_image} alt={it.listing_title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                      <MessageSquare className="h-5 w-5" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0 border-b border-border/50 py-2 -my-2">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <p className={cn('text-[15px] truncate text-foreground', isUnread ? 'font-bold' : 'font-semibold')}>
                      {it.listing_title}
                    </p>
                    {it.last_message_at && (
                      <span className={cn('text-[12px] shrink-0', isUnread ? 'text-primary font-semibold' : 'text-muted-foreground')}>
                        {formatTime(it.last_message_at)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 min-w-0 flex-1">
                      {isMine && it.last_message && (
                        <CheckCheck className={cn('h-4 w-4 shrink-0', it.last_message_is_read ? 'text-primary' : 'text-muted-foreground')} />
                      )}
                      <p className={cn('text-[13px] truncate', isUnread ? 'text-foreground/90 font-medium' : 'text-muted-foreground')}>
                        {it.last_message || 'لا توجد رسائل'}
                      </p>
                    </div>
                    {isUnread && (
                      <span className="flex h-[20px] min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground shrink-0">
                        {it.unread_count > 99 ? '99+' : it.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ChatUserPage;
