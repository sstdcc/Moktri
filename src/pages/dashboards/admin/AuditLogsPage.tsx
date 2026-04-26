import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

type AuditLog = {
  id: string;
  admin_id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  details: any;
  created_at: string;
};

const actionLabels: Record<string, string> = {
  ban_user: 'حظر مستخدم',
  unban_user: 'رفع الحظر',
  verify_user: 'توثيق مستخدم',
  unverify_user: 'إلغاء التوثيق',
  change_verification_badge: 'تغيير شارة التوثيق',
  approve_listing: 'قبول إعلان',
  reject_listing: 'رفض إعلان',
  change_listing_status: 'تغيير حالة الإعلان',
  approve_rental: 'قبول إيجار',
  reject_rental: 'رفض إيجار',
  change_rental_status: 'تغيير حالة الإيجار',
  approve_verification: 'قبول طلب توثيق',
  reject_verification: 'رفض طلب توثيق',
  change_verification_status: 'تغيير حالة التوثيق',
};

const targetLabels: Record<string, string> = {
  profile: 'مستخدم',
  listing: 'إعلان',
  rental: 'إيجار',
  verification_application: 'طلب توثيق',
};

const destructiveActions = new Set(['ban_user', 'unverify_user', 'reject_listing', 'reject_rental', 'reject_verification']);

const AuditLogsPage = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [admins, setAdmins] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from('admin_audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(300);
    const list = (data ?? []) as AuditLog[];
    setLogs(list);

    const adminIds = Array.from(new Set(list.map((l) => l.admin_id)));
    if (adminIds.length) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', adminIds);
      const map: Record<string, string> = {};
      (profs ?? []).forEach((p: any) => { map[p.id] = p.full_name; });
      setAdmins(map);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const filtered = logs.filter((l) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (actionLabels[l.action] ?? l.action).toLowerCase().includes(q) ||
      (targetLabels[l.target_type] ?? l.target_type).toLowerCase().includes(q) ||
      (admins[l.admin_id] ?? '').toLowerCase().includes(q) ||
      (l.target_id ?? '').toLowerCase().includes(q)
    );
  });

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold text-foreground mb-4">سجل إجراءات المسؤولين</h1>

      <Input
        placeholder="بحث (إجراء، نوع، مسؤول، معرف)"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-4 max-w-md"
      />

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">لا توجد سجلات</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((l) => (
            <div key={l.id} className="bg-card border border-border rounded-xl p-3">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={destructiveActions.has(l.action) ? 'destructive' : 'default'} className="text-xs">
                    {actionLabels[l.action] ?? l.action}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {targetLabels[l.target_type] ?? l.target_type}
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(l.created_at), 'dd MMM yyyy HH:mm', { locale: ar })}
                </span>
              </div>
              <p className="text-sm text-foreground mt-2">
                المسؤول: <span className="font-semibold">{admins[l.admin_id] ?? l.admin_id.slice(0, 8)}</span>
              </p>
              {l.target_id && (
                <p className="text-xs text-muted-foreground mt-1" dir="ltr">
                  target: {l.target_id}
                </p>
              )}
              {l.details && (
                <pre className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-2 mt-2 overflow-x-auto" dir="ltr">
                  {JSON.stringify(l.details, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  );
};

export default AuditLogsPage;
