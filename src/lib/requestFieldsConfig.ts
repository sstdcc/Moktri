import type { ListingCategory } from '@/types/database';

export type ForWhomValue = 'family' | 'bachelors' | 'students';

export interface CategoryFieldConfig {
  /** Show bedrooms input */
  bedrooms: boolean;
  /** Show furnishing selector */
  furnishing: boolean;
  /** Allowed "for whom" options; null = hide the field entirely */
  forWhom: ForWhomValue[] | null;
  /** Force a specific for_whom value (used when hidden but implicit) */
  forceForWhom?: ForWhomValue;
  /** Whether picking a for_whom is required (when the field is shown) */
  forWhomRequired?: boolean;
  /** Label shown on the "notes" textarea (context-aware) */
  notesLabel: string;
  notesPlaceholder: string;
}

export const CATEGORY_FIELDS: Record<ListingCategory, CategoryFieldConfig> = {
  room: {
    bedrooms: false,
    furnishing: true,
    forWhom: ['bachelors', 'students'],
    forWhomRequired: true,
    notesLabel: 'ملاحظات إضافية',
    notesPlaceholder: 'أضف أي تفاصيل تساعد في العثور على الغرفة المناسبة...',
  },
  apartment: {
    bedrooms: true,
    furnishing: true,
    forWhom: ['family', 'bachelors', 'students'],
    forWhomRequired: true,
    notesLabel: 'ملاحظات إضافية',
    notesPlaceholder: 'أضف أي تفاصيل تساعد في العثور على الشقة المناسبة...',
  },
  house: {
    bedrooms: true,
    furnishing: true,
    forWhom: ['family', 'bachelors', 'students'],
    forWhomRequired: true,
    notesLabel: 'ملاحظات إضافية',
    notesPlaceholder: 'أضف أي تفاصيل تساعد في العثور على البيت المناسب...',
  },
  floor: {
    bedrooms: true,
    furnishing: true,
    forWhom: ['family', 'bachelors', 'students'],
    forWhomRequired: true,
    notesLabel: 'ملاحظات إضافية',
    notesPlaceholder: 'أضف أي تفاصيل تساعد في العثور على الدور المناسب...',
  },
  shop: {
    bedrooms: false,
    furnishing: false,
    forWhom: null,
    notesLabel: 'نوع النشاط التجاري وتفاصيل إضافية',
    notesPlaceholder: 'مثال: محل ملابس، بقالة، مساحة تقريبية، واجهة على الشارع...',
  },
  office: {
    bedrooms: false,
    furnishing: true,
    forWhom: null,
    notesLabel: 'طبيعة العمل وتفاصيل إضافية',
    notesPlaceholder: 'مثال: مكتب استشارات، مساحة تقريبية، عدد الغرف/المكاتب، موقف سيارات...',
  },
  shared: {
    bedrooms: false,
    furnishing: true,
    forWhom: ['bachelors', 'students'],
    forWhomRequired: true,
    notesLabel: 'ملاحظات إضافية',
    notesPlaceholder: 'مثال: عدد السكان الحالي، نمط الحياة المفضل، الجنسية...',
  },
  family: {
    bedrooms: true,
    furnishing: true,
    forWhom: null,
    forceForWhom: 'family',
    notesLabel: 'ملاحظات إضافية',
    notesPlaceholder: 'مثال: عدد أفراد الأسرة، متطلبات خاصة...',
  },
  student: {
    bedrooms: true,
    furnishing: true,
    forWhom: null,
    forceForWhom: 'students',
    notesLabel: 'ملاحظات إضافية',
    notesPlaceholder: 'مثال: القرب من الجامعة، عدد الطلاب، ملاحظات أخرى...',
  },
};

export const getCategoryFields = (cat: ListingCategory | '' | null | undefined): CategoryFieldConfig | null => {
  if (!cat) return null;
  return CATEGORY_FIELDS[cat as ListingCategory] ?? null;
};
