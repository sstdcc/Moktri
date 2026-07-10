import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Aggregates counts of dashboard items that need the user's attention,
 * scoped to their role. Designed to be scalable — add new signals here.
 *
 * - admin/moderator: pending reports + pending verifications + listings pending review
 * - owner/broker:    pending listing_requests on their listings + their listings pending review
 * - renter:          new pending responses on their housing_requests
 */
export const useDashboardNotifications = (): number => {
  const { user, profile } = useAuth();
  const [count, setCount] = useState(0);
  const idRef = useRef(crypto.randomUUID());

  useEffect(() => {
    if (!user || !profile) { setCount(0); return; }
    const role = profile.role;

    const sumCounts = (results: { count: number | null; error: unknown }[]) =>
      results.reduce((acc, r) => acc + (r.error ? 0 : (r.count ?? 0)), 0);

    const fetchCount = async () => {
      try {
        if (role === 'admin' || role === 'moderator') {
          const [reports, verifications, pendingListings] = await Promise.all([
            supabase.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
            supabase.from('verification_applications').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
            supabase.from('listings').select('id', { count: 'exact', head: true }).eq('status', 'pending_review'),
          ]);
          setCount(sumCounts([reports, verifications, pendingListings]));
          return;
        }

        if (role === 'owner' || role === 'broker') {
          const [listingRequests, pendingListings] = await Promise.all([
            supabase.from('listing_requests').select('id', { count: 'exact', head: true })
              .eq('owner_id', user.id).eq('status', 'pending'),
            supabase.from('listings').select('id', { count: 'exact', head: true })
              .eq('owner_id', user.id).eq('status', 'pending_review'),
          ]);
          setCount(sumCounts([listingRequests, pendingListings]));
          return;
        }

        if (role === 'renter') {
          const { data: reqs, error: reqErr } = await supabase
            .from('housing_requests').select('id').eq('requester_id', user.id);
          if (reqErr || !reqs?.length) { setCount(0); return; }
          const ids = reqs.map((r) => r.id);
          const { count: c, error } = await supabase
            .from('request_responses').select('id', { count: 'exact', head: true })
            .in('request_id', ids).eq('status', 'pending');
          setCount(error ? 0 : (c ?? 0));
          return;
        }

        setCount(0);
      } catch {
        setCount(0);
      }
    };

    fetchCount();

    const channel = supabase
      .channel(`dashboard-notifications-${idRef.current}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'listing_requests' }, fetchCount)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'listings' }, fetchCount)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, fetchCount)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'verification_applications' }, fetchCount)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'request_responses' }, fetchCount)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'housing_requests' }, fetchCount)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, profile]);

  return count;
};
