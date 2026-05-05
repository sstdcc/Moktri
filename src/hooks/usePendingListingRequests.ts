import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const usePendingListingRequests = (): number => {
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  const idRef = useRef(crypto.randomUUID());

  useEffect(() => {
    if (!user) { setCount(0); return; }

    const fetchCount = async () => {
      const { count: c, error } = await supabase
        .from('listing_requests')
        .select('*', { count: 'exact', head: true })
        .eq('owner_id', user.id)
        .eq('status', 'pending');
      if (!error && c != null) setCount(c);
    };

    fetchCount();

    const channel = supabase
      .channel(`pending-listing-requests-${idRef.current}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'listing_requests',
      }, () => { fetchCount(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  return count;
};
