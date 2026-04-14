import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
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

const AdminDashboardPage = () => {
  const [stats, setStats] = useState<Stats>({ users: 0, activeListings: 0, activeRequests: 0, pendingReports: 0 });
  const [alerts, setAlerts] = useState<Alerts>({ pendingReview: 0, staleListings: 0, pendingVerifications: 0 });
  const [recentReports, setRecentReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

      const [usersRes, listingsRes, requestsRes, reportsRes, pendingReviewRes, staleRes, verificationsRes, recentRes] =
        await Promise.all([
          supabase.from('profiles').select('id', { count: 'exact', head: true }),
          supabase.from('listings').select('id', { count: 'exact', head: true }).eq('status', 'active'),
          supabase.from('housing_requests').select('id', { count: 'exact', head: true }).eq('status', 'active'),
          supabase.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase.from('listings').select('id', { count: 'exact', head: true }).eq('status', 'pending_review'),
          supabase.from('listings').select('id', { count: 'exact', head: true }).eq('status', 'active').lt('last_updated_at', sixtyDaysAgo),
          supabase.from('verification_applications').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase
            .from('reports')
            .select('*, reporter:profiles!reports_reporter_id_fkey(full_name)')
            .order('created_at', { ascending: false })
            .limit(5),
        ]);

      setStats({
        users: usersRes.count ?? 0,
        activeListings: listingsRes.count ?? 0,
        activeRequests: requestsRes.count ?? 0,
        pendingReports: reportsRes.count ?? 0,
      });
      setAlerts({
        pendingReview: pendingReviewRes.count ?? 0,
        staleListings: staleRes.count ?? 0,
        pendingVerifications: verificationsRes.count ?? 0,
      });
      setRecentReports(recentRes.data ?? []);
      setLoading(false);
    };
    fetchData();
  }, []);

  const statCards = [
    { label: 'إجمالي المستخدمين', value: stats.users, icon: Users, color: 'text-blue-500', trend: '+5 هذا الأسبوع' },
    { label: 'إعلانات نشطة', value: stats.activeListings, icon: ListChecks, color: 'text-green-500', trend: '+3 هذا الأسبوع' },
    { label: 'طلبات سكن نشطة', value: stats.activeRequests, icon: FileSearch, color: 'text-amber-500', trend: '+2 هذا الأسبوع' },
    { label: 'بلاغات معلقة', value: stats.pendingReports, icon: ShieldAlert, color: 'text-red-500', trend: '+1 هذا الأسبوع' },
  ];

  const alertItems = [
    { count: alerts.pendingReview, label: 'إعلان بانتظار المراجعة', color: 'bg-amber-500', link: '/dashboard/admin/listings' },
    { count: alerts.staleListings, label: 'إعلان قديم (أكثر من 60 يوم)', color: 'bg-orange-500', link: '/dashboard/admin/listings' },
    { count: alerts.pendingVerifications, label: 'طلب توثيق معلق', color: 'bg-blue-500', link: '/dashboard/admin/verifications' },
    { count: stats.pendingReports, label: 'بلاغ معلق', color: 'bg-red-500', link: '/dashboard/admin/reports' },
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
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold text-foreground mb-6">نظرة عامة</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {statCards.map((stat) => (
          <Card key={stat.label} className="rounded-2xl shadow-sm">
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-3xl font-black text-foreground">{stat.value}</p>
                  <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
                  <p className={`text-xs mt-1 ${stat.color}`}>{stat.trend}</p>
                </div>
                <stat.icon className={`h-8 w-8 ${stat.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Alerts */}
      {alertItems.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Bell className="h-5 w-5 text-accent" />
            <h2 className="text-lg font-bold text-foreground">يحتاج انتباهك</h2>
          </div>
          <div className="space-y-2">
            {alertItems.map((alert, i) => (
              <div
                key={i}
                className="rounded-xl border border-border p-3 flex items-center justify-between bg-card"
              >
                <div className="flex items-center gap-3">
                  <span className={`w-2.5 h-2.5 rounded-full ${alert.color}`} />
                  <Badge variant="secondary" className="text-xs">{alert.count}</Badge>
                  <span className="text-sm text-foreground">{alert.label}</span>
                </div>
                <Link to={alert.link} className="text-sm text-accent font-medium hover:underline">
                  مراجعة
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Reports */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <ExternalLink className="h-5 w-5 text-accent" />
          <h2 className="text-lg font-bold text-foreground">آخر البلاغات</h2>
        </div>
        {recentReports.length === 0 ? (
          <p className="text-sm text-muted-foreground">لا توجد بلاغات</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-right py-2 px-2 text-muted-foreground font-medium">المُبلِّغ</th>
                  <th className="text-right py-2 px-2 text-muted-foreground font-medium">النوع</th>
                  <th className="text-right py-2 px-2 text-muted-foreground font-medium">السبب</th>
                  <th className="text-right py-2 px-2 text-muted-foreground font-medium">التاريخ</th>
                  <th className="text-right py-2 px-2 text-muted-foreground font-medium">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {recentReports.map((r: any) => (
                  <tr key={r.id} className="border-b border-border/50">
                    <td className="py-2 px-2">{r.reporter?.full_name ?? '—'}</td>
                    <td className="py-2 px-2">
                      <Badge variant="outline" className="text-xs">{targetTypeMap[r.target_type] ?? r.target_type}</Badge>
                    </td>
                    <td className="py-2 px-2">{reasonMap[r.reason] ?? r.reason}</td>
                    <td className="py-2 px-2 text-muted-foreground">
                      {r.created_at ? format(new Date(r.created_at), 'dd MMM', { locale: ar }) : '—'}
                    </td>
                    <td className="py-2 px-2">
                      <Badge variant="secondary" className="text-xs">{statusMap[r.status] ?? r.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminDashboardPage;
