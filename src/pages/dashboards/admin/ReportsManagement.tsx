import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { MoreHorizontal, Flag } from 'lucide-react';
import { toast } from 'sonner';
import { ErrorState } from '@/components/ui/ErrorState';
import { createNotificationService } from '@/services';

const PAGE_SIZE = 30;

type TabStatus = 'pending' | 'reviewed' | 'resolved' | 'dismissed';

const tabList: { label: string; status: TabStatus }[] = [
  { label: 'معلقة', status: 'pending' },
  { label: 'تمت المراجعة', status: 'reviewed' },
  { label: 'محلولة', status: 'resolved' },
  { label: 'مرفوضة', status: 'dismissed' },
];

const reasonMap: Record<string, string> = {
  fake: 'محتوى وهمي', duplicate: 'مكرر', inappropriate: 'غير لائق', spam: 'سبام',
  wrong_price: 'سعر خاطئ', already_rented: 'مؤجر بالفعل', other: 'أخرى',
};
const targetMap: Record<string, string> = { listing: 'إعلان', user: 'مستخدم', request: 'طلب' };

const listingStatusMap: Record<string, string> = {
  draft: 'مسودة',
  pending_review: 'قيد المراجعة',
  active: 'نشط',
  paused: 'موقوف',
  rented: 'مؤجَّر',
  expired: 'منتهي',
  rejected: 'مرفوض',
  private_offer: 'عرض خاص',
  reserved: 'محجوز',
  negotiating: 'قيد التفاوض',
};

const reportStatusMap: Record<string, string> = {
  pending: 'معلق',
  reviewed: 'تمت المراجعة',
  resolved: 'محلول',
  dismissed: 'مرفوض',
};

const ReportsManagement = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabStatus>('pending');
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<any | null>(null);
  const [confirmSuspend, setConfirmSuspend] = useState<any | null>(null);
  const [listingMeta, setListingMeta] = useState<Record<string, any>>({});
  const [listingReportCounts, setListingReportCounts] = useState<Record<string, { total: number; items: { status: string; reason: string }[] }>>({});

  const fetchReports = useCallback(async (pageNum: number, append = false) => {
    if (append) setLoadingMore(true); else setLoading(true);
    setError(false);
    const from = pageNum * PAGE_SIZE;
    const { data, error: err } = await supabase
      .from('reports')
      .select('*, reporter:profiles!reports_reporter_id_fkey(full_name), resolver:profiles!reports_resolved_by_fkey(full_name)')
      .eq('status', activeTab)
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (err) {
      setError(true);
      if (!append) setReports([]);
      setLoading(false);
      setLoadingMore(false);
      return;
    }
    const list = data ?? [];
    setReports(prev => append ? [...prev, ...list] : list);
    setHasMore(list.length === PAGE_SIZE);

    const listingIds = Array.from(new Set(
      list.filter((r: any) => r.target_type === 'listing').map((r: any) => r.target_id as string)
    ));
    if (listingIds.length === 0) {
      if (!append) {
        setListingMeta({});
        setListingReportCounts({});
      }
      setLoading(false);
      setLoadingMore(false);
      return;
    }

    try {
      const [listingsRes, countsRes] = await Promise.all([
        supabase.from('listings')
          .select('id, title, price, status, profiles!owner_id(full_name, avatar_url), listing_images(id, url, is_primary, sort_order)')
          .in('id', listingIds),
        supabase.from('reports')
          .select('target_id, status, reason')
          .eq('target_type', 'listing')
          .in('target_id', listingIds),
      ]);

      const metaById: Record<string, any> = {};
      for (const l of (listingsRes.data ?? [])) metaById[l.id] = l;

      const countsById: Record<string, { total: number; items: { status: string; reason: string }[] }> = {};
      for (const row of (countsRes.data ?? [])) {
        const c = countsById[row.target_id] ?? (countsById[row.target_id] = { total: 0, items: [] });
        c.total += 1;
        c.items.push({ status: row.status, reason: row.reason });
      }

      setListingMeta(prev => ({ ...(append ? prev : {}), ...metaById }));
      setListingReportCounts(prev => {
        const base = append ? { ...prev } : {};
        for (const [id, val] of Object.entries(countsById)) base[id] = val;
        return base;
      });
    } catch (e) {
      console.error('listing meta fetch error', e);
      if (!append) {
        setListingMeta({});
        setListingReportCounts({});
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [activeTab]);

  useEffect(() => { setPage(0); fetchReports(0); }, [fetchReports]);

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchReports(next, true);
  };

  const resolve = async (id: string, reporterId?: string) => {
    try {
      const { error } = await supabase.from('reports').update({ status: 'resolved' as any, resolved_by: user!.id }).eq('id', id);
      if (error) {
        toast.error('فشل حل البلاغ، حاول مرة أخرى');
        return;
      }
      if (reporterId) {
        createNotificationService(supabase).create('system', reporterId, {
          titleAr: 'تم حل البلاغ',
          bodyAr: 'تمت مراجعة بلاغك واتخاذ الإجراء المناسب',
          link: '/notifications',
        }).catch(console.error);
      }
      toast.success('تم حل البلاغ');
      fetchReports(0);
    } catch (e) {
      console.error('resolve error', e);
      toast.error('حدث خطأ أثناء حل البلاغ');
    }
  };

  const dismiss = async (id: string, reporterId?: string) => {
    try {
      const { error } = await supabase.from('reports').update({ status: 'dismissed' as any, resolved_by: user!.id }).eq('id', id);
      if (error) {
        toast.error('فشل رفض البلاغ، حاول مرة أخرى');
        return;
      }
      if (reporterId) {
        createNotificationService(supabase).create('system', reporterId, {
          titleAr: 'تحديث على بلاغك',
          bodyAr: 'تمت مراجعة بلاغك ولم يتم العثور على مخالفة',
          link: '/notifications',
        }).catch(console.error);
      }
      toast.success('تم رفض البلاغ');
      fetchReports(0);
    } catch (e) {
      console.error('dismiss error', e);
      toast.error('حدث خطأ أثناء رفض البلاغ');
    }
  };

  const removeListing = async (r: any) => {
    try {
      if (r.target_type === 'listing') {
        const { error: listingErr } = await supabase.from('listings').update({ status: 'rejected' as any }).eq('id', r.target_id);
        if (listingErr) {
          toast.error('فشل إزالة الإعلان');
          return;
        }
        const { data: listing } = await supabase.from('listings').select('owner_id, title').eq('id', r.target_id).single();
        if (listing) {
          createNotificationService(supabase).create('listing_rejected', listing.owner_id, {
            titleAr: 'تم إزالة إعلانك',
            bodyAr: `تم إزالة إعلانك "${listing.title}" بسبب بلاغ مقدم`,
            link: `/listings/${r.target_id}`,
          }).catch(console.error);
        }
      }
      const { error } = await supabase.from('reports').update({ status: 'resolved' as any, resolved_by: user!.id }).eq('id', r.id);
      if (error) {
        toast.error('تمت إزالة الإعلان لكن فشل تحديث حالة البلاغ');
        return;
      }
      if (r.reporter_id) {
        createNotificationService(supabase).create('system', r.reporter_id, {
          titleAr: 'تم حل البلاغ',
          bodyAr: 'تمت مراجعة بلاغك واتخاذ الإجراء المناسب',
          link: '/notifications',
        }).catch(console.error);
      }
      toast.success('تمت إزالة الإعلان وحل البلاغ');
      fetchReports(0);
    } catch (e) {
      console.error('removeListing error', e);
      toast.error('حدث خطأ أثناء إزالة الإعلان');
    }
  };

  const warnUser = async (r: any) => {
    try {
      const targetUserId = r.target_type === 'user' ? r.target_id : null;
      if (targetUserId) {
        createNotificationService(supabase).create('system', targetUserId, {
          titleAr: 'تحذير من الإدارة',
          bodyAr: 'تم تلقي بلاغ بخصوص حسابك. يرجى الالتزام بسياسة الاستخدام.',
        }).catch(console.error);
      }
      const { error } = await supabase.from('reports').update({ status: 'resolved' as any, resolved_by: user!.id }).eq('id', r.id);
      if (error) {
        toast.error('فشل إرسال التحذير');
        return;
      }
      if (r.reporter_id) {
        createNotificationService(supabase).create('system', r.reporter_id, {
          titleAr: 'تم حل البلاغ',
          bodyAr: 'تمت مراجعة بلاغك واتخاذ الإجراء المناسب',
          link: '/notifications',
        }).catch(console.error);
      }
      toast.success('تم إرسال التحذير وإنهاء البلاغ');
      fetchReports(0);
    } catch (e) {
      console.error('warnUser error', e);
      toast.error('حدث خطأ أثناء إرسال التحذير');
    }
  };

  const suspendUser = async (r: any) => {
    try {
      const targetUserId = r.target_type === 'user' ? r.target_id : null;
      if (targetUserId) {
        const { error: pErr } = await supabase.from('profiles').update({ is_active: false }).eq('id', targetUserId);
        if (pErr) {
          toast.error('فشل تعليق الحساب');
          return;
        }
        createNotificationService(supabase).create('system', targetUserId, {
          titleAr: 'تم تعليق حسابك',
          bodyAr: 'تم تعليق حسابك بسبب مخالفة سياسة الاستخدام. تواصل مع الإدارة للاستفسار.',
        }).catch(console.error);
      }
      const { error } = await supabase.from('reports').update({ status: 'resolved' as any, resolved_by: user!.id }).eq('id', r.id);
      if (error) {
        toast.error('تم تعليق الحساب لكن فشل تحديث حالة البلاغ');
        return;
      }
      if (r.reporter_id) {
        createNotificationService(supabase).create('system', r.reporter_id, {
          titleAr: 'تم حل البلاغ',
          bodyAr: 'تمت مراجعة بلاغك واتخاذ الإجراء المناسب',
          link: '/notifications',
        }).catch(console.error);
      }
      toast.success('تم تعليق الحساب وحل البلاغ');
      fetchReports(0);
    } catch (e) {
      console.error('suspendUser error', e);
      toast.error('حدث خطأ أثناء تعليق الحساب');
    }
  };

  const targetLink = (r: any) => {
    if (r.target_type === 'listing') return `/listings/${r.target_id}`;
    if (r.target_type === 'user') return `/profile/${r.target_id}`;
    if (r.target_type === 'request') return `/requests/${r.target_id}`;
    return '#';
  };

  return (
    <>
      <h1 className="text-2xl font-bold text-foreground mb-4">إدارة البلاغات</h1>

      <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-4 pb-1">
        {tabList.map((t) => (
          <button
            key={t.status}
            onClick={() => setActiveTab(t.status)}
            className={cn(
              'px-3 py-2 rounded-xl text-sm whitespace-nowrap transition-colors',
              activeTab === t.status ? 'bg-accent text-accent-foreground font-semibold' : 'bg-muted text-muted-foreground'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" /></div>
      ) : error ? (
        <ErrorState onRetry={() => fetchReports(0)} />
      ) : reports.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">لا توجد بلاغات</p>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => {
            const meta = r.target_type === 'listing' ? listingMeta[r.target_id as string] : undefined;
            const counts = r.target_type === 'listing' ? listingReportCounts[r.target_id as string] : undefined;
            const listingImages: any[] = meta?.listing_images ?? [];
            const img = listingImages.find((i: any) => i.is_primary)
              ?? listingImages.slice().sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0];
            return (
            <div key={r.id} className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-foreground text-sm">{r.reporter?.full_name ?? '—'}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.created_at ? format(new Date(r.created_at), 'dd MMM yyyy', { locale: ar }) : ''}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="flex gap-1.5">
                    <Badge variant="outline" className="text-xs">{targetMap[r.target_type] ?? r.target_type}</Badge>
                    <Badge className="bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300 text-xs">{reasonMap[r.reason] ?? r.reason}</Badge>
                  </div>
                  {r.target_type === 'listing' && meta?.status && (
                    <Badge variant="outline" className="text-xs">{listingStatusMap[meta.status] ?? meta.status}</Badge>
                  )}
                </div>
              </div>

              {r.target_type === 'listing' && (meta ? (
                <div className="mt-3 flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-3">
                  {img ? (
                    <img src={img.url} alt="" className="h-12 w-12 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                      <Flag className="h-5 w-5" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <Link to={`/listings/${r.target_id}`} className="block truncate text-sm font-bold text-foreground hover:text-accent">
                      {meta.title || '—'}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      المالك: {meta.profiles?.full_name ?? '—'}
                      {meta.price != null && <span className="ms-2 font-semibold text-accent">{Number(meta.price).toLocaleString('en-GB')} ريال</span>}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mt-3 rounded-xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                  تعذّر جلب معلومات الإعلان
                </div>
              ))}

              {r.notes && (
                <p className="mt-2 text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">وصف المبلّغ: </span>{r.notes}
                </p>
              )}

              {r.target_type === 'listing' && counts && counts.total > 0 && (
                <div className="mt-2 rounded-xl border border-border bg-muted/40 p-2.5">
                  <p className="text-xs font-semibold text-foreground">بلاغات على هذا الإعلان: {counts.total}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {counts.items.map((it, i) => (
                      <Badge key={i} variant="outline" className="text-[10px]">
                        {reasonMap[it.reason] ?? it.reason} · {reportStatusMap[it.status] ?? it.status}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <Link to={targetLink(r)}>
                  <Button size="sm" variant="outline" className="h-8 text-xs">عرض المُبلَّغ عنه</Button>
                </Link>
                {activeTab === 'pending' && (
                  <>
                    <Button size="sm" className="h-8 text-xs bg-success text-success-foreground" onClick={() => resolve(r.id, r.reporter_id)}>حل البلاغ</Button>
                    <Button size="sm" variant="destructive" className="h-8 text-xs" onClick={() => dismiss(r.id, r.reporter_id)}>رفض البلاغ</Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="ghost" className="h-8"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {r.target_type === 'listing' && (
                          <DropdownMenuItem onClick={() => setConfirmRemove(r)}>إزالة الإعلان</DropdownMenuItem>
                        )}
                        {r.target_type === 'user' && (
                          <>
                            <DropdownMenuItem onClick={() => warnUser(r)}>تحذير المستخدم</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setConfirmSuspend(r)}>تعليق الحساب</DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                )}
              </div>
            </div>
            );
          })}
          {hasMore && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="mt-2 block rounded-lg border border-border bg-card px-6 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              {loadingMore ? 'جاري التحميل...' : 'تحميل المزيد'}
            </button>
          )}
        </div>
      )}

      {/* Confirm remove listing */}
      <AlertDialog open={!!confirmRemove} onOpenChange={(o) => !o && setConfirmRemove(null)}>
        <AlertDialogContent dir="rtl" className="font-tajawal">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد إزالة الإعلان</AlertDialogTitle>
            <AlertDialogDescription>هل أنت متأكد من إزالة هذا الإعلان؟ سيتم تغيير حالته إلى مرفوض.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel onClick={() => setConfirmRemove(null)}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                const r = confirmRemove;
                setConfirmRemove(null);
                if (r) removeListing(r);
              }}
            >
              تأكيد الإزالة
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm suspend account */}
      <AlertDialog open={!!confirmSuspend} onOpenChange={(o) => !o && setConfirmSuspend(null)}>
        <AlertDialogContent dir="rtl" className="font-tajawal">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد تعليق الحساب</AlertDialogTitle>
            <AlertDialogDescription>هل أنت متأكد من تعليق حساب هذا المستخدم؟ سيتم تعطيله فورًا.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel onClick={() => setConfirmSuspend(null)}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                const r = confirmSuspend;
                setConfirmSuspend(null);
                if (r) suspendUser(r);
              }}
            >
              تأكيد التعليق
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ReportsManagement;
