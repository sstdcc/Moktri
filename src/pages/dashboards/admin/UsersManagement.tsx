import { useEffect, useState, useCallback } from 'react';
import { VerifiedBadge } from '@/components/ui/VerifiedBadge';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
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

const roleMap: Record<string, string> = {
  renter: 'مستأجر', owner: 'مالك', broker: 'دلال', admin: 'مدير', moderator: 'مشرف',
};

const UsersManagement = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [verifiedFilter, setVerifiedFilter] = useState('all');
  const [roleModal, setRoleModal] = useState<{ open: boolean; user: any | null }>({ open: false, user: null });
  const [newRole, setNewRole] = useState('');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (search) {
      q = q.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%`);
    }
    if (roleFilter !== 'all') q = q.eq('role', roleFilter as any);
    if (statusFilter === 'active') q = q.eq('is_active', true);
    if (statusFilter === 'suspended') q = q.eq('is_active', false);
    if (verifiedFilter === 'verified') q = q.eq('is_verified', true);
    if (verifiedFilter === 'unverified') q = q.eq('is_verified', false);
    const { data } = await q;
    setUsers(data ?? []);
    setLoading(false);
  }, [search, roleFilter, statusFilter, verifiedFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const toggleActive = async (u: any) => {
    await supabase.from('profiles').update({ is_active: !u.is_active }).eq('id', u.id);
    toast.success(u.is_active ? 'تم تعليق الحساب' : 'تم تفعيل الحساب');
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
    <AdminLayout>
      <h1 className="text-2xl font-bold text-foreground mb-4">إدارة المستخدمين</h1>

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
      ) : users.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">لا يوجد مستخدمون</p>
      ) : (
        <div className="space-y-3">
          {users.map((u) => (
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
                  <DropdownMenuItem onClick={() => toggleActive(u)}>
                    {u.is_active ? 'تعليق الحساب' : 'تفعيل الحساب'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
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
    </AdminLayout>
  );
};

export default UsersManagement;
