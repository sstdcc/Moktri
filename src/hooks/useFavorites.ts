import { useState, useEffect, useCallback } from 'react';
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
  const [favSet, setFavSet] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  const fetchFavorites = useCallback(async () => {
    if (!user) { setFavSet(new Set()); setLoaded(true); return; }
    const { data } = await supabase
      .from('favorites')
      .select('listing_id')
      .eq('user_id', user.id);
    setFavSet(new Set((data ?? []).map(f => f.listing_id)));
    setLoaded(true);
  }, [user]);

  useEffect(() => { fetchFavorites(); }, [fetchFavorites]);

  const isFavorited = useCallback((listingId: string) => favSet.has(listingId), [favSet]);

  const toggleFavorite = useCallback(async (listingId: string) => {
    if (!user) {
      navigate(`/auth?returnUrl=${window.location.pathname}`);
      return;
    }

    const was = favSet.has(listingId);

    // Optimistic update
    setFavSet(prev => {
      const next = new Set(prev);
      if (was) next.delete(listingId);
      else next.add(listingId);
      return next;
    });

    if (was) {
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('listing_id', listingId);
      if (error) {
        toast.error('تعذر إزالة من المفضلة');
        setFavSet(prev => { const n = new Set(prev); n.add(listingId); return n; });
      }
    } else {
      const { error } = await supabase
        .from('favorites')
        .insert({ user_id: user.id, listing_id: listingId });
      if (error) {
        toast.error('تعذر الإضافة للمفضلة');
        setFavSet(prev => { const n = new Set(prev); n.delete(listingId); return n; });
      }
    }
  }, [user, favSet, navigate]);

  return { isFavorited, toggleFavorite, loaded };
};
