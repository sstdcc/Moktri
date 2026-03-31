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
import { cn } from '@/lib/utils';
import { formatPrice, timeAgo } from '@/lib/format';
import { Plus, MapPin, MessageSquare, Eye, Users, Search as SearchIcon, RefreshCw } from 'lucide-react';
import type { ListingCategory } from '@/types/database';

const categoryLabels: Record<string, string> = {
  room: 'غرفة', apartment: 'شقة', house: 'بيت', floor: 'دور',
  shop: 'محل', office: 'مكتب', shared: 'سكن مشترك', family: 'عائلي', student: 'طلابي',
};

const forWhomLabels: Record<string, string> = {
  family: 'عائلة', bachelors: 'عزاب', students: 'طلاب',
};

interface RequestRow {
  id: string;
  category: ListingCategory;
  neighborhood: string | null;
  district_id: string | null;
  min_price: number | null;
  max_price: number | null;
  currency: string | null;
  for_whom: string | null;
  notes: string | null;
  bedrooms_needed: number | null;
  responses_count: number | null;
  views_count: number | null;
  created_at: string | null;
  expires_at: string | null;
  requester: { full_name: string; avatar_url: string | null } | null;
}

const HousingRequestsPage = () => {
  usePageTitle();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { districts } = useDistricts();
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const districtName = (id: string | null) =>
    districts.find((d) => d.id === id)?.name_ar ?? '';

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError(false);
    const { data, error: err } = await supabase
      .from('housing_requests')
      .select('id, category, neighborhood, district_id, min_price, max_price, currency, for_whom, notes, bedrooms_needed, responses_count, views_count, created_at, expires_at, requester:profiles!housing_requests_requester_id_fkey(full_name, avatar_url)')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(50);

    if (err) { setError(true); setLoading(false); return; }
    setRequests((data as unknown as RequestRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  return (
    <div className="min-h-screen bg-background pb-20 font-tajawal" dir="rtl">
      <PageHeader
        title="طلبات السكن"
        action={
          user ? (
            <button onClick={() => navigate('/requests/new')} className="p-2 text-accent">
              <Plus className="h-5 w-5" />
            </button>
          ) : undefined
        }
      />

      <div className="p-4 space-y-3">
        {loading && <LoadingSpinner />}

        {error && !loading && (
          <div className="flex flex-col items-center gap-3 py-12">
            <p className="text-sm text-destructive">تعذر تحميل الطلبات</p>
            <Button variant="outline" size="sm" onClick={fetchRequests}>
              <RefreshCw className="h-4 w-4 ml-2" /> إعادة المحاولة
            </Button>
          </div>
        )}

        {!loading && !error && requests.length === 0 && (
          <EmptyState
            icon={SearchIcon}
            title="لا توجد طلبات سكن حالياً"
            subtitle="كن أول من ينشر طلب سكن"
            actionLabel={user ? 'نشر طلب' : undefined}
            onAction={user ? () => navigate('/requests/new') : undefined}
          />
        )}

        {!loading && !error && requests.length > 0 && (
          <div className="space-y-3">
            {requests.map((r) => {
              const name = (r.requester as any)?.full_name ?? 'مستخدم';
              const budget = r.min_price || r.max_price
                ? `${r.min_price ? formatPrice(Number(r.min_price)) : '—'} – ${r.max_price ? formatPrice(Number(r.max_price)) : '—'}`
                : null;

              return (
                <div
                  key={r.id}
                  onClick={() => navigate(`/requests/${r.id}`)}
                  className="cursor-pointer rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:shadow-md hover:border-accent/30 active:scale-[0.99]"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground">يبحث عن {categoryLabels[r.category] || r.category}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{name}</p>
                    </div>
                    <Badge variant="secondary" className="shrink-0 text-[10px]">
                      {categoryLabels[r.category] || r.category}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {districtName(r.district_id) && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {(() => { const d = districts.find(d => d.id === r.district_id); return d ? (d.city ? `${d.city} • ${d.name_ar}` : d.name_ar) : ''; })()}{r.neighborhood ? ` — ${r.neighborhood}` : ''}
                      </span>
                    )}
                    {budget && <span>💰 {budget}</span>}
                    {r.bedrooms_needed && <span>🛏 {r.bedrooms_needed} غرف</span>}
                    {r.for_whom && (
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" /> {forWhomLabels[r.for_whom] ?? r.for_whom}
                      </span>
                    )}
                  </div>

                  {r.notes && (
                    <p className="mt-2 text-xs text-muted-foreground line-clamp-2 leading-relaxed">{r.notes}</p>
                  )}

                  <div className="mt-3 pt-2 border-t border-border/50 flex items-center gap-4 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" /> {r.responses_count ?? 0} رد
                    </span>
                    <span className="flex items-center gap-1">
                      <Eye className="h-3 w-3" /> {r.views_count ?? 0}
                    </span>
                    {r.created_at && <span>{timeAgo(r.created_at)}</span>}
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

export default HousingRequestsPage;
