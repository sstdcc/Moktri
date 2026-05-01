import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SlidersHorizontal, X, Droplets, Zap, ParkingCircle, Wifi, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const categories = [
  { value: '', label: 'الكل' },
  { value: 'room', label: 'غرفة' }, { value: 'apartment', label: 'شقة' },
  { value: 'house', label: 'بيت' }, { value: 'floor', label: 'دور' },
  { value: 'shop', label: 'محل' }, { value: 'office', label: 'مكتب' },
  { value: 'shared', label: 'مشترك' }, { value: 'family', label: 'عائلي' },
  { value: 'student', label: 'طلابي' },
];

const furnishingOptions = [
  { value: '', label: 'الكل' },
  { value: 'furnished', label: 'مفروش' },
  { value: 'semi_furnished', label: 'نصف مفروش' },
  { value: 'unfurnished', label: 'غير مفروش' },
];

const allowedForOptions = [
  { value: '', label: 'الكل' },
  { value: 'family', label: 'عائلة' },
  { value: 'bachelors', label: 'عزّاب' },
  { value: 'students', label: 'طلاب' },
];

export interface FilterValues {
  governorate?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  furnishing?: string;
  allowedFor?: string;
  hasWater?: boolean;
  hasElectricity?: boolean;
  hasParking?: boolean;
  hasInternet?: boolean;
}

interface FilterSheetProps {
  onApply: (filters: FilterValues) => void;
  initialValues?: FilterValues;
}

export const FilterSheet = ({ onApply, initialValues }: FilterSheetProps) => {
  const [open, setOpen] = useState(false);
  const [filters, setFilters] = useState<FilterValues>(initialValues || {});

  useEffect(() => {
    if (initialValues) setFilters(initialValues);
  }, [initialValues]);

  const handleApply = () => { onApply(filters); setOpen(false); };
  const handleReset = () => { setFilters({}); onApply({}); setOpen(false); };

  const toggleAmenity = (key: 'hasWater' | 'hasElectricity' | 'hasParking' | 'hasInternet') => {
    setFilters(f => ({ ...f, [key]: f[key] ? undefined : true }));
  };

  const ChipSelect = ({ options, value, onChange }: { options: { value: string; label: string }[]; value?: string; onChange: (v: string | undefined) => void }) => (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(value === opt.value || (!opt.value && !value) ? undefined : opt.value || undefined)}
          className={cn(
            'rounded-full border px-3 py-1 text-xs transition-colors',
            (value === opt.value || (!opt.value && !value))
              ? 'border-accent bg-accent text-accent-foreground'
              : 'border-border bg-card text-foreground'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );

  const amenities: { key: 'hasWater' | 'hasElectricity' | 'hasParking' | 'hasInternet'; label: string; icon: LucideIcon }[] = [
    { key: 'hasWater', label: 'ماء', icon: Droplets },
    { key: 'hasElectricity', label: 'كهرباء', icon: Zap },
    { key: 'hasParking', label: 'موقف', icon: ParkingCircle },
    { key: 'hasInternet', label: 'إنترنت', icon: Wifi },
  ];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          <SlidersHorizontal className="h-4 w-4" />
          <span className="font-tajawal">تصفية</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl font-tajawal">
        <SheetHeader>
          <SheetTitle className="text-right font-tajawal">تصفية النتائج</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-5 pb-6">
          {/* Category */}
          <div>
            <p className="mb-2 text-sm font-medium">نوع العقار</p>
            <ChipSelect options={categories} value={filters.category} onChange={v => setFilters(f => ({ ...f, category: v }))} />
          </div>

          {/* Governorate */}
          <div>
            <p className="mb-2 text-sm font-medium">المحافظة</p>
            <Input
              value={filters.governorate || ''}
              onChange={(e) => setFilters(f => ({ ...f, governorate: e.target.value || undefined }))}
              placeholder="مثال: تعز، صنعاء..."
              className="text-sm"
            />
          </div>

          {/* Price Range */}
          <div>
            <p className="mb-2 text-sm font-medium">نطاق السعر (ريال)</p>
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="من"
                value={filters.minPrice || ''}
                onChange={(e) => setFilters(f => ({ ...f, minPrice: e.target.value ? Number(e.target.value) : undefined }))}
                className="w-1/2 rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground"
              />
              <input
                type="number"
                placeholder="إلى"
                value={filters.maxPrice || ''}
                onChange={(e) => setFilters(f => ({ ...f, maxPrice: e.target.value ? Number(e.target.value) : undefined }))}
                className="w-1/2 rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground"
              />
            </div>
          </div>

          {/* Bedrooms */}
          <div>
            <p className="mb-2 text-sm font-medium">غرف النوم</p>
            <div className="flex gap-2">
              {[0, 1, 2, 3, 4].map(n => (
                <button
                  key={n}
                  onClick={() => setFilters(f => ({ ...f, bedrooms: f.bedrooms === n ? undefined : n }))}
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-lg border text-sm transition-colors',
                    filters.bedrooms === n
                      ? 'border-accent bg-accent text-accent-foreground'
                      : 'border-border bg-card text-foreground'
                  )}
                >
                  {n === 0 ? 'الكل' : n === 4 ? '+4' : n}
                </button>
              ))}
            </div>
          </div>

          {/* Furnishing */}
          <div>
            <p className="mb-2 text-sm font-medium">التأثيث</p>
            <ChipSelect options={furnishingOptions} value={filters.furnishing} onChange={v => setFilters(f => ({ ...f, furnishing: v }))} />
          </div>

          {/* Allowed For */}
          <div>
            <p className="mb-2 text-sm font-medium">مناسب لـ</p>
            <ChipSelect options={allowedForOptions} value={filters.allowedFor} onChange={v => setFilters(f => ({ ...f, allowedFor: v }))} />
          </div>

          {/* Amenities */}
          <div>
            <p className="mb-2 text-sm font-medium">المرافق</p>
            <div className="flex flex-wrap gap-2">
              {amenities.map(a => {
                const Icon = a.icon;
                return (
                  <button
                    key={a.key}
                    onClick={() => toggleAmenity(a.key)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs transition-colors inline-flex items-center gap-1',
                      filters[a.key]
                        ? 'border-success bg-success/10 text-success'
                        : 'border-border bg-card text-foreground'
                    )}
                  >
                    <Icon className="h-3 w-3" /> {a.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button onClick={handleApply} className="flex-1">تطبيق</Button>
            <Button onClick={handleReset} variant="outline" className="flex-1">إعادة تعيين</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
