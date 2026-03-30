import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useDistricts } from '@/contexts/DistrictsContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/PageHeader';
import { BottomNav } from '@/components/ui/BottomNav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarDays, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import type { ListingCategory } from '@/types/database';

const categories: { value: ListingCategory; label: string }[] = [
  { value: 'room', label: 'غرفة' },
  { value: 'apartment', label: 'شقة' },
  { value: 'house', label: 'بيت' },
  { value: 'floor', label: 'دور' },
  { value: 'shop', label: 'محل' },
  { value: 'office', label: 'مكتب' },
  { value: 'shared', label: 'سكن مشترك' },
  { value: 'family', label: 'عائلي' },
  { value: 'student', label: 'طلابي' },
];

const forWhomOptions = [
  { value: 'family', label: 'عائلة' },
  { value: 'bachelors', label: 'عزاب' },
  { value: 'students', label: 'طلاب' },
];

const furnishingOptions = [
  { value: 'any', label: 'غير محدد' },
  { value: 'furnished', label: 'مفروش' },
  { value: 'unfurnished', label: 'غير مفروش' },
];

const CreateRequestPage = () => {
  usePageTitle();
  const { user } = useAuth();
  const { districts } = useDistricts();
  const navigate = useNavigate();

  const [category, setCategory] = useState<ListingCategory | ''>('');
  const [districtId, setDistrictId] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [bedrooms, setBedrooms] = useState('');
  const [furnishing, setFurnishing] = useState('any');
  const [forWhom, setForWhom] = useState('');
  const [moveInDate, setMoveInDate] = useState<Date | undefined>();
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!category) { toast.error('اختر نوع العقار المطلوب'); return; }
    if (!districtId) { toast.error('اختر الحي المفضل'); return; }
    if (!forWhom) { toast.error('حدد الطلب لمن'); return; }
    if (!user) return;

    setSubmitting(true);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const { data, error } = await supabase.from('housing_requests').insert({
      requester_id: user.id,
      category: category as ListingCategory,
      district_id: districtId,
      neighborhood: neighborhood.trim() || null,
      min_price: minPrice ? Number(minPrice) : null,
      max_price: maxPrice ? Number(maxPrice) : null,
      bedrooms_needed: bedrooms ? Number(bedrooms) : null,
      furnishing_preference: furnishing as any,
      for_whom: forWhom as any,
      move_in_date: moveInDate ? format(moveInDate, 'yyyy-MM-dd') : null,
      notes: notes.trim() || null,
      status: 'active',
      expires_at: expiresAt.toISOString(),
    }).select('id').single();

    setSubmitting(false);

    if (error) {
      toast.error('حدث خطأ أثناء نشر الطلب');
      return;
    }
    toast.success('تم نشر طلبك بنجاح');
    navigate(`/requests/${data.id}`);
  };

  return (
    <div className="min-h-screen bg-background font-tajawal pb-24" dir="rtl">
      <PageHeader title="طلب سكن جديد" showBack />

      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
        {/* Category */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold">نوع العقار المطلوب *</Label>
          <div className="flex flex-wrap gap-2">
            {categories.map(c => (
              <button
                key={c.value}
                type="button"
                onClick={() => setCategory(c.value)}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  category === c.value
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-muted text-muted-foreground border-border hover:border-primary/50'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* District */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold">الحي المفضل *</Label>
          <Select value={districtId} onValueChange={setDistrictId}>
            <SelectTrigger><SelectValue placeholder="اختر الحي" /></SelectTrigger>
            <SelectContent>
              {districts.map(d => (
                <SelectItem key={d.id} value={d.id}>{d.name_ar}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Neighborhood */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold">المنطقة أو الشارع</Label>
          <Input value={neighborhood} onChange={e => setNeighborhood(e.target.value)} placeholder="مثال: شارع جمال" />
        </div>

        {/* Budget */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold">الميزانية (ريال يمني)</Label>
          <div className="flex gap-3">
            <Input type="number" value={minPrice} onChange={e => setMinPrice(e.target.value)} placeholder="من" className="flex-1" />
            <Input type="number" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} placeholder="إلى" className="flex-1" />
          </div>
        </div>

        {/* Bedrooms */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold">عدد الغرف المطلوبة</Label>
          <Input type="number" value={bedrooms} onChange={e => setBedrooms(e.target.value)} placeholder="مثال: 2" />
        </div>

        {/* Furnishing */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold">حالة التأثيث</Label>
          <Select value={furnishing} onValueChange={setFurnishing}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {furnishingOptions.map(f => (
                <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* For whom */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold">الطلب لـ *</Label>
          <div className="flex gap-2">
            {forWhomOptions.map(o => (
              <button
                key={o.value}
                type="button"
                onClick={() => setForWhom(o.value)}
                className={`flex-1 py-2 rounded-lg text-sm border transition-colors ${
                  forWhom === o.value
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-muted text-muted-foreground border-border hover:border-primary/50'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* Move-in date */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold">تاريخ الانتقال المتوقع</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start gap-2 font-normal">
                <CalendarDays className="h-4 w-4" />
                {moveInDate ? format(moveInDate, 'dd MMMM yyyy', { locale: ar }) : 'اختر تاريخ'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={moveInDate} onSelect={setMoveInDate} disabled={d => d < new Date()} />
            </PopoverContent>
          </Popover>
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold">ملاحظات إضافية</Label>
          <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="أضف أي تفاصيل إضافية تساعد في العثور على السكن المناسب..." rows={4} />
        </div>

        {/* Submit */}
        <Button onClick={handleSubmit} disabled={submitting} className="w-full h-12 text-base font-semibold">
          {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : 'نشر الطلب الآن'}
        </Button>
      </div>

      <BottomNav />
    </div>
  );
};

export default CreateRequestPage;
