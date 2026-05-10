import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const useUnreadChats = (): number => {
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  const idRef = useRef(crypto.randomUUID());

  useEffect(() => {
    if (!user) { setCount(0); return; }

    const fetchCount = async () => {
      // Listing conversations
      const { data: lConvos } = await supabase
        .from('listing_conversations')
        .select('id')
        .or(`owner_id.eq.${user.id},user_id.eq.${user.id}`);

      // Request conversations
      const { data: rConvos } = await (supabase as any)
        .from('request_conversations')
        .select('id')
        .or(`requester_id.eq.${user.id},responder_id.eq.${user.id}`);

      let total = 0;

      if (lConvos && lConvos.length > 0) {
        const ids = lConvos.map((c: any) => c.id);
        const { count: c } = await supabase
          .from('listing_messages')
          .select('*', { count: 'exact', head: true })
          .in('conversation_id', ids)
          .neq('sender_id', user.id)
          .eq('is_read', false);
        if (c != null) total += c;
      }

      if (rConvos && rConvos.length > 0) {
        const ids = rConvos.map((c: any) => c.id);
        const { count: c } = await (supabase as any)
          .from('request_messages')
          .select('*', { count: 'exact', head: true })
          .in('conversation_id', ids)
          .neq('sender_id', user.id)
          .eq('is_read', false);
        if (c != null) total += c;
      }

      setCount(total);
    };

    fetchCount();

    const channel = supabase
      .channel(`unread-chats-${idRef.current}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'listing_messages' }, () => fetchCount())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'request_messages' }, () => fetchCount())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'listing_conversations' }, () => fetchCount())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'request_conversations' }, () => fetchCount())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  return count;
};
