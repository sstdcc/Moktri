import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';

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

const ReportsManagement = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabStatus>('pending');
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('reports')
      .select('*, reporter:profiles!reports_reporter_id_fkey(full_name), resolver:profiles!reports_resolved_by_fkey(full_name)')
      .eq('status', activeTab)
      .order('created_at', { ascending: false });
    setReports(data ?? []);
    setLoading(false);
  }, [activeTab]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  const resolve = async (id: string, reporterId?: string) => {
    await supabase.from('reports').update({ status: 'resolved' as any, resolved_by: user!.id }).eq('id', id);
    if (reporterId) {
      await supabase.from('notifications').insert({
        type: 'system' as any,
        user_id: reporterId,
        title_ar: 'تم حل البلاغ',
        body_ar: 'تمت مراجعة بلاغك واتخاذ الإجراء المناسب',
        link: '/notifications',
      });
    }
    toast.success('تم حل البلاغ');
    fetchReports();
  };

  const dismiss = async (id: string, reporterId?: string) => {
    await supabase.from('reports').update({ status: 'dismissed' as any, resolved_by: user!.id }).eq('id', id);
    if (reporterId) {
      await supabase.from('notifications').insert({
        type: 'system' as any,
        user_id: reporterId,
        title_ar: 'تحديث على بلاغك',
        body_ar: 'تمت مراجعة بلاغك ولم يتم العثور على مخالفة',
        link: '/notifications',
      });
    }
    toast.success('تم رفض البلاغ');
    fetchReports();
  };

  const removeListing = async (r: any) => {
    if (r.target_type === 'listing') {
      await supabase.from('listings').update({ status: 'rejected' as any }).eq('id', r.target_id);
      // Notify the listing owner
      const { data: listing } = await supabase.from('listings').select('owner_id, title').eq('id', r.target_id).single();
      if (listing) {
        await supabase.from('notifications').insert({
          type: 'listing_rejected' as any,
          user_id: listing.owner_id,
          title_ar: 'تم إزالة إعلانك',
          body_ar: `تم إزالة إعلانك "${listing.title}" بسبب بلاغ مقدم`,
          link: `/listings/${r.target_id}`,
        });
      }
    }
    await resolve(r.id, r.reporter_id);
  };

  const warnUser = async (r: any) => {
    const targetUserId = r.target_type === 'user' ? r.target_id : null;
    if (targetUserId) {
      await supabase.from('notifications').insert({
        type: 'system' as any,
        user_id: targetUserId,
        title_ar: 'تحذير من الإدارة',
        body_ar: 'تم تلقي بلاغ بخصوص حسابك. يرجى الالتزام بسياسة الاستخدام.',
      });
    }
    toast.success('تم إرسال التحذير');
  };

  const suspendUser = async (r: any) => {
    const targetUserId = r.target_type === 'user' ? r.target_id : null;
    if (targetUserId) {
      await supabase.from('profiles').update({ is_active: false }).eq('id', targetUserId);
      await supabase.from('notifications').insert({
        type: 'system' as any,
        user_id: targetUserId,
        title_ar: 'تم تعليق حسابك',
        body_ar: 'تم تعليق حسابك بسبب مخالفة سياسة الاستخدام. تواصل مع الإدارة للاستفسار.',
      });
    }
    await resolve(r.id, r.reporter_id);
    toast.success('تم تعليق الحساب');
  };

  const targetLink = (r: any) => {
    if (r.target_type === 'listing') return `/listings/${r.target_id}`;
    if (r.target_type === 'user') return `/profile/${r.target_id}`;
    if (r.target_type === 'request') return `/requests/${r.target_id}`;
    return '#';
  };

  return (
    <AdminLayout>
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
      ) : reports.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">لا توجد بلاغات</p>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <div key={r.id} className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-foreground text-sm">{r.reporter?.full_name ?? '—'}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.created_at ? format(new Date(r.created_at), 'dd MMM yyyy', { locale: ar }) : ''}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <Badge variant="outline" className="text-xs">{targetMap[r.target_type] ?? r.target_type}</Badge>
                  <Badge className="bg-red-100 text-red-700 text-xs">{reasonMap[r.reason] ?? r.reason}</Badge>
                </div>
              </div>
              {r.notes && <p className="text-sm text-muted-foreground mt-2">{r.notes}</p>}
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <a href={targetLink(r)} target="_blank" rel="noreferrer">
                  <Button size="sm" variant="outline" className="h-8 text-xs">عرض المُبلَّغ عنه</Button>
                </a>
                {activeTab === 'pending' && (
                  <>
                    <Button size="sm" className="h-8 text-xs bg-success text-success-foreground" onClick={() => resolve(r.id)}>حل البلاغ</Button>
                    <Button size="sm" variant="destructive" className="h-8 text-xs" onClick={() => dismiss(r.id)}>رفض البلاغ</Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="ghost" className="h-8"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {r.target_type === 'listing' && (
                          <DropdownMenuItem onClick={() => removeListing(r)}>إزالة الإعلان</DropdownMenuItem>
                        )}
                        {r.target_type === 'user' && (
                          <>
                            <DropdownMenuItem onClick={() => warnUser(r)}>تحذير المستخدم</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => suspendUser(r)}>تعليق الحساب</DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  );
};

export default ReportsManagement;
