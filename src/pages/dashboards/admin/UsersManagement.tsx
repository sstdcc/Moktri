import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { VerifiedBadge } from '@/components/ui/VerifiedBadge';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Search } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toast } from 'sonner';
import { ErrorState } from '@/components/ui/ErrorState';

const roleMap: Record<string, string> = {
  renter: 'مستأجر', owner: 'مالك', broker: 'دلال', admin: 'مدير', moderator: 'مشرف',
};

interface Stats { total: number; owners: number; renters: number; banned: number; }

const PAGE_SIZE = 50;

const UsersManagement = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [verifiedFilter, setVerifiedFilter] = useState('all');
  const [roleModal, setRoleModal] = useState<{ open: boolean; user: any | null }>({ open: false, user: null });
  const [newRole, setNewRole] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const stats: Stats = {
    total: users.length,
    owners: users.filter(u => u.role === 'owner' || u.role === 'broker').length,
    renters: users.filter(u => u.role === 'renter').length,
    banned: users.filter(u => u.is_active === false).length,
  };

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(false);
    setVisibleCount(PAGE_SIZE);
    const params = {
      _search: search || null,
      _role: roleFilter,
      _status: statusFilter,
      _verified: verifiedFilter,
      _limit: 500,
    };
    console.info('[UsersManagement] admin_list_users params', params);
    const { data, error: err } = await supabase.rpc('admin_list_users', params);
    if (err) {
      console.error('[UsersManagement] admin_list_users failed', {
        code: (err as any).code,
        message: err.message,
        details: (err as any).details,
        hint: (err as any).hint,
      });
      setError(true);
      setUsers([]);
    } else {
      console.info('[UsersManagement] admin_list_users ok', { count: data?.length ?? 0 });
      setUsers(data ?? []);
    }
    setLoading(false);
  }, [search, roleFilter, statusFilter, verifiedFilter]);

  const loadMore = () => {
    setLoadingMore(true);
    setTimeout(() => {
      setVisibleCount(c => c + PAGE_SIZE);
      setLoadingMore(false);
    }, 100);
  };

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const toggleActive = async (u: any) => {
    const { error } = await supabase.from('profiles').update({ is_active: !u.is_active }).eq('id', u.id);
    if (error) { toast.error(error.message); return; }
    toast.success(u.is_active ? 'تم حظر الحساب' : 'تم رفع الحظر');
    fetchUsers();
    
  };

  const toggleVerified = async (u: any) => {
    const { error } = await supabase
      .from('profiles')
      .update({
        is_verified: !u.is_verified,
        verification_badge: !u.is_verified ? 'verified' : 'none',
      })
      .eq('id', u.id);
    if (error) { toast.error(error.message); return; }
    toast.success(u.is_verified ? 'تم إلغاء التوثيق' : 'تم توثيق المستخدم');
    fetchUsers();
  };

  const changeRole = async () => {
    if (!roleModal.user || !newRole) return;
    await supabase.from('profiles').update({ role: newRole as any }).eq('id', roleModal.user.id);
    toast.success('تم تغيير الدور');
    setRoleModal({ open: false, user: null });
    fetchUsers();
  };

  return (
    <>
      <h1 className="text-2xl font-bold text-foreground mb-4">إدارة المستخدمين</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {[
          { label: 'إجمالي المستخدمين', value: stats.total, color: 'text-primary' },
          { label: 'الملاك', value: stats.owners, color: 'text-accent' },
          { label: 'المستأجرون', value: stats.renters, color: 'text-foreground' },
          { label: 'محظورون', value: stats.banned, color: 'text-destructive' },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-2xl p-3">
            <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="بحث بالاسم أو الهاتف..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pr-10"
        />
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide pb-1">
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-28 h-9 text-xs"><SelectValue placeholder="الدور" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">الكل</SelectItem>
            <SelectItem value="renter">مستأجر</SelectItem>
            <SelectItem value="owner">مالك</SelectItem>
            <SelectItem value="broker">دلال</SelectItem>
            <SelectItem value="admin">مدير</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-28 h-9 text-xs"><SelectValue placeholder="الحالة" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">الكل</SelectItem>
            <SelectItem value="active">نشط</SelectItem>
            <SelectItem value="suspended">موقوف</SelectItem>
          </SelectContent>
        </Select>
        <Select value={verifiedFilter} onValueChange={setVerifiedFilter}>
          <SelectTrigger className="w-28 h-9 text-xs"><SelectValue placeholder="التوثيق" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">الكل</SelectItem>
            <SelectItem value="verified">موثق</SelectItem>
            <SelectItem value="unverified">غير موثق</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="text-sm text-muted-foreground mb-3">{users.length} مستخدم</p>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" /></div>
      ) : error ? (
        <ErrorState onRetry={fetchUsers} />
      ) : users.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">لا يوجد مستخدمون</p>
      ) : (
        <div className="space-y-3">
          {users.slice(0, visibleCount).map((u) => (
            <div key={u.id} className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                {u.full_name?.charAt(0) || '؟'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-foreground text-sm">{u.full_name}</span>
                  <Badge variant="outline" className="text-[10px]">{roleMap[u.role] ?? u.role}</Badge>
                  {u.is_verified && <VerifiedBadge size="sm" />}
                </div>
                <p className="text-xs text-muted-foreground">{u.phone}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`w-2 h-2 rounded-full ${u.is_active ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="text-xs text-muted-foreground">
                    {u.created_at ? format(new Date(u.created_at), 'dd MMM yyyy', { locale: ar }) : ''}
                  </span>
                  {(u.role === 'owner' || u.role === 'broker') && (
                    <span className="text-xs text-muted-foreground">{u.total_listings ?? 0} إعلان</span>
                  )}
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <a href={`/profile/${u.id}`} target="_blank" rel="noreferrer">عرض الملف الشخصي</a>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { setRoleModal({ open: true, user: u }); setNewRole(u.role); }}>
                    تغيير الدور
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toggleVerified(u)}>
                    {u.is_verified ? 'إلغاء التوثيق' : 'توثيق المستخدم'}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => toggleActive(u)}
                    className={u.is_active ? 'text-destructive focus:text-destructive' : ''}
                  >
                    {u.is_active ? 'حظر الحساب' : 'رفع الحظر'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
          {visibleCount < users.length && (
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

      {/* Role change modal */}
      <Dialog open={roleModal.open} onOpenChange={(o) => !o && setRoleModal({ open: false, user: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تغيير دور {roleModal.user?.full_name}</DialogTitle>
          </DialogHeader>
          <RadioGroup value={newRole} onValueChange={setNewRole} className="space-y-2">
            {Object.entries(roleMap).map(([val, label]) => (
              <div key={val} className="flex items-center gap-2">
                <RadioGroupItem value={val} id={val} />
                <Label htmlFor={val}>{label}</Label>
              </div>
            ))}
          </RadioGroup>
          <DialogFooter>
            <Button onClick={changeRole}>تأكيد</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default UsersManagement;
