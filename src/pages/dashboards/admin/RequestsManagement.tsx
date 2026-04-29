import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { formatPrice, timeAgo } from '@/lib/format';
import { useDistricts } from '@/contexts/DistrictsContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { ExternalLink, RotateCcw, CheckCircle, XCircle, Search, FileSearch, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { RequestStatus, ListingCategory } from '@/types/database';

const categoryLabels: Record<ListingCategory, string> = {
  room: 'غرفة', apartment: 'شقة', house: 'بيت', floor: 'دور',
  shop: 'محل', office: 'مكتب', shared: 'سكن مشترك', family: 'عائلي', student: 'طلابي',
};

const forWhomLabels: Record<string, string> = {
  family: 'عائلة', bachelors: 'عزاب', students: 'طلاب',
};

const statusColors: Record<string, string> = {
  active: 'bg-success/10 text-success',
  fulfilled: 'bg-primary/10 text-primary',
  completed: 'bg-primary/10 text-primary',
  expired: 'bg-muted text-muted-foreground',
  cancelled: 'bg-danger/10 text-danger',
};

const statusLabels: Record<string, string> = {
  active: 'نشط', fulfilled: 'مكتمل', completed: 'مكتمل', expired: 'منتهي', cancelled: 'ملغي',
};

type TabValue = 'active' | 'expired' | 'completed' | 'cancelled';

const tabs: { label: string; value: TabValue }[] = [
  { label: 'نشطة', value: 'active' },
  { label: 'منتهية', value: 'expired' },
  { label: 'مكتملة', value: 'completed' },
  { label: 'ملغية', value: 'cancelled' },
];

interface RequestRow {
  id: string;
  category: ListingCategory;
  neighborhood: string | null;
  min_price: number | null;
  max_price: number | null;
  currency: string | null;
  for_whom: string | null;
  status: RequestStatus | null;
  responses_count: number | null;
  views_count: number | null;
  created_at: string | null;
  expires_at: string | null;
  district_id: string | null;
  requester_id: string;
  requester: { full_name: string } | null;
}

const RequestsManagement = () => {
  usePageTitle();
  const { districts } = useDistricts();
  const [tab, setTab] = useState<TabValue>('active');
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [acting, setActing] = useState<string | null>(null);

  const districtName = (id: string | null) =>
    districts.find((d) => d.id === id)?.name_ar ?? '';

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError(false);
    const statuses = tab === 'completed' ? ['completed', 'fulfilled'] : [tab];
    const { data, error: err } = await supabase
      .from('housing_requests')
      .select('id, category, neighborhood, min_price, max_price, currency, for_whom, status, responses_count, views_count, created_at, expires_at, district_id, requester_id, requester:profiles!housing_requests_requester_id_fkey(full_name)')
      .in('status', statuses as any)
      .order('created_at', { ascending: false })
      .limit(200);

    if (err) { setError(true); setLoading(false); return; }
    setRequests((data as unknown as RequestRow[]) ?? []);
    setLoading(false);
  }, [tab]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const filtered = search
    ? requests.filter((r) => {
        const name = (r.requester as any)?.full_name ?? '';
        return name.includes(search);
      })
    : requests;

  const updateStatus = async (id: string, status: RequestStatus, extra?: Record<string, unknown>) => {
    setActing(id);
    const { error: err } = await supabase
      .from('housing_requests')
      .update({ status, ...extra })
      .eq('id', id);
    setActing(null);
    if (err) { toast.error('حدث خطأ أثناء التحديث'); return; }

    // Notify the request owner
    const req = requests.find((r) => r.id === id);
    if (req) {
      const statusLabelsNotif: Record<string, string> = {
        fulfilled: 'تم تلبية طلبك',
        cancelled: 'تم إلغاء طلبك',
        expired: 'انتهت صلاحية طلبك',
        active: 'تم تجديد طلبك',
      };
      const bodyMap: Record<string, string> = {
        fulfilled: 'تم تحديث حالة طلب السكن الخاص بك إلى "تم التلبية"',
        cancelled: 'تم إلغاء طلب السكن الخاص بك من قبل الإدارة',
        expired: 'انتهت صلاحية طلب السكن الخاص بك',
        active: 'تم تجديد طلب السكن الخاص بك لمدة 30 يوماً إضافية',
      };
      await supabase.from('notifications').insert({
        type: 'system' as any,
        user_id: req.requester_id,
        title_ar: statusLabelsNotif[status] ?? 'تحديث على طلبك',
        body_ar: bodyMap[status] ?? 'تم تحديث حالة طلب السكن الخاص بك',
        link: `/requests/${id}`,
      });
    }

    toast.success('تم التحديث بنجاح');
    fetchRequests();
  };

  const renewRequest = async (id: string) => {
    const newExpiry = new Date();
    newExpiry.setDate(newExpiry.getDate() + 30);
    await updateStatus(id, 'active', { expires_at: newExpiry.toISOString() });
  };

  return (
    <>
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-foreground font-tajawal">إدارة طلبات السكن</h1>

        <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)}>
          <TabsList className="w-full grid grid-cols-4 h-auto">
            {tabs.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="text-xs py-2 font-tajawal">
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="بحث باسم مقدّم الطلب..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-9 font-tajawal text-sm"
          />
        </div>

        {loading && <LoadingSpinner />}

        {error && !loading && (
          <div className="flex flex-col items-center gap-3 py-12">
            <AlertCircle className="h-8 w-8 text-danger" />
            <p className="text-sm text-danger font-tajawal">تعذر تحميل الطلبات</p>
            <Button variant="outline" size="sm" onClick={fetchRequests}>إعادة المحاولة</Button>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <EmptyState icon={FileSearch} title="لا توجد طلبات" subtitle={search ? 'لم يُعثر على نتائج' : `لا توجد طلبات ${statusLabels[tab]}`} />
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="space-y-3">
            {filtered.map((r) => {
              const name = (r.requester as any)?.full_name ?? 'مستخدم';
              const budget = r.min_price || r.max_price
                ? `${r.min_price ? formatPrice(Number(r.min_price)) : '—'} – ${r.max_price ? formatPrice(Number(r.max_price)) : '—'}`
                : null;
              return (
                <div key={r.id} className="rounded-xl border border-border bg-card p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-foreground font-tajawal truncate">{name}</p>
                      <p className="text-xs text-muted-foreground font-tajawal">
                        {categoryLabels[r.category]} · {districtName(r.district_id)}{r.neighborhood ? ` — ${r.neighborhood}` : ''}
                      </p>
                    </div>
                    <Badge className={cn('shrink-0 text-[10px]', statusColors[r.status ?? 'active'])}>
                      {statusLabels[r.status ?? 'active']}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground font-tajawal">
                    {budget && <span>الميزانية: {budget}</span>}
                    {r.for_whom && <span>{forWhomLabels[r.for_whom] ?? r.for_whom}</span>}
                    <span>الردود: {r.responses_count ?? 0}</span>
                    <span>المشاهدات: {r.views_count ?? 0}</span>
                    {r.created_at && <span>{timeAgo(r.created_at)}</span>}
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button variant="outline" size="sm" className="text-xs gap-1 font-tajawal" asChild>
                      <a href={`/requests/${r.id}`} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3.5 w-3.5" /> عرض
                      </a>
                    </Button>
                    {r.status === 'active' && (
                      <>
                        <Button
                          variant="outline" size="sm"
                          className="text-xs gap-1 font-tajawal text-success"
                          disabled={acting === r.id}
                          onClick={() => updateStatus(r.id, 'fulfilled')}
                        >
                          <CheckCircle className="h-3.5 w-3.5" /> إنهاء الطلب
                        </Button>
                        <Button
                          variant="outline" size="sm"
                          className="text-xs gap-1 font-tajawal text-danger"
                          disabled={acting === r.id}
                          onClick={() => updateStatus(r.id, 'cancelled')}
                        >
                          <XCircle className="h-3.5 w-3.5" /> إلغاء الطلب
                        </Button>
                      </>
                    )}
                    {r.status === 'expired' && (
                      <Button
                        variant="outline" size="sm"
                        className="text-xs gap-1 font-tajawal text-accent"
                        disabled={acting === r.id}
                        onClick={() => renewRequest(r.id)}
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> تجديد
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
};

export default RequestsManagement;
