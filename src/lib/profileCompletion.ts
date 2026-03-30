import type { Profile } from '@/types/database';

interface CompletionResult {
  percent: number;
  missingFields: { key: string; label: string; weight: number }[];
  completedFields: { key: string; label: string; weight: number }[];
}

const FIELD_WEIGHTS = [
  { key: 'full_name', label: 'الاسم الكامل', weight: 20, check: (p: Profile) => !!p.full_name?.trim() },
  { key: 'role', label: 'نوع الحساب', weight: 20, check: (p: Profile) => !!p.role && p.role !== 'renter' || p.role === 'renter' },
  { key: 'whatsapp_number', label: 'رقم واتساب', weight: 15, check: (p: Profile) => !!p.whatsapp_number?.trim() },
  { key: 'avatar_url', label: 'صورة شخصية', weight: 15, check: (p: Profile) => !!p.avatar_url?.trim() },
  { key: 'activity', label: 'نشاط (إعلان أو طلب)', weight: 30, check: (p: Profile) => (p.total_listings ?? 0) > 0 || (p.total_responses ?? 0) > 0 },
];

export function calculateProfileCompletion(profile: Profile | null): CompletionResult {
  if (!profile) return { percent: 0, missingFields: FIELD_WEIGHTS, completedFields: [] };

  const completed: CompletionResult['completedFields'] = [];
  const missing: CompletionResult['missingFields'] = [];

  for (const field of FIELD_WEIGHTS) {
    if (field.check(profile)) {
      completed.push({ key: field.key, label: field.label, weight: field.weight });
    } else {
      missing.push({ key: field.key, label: field.label, weight: field.weight });
    }
  }

  const percent = completed.reduce((sum, f) => sum + f.weight, 0);
  return { percent, missingFields: missing, completedFields: completed };
}
