import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil } from 'lucide-react';
import { toast } from 'sonner';

const DistrictsManagement = () => {
  const [districts, setDistricts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNameAr, setNewNameAr] = useState('');
  const [newNameEn, setNewNameEn] = useState('');
  const [newCity, setNewCity] = useState('تعز');
  const [editModal, setEditModal] = useState<{ open: boolean; district: any | null }>({ open: false, district: null });
  const [editName, setEditName] = useState('');
  const [editCity, setEditCity] = useState('');

  const fetchDistricts = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('districts').select('*').order('city').order('name_ar');
    setDistricts(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchDistricts(); }, [fetchDistricts]);

  const addDistrict = async () => {
    if (!newNameAr.trim()) return;
    await supabase.from('districts').insert({ name_ar: newNameAr.trim(), name_en: newNameEn.trim() || null, city: newCity.trim() || 'تعز' });
    toast.success('تم إضافة الحي');
    setNewNameAr('');
    setNewNameEn('');
    setNewCity('تعز');
    fetchDistricts();
  };

  const toggleActive = async (d: any) => {
    await supabase.from('districts').update({ is_active: !d.is_active }).eq('id', d.id);
    toast.success(d.is_active ? 'تم تعطيل الحي' : 'تم تفعيل الحي');
    fetchDistricts();
  };

  const saveEdit = async () => {
    if (!editModal.district || !editName.trim()) return;
    await supabase.from('districts').update({ name_ar: editName.trim() }).eq('id', editModal.district.id);
    toast.success('تم التحديث');
    setEditModal({ open: false, district: null });
    fetchDistricts();
  };

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold text-foreground mb-4">إدارة الأحياء</h1>

      {/* Add form */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <Input
          placeholder="اسم الحي بالعربي"
          value={newNameAr}
          onChange={(e) => setNewNameAr(e.target.value)}
          className="flex-1 min-w-[140px]"
        />
        <Input
          placeholder="اسم بالإنجليزي (اختياري)"
          value={newNameEn}
          onChange={(e) => setNewNameEn(e.target.value)}
          className="flex-1 min-w-[140px]"
        />
        <Button onClick={addDistrict} disabled={!newNameAr.trim()}>
          <Plus className="h-4 w-4" /> إضافة حي
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" /></div>
      ) : (
        <div className="space-y-2">
          {districts.map((d) => (
            <div key={d.id} className="bg-card border border-border rounded-2xl p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="font-bold text-foreground text-sm">{d.name_ar}</span>
                {d.name_en && <span className="text-xs text-muted-foreground">({d.name_en})</span>}
                <Badge variant="secondary" className="text-[10px]">{d.listing_count ?? 0} إعلان</Badge>
                {!d.is_active && <Badge variant="outline" className="text-[10px] text-red-500">معطل</Badge>}
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={d.is_active ?? true} onCheckedChange={() => toggleActive(d)} />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => { setEditModal({ open: true, district: d }); setEditName(d.name_ar); }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={editModal.open} onOpenChange={(o) => !o && setEditModal({ open: false, district: null })}>
        <DialogContent>
          <DialogHeader><DialogTitle>تعديل اسم الحي</DialogTitle></DialogHeader>
          <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
          <DialogFooter>
            <Button onClick={saveEdit}>حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default DistrictsManagement;
