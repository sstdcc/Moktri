import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDistricts } from '@/contexts/DistrictsContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { PageHeader } from '@/components/ui/PageHeader';

import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  Search, Heart, MessageSquare, Bell, Plus, FileText,
} from 'lucide-react';
import ProfileCompletionCard from '@/components/ProfileCompletionCard';
import SmartNudgeBanner from '@/components/SmartNudgeBanner';
import { RequestCard } from '@/components/RequestCard';

const statusLabels: Record<string, string> = {
  active: 'نشط', fulfilled: 'مكتمل', expired: 'منتهي', cancelled: 'ملغي',
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

        <SmartNudgeBanner />
        <ProfileCompletionCard />

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
              {myRequests.map((r: any) => (
                <RequestCard key={r.id} request={r} districts={districts} />
              ))}
            </div>
          )}
        </div>
      </div>

      
    </div>
  );
};

export default RenterDashboard;
