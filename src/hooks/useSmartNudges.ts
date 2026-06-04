import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { calculateProfileCompletion } from '@/lib/profileCompletion';

export interface Nudge {
  id: string;
  message: string;
  actionLabel: string;
  path: string;
}

export function useSmartNudges(): Nudge[] {
  const { profile } = useAuth();

  return useMemo(() => {
    if (!profile) return [];
    const nudges: Nudge[] = [];
    const { percent } = calculateProfileCompletion(profile);

    if ((profile.total_listings ?? 0) === 0 && (profile.role === 'owner' || profile.role === 'broker')) {
      nudges.push({
        id: 'first-listing',
        message: 'ابدأ بإضافة أول إعلان لك',
        actionLabel: 'إضافة إعلان',
        path: '/listings/new',
      });
    }

    if ((profile.total_responses ?? 0) === 0 && profile.role === 'renter') {
      nudges.push({
        id: 'first-request',
        message: 'انشر طلب سكن لتجد خيارات أسرع',
        actionLabel: 'نشر طلب',
        path: '/requests/new',
      });
    }

    if (percent < 70) {
      nudges.push({
        id: 'complete-profile',
        message: 'أكمل ملفك لزيادة فرص التفاعل',
        actionLabel: 'إكمال الملف',
        path: '/settings',
      });
    }

    return nudges.slice(0, 2); // max 2 nudges at a time
  }, [profile]);
}
