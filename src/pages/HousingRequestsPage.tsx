import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDistricts } from '@/contexts/DistrictsContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatPrice, timeAgo } from '@/lib/format';
import { Plus, MapPin, MessageSquare, Eye, Users, Search as SearchIcon, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { ListingCategory } from '@/types/database';

const categoryLabels: Record<string, string> = {
  room: 'غرفة', apartment: 'شقة', house: 'بيت', floor: 'دور',
  shop: 'محل', office: 'مكتب', shared: 'سكن مشترك', family: 'عائلي', student: 'طلابي',
};

const forWhomLabels: Record<string, string> = {
  family: 'عائلة', bachelors: 'عزاب', students: 'طلاب',
};

const statusLabels: Record<string, string> = {
  active: 'نشط', fulfilled: 'مكتمل', expired: 'منتهي', cancelled: 'ملغي',
};
const statusColors: Record<string, string> = {
  active: 'bg-success/10 text-success', fulfilled: 'bg-primary/10 text-primary',
  expired: 'bg-muted text-muted-foreground', cancelled: 'bg-destructive/10 text-destructive',
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
  status: string | null;
  created_at: string | null;
  expires_at: string | null;
  requester_id: string;
  requester: { full_name: string; avatar_url: string | null } | null;
}

const RequestCard = ({ r, navigate, districts }: { r: RequestRow; navigate: (path: string) => void; districts: any[] }) => {
  const name = (r.requester as any)?.full_name ?? 'مستخدم';
  const budget = r.min_price || r.max_price
    ? `${r.min_price ? formatPrice(Number(r.min_price)) : '—'} – ${r.max_price ? formatPrice(Number(r.max_price)) : '—'}`
    : null;
  const d = districts.find(d => d.id === r.district_id);

  return (
    <div
      onClick={() => navigate(`/requests/${r.id}`)}
      className="cursor-pointer rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:shadow-md hover:border-accent/30 active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground">يبحث عن {categoryLabels[r.category] || r.category}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{name}</p>
        </div>
        <Badge variant="secondary" className={cn('shrink-0 text-[10px]', statusColors[r.status ?? 'active'])}>
          {statusLabels[r.status ?? 'active'] || categoryLabels[r.category] || r.category}
        </Badge>
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {d && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" /> {d.city ? `${d.city} • ${d.name_ar}` : d.name_ar}{r.neighborhood ? ` — ${r.neighborhood}` : ''}
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
};

const HousingRequestsPage = () => {
  usePageTitle();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { districts } = useDistricts();
  const [myRequests, setMyRequests] = useState<RequestRow[]>([]);
  const [otherRequests, setOtherRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [othersOpen, setOthersOpen] = useState(true);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError(false);
    const { data, error: err } = await supabase
      .from('housing_requests')
      .select('id, category, neighborhood, district_id, min_price, max_price, currency, for_whom, notes, bedrooms_needed, responses_count, views_count, status, created_at, expires_at, requester_id, requester:profiles!housing_requests_requester_id_fkey(full_name, avatar_url)')
      .in('status', ['active', 'fulfilled', 'expired', 'cancelled'])
      .order('created_at', { ascending: false })
      .limit(100);

    if (err) { setError(true); setLoading(false); return; }
    const all = (data as unknown as RequestRow[]) ?? [];
    
    if (user) {
      setMyRequests(all.filter(r => r.requester_id === user.id));
      setOtherRequests(all.filter(r => r.requester_id !== user.id));
    } else {
      setMyRequests([]);
      setOtherRequests(all);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  return (
    <div className="min-h-screen bg-background font-tajawal" dir="rtl">
      <div className="p-4 flex items-center justify-between">
        <h1 className="text-xl font-black text-foreground">طلبات السكن</h1>
        {user && (
          <button onClick={() => navigate('/requests/new')} className="p-2 text-accent">
            <Plus className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="px-4 pb-8 space-y-4">
        {loading && <LoadingSpinner />}

        {error && !loading && (
          <div className="flex flex-col items-center gap-3 py-12">
            <p className="text-sm text-destructive">تعذر تحميل الطلبات</p>
            <Button variant="outline" size="sm" onClick={fetchRequests}>
              <RefreshCw className="h-4 w-4 ml-2" /> إعادة المحاولة
            </Button>
          </div>
        )}

        {!loading && !error && (
          <>
            {/* My requests section */}
            {user && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-bold text-foreground">طلباتي</h2>
                  <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => navigate('/requests/new')}>
                    <Plus className="h-3.5 w-3.5" /> طلب جديد
                  </Button>
                </div>
                {myRequests.length === 0 ? (
                  <EmptyState
                    icon={SearchIcon}
                    title="لم تنشر أي طلب سكن بعد"
                    subtitle="انشر طلبك وسيتواصل معك الملاك"
                    actionLabel="نشر طلب"
                    onAction={() => navigate('/requests/new')}
                  />
                ) : (
                  <div className="space-y-3">
                    {myRequests.map((r) => (
                      <RequestCard key={r.id} r={r} navigate={navigate} districts={districts} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Other requests section */}
            <Collapsible open={othersOpen} onOpenChange={setOthersOpen}>
              <CollapsibleTrigger className="flex items-center justify-between w-full py-2">
                <h2 className="text-base font-bold text-foreground">
                  {user ? 'طلبات أخرى' : 'طلبات السكن'}
                </h2>
                {othersOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </CollapsibleTrigger>
              <CollapsibleContent>
                {otherRequests.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">لا توجد طلبات حالياً</p>
                ) : (
                  <div className="space-y-3 mt-2">
                    {otherRequests.map((r) => (
                      <RequestCard key={r.id} r={r} navigate={navigate} districts={districts} />
                    ))}
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          </>
        )}
      </div>
    </div>
  );
};

export default HousingRequestsPage;
