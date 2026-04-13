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
      // Get conversations where user is a member
      const { data: convos } = await supabase
        .from('listing_conversations')
        .select('id')
        .or(`owner_id.eq.${user.id},user_id.eq.${user.id}`);

      if (!convos || convos.length === 0) { setCount(0); return; }

      const convoIds = convos.map(c => c.id);

      const { count: c, error } = await supabase
        .from('listing_messages')
        .select('*', { count: 'exact', head: true })
        .in('conversation_id', convoIds)
        .neq('sender_id', user.id)
        .eq('is_read', false);

      if (!error && c != null) setCount(c);
    };

    fetchCount();

    const channel = supabase
      .channel(`unread-chats-${idRef.current}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'listing_messages',
      }, () => { fetchCount(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  return count;
};
