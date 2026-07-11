import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { successToast } from '@/lib/successToast';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarDays, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import type { ListingCategory } from '@/types/database';
import { getCategoryFields, type ForWhomValue } from '@/lib/requestFieldsConfig';

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

const forWhomLabels: Record<ForWhomValue, string> = {
  family: 'عائلة',
  bachelors: 'عزاب',
  students: 'طلاب',
};

const furnishingOptions = [
  { value: 'any', label: 'غير محدد' },
  { value: 'furnished', label: 'مفروش' },
  { value: 'unfurnished', label: 'غير مفروش' },
];

const CreateRequestPage = () => {
  usePageTitle();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [category, setCategory] = useState<ListingCategory | ''>('');
  const [governorate, setGovernorate] = useState('');
  const [cityName, setCityName] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [bedrooms, setBedrooms] = useState('');
  const [furnishing, setFurnishing] = useState('any');
  const [forWhom, setForWhom] = useState<ForWhomValue | ''>('');
  const [moveInDate, setMoveInDate] = useState<Date | undefined>();
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const cfg = getCategoryFields(category);

  // Clear irrelevant fields whenever the category changes
  useEffect(() => {
    if (!cfg) return;
    if (!cfg.bedrooms) setBedrooms('');
    if (!cfg.furnishing) setFurnishing('any');
    if (cfg.forceForWhom) {
      setForWhom(cfg.forceForWhom);
    } else if (!cfg.forWhom) {
      setForWhom('');
    } else if (forWhom && !cfg.forWhom.includes(forWhom as ForWhomValue)) {
      setForWhom('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  const handleSubmit = async () => {
    if (!category || !cfg) { toast.error('اختر نوع العقار المطلوب'); return; }
    if (!governorate.trim()) { toast.error('أدخل المحافظة'); return; }
    if (cfg.forWhom && cfg.forWhomRequired && !forWhom) {
      toast.error('حدد الطلب لمن');
      return;
    }
    if (!user) return;

    setSubmitting(true);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // Only include fields relevant to this category — hidden fields are submitted as null
    const effectiveForWhom = cfg.forceForWhom ?? (cfg.forWhom ? (forWhom || null) : null);

    const { data, error } = await supabase.from('housing_requests').insert({
      requester_id: user.id,
      category: category as ListingCategory,
      governorate: governorate.trim() || null,
      city_name: cityName.trim() || null,
      neighborhood: neighborhood.trim() || null,
      min_price: minPrice ? Number(minPrice) : null,
      max_price: maxPrice ? Number(maxPrice) : null,
      bedrooms_needed: cfg.bedrooms && bedrooms ? Number(bedrooms) : null,
      furnishing_preference: cfg.furnishing ? (furnishing as any) : null,
      for_whom: effectiveForWhom as any,
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
    successToast('تم نشر طلبك بنجاح', { description: 'سيتمكن الملاك من إرسال عروضهم لك قريباً' });
    navigate(`/requests/${data.id}`);
  };

  return (
    <div className="min-h-screen bg-background font-tajawal pb-24" dir="rtl">
      <PageHeader title="طلب سكن جديد" showBack />

      <div className="max-w-lg mx-auto md:max-w-none md:mx-0 px-4 py-6 space-y-5">
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

        {/* Governorate */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold">المحافظة *</Label>
          <Input value={governorate} onChange={e => setGovernorate(e.target.value)} placeholder="مثال: تعز، صنعاء، عدن" />
        </div>

        {/* City / District */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold">المدينة / المديرية</Label>
          <Input value={cityName} onChange={e => setCityName(e.target.value)} placeholder="مثال: المظفر، الشماسي" />
        </div>

        {/* Neighborhood */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold">الحي أو المنطقة</Label>
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

        {/* Bedrooms — conditional */}
        {cfg?.bedrooms && (
          <div className="space-y-2">
            <Label className="text-sm font-semibold">عدد الغرف المطلوبة</Label>
            <Input type="number" value={bedrooms} onChange={e => setBedrooms(e.target.value)} placeholder="مثال: 2" />
          </div>
        )}

        {/* Furnishing — conditional */}
        {cfg?.furnishing && (
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
        )}

        {/* For whom — conditional */}
        {cfg?.forWhom && (
          <div className="space-y-2">
            <Label className="text-sm font-semibold">الطلب لـ {cfg.forWhomRequired && '*'}</Label>
            <div className="flex gap-2">
              {cfg.forWhom.map(o => (
                <button
                  key={o}
                  type="button"
                  onClick={() => setForWhom(o)}
                  className={`flex-1 py-2 rounded-lg text-sm border transition-colors ${
                    forWhom === o
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted text-muted-foreground border-border hover:border-primary/50'
                  }`}
                >
                  {forWhomLabels[o]}
                </button>
              ))}
            </div>
          </div>
        )}

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

        {/* Notes — label adapts */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold">{cfg?.notesLabel ?? 'ملاحظات إضافية'}</Label>
          <Textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder={cfg?.notesPlaceholder ?? 'أضف أي تفاصيل إضافية...'}
            rows={4}
          />
        </div>


        {/* Submit */}
        <Button onClick={handleSubmit} disabled={submitting} className="w-full h-12 text-base font-semibold">
          {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : 'نشر الطلب الآن'}
        </Button>
      </div>

    </div>
  );
};

export default CreateRequestPage;
