import { createContext, useContext, useEffect, useState, ReactNode, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface PresenceContextValue {
  onlineUsers: Set<string>;
  isOnline: (userId: string) => boolean;
}

const PresenceContext = createContext<PresenceContextValue>({
  onlineUsers: new Set(),
  isOnline: () => false,
});

export const PresenceProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) {
      setOnlineUsers(new Set());
      return;
    }

    const channel = supabase.channel('online-users', {
      config: { presence: { key: user.id } },
    });

    const syncState = () => {
      const state = channel.presenceState<{ user_id: string; online: boolean }>();
      const ids = new Set<string>();
      Object.keys(state).forEach((key) => {
        const metas = state[key];
        if (metas && metas.length > 0) ids.add(key);
      });
      setOnlineUsers(ids);
    };

    channel
      .on('presence', { event: 'sync' }, syncState)
      .on('presence', { event: 'join' }, syncState)
      .on('presence', { event: 'leave' }, syncState)
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: user.id,
            online: true,
            last_seen: new Date().toISOString(),
          });
        }
      });

    return () => {
      channel.untrack();
      supabase.removeChannel(channel);
    };
  }, [user]);

  const value = useMemo<PresenceContextValue>(
    () => ({ onlineUsers, isOnline: (id: string) => onlineUsers.has(id) }),
    [onlineUsers]
  );

  return <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>;
};

export const usePresence = () => useContext(PresenceContext);
