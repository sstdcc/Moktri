import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

const categories = [
  { value: 'room', label: 'غرفة' }, { value: 'apartment', label: 'شقة' },
  { value: 'house', label: 'منزل' }, { value: 'floor', label: 'دور' },
  { value: 'shop', label: 'محل' }, { value: 'office', label: 'مكتب' },
  { value: 'shared', label: 'مشترك' }, { value: 'family', label: 'عائلي' },
  { value: 'student', label: 'طلاب' },
];

const furnishingOptions = [
  { value: 'any', label: 'الكل' },
  { value: 'furnished', label: 'مفروش' },
  { value: 'unfurnished', label: 'غير مفروش' },
];

const allowedForOptions = [
  { value: 'all', label: 'الكل' },
  { value: 'family', label: 'عائلات' },
  { value: 'bachelors', label: 'عزّاب' },
  { value: 'students', label: 'طلاب' },
];

export interface FilterValues {
  category?: string;
  bedrooms?: number;
  furnishing?: string;
  allowedFor?: string;
}

interface FilterSheetProps {
  onApply: (filters: FilterValues) => void;
  initialValues?: FilterValues;
}

export const FilterSheet = ({ onApply, initialValues }: FilterSheetProps) => {
  const [open, setOpen] = useState(false);
  const [filters, setFilters] = useState<FilterValues>(initialValues || {});

  const handleApply = () => {
    onApply(filters);
    setOpen(false);
  };

  const handleReset = () => {
    setFilters({});
    onApply({});
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          <SlidersHorizontal className="h-4 w-4" />
          <span className="font-tajawal">تصفية</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-2xl font-tajawal">
        <SheetHeader>
          <SheetTitle className="text-right font-tajawal">تصفية النتائج</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-6 pb-6">
          {/* Category */}
          <div>
            <p className="mb-2 text-sm font-medium">نوع العقار</p>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => setFilters(f => ({ ...f, category: f.category === cat.value ? undefined : cat.value }))}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs transition-colors',
                    filters.category === cat.value
                      ? 'border-accent bg-accent text-accent-foreground'
                      : 'border-border bg-card text-foreground'
                  )}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Bedrooms */}
          <div>
            <p className="mb-2 text-sm font-medium">عدد الغرف</p>
            <div className="flex gap-2">
              {[1, 2, 3, 4].map((n) => (
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
                  {n === 4 ? '+4' : n}
                </button>
              ))}
            </div>
          </div>

          {/* Furnishing */}
          <div>
            <p className="mb-2 text-sm font-medium">التأثيث</p>
            <div className="flex gap-2">
              {furnishingOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setFilters(f => ({ ...f, furnishing: f.furnishing === opt.value ? undefined : opt.value }))}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs transition-colors',
                    filters.furnishing === opt.value
                      ? 'border-accent bg-accent text-accent-foreground'
                      : 'border-border bg-card text-foreground'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Allowed For */}
          <div>
            <p className="mb-2 text-sm font-medium">مناسب لـ</p>
            <div className="flex gap-2">
              {allowedForOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setFilters(f => ({ ...f, allowedFor: f.allowedFor === opt.value ? undefined : opt.value }))}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs transition-colors',
                    filters.allowedFor === opt.value
                      ? 'border-accent bg-accent text-accent-foreground'
                      : 'border-border bg-card text-foreground'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <Button onClick={handleApply} className="flex-1">تطبيق</Button>
            <Button onClick={handleReset} variant="outline" className="flex-1">إعادة تعيين</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
