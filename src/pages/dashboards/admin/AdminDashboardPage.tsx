import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  ListChecks,
  FileSearch,
  ShieldAlert,
  Bell,
  ExternalLink,
  AlertTriangle,
  Clock,
  BadgeCheck,
  ChevronLeft,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface Stats {
  users: number;
  activeListings: number;
  activeRequests: number;
  pendingReports: number;
}

interface Alerts {
  pendingReview: number;
  staleListings: number;
  pendingVerifications: number;
}

interface Trends {
  users: number;
  activeListings: number;
  activeRequests: number;
  pendingReports: number;
}

const AdminDashboardPage = () => {
  const [stats, setStats] = useState<Stats>({ users: 0, activeListings: 0, activeRequests: 0, pendingReports: 0 });
  const [trends, setTrends] = useState<Trends>({ users: 0, activeListings: 0, activeRequests: 0, pendingReports: 0 });
  const [alerts, setAlerts] = useState<Alerts>({ pendingReview: 0, staleListings: 0, pendingVerifications: 0 });
  const [recentReports, setRecentReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const now = Date.now();
      const sixtyDaysAgo = new Date(now - 60 * 24 * 60 * 60 * 1000).toISOString();
      const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();

      const results = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('listings').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('housing_requests').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('listings').select('id', { count: 'exact', head: true }).eq('status', 'pending_review'),
        supabase.from('listings').select('id', { count: 'exact', head: true }).eq('status', 'active').lt('last_updated_at', sixtyDaysAgo),
        supabase.from('verification_applications').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('reports').select('*, reporter:profiles!reports_reporter_id_fkey(full_name)').order('created_at', { ascending: false }).limit(5),
        // Weekly trends
        supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo),
        supabase.from('listings').select('id', { count: 'exact', head: true }).eq('status', 'active').gte('published_at', sevenDaysAgo),
        supabase.from('housing_requests').select('id', { count: 'exact', head: true }).eq('status', 'active').gte('created_at', sevenDaysAgo),
        supabase.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'pending').gte('created_at', sevenDaysAgo),
      ]);

      results.forEach((r, i) => {
        if (r.error) console.error(`[AdminDashboard] query #${i} failed`, r.error);
      });

      const [usersRes, listingsRes, requestsRes, reportsRes, pendingReviewRes, staleRes, verificationsRes, recentRes,
        usersWeekRes, listingsWeekRes, requestsWeekRes, reportsWeekRes] = results;

      setStats({
        users: usersRes.count ?? 0,
        activeListings: listingsRes.count ?? 0,
        activeRequests: requestsRes.count ?? 0,
        pendingReports: reportsRes.count ?? 0,
      });
      setTrends({
        users: usersWeekRes.count ?? 0,
        activeListings: listingsWeekRes.count ?? 0,
        activeRequests: requestsWeekRes.count ?? 0,
        pendingReports: reportsWeekRes.count ?? 0,
      });
      setAlerts({
        pendingReview: pendingReviewRes.count ?? 0,
        staleListings: staleRes.count ?? 0,
        pendingVerifications: verificationsRes.count ?? 0,
      });
      setRecentReports((recentRes as any).data ?? []);
      setLoading(false);
    };
    fetchData();
  }, []);

  const formatTrend = (n: number) => (n > 0 ? `+${n} هذا الأسبوع` : n < 0 ? `${n} هذا الأسبوع` : 'لا تغيّر هذا الأسبوع');
  const trendTone = (n: number) =>
    n > 0
      ? { icon: TrendingUp, cls: 'text-green-600 dark:text-green-400' }
      : n < 0
      ? { icon: TrendingDown, cls: 'text-red-600 dark:text-red-400' }
      : { icon: Minus, cls: 'text-muted-foreground/60' };

  const statCards = [
    { label: 'إجمالي المستخدمين', value: stats.users, icon: Users, color: 'text-blue-500', trendValue: trends.users, trend: formatTrend(trends.users) },
    { label: 'إعلانات نشطة', value: stats.activeListings, icon: ListChecks, color: 'text-green-500', trendValue: trends.activeListings, trend: formatTrend(trends.activeListings) },
    { label: 'طلبات سكن نشطة', value: stats.activeRequests, icon: FileSearch, color: 'text-amber-500', trendValue: trends.activeRequests, trend: formatTrend(trends.activeRequests) },
    { label: 'بلاغات معلقة', value: stats.pendingReports, icon: ShieldAlert, color: 'text-red-500', trendValue: trends.pendingReports, trend: formatTrend(trends.pendingReports) },
  ];

  const statusBadgeCls: Record<string, string> = {
    pending: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
    reviewed: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
    resolved: 'bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/30',
    dismissed: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30',
  };

  const alertItems = [
    { count: alerts.pendingReview, label: 'إعلان بانتظار المراجعة', color: 'bg-amber-500', icon: Clock, status: 'معلق', statusColor: 'text-amber-600 bg-amber-100 dark:text-amber-300 dark:bg-amber-500/15', link: '/dashboard/admin/listings' },
    { count: alerts.staleListings, label: 'إعلان قديم (أكثر من 60 يوم)', color: 'bg-orange-500', icon: AlertTriangle, status: 'يحتاج تحديث', statusColor: 'text-orange-600 bg-orange-100 dark:text-orange-300 dark:bg-orange-500/15', link: '/dashboard/admin/listings' },
    { count: alerts.pendingVerifications, label: 'طلب توثيق معلق', color: 'bg-blue-500', icon: BadgeCheck, status: 'معلق', statusColor: 'text-blue-600 bg-blue-100 dark:text-blue-300 dark:bg-blue-500/15', link: '/dashboard/admin/verifications' },
    { count: stats.pendingReports, label: 'بلاغ معلق', color: 'bg-red-500', icon: ShieldAlert, status: 'عاجل', statusColor: 'text-red-600 bg-red-100 dark:text-red-300 dark:bg-red-500/15', link: '/dashboard/admin/reports' },
  ].filter((a) => a.count > 0);

  const reasonMap: Record<string, string> = {
    fake: 'محتوى وهمي',
    duplicate: 'مكرر',
    inappropriate: 'غير لائق',
    spam: 'سبام',
    wrong_price: 'سعر خاطئ',
    already_rented: 'مؤجر بالفعل',
    other: 'أخرى',
  };

  const targetTypeMap: Record<string, string> = {
    listing: 'إعلان',
    user: 'مستخدم',
    request: 'طلب',
  };

  const statusMap: Record<string, string> = {
    pending: 'معلق',
    reviewed: 'تمت المراجعة',
    resolved: 'محلول',
    dismissed: 'مرفوض',
  };

  if (loading) {
    return (
      <>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
        </div>
      </>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-bold text-foreground mb-6">نظرة عامة</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        {statCards.map((stat) => {
          const tone = trendTone(stat.trendValue);
          const TrendIcon = tone.icon;
          return (
            <Card key={stat.label} className="rounded-xl shadow-none border border-border/40">
              <CardContent className="p-5">
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-2xl md:text-3xl font-semibold text-foreground leading-none tracking-tight">{stat.value}</p>
                    <p className="text-xs text-muted-foreground/80 mt-2 font-medium">{stat.label}</p>
                    <div className={`mt-2 inline-flex items-center gap-1 text-[11px] font-medium ${tone.cls}`}>
                      <TrendIcon className="h-3 w-3" />
                      <span>{stat.trend}</span>
                    </div>
                  </div>
                  <stat.icon className={`h-5 w-5 shrink-0 opacity-50 ${stat.color}`} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Alerts */}
      {alertItems.length > 0 && (
        <div className="mb-10 rounded-xl border border-border/60 bg-card/50 p-5">
          <div className="flex items-center gap-2 mb-5">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">يحتاج انتباهك</h2>
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground mr-auto">{alertItems.length}</span>
          </div>
          <div className="grid gap-2">
            {alertItems.map((alert, i) => (
              <Link
                key={i}
                to={alert.link}
                className="group rounded-lg border border-border/40 bg-background/50 p-3 flex items-center gap-3 hover:border-border transition-colors"
              >
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${alert.color}/10`}>
                  <alert.icon className={`h-4 w-4 ${alert.color.replace('bg-', 'text-')}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-semibold text-foreground leading-none">{alert.count}</span>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${alert.statusColor}`}>{alert.status}</span>
                  </div>
                  <p className="text-xs text-muted-foreground/70 mt-0.5">{alert.label}</p>
                </div>
                <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recent Reports */}
      <div className="mt-10">
        <div className="flex items-center gap-2 mb-5">
          <ExternalLink className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">آخر البلاغات</h2>
        </div>
        {recentReports.length === 0 ? (
          <p className="text-sm text-muted-foreground/70">لا توجد بلاغات</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60">
                  <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground/70 uppercase tracking-wider">المُبلِّغ</th>
                  <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground/70 uppercase tracking-wider">النوع</th>
                  <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground/70 uppercase tracking-wider">السبب</th>
                  <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground/70 uppercase tracking-wider">التاريخ</th>
                  <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground/70 uppercase tracking-wider">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {recentReports.map((r: any) => (
                  <tr key={r.id} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-3 text-sm font-medium">{r.reporter?.full_name ?? '—'}</td>
                    <td className="py-3 px-3">
                      <span className="text-xs text-muted-foreground/80">{targetTypeMap[r.target_type] ?? r.target_type}</span>
                    </td>
                    <td className="py-3 px-3 text-sm text-muted-foreground/80">{reasonMap[r.reason] ?? r.reason}</td>
                    <td className="py-3 px-3 text-xs text-muted-foreground/60">
                      {r.created_at ? format(new Date(r.created_at), 'dd MMM', { locale: ar }) : '—'}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${statusBadgeCls[r.status] ?? 'bg-muted text-muted-foreground border-border'}`}>
                        {statusMap[r.status] ?? r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
};

export default AdminDashboardPage;
