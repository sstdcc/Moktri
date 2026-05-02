import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDistricts } from '@/contexts/DistrictsContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Plus, Search as SearchIcon, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { RequestCard, type RequestCardData } from '@/components/RequestCard';

const PAGE_SIZE = 20;

const HousingRequestsPage = () => {
  usePageTitle();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { districts } = useDistricts();
  const [myRequests, setMyRequests] = useState<RequestCardData[]>([]);
  const [otherRequests, setOtherRequests] = useState<RequestCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [othersOpen, setOthersOpen] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const isClosed = (s: string | null) => s === 'fulfilled' || s === 'completed' || s === 'cancelled' || s === 'expired';

  const fetchRequests = useCallback(async (pageNum: number, append = false) => {
    if (append) setLoadingMore(true); else setLoading(true);
    setError(false);
    const from = pageNum * PAGE_SIZE;
    const { data, error: err } = await supabase
      .from('housing_requests')
      .select('id, category, neighborhood, district_id, min_price, max_price, currency, for_whom, notes, bedrooms_needed, responses_count, views_count, status, created_at, expires_at, requester_id, requester:profiles!housing_requests_requester_id_fkey(full_name, avatar_url)')
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

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchRequests(next, true);
  };

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
            <Button variant="outline" size="sm" onClick={() => fetchRequests(0)}>
              <RefreshCw className="h-4 w-4 ml-2" /> إعادة المحاولة
            </Button>
          </div>
        )}

        {!loading && !error && (
          <>
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
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {myRequests.map((r) => (
                      <RequestCard key={r.id} request={r} districts={districts} />
                    ))}
                  </div>
                )}
              </div>
            )}

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
                      <RequestCard key={r.id} request={r} districts={districts} />
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
