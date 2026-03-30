import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Check, X, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

type TabStatus = 'pending' | 'approved' | 'rejected';

const tabList: { label: string; status: TabStatus }[] = [
  { label: 'معلقة', status: 'pending' },
  { label: 'مقبولة', status: 'approved' },
  { label: 'مرفوضة', status: 'rejected' },
];

const roleLabel: Record<string, string> = { owner: 'مالك عقار', broker: 'دلال عقارات' };

const VerificationsManagement = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabStatus>('pending');
  const [apps, setApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectModal, setRejectModal] = useState<{ open: boolean; app: any | null }>({ open: false, app: null });
  const [rejectReason, setRejectReason] = useState('');

  const fetchApps = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('verification_applications')
      .select('*, applicant:profiles!verification_applications_applicant_id_fkey(full_name, phone, role, verification_badge)')
      .eq('status', activeTab)
      .order('created_at', { ascending: false });
    setApps(data ?? []);
    setLoading(false);
  }, [activeTab]);

  useEffect(() => { fetchApps(); }, [fetchApps]);

  const approve = async (app: any) => {
    await supabase.from('profiles').update({ is_verified: true, verification_badge: 'verified' as any }).eq('id', app.applicant_id);
    await supabase.from('verification_applications').update({ status: 'approved' as any, reviewed_by: user!.id }).eq('id', app.id);
    await supabase.from('notifications').insert({
      type: 'verification_update' as any,
      user_id: app.applicant_id,
      title_ar: 'تم توثيق حسابك ✓',
      body_ar: 'تهانينا! تم التحقق من هويتك وأصبح حسابك موثقاً',
    });
    toast.success('تم قبول التوثيق');
    fetchApps();
  };

  const confirmReject = async () => {
    if (!rejectModal.app) return;
    const app = rejectModal.app;
    await supabase.from('profiles').update({ verification_badge: 'rejected' as any }).eq('id', app.applicant_id);
    await supabase.from('verification_applications').update({
      status: 'rejected' as any,
      review_note: rejectReason,
      reviewed_by: user!.id,
    }).eq('id', app.id);
    await supabase.from('notifications').insert({
      type: 'verification_update' as any,
      user_id: app.applicant_id,
      title_ar: 'تم رفض طلب التوثيق',
      body_ar: `للأسف، تم رفض طلب توثيق حسابك — السبب: ${rejectReason}`,
    });
    toast.success('تم رفض التوثيق');
    setRejectModal({ open: false, app: null });
    setRejectReason('');
    fetchApps();
  };

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold text-foreground mb-4">إدارة التوثيق</h1>

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
      ) : apps.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">لا توجد طلبات</p>
      ) : (
        <div className="space-y-3">
          {apps.map((a) => (
            <div key={a.id} className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold text-foreground">{a.applicant?.full_name}</p>
                  <p className="text-xs text-muted-foreground">{a.applicant?.phone}</p>
                </div>
                <Badge variant="outline" className="text-xs">{roleLabel[a.role] ?? a.role}</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {a.created_at ? format(new Date(a.created_at), 'dd MMM yyyy', { locale: ar }) : ''}
              </p>
              <div className="flex gap-2 mt-2 flex-wrap">
                {a.id_document_url && (
                  <a href={a.id_document_url} target="_blank" rel="noreferrer">
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                      <ExternalLink className="h-3 w-3" /> صورة الهوية
                    </Button>
                  </a>
                )}
                {a.business_document_url && (
                  <a href={a.business_document_url} target="_blank" rel="noreferrer">
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                      <ExternalLink className="h-3 w-3" /> وثيقة إضافية
                    </Button>
                  </a>
                )}
              </div>
              {a.notes && <p className="text-sm text-muted-foreground mt-2">{a.notes}</p>}
              {a.review_note && <p className="text-sm text-red-500 mt-2">ملاحظة: {a.review_note}</p>}

              {activeTab === 'pending' && (
                <div className="flex gap-2 mt-3">
                  <Button size="sm" className="bg-success text-success-foreground h-8" onClick={() => approve(a)}>
                    <Check className="h-4 w-4" /> قبول التوثيق
                  </Button>
                  <Button size="sm" variant="destructive" className="h-8" onClick={() => setRejectModal({ open: true, app: a })}>
                    <X className="h-4 w-4" /> رفض
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={rejectModal.open} onOpenChange={(o) => !o && setRejectModal({ open: false, app: null })}>
        <DialogContent>
          <DialogHeader><DialogTitle>رفض طلب التوثيق</DialogTitle></DialogHeader>
          <Textarea placeholder="سبب الرفض" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
          <DialogFooter>
            <Button variant="destructive" onClick={confirmReject} disabled={!rejectReason}>تأكيد الرفض</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default VerificationsManagement;
