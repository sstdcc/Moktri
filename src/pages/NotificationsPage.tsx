import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { BottomNav } from '@/components/ui/BottomNav';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  Bell, MessageCircle, Clock, CheckCircle2, XCircle,
  BadgeCheck, ShieldAlert, RefreshCw, Sparkles, Trash2, Check,
  SlidersHorizontal, ChevronDown,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

/* ---------- Notification visual config ---------- */
type NotifVisual = {
  icon: React.ElementType;
  // Tailwind classes for the soft circle background + icon color
  bg: string;
  fg: string;
  // Accent bar color (used on unread)
  bar: string;
};

const visualMap: Record<string, NotifVisual> = {
  new_response: {
    icon: MessageCircle,
    bg: 'bg-violet-100 dark:bg-violet-500/15',
    fg: 'text-violet-600 dark:text-violet-300',
    bar: 'bg-violet-500',
  },
  new_message: {
    icon: MessageCircle,
    bg: 'bg-violet-100 dark:bg-violet-500/15',
    fg: 'text-violet-600 dark:text-violet-300',
    bar: 'bg-violet-500',
  },
  listing_expiring: {
    icon: Clock,
    bg: 'bg-amber-100 dark:bg-amber-500/15',
    fg: 'text-amber-600 dark:text-amber-300',
    bar: 'bg-amber-500',
  },
  listing_approved: {
    icon: CheckCircle2,
    bg: 'bg-emerald-100 dark:bg-emerald-500/15',
    fg: 'text-emerald-600 dark:text-emerald-300',
    bar: 'bg-emerald-500',
  },
  listing_rejected: {
    icon: XCircle,
    bg: 'bg-rose-100 dark:bg-rose-500/15',
    fg: 'text-rose-600 dark:text-rose-300',
    bar: 'bg-rose-500',
  },
  verification_update: {
    icon: BadgeCheck,
    bg: 'bg-emerald-100 dark:bg-emerald-500/15',
    fg: 'text-emerald-600 dark:text-emerald-300',
    bar: 'bg-emerald-500',
  },
  new_report: {
    icon: ShieldAlert,
    bg: 'bg-rose-100 dark:bg-rose-500/15',
    fg: 'text-rose-600 dark:text-rose-300',
    bar: 'bg-rose-500',
  },
  private_offer_request: {
    icon: Sparkles,
    bg: 'bg-sky-100 dark:bg-sky-500/15',
    fg: 'text-sky-600 dark:text-sky-300',
    bar: 'bg-sky-500',
  },
  private_offer_created: {
    icon: Sparkles,
    bg: 'bg-sky-100 dark:bg-sky-500/15',
    fg: 'text-sky-600 dark:text-sky-300',
    bar: 'bg-sky-500',
  },
  private_offer_accepted: {
    icon: CheckCircle2,
    bg: 'bg-emerald-100 dark:bg-emerald-500/15',
    fg: 'text-emerald-600 dark:text-emerald-300',
    bar: 'bg-emerald-500',
  },
  private_offer_rejected: {
    icon: XCircle,
    bg: 'bg-rose-100 dark:bg-rose-500/15',
    fg: 'text-rose-600 dark:text-rose-300',
    bar: 'bg-rose-500',
  },
  rental_pending_review: {
    icon: Clock,
    bg: 'bg-amber-100 dark:bg-amber-500/15',
    fg: 'text-amber-600 dark:text-amber-300',
    bar: 'bg-amber-500',
  },
  system: {
    icon: Bell,
    bg: 'bg-primary/10',
    fg: 'text-primary',
    bar: 'bg-primary',
  },
};

const getVisual = (type: string): NotifVisual => visualMap[type] ?? visualMap.system;

/* ---------- Date helpers ---------- */
const getRelativeTime = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'الآن';
  if (mins < 60) return `منذ ${mins} د`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `منذ ${hours} س`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'أمس';
  if (days < 7) return `منذ ${days} أيام`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `منذ ${weeks} أسابيع`;
  const months = Math.floor(days / 30);
  return `منذ ${months} أشهر`;
};

const getDateGroup = (dateStr: string) => {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);
  if (date >= today) return 'اليوم';
  if (date >= yesterday) return 'الأمس';
  if (date >= weekAgo) return 'هذا الأسبوع';
  return 'سابقاً';
};

type Notification = {
  id: string;
  type: string;
  title_ar: string | null;
  body_ar: string | null;
  link: string | null;
  is_read: boolean | null;
  created_at: string | null;
};

/* ---------- Swipe-to-delete row ---------- */
type RowProps = {
  notif: Notification;
  onOpen: (n: Notification) => void;
  onDelete: (n: Notification) => void;
};

const NotificationRow = ({ notif, onOpen, onDelete }: RowProps) => {
  const [dragX, setDragX] = useState(0);
  const [startX, setStartX] = useState<number | null>(null);
  const [removing, setRemoving] = useState(false);

  const visual = getVisual(notif.type);
  const Icon = visual.icon;
  const isUnread = !notif.is_read;

  // RTL: swipe LEFT (negative dx) reveals the delete action on the LEFT side
  const onTouchStart = (e: React.TouchEvent) => setStartX(e.touches[0].clientX);
  const onTouchMove = (e: React.TouchEvent) => {
    if (startX === null) return;
    const dx = e.touches[0].clientX - startX;
    // Allow swipe left (negative) up to -96, ignore right-swipes
    setDragX(Math.max(-110, Math.min(0, dx)));
  };
  const onTouchEnd = () => {
    if (dragX < -70) {
      setDragX(-96);
    } else {
      setDragX(0);
    }
    setStartX(null);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRemoving(true);
    setTimeout(() => onDelete(notif), 220);
  };

  const handleOpen = () => {
    if (dragX !== 0) {
      setDragX(0);
      return;
    }
    onOpen(notif);
  };

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl transition-all duration-300',
        removing && 'opacity-0 scale-95 -translate-y-1',
      )}
    >
      {/* Delete action revealed on swipe (visually-left side) */}
      <button
        onClick={handleDelete}
        aria-label="حذف الإشعار"
        className={cn(
          'absolute inset-y-0 left-0 flex w-24 items-center justify-center bg-destructive text-destructive-foreground',
          'transition-opacity duration-200',
          dragX < -10 ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
      >
        <Trash2 className="h-5 w-5" />
      </button>

      <button
        type="button"
        onClick={handleOpen}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        aria-label={notif.title_ar || 'إشعار'}
        style={{ transform: `translateX(${dragX}px)` }}
        className={cn(
          'group relative w-full text-right',
          'flex items-start gap-3 rounded-2xl bg-card',
          'pr-4 pl-5 py-4 sm:py-5',
          'shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)]',
          'transition-all duration-200 ease-out',
          'hover:-translate-y-[1px] hover:shadow-[0_4px_12px_rgba(16,24,40,0.06),0_2px_4px_rgba(16,24,40,0.04)]',
          'active:scale-[0.99]',
        )}
      >
        {/* Accent bar — visually LEFT side of card (as in reference image) */}
        <span
          aria-hidden
          className={cn(
            'absolute left-0 top-2 bottom-2 w-[4px] rounded-r-full transition-opacity',
            visual.bar,
            isUnread ? 'opacity-100' : 'opacity-0',
          )}
        />

        {/* Unread dot — top-LEFT (visually) */}
        {isUnread && (
          <span
            aria-hidden
            className="absolute left-3 top-3 h-2 w-2 rounded-full bg-primary"
          />
        )}

        {/* Content (right side in RTL) */}
        <div className="flex-1 min-w-0 pb-5">
          <p
            className={cn(
              'text-[15px] leading-tight text-foreground font-tajawal',
              isUnread ? 'font-bold' : 'font-semibold text-foreground/85',
            )}
          >
            {notif.title_ar}
          </p>
          {notif.body_ar && (
            <p
              className={cn(
                'mt-1.5 text-[13px] leading-relaxed line-clamp-2 font-tajawal',
                isUnread ? 'text-muted-foreground' : 'text-muted-foreground/80',
              )}
            >
              {notif.body_ar}
            </p>
          )}
        </div>

        {/* Icon circle — visually right (start of row in RTL) */}
        <div
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-transform group-hover:scale-105',
            isUnread ? visual.bg : 'bg-muted',
          )}
        >
          <Icon
            className={cn(
              'h-[20px] w-[20px] stroke-[1.8px]',
              isUnread ? visual.fg : 'text-muted-foreground',
            )}
          />
        </div>

        {/* Time — bottom-LEFT (visually) */}
        <span className="absolute bottom-3 left-4 text-[10px] font-medium text-muted-foreground/70 font-tajawal">
          {getRelativeTime(notif.created_at ?? '')}
        </span>
      </button>
    </div>
  );
};

/* ---------- Page ---------- */
const NotificationsPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    setError(false);
    setLoading(true);
    const { data, error: err } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (err) setError(true);
    else setNotifications(data ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  // Realtime
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('user-notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => setNotifications((prev) => [payload.new as Notification, ...prev]),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const markAsRead = async (notif: Notification) => {
    if (!notif.is_read) {
      await supabase.from('notifications').update({ is_read: true }).eq('id', notif.id);
      setNotifications((prev) => prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n)));
    }
    if (notif.link) navigate(notif.link);
  };

  const markAllRead = async () => {
    if (!user) return;
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    toast.success('تم تحديد الكل كمقروء');
  };

  const deleteNotification = async (notif: Notification) => {
    setNotifications((prev) => prev.filter((n) => n.id !== notif.id));
    const { error: err } = await supabase.from('notifications').delete().eq('id', notif.id);
    if (err) {
      toast.error('تعذر حذف الإشعار');
      fetchNotifications();
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const filtered = useMemo(
    () => (filter === 'unread' ? notifications.filter((n) => !n.is_read) : notifications),
    [notifications, filter],
  );

  const groups = useMemo(() => {
    return filtered.reduce<Record<string, Notification[]>>((acc, n) => {
      const group = getDateGroup(n.created_at ?? '');
      (acc[group] ||= []).push(n);
      return acc;
    }, {});
  }, [filtered]);

  const groupOrder = ['اليوم', 'الأمس', 'هذا الأسبوع', 'سابقاً'];

  return (
    <div className="min-h-screen bg-[hsl(var(--muted))]/40 pb-24 font-tajawal" dir="rtl">
      <PageHeader title="الإشعارات" showBack />

      {/* Filter / actions row — pills as in reference */}
      {!loading && !error && notifications.length > 0 && (
        <div className="flex items-center justify-between gap-2 px-4 pt-4">
          {/* Right side: mark all read pill */}
          {unreadCount > 0 ? (
            <button
              onClick={markAllRead}
              className="inline-flex items-center gap-1.5 rounded-full bg-card border border-border/60 px-4 py-2 text-[12px] font-semibold text-foreground shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-all hover:bg-muted active:scale-95"
              aria-label="تحديد الكل كمقروء"
            >
              <Check className="h-3.5 w-3.5 text-primary" />
              تحديد الكل كمقروء
            </button>
          ) : <span />}

          {/* Left side: filter icon + dropdown */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="تصفية"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-card border border-border/60 text-foreground shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-all hover:bg-muted active:scale-95"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-full bg-card border border-border/60 px-4 py-2 text-[12px] font-semibold text-foreground shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-all hover:bg-muted active:scale-95"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                  {filter === 'unread' ? 'غير مقروءة' : 'الكل'}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="font-tajawal min-w-[160px]">
                <DropdownMenuItem onClick={() => setFilter('all')} className="justify-end gap-2">
                  {filter === 'all' && <Check className="h-3.5 w-3.5 text-primary" />}
                  الكل ({notifications.length})
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilter('unread')} className="justify-end gap-2">
                  {filter === 'unread' && <Check className="h-3.5 w-3.5 text-primary" />}
                  غير مقروءة ({unreadCount})
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      )}

      <div className="px-4 pt-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex gap-3 rounded-2xl bg-card p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                <Skeleton className="h-11 w-11 rounded-full shrink-0" />
                <div className="flex-1 space-y-2 pt-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="rounded-2xl bg-rose-500/10 p-4">
              <ShieldAlert className="h-8 w-8 text-rose-500" />
            </div>
            <p className="text-sm text-muted-foreground">تعذر تحميل الإشعارات</p>
            <Button variant="outline" size="sm" onClick={fetchNotifications}>
              <RefreshCw className="h-4 w-4 ml-2" />
              إعادة المحاولة
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Bell}
            title={filter === 'unread' ? 'لا إشعارات غير مقروءة' : 'لا توجد إشعارات بعد'}
            subtitle={
              filter === 'unread'
                ? 'قرأت كل إشعاراتك. عمل رائع!'
                : 'عندما تصلك إشعارات جديدة ستظهر هنا'
            }
          />
        ) : (
          <div className="space-y-7">
            {groupOrder.map((group) => {
              const items = groups[group];
              if (!items?.length) return null;
              return (
                <section key={group} aria-label={group}>
                  <div className="mb-3 flex items-center gap-2 px-1">
                    <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">
                      {group}
                    </h2>
                    <div className="h-px flex-1 bg-border/50" />
                    <span className="text-[10px] font-medium text-muted-foreground/60">
                      {items.length}
                    </span>
                  </div>
                  <div className="space-y-2.5">
                    {items.map((notif) => (
                      <NotificationRow
                        key={notif.id}
                        notif={notif}
                        onOpen={markAsRead}
                        onDelete={deleteNotification}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default NotificationsPage;
