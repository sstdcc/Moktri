import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createNotificationService } from '@/services';
import type { NotificationQueryParams, PaginatedResult, NotificationRecord } from '@/types/notifications';

export function useNotifications(params: NotificationQueryParams) {
  return useQuery<PaginatedResult<NotificationRecord>>({
    queryKey: ['notifications', params],
    queryFn: () => createNotificationService(supabase).getNotifications(params),
    placeholderData: (prev) => prev,
  });
}

export function useNotification(id: string) {
  return useQuery<NotificationRecord>({
    queryKey: ['notification', id],
    queryFn: () => createNotificationService(supabase).getNotification(id),
    enabled: !!id,
  });
}
