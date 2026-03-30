import { useState, useEffect, useCallback } from 'react';
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
  Bell, MessageSquare, Clock3, CheckCircle2, XCircle,
  BadgeCheck, ShieldAlert, RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const iconMap: Record<string, React.ElementType> = {
  new_response: MessageSquare,
  listing_expiring: Clock3,
  listing_approved: CheckCircle2,
  listing_rejected: XCircle,
  verification_update: BadgeCheck,
  new_report: ShieldAlert,
  system: Bell,
};

const getRelativeTime = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'الآن';
  if (mins < 60) return `منذ ${mins} دقيقة`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `منذ ${hours} ساعة`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'منذ يوم';
  if (days <= 10) return `منذ ${days} أيام`;
  return `منذ ${days} يوم`;
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
  return 'أقدم';
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

const NotificationsPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    setError(false);
    setLoading(true);
    const { data, error: err } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (err) {
      setError(true);
    } else {
      setNotifications(data ?? []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('user-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          setNotifications((prev) => [payload.new as Notification, ...prev]);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const markAsRead = async (notif: Notification) => {
    if (!notif.is_read) {
      await supabase.from('notifications').update({ is_read: true }).eq('id', notif.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
      );
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

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  // Group by date
  const groups = notifications.reduce<Record<string, Notification[]>>((acc, n) => {
    const group = getDateGroup(n.created_at ?? '');
    if (!acc[group]) acc[group] = [];
    acc[group].push(n);
    return acc;
  }, {});

  const groupOrder = ['اليوم', 'الأمس', 'هذا الأسبوع', 'أقدم'];

  return (
    <div className="min-h-screen bg-background pb-20 font-tajawal" dir="rtl">
      <PageHeader
        title="الإشعارات"
        action={
          unreadCount > 0 ? (
            <button onClick={markAllRead} className="text-xs text-accent font-medium" aria-label="تحديد الكل كمقروء">
              تحديد الكل
            </button>
          ) : undefined
        }
      />

      <div className="p-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex gap-3 rounded-xl bg-card p-4">
                <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <p className="text-destructive text-sm">تعذر تحميل الإشعارات</p>
            <Button variant="outline" size="sm" onClick={fetchNotifications}>
              <RefreshCw className="h-4 w-4 ml-2" />
              إعادة المحاولة
            </Button>
          </div>
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="لا توجد إشعارات"
            subtitle="ستصلك الإشعارات هنا عند حدوث تحديثات"
          />
        ) : (
          <div className="space-y-6">
            {groupOrder.map((group) => {
              const items = groups[group];
              if (!items?.length) return null;
              return (
                <div key={group}>
                  <h2 className="text-xs font-semibold text-muted-foreground mb-2 px-1">{group}</h2>
                  <div className="space-y-2">
                    {items.map((notif) => {
                      const IconComp = iconMap[notif.type] || Bell;
                      return (
                        <button
                          key={notif.id}
                          onClick={() => markAsRead(notif)}
                          className={cn(
                            'w-full flex gap-3 rounded-xl p-4 text-right transition-colors',
                            notif.is_read
                              ? 'bg-card'
                              : 'bg-accent/5 border border-accent/20'
                          )}
                          aria-label={notif.title_ar || 'إشعار'}
                        >
                          <div className={cn(
                            'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                            notif.is_read ? 'bg-muted' : 'bg-accent/10'
                          )}>
                            <IconComp className={cn('h-5 w-5', notif.is_read ? 'text-muted-foreground' : 'text-accent')} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={cn('text-sm leading-relaxed', !notif.is_read && 'font-semibold')}>
                              {notif.title_ar}
                            </p>
                            {notif.body_ar && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notif.body_ar}</p>
                            )}
                            <p className="text-[10px] text-muted-foreground mt-1">
                              {getRelativeTime(notif.created_at ?? '')}
                            </p>
                          </div>
                          {!notif.is_read && (
                            <div className="h-2 w-2 rounded-full bg-accent shrink-0 mt-2" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
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
