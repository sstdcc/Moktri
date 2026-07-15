import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDistricts } from '@/contexts/DistrictsContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useDebounce } from '@/hooks/useDebounce';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Plus, Search as SearchIcon, RefreshCw, ChevronDown, ChevronUp, X } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { RequestCard, type RequestCardData } from '@/components/RequestCard';

const categoryLabels: Record<string, string> = {
  room: 'غرفة', apartment: 'شقة', house: 'بيت', floor: 'دور', shop: 'محل',
  office: 'مكتب', shared: 'مشترك', family: 'عائلي', student: 'طلابي',
};

const PAGE_SIZE = 20;

const HousingRequestsPage = () => {
  usePageTitle();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const isProvider = profile?.role === 'owner' || profile?.role === 'broker' || profile?.role === 'admin';
  const { districts } = useDistricts();
  const [myRequests, setMyRequests] = useState<RequestCardData[]>([]);
  const [otherRequests, setOtherRequests] = useState<RequestCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [othersOpen, setOthersOpen] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput, 350);

  const isClosed = (s: string | null) => s === 'fulfilled' || s === 'completed' || s === 'cancelled' || s === 'expired';

  const fetchRequests = useCallback(async (pageNum: number, append = false) => {
    if (append) setLoadingMore(true); else setLoading(true);
    setError(false);
    const from = pageNum * PAGE_SIZE;
    const { data, error: err } = await supabase
      .from('housing_requests')
      .select('id, category, neighborhood, district_id, city_name, governorate, min_price, max_price, currency, for_whom, notes, bedrooms_needed, responses_count, views_count, status, created_at, expires_at, requester_id, requester:profiles!housing_requests_requester_id_fkey(full_name, avatar_url)')
      .in('status', ['active', 'fulfilled', 'expired', 'cancelled', 'completed'])
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (err) { setError(true); setLoading(false); setLoadingMore(false); return; }
    const all = (data as unknown as RequestCardData[]) ?? [];
    setHasMore(all.length === PAGE_SIZE);

    if (user) {
      const mine = all.filter(r => r.requester_id === user.id);
      const others = all.filter(r => r.requester_id !== user.id && !isClosed(r.status));
      setMyRequests(prev => append ? [...prev, ...mine] : mine);
      setOtherRequests(prev => append ? [...prev, ...others] : others);
    } else {
      setMyRequests([]);
      const others = all.filter(r => !isClosed(r.status));
      setOtherRequests(prev => append ? [...prev, ...others] : others);
    }
    setLoading(false);
    setLoadingMore(false);
  }, [user]);

  useEffect(() => { setPage(0); fetchRequests(0); }, [fetchRequests]);

  const matchesSearch = useCallback((r: RequestCardData, q: string) => {
    if (!q.trim()) return true;
    const term = q.trim().toLowerCase();
    const category = categoryLabels[r.category] || r.category;
    const district = districts.find(d => d.id === r.district_id);
    const districtName = district?.name_ar ?? '';
    const city = district?.city ?? '';
    const haystack = [
      category,
      r.category,
      r.city_name,
      r.governorate,
      r.neighborhood,
      districtName,
      city,
      r.notes,
    ].filter(Boolean).join(' ').toLowerCase();
    return haystack.includes(term);
  }, [districts]);

  const filteredMyRequests = useMemo(() => {
    if (!debouncedSearch.trim()) return myRequests;
    return myRequests.filter(r => matchesSearch(r, debouncedSearch));
  }, [myRequests, debouncedSearch, matchesSearch]);

  const filteredOtherRequests = useMemo(() => {
    if (!debouncedSearch.trim()) return otherRequests;
    return otherRequests.filter(r => matchesSearch(r, debouncedSearch));
  }, [otherRequests, debouncedSearch, matchesSearch]);

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchRequests(next, true);
  };

  return (
    <div className="min-h-screen bg-background font-tajawal" dir="rtl">
      <div className="p-4 flex items-center justify-between">
        <h1 className="text-xl font-black text-foreground">طلبات السكن</h1>
        {user && !isProvider && (
          <button onClick={() => navigate('/requests/new')} className="p-2 text-accent">
            <Plus className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="px-4 pb-8 space-y-4">
        <div className="relative">
          <SearchIcon className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="ابحث في الطلبات..."
            className="w-full rounded-lg border border-border bg-background py-2.5 pr-10 pl-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
          />
          {searchInput && (
            <button
              onClick={() => setSearchInput('')}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="مسح البحث"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {loading && <LoadingSpinner />}

        {error && !loading && (
          <div className="flex flex-col items-center gap-3 py-12">
            <p className="text-sm text-destructive">تعذر تحميل الطلبات</p>
            <Button variant="outline" size="sm" onClick={() => fetchRequests(0)}>
              <RefreshCw className="h-4 w-4 ml-2" /> إعادة المحاولة
            </Button>
          </div>
        )}

        {!loading && !error && (
          <>
            {user && !isProvider && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-bold text-foreground">طلباتي</h2>
                  <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => navigate('/requests/new')}>
                    <Plus className="h-3.5 w-3.5" /> طلب جديد
                  </Button>
                </div>
                {filteredMyRequests.length === 0 ? (
                  <EmptyState
                    icon={SearchIcon}
                    title={myRequests.length === 0 ? "لم تنشر أي طلب سكن بعد" : "لا توجد نتائج مطابقة"}
                    subtitle={myRequests.length === 0 ? "انشر طلبك وسيتواصل معك الملاك" : "جرّب كلمات بحث مختلفة"}
                    actionLabel={myRequests.length === 0 ? "نشر طلب" : undefined}
                    onAction={myRequests.length === 0 ? () => navigate('/requests/new') : undefined}
                  />
                ) : (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {filteredMyRequests.map((r, i) => (
                      <RequestCard key={r.id} index={i} request={r} districts={districts} />
                    ))}
                  </div>
                )}
              </div>
            )}

            <Collapsible open={othersOpen} onOpenChange={setOthersOpen}>
              <CollapsibleTrigger className="flex items-center justify-between w-full py-2">
                <h2 className="text-base font-bold text-foreground">
                  {user ? (isProvider ? 'طلبات السوق' : 'طلبات أخرى') : 'طلبات السكن'}
                </h2>
                {othersOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </CollapsibleTrigger>
              <CollapsibleContent>
                {otherRequests.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">لا توجد طلبات حالياً</p>
                ) : (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 mt-2">
                    {otherRequests.map((r, i) => (
                      <RequestCard key={r.id} index={i} request={r} districts={districts} />
                    ))}
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>

            {hasMore && (
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="mx-auto mt-4 block rounded-lg border border-border bg-card px-6 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
              >
                {loadingMore ? 'جاري التحميل...' : 'تحميل المزيد'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default HousingRequestsPage;
