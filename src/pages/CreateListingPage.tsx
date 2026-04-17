import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { 
  DoorOpen, Building2, Home, Layers, Store, Briefcase, Users, HeartHandshake, GraduationCap,
  Check, ArrowLeft, ArrowRight, Camera, X, Droplets, Zap, ParkingCircle, Wifi,
  Minus, Plus, Sofa, Armchair, Package, Loader2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
// District type kept for backwards compat but no longer fetched for location selection

const STEP_LABELS = ['المعلومات الأساسية', 'تفاصيل العقار', 'الصور والوصف', 'المراجعة والنشر'];

const categoryOptions = [
  { value: 'room', label: 'غرفة', icon: DoorOpen },
  { value: 'apartment', label: 'شقة', icon: Building2 },
  { value: 'house', label: 'بيت', icon: Home },
  { value: 'floor', label: 'دور', icon: Layers },
  { value: 'shop', label: 'محل', icon: Store },
  { value: 'office', label: 'مكتب', icon: Briefcase },
  { value: 'shared', label: 'مشترك', icon: Users },
  { value: 'family', label: 'عائلي', icon: HeartHandshake },
  { value: 'student', label: 'طلابي', icon: GraduationCap },
] as const;

const furnishingOptions = [
  { value: 'furnished', label: 'مفروش', icon: Sofa },
  { value: 'semi_furnished', label: 'نصف مفروش', icon: Armchair },
  { value: 'unfurnished', label: 'غير مفروش', icon: Package },
] as const;

const allowedForOptions = [
  { value: 'family', label: 'عائلة' },
  { value: 'bachelors', label: 'عزاب' },
  { value: 'students', label: 'طلاب' },
  { value: 'all', label: 'الجميع' },
] as const;

const amenityOptions = [
  { key: 'has_water', label: 'ماء', icon: Droplets },
  { key: 'has_electricity', label: 'كهرباء', icon: Zap },
  { key: 'has_parking', label: 'موقف سيارات', icon: ParkingCircle },
  { key: 'has_internet', label: 'إنترنت', icon: Wifi },
] as const;

const billingOptions = [
  { value: 'monthly', label: 'شهري' },
  { value: 'yearly', label: 'سنوي' },
  { value: 'daily', label: 'يومي' },
] as const;

interface FormState {
  category: string;
  title: string;
  governorate: string;
  city_name: string;
  district_id: string;
  neighborhood: string;
  price: number | '';
  currency: string;
  billing_period: string;
  is_negotiable: boolean;
  bedrooms: number;
  bathrooms: number;
  kitchens: number;
  floor_number: number;
  property_size: number | '';
  furnishing: string;
  allowed_for: string;
  has_water: boolean;
  has_electricity: boolean;
  has_parking: boolean;
  has_internet: boolean;
  description: string;
  is_urgent: boolean;
}

const defaultForm: FormState = {
  category: '', title: '', governorate: '', city_name: '', district_id: '', neighborhood: '',
  price: '', currency: 'YER', billing_period: 'monthly', is_negotiable: false,
  bedrooms: 0, bathrooms: 0, kitchens: 0, floor_number: 0, property_size: '',
  furnishing: '', allowed_for: 'all',
  has_water: false, has_electricity: false, has_parking: false, has_internet: false,
  description: '', is_urgent: false,
};

interface UploadedImage {
  url: string;
  path: string;
}

export interface CreateListingFormProps {
  initialData?: Partial<FormState>;
  initialImages?: UploadedImage[];
  isEditing?: boolean;
  listingId?: string;
  onSave?: (data: FormState, images: UploadedImage[], status: string) => Promise<void>;
}

const Stepper = ({ value, onChange, min = 0, max = 10, label }: { value: number; onChange: (v: number) => void; min?: number; max?: number; label: string }) => (
  <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-3">
    <span className="text-sm font-medium text-foreground font-tajawal">{label}</span>
    <div className="flex items-center gap-3">
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:bg-muted transition-all duration-200 disabled:opacity-30" disabled={value <= min}>
        <Minus className="h-4 w-4" />
      </button>
      <span className="w-6 text-center text-sm font-bold text-foreground">{value}</span>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:bg-muted transition-all duration-200 disabled:opacity-30" disabled={value >= max}>
        <Plus className="h-4 w-4" />
      </button>
    </div>
  </div>
);

const QualityScore = ({ score }: { score: number }) => {
  const color = score >= 80 ? 'hsl(var(--success))' : score >= 50 ? 'hsl(var(--accent))' : 'hsl(var(--danger))';
  const r = 45;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  const message = score >= 80 ? 'إعلان ممتاز — سيحصل على مشاهدات أكثر' : score >= 50 ? 'إعلان جيد — يمكن تحسينه بإضافة المزيد من التفاصيل' : 'إعلانك يحتاج تحسين — أضف صوراً ووصفاً أوضح';

  return (
    <div className="flex flex-col items-center gap-3 py-4">
      <svg width="120" height="120" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke="hsl(var(--border))" strokeWidth="8" />
        <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset} transform="rotate(-90 60 60)" className="transition-all duration-700" />
        <text x="60" y="60" textAnchor="middle" dy="0.35em" fontSize="28" fontWeight="900" fill={color} fontFamily="Tajawal">{score}</text>
      </svg>
      <p className="text-sm text-center font-medium text-muted-foreground font-tajawal">{message}</p>
    </div>
  );
};

const CreateListingPage = ({ initialData, initialImages, isEditing, listingId, onSave }: CreateListingFormProps = {}) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, profile } = useAuth();

  // Private offer mode: created by owner for a specific renter from a housing request
  const privateForUserId = searchParams.get('private_for') || '';
  const fromRequestId = searchParams.get('from_request') || '';
  const isPrivateOffer = !!privateForUserId && !isEditing;

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>({ ...defaultForm, ...initialData });
  const [images, setImages] = useState<UploadedImage[]>(initialImages || []);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ id: string; status: string } | null>(null);
  const [imageError, setImageError] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Prefill from source housing request
  useEffect(() => {
    if (!fromRequestId || isEditing) return;
    (async () => {
      const { data } = await supabase
        .from('housing_requests')
        .select('category, governorate, city_name, neighborhood, max_price, currency, bedrooms_needed, furnishing_preference, notes')
        .eq('id', fromRequestId)
        .single();
      if (!data) return;
      setForm(f => ({
        ...f,
        category: data.category || f.category,
        governorate: data.governorate || f.governorate,
        city_name: data.city_name || f.city_name,
        neighborhood: data.neighborhood || f.neighborhood,
        price: data.max_price ?? f.price,
        currency: data.currency || f.currency,
        bedrooms: data.bedrooms_needed ?? f.bedrooms,
        furnishing: data.furnishing_preference && data.furnishing_preference !== 'any'
          ? data.furnishing_preference
          : f.furnishing,
        description: data.notes ? `عرض خاص بناءً على طلب السكن:\n\n${data.notes}` : f.description,
      }));
    })();
  }, [fromRequestId, isEditing]);

  const update = <K extends keyof FormState>(key: K, val: FormState[K]) => setForm(f => ({ ...f, [key]: val }));

  const canProceedStep0 = form.category && form.title.length >= 10 && form.governorate.trim().length > 0;
  const canProceedStep1 = form.price && Number(form.price) > 0 && form.furnishing;
  const canProceedStep2 = images.length > 0 && form.description.length >= 30;

  const calculateScore = () => {
    let s = 0;
    if (images.length >= 3) s += 25;
    if (form.description.length > 100) s += 20;
    if (Number(form.price) > 0) s += 15;
    if (form.governorate) s += 15;
    const amenityCount = [form.has_water, form.has_electricity, form.has_parking, form.has_internet].filter(Boolean).length;
    if (amenityCount >= 2) s += 15;
    if (form.bedrooms > 0 || form.bathrooms > 0) s += 10;
    return s;
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !user) return;
    setUploading(true);
    setImageError(false);
    const newImages: UploadedImage[] = [];
    for (const file of Array.from(files).slice(0, 10 - images.length)) {
      const ext = file.name.split('.').pop();
      const path = `listings/${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from('listing-images').upload(path, file);
      if (!error) {
        const { data: urlData } = supabase.storage.from('listing-images').getPublicUrl(path);
        newImages.push({ url: urlData.publicUrl, path });
      }
    }
    setImages(prev => [...prev, ...newImages]);
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const removeImage = async (idx: number) => {
    const img = images[idx];
    await supabase.storage.from('listing-images').remove([img.path]);
    setImages(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (status: string) => {
    if (!user) return;
    setSubmitting(true);
    try {
      if (onSave) {
        await onSave(form, images, status);
        return;
      }

      const finalStatus = isPrivateOffer
        ? 'private_offer'
        : status === 'active' && profile?.is_verified
          ? 'active'
          : status === 'active'
            ? 'pending_review'
            : 'draft';

      const { data: listing, error } = await supabase.from('listings').insert({
        owner_id: user.id,
        category: form.category as any,
        title: form.title,
        governorate: form.governorate || null,
        city_name: form.city_name || null,
        district_id: form.district_id || null,
        neighborhood: form.neighborhood || null,
        price: Number(form.price),
        currency: form.currency,
        billing_period: form.billing_period as any,
        is_negotiable: form.is_negotiable,
        bedrooms: form.bedrooms,
        bathrooms: form.bathrooms,
        kitchens: form.kitchens,
        floor_number: form.floor_number,
        property_size: form.property_size ? Number(form.property_size) : null,
        furnishing: form.furnishing as any,
        allowed_for: form.allowed_for as any,
        has_water: form.has_water,
        has_electricity: form.has_electricity,
        has_parking: form.has_parking,
        has_internet: form.has_internet,
        description: form.description,
        is_urgent: form.is_urgent,
        status: finalStatus as any,
        published_at: finalStatus === 'active' || finalStatus === 'pending_review' ? new Date().toISOString() : null,
        expires_at: finalStatus === 'active' || finalStatus === 'pending_review' ? new Date(Date.now() + 90 * 86400000).toISOString() : null,
        quality_score: calculateScore(),
        reserved_for_user_id: isPrivateOffer ? privateForUserId : null,
        source_request_id: isPrivateOffer && fromRequestId ? fromRequestId : null,
        offered_at: isPrivateOffer ? new Date().toISOString() : null,
      } as any).select('id').single();

      if (error) throw error;

      if (listing && images.length > 0) {
        await supabase.from('listing_images').insert(
          images.map((img, i) => ({
            listing_id: listing.id,
            url: img.url,
            is_primary: i === 0,
            sort_order: i,
          }))
        );
      }

      // If private offer: notify the renter
      if (isPrivateOffer && listing) {
        await supabase.from('notifications').insert({
          user_id: privateForUserId,
          type: 'private_offer_created' as any,
          title_ar: 'تم إنشاء عرض خاص لك',
          body_ar: 'قام المالك بإنشاء إعلان خاص لطلب السكن. راجع التفاصيل وأكّد القبول.',
          link: `/listings/${listing.id}`,
        });
        toast.success('تم إرسال العرض الخاص للمستأجر');
        navigate('/dashboard/owner');
        return;
      }

      if (status === 'draft') {
        navigate('/dashboard/owner');
      } else {
        setSuccess({ id: listing!.id, status: finalStatus });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 font-tajawal">
        <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mb-6 animate-bounce">
          <Check className="h-10 w-10 text-success" />
        </div>
        <h1 className="text-2xl font-black text-foreground">
          {success.status === 'active' ? 'تم نشر إعلانك! 🎉' : 'تم إرسال إعلانك للمراجعة'}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground text-center">
          {success.status === 'active' ? 'إعلانك متاح الآن للجميع' : 'سيتم مراجعة إعلانك والموافقة عليه قريباً'}
        </p>
        <div className="mt-8 w-full max-w-xs flex flex-col gap-3">
          <Button onClick={() => navigate(`/listings/${success.id}`)}>عرض إعلانك</Button>
          <Button variant="outline" onClick={() => { setSuccess(null); setForm(defaultForm); setImages([]); setStep(0); }}>إضافة إعلان آخر</Button>
        </div>
      </div>
    );
  }

  const locationText = [form.governorate, form.city_name, form.neighborhood].filter(Boolean).join(' — ');
  const billingLabel = billingOptions.find(b => b.value === form.billing_period)?.label || '';
  const categoryLabel = categoryOptions.find(c => c.value === form.category)?.label || '';
  const furnishingLabel = furnishingOptions.find(f => f.value === form.furnishing)?.label || '';

  return (
    <div className="min-h-screen bg-background pb-8 font-tajawal">
      <PageHeader title={isPrivateOffer ? 'إنشاء عرض خاص' : isEditing ? 'تعديل الإعلان' : 'إضافة إعلان جديد'} showBack />

      {isPrivateOffer && (
        <div className="mx-4 mt-3 rounded-2xl border border-accent/30 bg-accent/5 p-3 text-xs font-tajawal text-foreground" dir="rtl">
          <p className="font-bold mb-1">عرض خاص بمستأجر محدد</p>
          <p className="text-muted-foreground">هذا الإعلان لن يكون عاماً، وسيظهر فقط للمستأجر الذي طلبه. عند رفضه يتحول لمسودة يمكنك تعديلها ونشرها لاحقاً.</p>
        </div>
      )}

      {/* Progress bar */}
      <div className="sticky top-14 z-30 bg-card border-b border-border px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          {STEP_LABELS.map((label, i) => (
            <div key={i} className="flex items-center gap-1">
              <div className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-200',
                i < step ? 'bg-success text-white' : i === step ? 'bg-accent text-white' : 'bg-muted text-muted-foreground'
              )}>
                {i < step ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span className={cn('text-[10px] hidden sm:inline', i === step ? 'text-accent font-semibold' : 'text-muted-foreground')}>{label}</span>
            </div>
          ))}
        </div>
        <Progress value={((step + 1) / 4) * 100} className="h-1.5" />
      </div>

      <div className="px-4 pt-6 max-w-lg mx-auto">

        {/* STEP 0 */}
        {step === 0 && (
          <div className="space-y-6">
            <div>
              <Label className="text-sm font-bold mb-3 block font-tajawal">نوع العقار *</Label>
              <div className="grid grid-cols-3 gap-3">
                {categoryOptions.map(({ value, label, icon: Icon }) => (
                  <button key={value} type="button" onClick={() => update('category', value)}
                    className={cn(
                      'flex flex-col items-center gap-2 rounded-2xl border p-4 transition-all duration-200 hover:shadow-md active:scale-95',
                      form.category === value ? 'border-accent bg-accent/10' : 'border-border bg-card'
                    )}>
                    <Icon className={cn('h-6 w-6', form.category === value ? 'text-accent' : 'text-muted-foreground')} />
                    <span className={cn('text-xs font-medium', form.category === value ? 'text-accent' : 'text-foreground')}>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-sm font-bold mb-2 block font-tajawal">عنوان الإعلان *</Label>
              <Input value={form.title} onChange={e => update('title', e.target.value)} maxLength={100}
                placeholder="مثال: شقة ثلاث غرف في حي الأندلس" className="font-tajawal" />
              <p className="mt-1 text-xs text-muted-foreground text-left font-tajawal">{form.title.length}/100</p>
              {form.title.length > 0 && form.title.length < 10 && (
                <p className="text-xs text-danger font-tajawal">يجب أن يكون العنوان 10 أحرف على الأقل</p>
              )}
            </div>

            {/* Governorate */}
            <div>
              <Label className="text-sm font-bold mb-2 block font-tajawal">المحافظة *</Label>
              <Input value={form.governorate} onChange={e => update('governorate', e.target.value)}
                placeholder="مثال: تعز، صنعاء، عدن" className="font-tajawal" />
            </div>

            {/* City / District */}
            <div>
              <Label className="text-sm font-bold mb-2 block font-tajawal">المدينة / المديرية</Label>
              <Input value={form.city_name} onChange={e => update('city_name', e.target.value)}
                placeholder="مثال: المظفر، الشماسي" className="font-tajawal" />
            </div>

            <div>
              <Label className="text-sm font-bold mb-2 block font-tajawal">الحي أو المنطقة</Label>
              <Input value={form.neighborhood} onChange={e => update('neighborhood', e.target.value)}
                placeholder="مثال: شارع جمال، بجانب المسجد" className="font-tajawal" />
            </div>

            <Button onClick={() => setStep(1)} disabled={!canProceedStep0} className="w-full gap-2">
              التالي <ArrowLeft className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* STEP 1 */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <Label className="text-sm font-bold mb-2 block font-tajawal">السعر *</Label>
              <div className="flex gap-2">
                <Input type="number" value={form.price} onChange={e => update('price', e.target.value ? Number(e.target.value) : '')}
                  placeholder="0" className="flex-1 font-tajawal" />
                <div className="flex rounded-xl border border-border overflow-hidden">
                  {['YER', 'USD'].map(c => (
                    <button key={c} type="button" onClick={() => update('currency', c)}
                      className={cn('px-3 py-2 text-xs font-bold transition-all duration-200', form.currency === c ? 'bg-accent text-white' : 'bg-card text-muted-foreground')}>
                      {c === 'YER' ? 'ريال' : 'دولار'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                {billingOptions.map(b => (
                  <button key={b.value} type="button" onClick={() => update('billing_period', b.value)}
                    className={cn('flex-1 rounded-xl border py-2 text-xs font-medium transition-all duration-200',
                      form.billing_period === b.value ? 'border-accent bg-accent/10 text-accent' : 'border-border text-muted-foreground')}>
                    {b.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between mt-3 rounded-xl border border-border p-3">
                <span className="text-sm text-foreground font-tajawal">السعر قابل للتفاوض</span>
                <Switch checked={form.is_negotiable} onCheckedChange={v => update('is_negotiable', v)} />
              </div>
            </div>

            <div className="space-y-3">
              <Stepper value={form.bedrooms} onChange={v => update('bedrooms', v)} label="غرف النوم" max={10} />
              <Stepper value={form.bathrooms} onChange={v => update('bathrooms', v)} label="الحمامات" max={5} />
              <Stepper value={form.kitchens} onChange={v => update('kitchens', v)} label="المطابخ" max={3} />
              <Stepper value={form.floor_number} onChange={v => update('floor_number', v)} label="الطابق" max={15} />
            </div>

            <div>
              <Label className="text-sm font-bold mb-2 block font-tajawal">المساحة (م²)</Label>
              <div className="flex items-center gap-2">
                <Input type="number" value={form.property_size} onChange={e => update('property_size', e.target.value ? Number(e.target.value) : '')}
                  placeholder="0" className="flex-1 font-tajawal" />
                <span className="text-sm text-muted-foreground font-tajawal">م²</span>
              </div>
            </div>

            <div>
              <Label className="text-sm font-bold mb-3 block font-tajawal">حالة التأثيث *</Label>
              <div className="grid grid-cols-3 gap-3">
                {furnishingOptions.map(({ value, label, icon: Icon }) => (
                  <button key={value} type="button" onClick={() => update('furnishing', value)}
                    className={cn(
                      'flex flex-col items-center gap-2 rounded-2xl border p-3 transition-all duration-200',
                      form.furnishing === value ? 'border-accent bg-accent/10' : 'border-border bg-card'
                    )}>
                    <Icon className={cn('h-5 w-5', form.furnishing === value ? 'text-accent' : 'text-muted-foreground')} />
                    <span className={cn('text-xs font-medium', form.furnishing === value ? 'text-accent' : 'text-foreground')}>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-sm font-bold mb-3 block font-tajawal">مناسب لـ</Label>
              <div className="flex gap-2 flex-wrap">
                {allowedForOptions.map(opt => (
                  <button key={opt.value} type="button" onClick={() => update('allowed_for', opt.value)}
                    className={cn('rounded-xl border px-4 py-2 text-xs font-medium transition-all duration-200',
                      form.allowed_for === opt.value ? 'border-accent bg-accent/10 text-accent' : 'border-border text-muted-foreground')}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-sm font-bold mb-3 block font-tajawal">المرافق</Label>
              <div className="grid grid-cols-2 gap-3">
                {amenityOptions.map(({ key, label, icon: Icon }) => {
                  const active = form[key as keyof FormState] as boolean;
                  return (
                    <button key={key} type="button" onClick={() => update(key as keyof FormState, !active as any)}
                      className={cn('flex items-center gap-2 rounded-xl border px-3 py-2.5 transition-all duration-200',
                        active ? 'border-success bg-success/10' : 'border-border bg-card')}>
                      <Icon className={cn('h-4 w-4', active ? 'text-success' : 'text-muted-foreground')} />
                      <span className={cn('text-xs font-medium', active ? 'text-success' : 'text-foreground')}>{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(0)} className="flex-1 gap-2">
                <ArrowRight className="h-4 w-4" /> السابق
              </Button>
              <Button onClick={() => setStep(2)} disabled={!canProceedStep1} className="flex-1 gap-2">
                التالي <ArrowLeft className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <Label className="text-sm font-bold mb-3 block font-tajawal">صور العقار *</Label>
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
              {images.length < 10 && (
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="w-full rounded-2xl border-2 border-dashed border-border py-10 flex flex-col items-center gap-2 text-muted-foreground transition-all duration-200 hover:border-accent hover:text-accent">
                  {uploading ? <Loader2 className="h-8 w-8 animate-spin" /> : <Camera className="h-8 w-8" />}
                  <span className="text-sm font-medium font-tajawal">{uploading ? 'جاري الرفع...' : 'اضغط لإضافة صور'}</span>
                  <span className="text-xs font-tajawal">الحد الأقصى 10 صور، بدءاً من الغلاف</span>
                </button>
              )}
              {imageError && images.length === 0 && (
                <p className="mt-2 text-xs text-danger font-tajawal">يجب إضافة صورة واحدة على الأقل</p>
              )}
              {images.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mt-3">
                  {images.map((img, i) => (
                    <div key={i} className="relative rounded-xl overflow-hidden aspect-square border border-border">
                      <img src={img.url} alt="" className="h-full w-full object-cover" />
                      {i === 0 && (
                        <span className="absolute bottom-1 right-1 rounded bg-accent/90 text-white text-[10px] px-1.5 py-0.5 font-bold font-tajawal">الغلاف</span>
                      )}
                      <button type="button" onClick={() => removeImage(i)}
                        className="absolute top-1 left-1 w-6 h-6 rounded-full bg-danger/80 flex items-center justify-center text-white transition-all duration-200 hover:bg-danger">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <Label className="text-sm font-bold mb-2 block font-tajawal">الوصف *</Label>
              <Textarea value={form.description} onChange={e => update('description', e.target.value)} maxLength={1000} rows={5}
                placeholder="اكتب وصفاً واضحاً للعقار — الموقع، المميزات، القريب منه، الشروط..." className="font-tajawal" />
              <p className="mt-1 text-xs text-muted-foreground text-left font-tajawal">{form.description.length}/1000</p>
              {form.description.length > 0 && form.description.length < 30 && (
                <p className="text-xs text-danger font-tajawal">يجب أن يكون الوصف 30 حرفاً على الأقل</p>
              )}
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border p-3">
              <div>
                <span className="text-sm font-medium text-foreground font-tajawal">هل الإعلان عاجل؟</span>
                <p className="text-xs text-muted-foreground font-tajawal mt-0.5">الإعلانات العاجلة تظهر في أعلى نتائج البحث</p>
              </div>
              <Switch checked={form.is_urgent} onCheckedChange={v => update('is_urgent', v)} />
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1 gap-2">
                <ArrowRight className="h-4 w-4" /> السابق
              </Button>
              <Button onClick={() => {
                if (images.length === 0) { setImageError(true); return; }
                setStep(3);
              }} disabled={!canProceedStep2} className="flex-1 gap-2">
                التالي <ArrowLeft className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3 — Review */}
        {step === 3 && (
          <div className="space-y-6">
            {!profile?.whatsapp_number?.trim() && (
              <div className="rounded-2xl border border-accent/30 bg-accent/5 p-4 space-y-2" dir="rtl">
                <p className="text-sm font-bold text-foreground">أضف رقم واتساب للتواصل الأسرع</p>
                <p className="text-xs text-muted-foreground">المستأجرون يفضلون التواصل عبر واتساب</p>
                <button
                  onClick={() => navigate('/settings')}
                  className="text-xs font-bold text-accent hover:underline"
                >
                  إضافة الرقم الآن ←
                </button>
              </div>
            )}
            <QualityScore score={calculateScore()} />

            <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
              {images.length > 0 && (
                <img src={images[0].url} alt="" className="w-full h-40 object-cover rounded-xl" />
              )}
              <div>
                <span className="text-xs text-accent font-bold font-tajawal">{categoryLabel}</span>
                <h3 className="text-lg font-black text-foreground font-tajawal mt-1">{form.title}</h3>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-black text-accent font-tajawal">{Number(form.price).toLocaleString('ar-YE')}</span>
                <span className="text-xs text-muted-foreground font-tajawal">{form.currency === 'YER' ? 'ر.ي' : '$'}/{billingLabel}</span>
              </div>
              {locationText && <p className="text-sm text-muted-foreground font-tajawal">📍 {locationText}</p>}

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
                {form.bedrooms > 0 && <span className="text-xs text-muted-foreground font-tajawal">🛏 {form.bedrooms} غرف نوم</span>}
                {form.bathrooms > 0 && <span className="text-xs text-muted-foreground font-tajawal">🚿 {form.bathrooms} حمام</span>}
                {form.kitchens > 0 && <span className="text-xs text-muted-foreground font-tajawal">🍳 {form.kitchens} مطبخ</span>}
                {form.property_size && <span className="text-xs text-muted-foreground font-tajawal">📐 {form.property_size} م²</span>}
                <span className="text-xs text-muted-foreground font-tajawal">🪑 {furnishingLabel}</span>
              </div>
              
              {form.description && <p className="text-sm text-foreground border-t border-border pt-3 font-tajawal">{form.description}</p>}
            </div>

            <div className="flex flex-col gap-3">
              <Button onClick={() => handleSubmit('active')} disabled={submitting} className="w-full gap-2">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isPrivateOffer ? 'إرسال العرض الخاص' : isEditing ? 'حفظ التعديلات' : 'نشر الإعلان الآن'}
              </Button>
              {!isEditing && !isPrivateOffer && (
                <Button variant="outline" onClick={() => handleSubmit('draft')} disabled={submitting} className="w-full">
                  حفظ كمسودة
                </Button>
              )}
              <Button variant="ghost" onClick={() => setStep(2)} className="w-full gap-2">
                <ArrowRight className="h-4 w-4" /> العودة للتعديل
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateListingPage;
