import { useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const useUnreadCount = (): number => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const idRef = useRef(crypto.randomUUID());
  const queryKey = useMemo(() => ['unread-notifications-count', user?.id ?? 'guest'], [user?.id]);

  const { data: count = 0 } = useQuery({
    queryKey,
    enabled: !!user,
    staleTime: 60 * 1000,
    gcTime: 30 * 60 * 1000,
    initialData: 0,
    queryFn: async () => {
      if (!user) return 0;
      const { count: c, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
      return !error && c != null ? c : 0;
    },
  });

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`unread-notifications-${idRef.current}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, () => { queryClient.invalidateQueries({ queryKey }); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient, queryKey]);

  return count;
};
