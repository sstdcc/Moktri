import type { Profile } from '@/types/database';

interface CompletionResult {
  percent: number;
  missingFields: { key: string; label: string; weight: number }[];
  completedFields: { key: string; label: string; weight: number }[];
}

interface CompletionOptions {
  hasListings?: boolean;
  hasRequests?: boolean;
}

const BASE_FIELDS = [
  { key: 'full_name', label: 'الاسم الكامل', weight: 20, check: (p: Profile) => !!p.full_name?.trim() },
  { key: 'role', label: 'نوع الحساب', weight: 20, check: (_p: Profile) => true },
  { key: 'whatsapp_number', label: 'رقم واتساب', weight: 15, check: (p: Profile) => !!p.whatsapp_number?.trim() },
  { key: 'avatar_url', label: 'صورة شخصية', weight: 15, check: (p: Profile) => !!p.avatar_url?.trim() },
];

export function calculateProfileCompletion(profile: Profile | null, opts?: CompletionOptions): CompletionResult {
  if (!profile) {
    const all = [...BASE_FIELDS, { key: 'activity', label: 'نشاط (إعلان أو طلب)', weight: 30 }];
    return { percent: 0, missingFields: all.map(f => ({ key: f.key, label: f.label, weight: f.weight })), completedFields: [] };
  }

  const isOwnerOrBroker = profile.role === 'owner' || profile.role === 'broker';
  const activityLabel = isOwnerOrBroker ? 'إضافة إعلان' : 'نشر طلب سكن';
  const activityDone = isOwnerOrBroker
    ? (opts?.hasListings ?? (profile.total_listings ?? 0) > 0)
    : (opts?.hasRequests ?? false);

  const fields = [
    ...BASE_FIELDS,
    { key: 'activity', label: activityLabel, weight: 30, check: () => activityDone },
  ];

  const completed: CompletionResult['completedFields'] = [];
  const missing: CompletionResult['missingFields'] = [];

  for (const field of fields) {
    if (field.check(profile)) {
      completed.push({ key: field.key, label: field.label, weight: field.weight });
    } else {
      missing.push({ key: field.key, label: field.label, weight: field.weight });
    }
  }

  const percent = completed.reduce((sum, f) => sum + f.weight, 0);
  return { percent, missingFields: missing, completedFields: completed };
}
