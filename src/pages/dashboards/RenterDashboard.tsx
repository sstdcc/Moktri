import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDistricts } from '@/contexts/DistrictsContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { PageHeader } from '@/components/ui/PageHeader';
import { BottomNav } from '@/components/ui/BottomNav';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatPrice, timeAgo } from '@/lib/format';
import {
  Search, Heart, MessageSquare, Bell, Plus, MapPin, Eye, FileText,
} from 'lucide-react';
import ProfileCompletionCard from '@/components/ProfileCompletionCard';
import SmartNudgeBanner from '@/components/SmartNudgeBanner';

const categoryLabels: Record<string, string> = {
  room: 'غرفة', apartment: 'شقة', house: 'بيت', floor: 'دور',
  shop: 'محل', office: 'مكتب', shared: 'سكن مشترك', family: 'عائلي', student: 'طلابي',
};
const statusLabels: Record<string, string> = {
  active: 'نشط', fulfilled: 'مكتمل', expired: 'منتهي', cancelled: 'ملغي',
};
const statusColors: Record<string, string> = {
  active: 'bg-success/10 text-success', fulfilled: 'bg-primary/10 text-primary',
  expired: 'bg-muted text-muted-foreground', cancelled: 'bg-destructive/10 text-destructive',
};

const RenterDashboard = () => {
  usePageTitle();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { districts } = useDistricts();
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [favCount, setFavCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const districtName = (id: string | null) => districts.find(d => d.id === id)?.name_ar ?? '';

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [reqRes, favRes, notifRes] = await Promise.all([
      supabase.from('housing_requests').select('id, category, district_id, neighborhood, min_price, max_price, status, responses_count, views_count, created_at')
        .eq('requester_id', user.id).order('created_at', { ascending: false }).limit(10),
      supabase.from('favorites').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_read', false),
    ]);
    setMyRequests(reqRes.data ?? []);
    setFavCount(favRes.count ?? 0);
    setUnreadCount(notifRes.count ?? 0);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const today = new Date().toLocaleDateString('ar-YE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  if (loading) return <LoadingSpinner />;

  const quickLinks = [
    { icon: Search, label: 'تصفح الإعلانات', path: '/listings', color: 'text-primary' },
    { icon: Heart, label: `المفضلة (${favCount})`, path: '/favorites', color: 'text-danger' },
    { icon: Bell, label: `الإشعارات${unreadCount > 0 ? ` (${unreadCount})` : ''}`, path: '/notifications', color: 'text-accent' },
    { icon: FileText, label: 'طلبات السكن', path: '/requests', color: 'text-success' },
  ];

  return (
    <div className="min-h-screen bg-background pb-20 font-tajawal" dir="rtl">
      <PageHeader title="لوحة التحكم" />

      <div className="px-4 pt-4 space-y-5">
        <div>
          <h1 className="text-2xl font-black text-foreground">مرحباً، {profile?.full_name}</h1>
          <p className="text-xs text-muted-foreground mt-1">{today}</p>
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-2 gap-3">
          {quickLinks.map((link) => (
            <button
              key={link.path}
              onClick={() => navigate(link.path)}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-all hover:shadow-md hover:border-accent/30"
            >
              <link.icon className={cn('h-5 w-5', link.color)} />
              <span className="text-sm font-medium text-foreground">{link.label}</span>
            </button>
          ))}
        </div>

        {/* My Requests */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold">طلباتي</h2>
            <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => navigate('/requests/new')}>
              <Plus className="h-3.5 w-3.5" /> طلب جديد
            </Button>
          </div>

          {myRequests.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title="لم تنشر أي طلب سكن بعد"
              subtitle="انشر طلبك وسيتواصل معك الملاك"
              actionLabel="نشر طلب"
              onAction={() => navigate('/requests')}
            />
          ) : (
            <div className="space-y-3">
              {myRequests.map((r: any) => {
                const budget = r.min_price || r.max_price
                  ? `${r.min_price ? formatPrice(Number(r.min_price)) : '—'} – ${r.max_price ? formatPrice(Number(r.max_price)) : '—'}`
                  : null;
                return (
                  <Card key={r.id} className="cursor-pointer transition-all hover:shadow-md" onClick={() => navigate(`/requests/${r.id}`)}>
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-foreground">
                            {categoryLabels[r.category] || r.category}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {districtName(r.district_id)}{r.neighborhood ? ` — ${r.neighborhood}` : ''}
                          </p>
                        </div>
                        <Badge className={cn('shrink-0 text-[10px]', statusColors[r.status ?? 'active'])}>
                          {statusLabels[r.status ?? 'active']}
                        </Badge>
                      </div>
                      {budget && <p className="text-xs text-accent font-medium mt-1">{budget}</p>}
                      <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" /> {r.responses_count ?? 0} رد</span>
                        <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {r.views_count ?? 0}</span>
                        {r.created_at && <span>{timeAgo(r.created_at)}</span>}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default RenterDashboard;
