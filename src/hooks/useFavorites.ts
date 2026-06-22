import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

/**
 * Global favorites hook — tracks which listing IDs are favorited
 * and provides an optimistic toggle function.
 */
export const useFavorites = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const queryKey = useMemo(() => ['favorites', user?.id ?? 'guest'], [user?.id]);
  const { data: favoriteIds = [], isLoading } = useQuery({
    queryKey,
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    initialData: [] as string[],
    queryFn: async () => {
      if (!user) return [];
    const { data } = await supabase
      .from('favorites')
      .select('listing_id')
      .eq('user_id', user.id);
      return (data ?? []).map(f => f.listing_id);
    },
  });

  const favSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);

  const isFavorited = useCallback((listingId: string) => favSet.has(listingId), [favSet]);

  const toggleFavorite = useCallback(async (listingId: string) => {
    if (!user) {
      navigate(`/auth?returnUrl=${window.location.pathname}`);
      return;
    }

    const was = favSet.has(listingId);

    queryClient.setQueryData<string[]>(queryKey, (prev = []) => {
      const next = new Set(prev);
      if (was) next.delete(listingId);
      else next.add(listingId);
      return Array.from(next);
    });

    if (was) {
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('listing_id', listingId);
      if (error) {
        toast.error('تعذر إزالة من المفضلة');
        queryClient.setQueryData<string[]>(queryKey, (prev = []) => Array.from(new Set([...prev, listingId])));
      }
    } else {
      const { error } = await supabase
        .from('favorites')
        .insert({ user_id: user.id, listing_id: listingId });
      if (error) {
        toast.error('تعذر الإضافة للمفضلة');
        queryClient.setQueryData<string[]>(queryKey, (prev = []) => prev.filter((id) => id !== listingId));
      }
    }
  }, [user, favSet, navigate, queryClient, queryKey]);

  return { isFavorited, toggleFavorite, loaded: !user || !isLoading };
};
