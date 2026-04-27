import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { ExternalLink, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { ErrorState } from '@/components/ui/ErrorState';

const PAGE_SIZE = 30;

type TabStatus = 'pending_review' | 'active' | 'paused' | 'rejected' | 'expired';

const tabs: { label: string; status: TabStatus }[] = [
  { label: 'معلقة للمراجعة', status: 'pending_review' },
  { label: 'نشطة', status: 'active' },
  { label: 'موقوفة', status: 'paused' },
  { label: 'مرفوضة', status: 'rejected' },
  { label: 'منتهية', status: 'expired' },
];

const rejectReasons = [
  'محتوى مخالف',
  'صور غير لائقة',
  'معلومات مضللة',
  'إعلان مكرر',
  'سعر وهمي',
  'أخرى',
];

const ListingsModeration = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabStatus>('pending_review');
  const [listings, setListings] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<TabStatus, number>>({} as any);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rejectModal, setRejectModal] = useState<{ open: boolean; listing: any | null }>({ open: false, listing: null });
  const [rejectReason, setRejectReason] = useState('');
  const [rejectNote, setRejectNote] = useState('');

  const fetchCounts = useCallback(async () => {
    const results = await Promise.all(
      tabs.map((t) =>
        supabase.from('listings').select('id', { count: 'exact', head: true }).eq('status', t.status)
      )
    );
    const c: any = {};
    tabs.forEach((t, i) => (c[t.status] = results[i].count ?? 0));
    setCounts(c);
  }, []);

  const fetchListings = useCallback(async (pageNum: number, append = false) => {
    if (append) setLoadingMore(true); else setLoading(true);
    setError(false);
    if (!append) setSelected(new Set());
    const from = pageNum * PAGE_SIZE;
    const { data, error: err } = await supabase
      .from('listings')
      .select('*, owner:profiles!listings_owner_id_fkey(full_name, is_verified), district:districts!listings_district_id_fkey(name_ar)')
      .eq('status', activeTab)
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (err) {
      setError(true);
      if (!append) setListings([]);
    } else {
      const list = data ?? [];
      setListings(prev => append ? [...prev, ...list] : list);
      setHasMore(list.length === PAGE_SIZE);
    }
    setLoading(false);
    setLoadingMore(false);
  }, [activeTab]);

  useEffect(() => {
    setPage(0);
    fetchCounts();
    fetchListings(0);
  }, [fetchCounts, fetchListings]);

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchListings(next, true);
  };

  const approveListing = async (listing: any) => {
    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
    await supabase
      .from('listings')
      .update({ status: 'active' as any, published_at: new Date().toISOString(), expires_at: expiresAt })
      .eq('id', listing.id);
    await supabase.from('notifications').insert({
      type: 'listing_approved' as any,
      user_id: listing.owner_id,
      title_ar: 'تم قبول إعلانك',
      body_ar: `تمت مراجعة إعلانك "${listing.title}" وتم نشره`,
    });
    toast.success('تم قبول الإعلان');
    fetchListings(0);
    fetchCounts();
  };

  const confirmReject = async () => {
    if (!rejectModal.listing) return;
    const l = rejectModal.listing;
    const note = `${rejectReason}${rejectNote ? ' — ' + rejectNote : ''}`;
    await supabase.from('listings').update({ status: 'rejected' as any, moderation_note: note }).eq('id', l.id);
    await supabase.from('notifications').insert({
      type: 'listing_rejected' as any,
      user_id: l.owner_id,
      title_ar: 'تم رفض إعلانك',
      body_ar: `تم رفض إعلانك "${l.title}" — السبب: ${rejectReason}`,
    });
    toast.success('تم رفض الإعلان');
    setRejectModal({ open: false, listing: null });
    setRejectReason('');
    setRejectNote('');
    fetchListings(0);
    fetchCounts();
  };

  const bulkApprove = async () => {
    for (const id of selected) {
      const l = listings.find((x) => x.id === id);
      if (l) await approveListing(l);
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const toggleAll = () => {
    if (selected.size === listings.length) setSelected(new Set());
    else setSelected(new Set(listings.map((l) => l.id)));
  };

  const fortyFiveDaysAgo = Date.now() - 45 * 24 * 60 * 60 * 1000;

  const categoryMap: Record<string, string> = {
    room: 'غرفة', apartment: 'شقة', house: 'بيت', floor: 'دور', shop: 'محل',
    office: 'مكتب', shared: 'مشترك', family: 'عائلي', student: 'طلاب',
  };

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold text-foreground mb-4">إدارة الإعلانات</h1>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-4 pb-1">
        {tabs.map((t) => (
          <button
            key={t.status}
            onClick={() => setActiveTab(t.status)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm whitespace-nowrap transition-colors',
              activeTab === t.status ? 'bg-accent text-accent-foreground font-semibold' : 'bg-muted text-muted-foreground'
            )}
          >
            {t.label}
            <Badge variant="secondary" className="text-[10px] h-5 min-w-5 px-1">{counts[t.status] ?? 0}</Badge>
          </button>
        ))}
      </div>

      {/* Bulk bar */}
      {selected.size > 0 && activeTab === 'pending_review' && (
        <div className="flex items-center gap-3 mb-3 p-3 bg-muted rounded-xl">
          <span className="text-sm font-medium">{selected.size} محدد</span>
          <Button size="sm" onClick={bulkApprove} className="bg-success text-success-foreground">
            موافقة على الكل
          </Button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
        </div>
      ) : error ? (
        <ErrorState onRetry={() => fetchListings(0)} />
      ) : listings.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">لا توجد إعلانات</p>
      ) : (
        <div className="space-y-3">
          {activeTab === 'pending_review' && (
            <div className="flex items-center gap-2 px-1">
              <Checkbox checked={selected.size === listings.length} onCheckedChange={toggleAll} />
              <span className="text-xs text-muted-foreground">تحديد الكل</span>
            </div>
          )}
          {listings.map((l) => {
            const isStale = l.last_updated_at && new Date(l.last_updated_at).getTime() < fortyFiveDaysAgo;
            return (
              <div key={l.id} className="bg-card border border-border rounded-2xl p-3 flex gap-3 items-start">
                {activeTab === 'pending_review' && (
                  <Checkbox
                    checked={selected.has(l.id)}
                    onCheckedChange={() => toggleSelect(l.id)}
                    className="mt-1"
                  />
                )}
                <div className="w-[60px] h-[60px] rounded-xl bg-muted shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-foreground line-clamp-1">{l.title}</span>
                    <Badge variant="outline" className="text-[10px]">{categoryMap[l.category] ?? l.category}</Badge>
                    {isStale && <Badge className="bg-orange-500 text-white text-[10px]">قديم</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {l.owner?.full_name} {l.owner?.is_verified && '✓'} · {l.district?.name_ar ?? '—'} · {l.price} ر.ي
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {l.created_at ? format(new Date(l.created_at), 'dd MMM yyyy', { locale: ar }) : ''}
                    {l.quality_score != null && (
                      <span className={cn(
                        'mr-2 px-1.5 py-0.5 rounded text-[10px] font-medium',
                        l.quality_score >= 70 ? 'bg-green-100 text-green-700' :
                        l.quality_score >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                      )}>
                        جودة {l.quality_score}
                      </span>
                    )}
                  </p>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {activeTab === 'pending_review' && (
                      <>
                        <Button size="sm" className="bg-success text-success-foreground h-8" onClick={() => approveListing(l)}>
                          <Check className="h-4 w-4" /> موافقة
                        </Button>
                        <Button size="sm" variant="destructive" className="h-8" onClick={() => setRejectModal({ open: true, listing: l })}>
                          <X className="h-4 w-4" /> رفض
                        </Button>
                      </>
                    )}
                    {activeTab === 'active' && (
                      <Button size="sm" variant="outline" className="h-8" onClick={async () => {
                        await supabase.from('listings').update({ status: 'paused' as any }).eq('id', l.id);
                        await supabase.from('notifications').insert({
                          type: 'system' as any,
                          user_id: l.owner_id,
                          title_ar: 'تم إيقاف إعلانك',
                          body_ar: `تم إيقاف إعلانك "${l.title}" من قبل الإدارة`,
                          link: `/listings/${l.id}`,
                        });
                        toast.success('تم إيقاف الإعلان');
                        fetchListings(0);
                        fetchCounts();
                      }}>
                        إيقاف
                      </Button>
                    )}
                    <a href={`/listings/${l.id}`} target="_blank" rel="noreferrer">
                      <Button size="sm" variant="ghost" className="h-8">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
          {hasMore && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="mx-auto mt-2 block rounded-lg border border-border bg-card px-6 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              {loadingMore ? 'جاري التحميل...' : 'تحميل المزيد'}
            </button>
          )}
        </div>
      )}

      {/* Reject modal */}
      <Dialog open={rejectModal.open} onOpenChange={(open) => !open && setRejectModal({ open: false, listing: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>رفض الإعلان</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-2">{rejectModal.listing?.title}</p>
          <Select value={rejectReason} onValueChange={setRejectReason}>
            <SelectTrigger><SelectValue placeholder="سبب الرفض" /></SelectTrigger>
            <SelectContent>
              {rejectReasons.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
          <Textarea placeholder="ملاحظة إضافية (اختياري)" value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} />
          <DialogFooter>
            <Button variant="destructive" onClick={confirmReject} disabled={!rejectReason}>تأكيد الرفض</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default ListingsModeration;
