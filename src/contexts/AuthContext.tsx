import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { usePushNotifications, type PushNotificationsState } from '@/hooks/usePushNotifications';
import DeviceTokenService from '@/services/DeviceTokenService';
import type { Profile } from '@/types/database';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  profileError: boolean;
  signOut: () => Promise<void>;
  retryProfile: () => void;
  push: PushNotificationsState;
}

const noopPush: PushNotificationsState = {
  permission: null,
  token: null,
  isSupported: false,
  requestPermission: async () => {},
  registerCurrentToken: async () => {},
  unregisterCurrentToken: async () => {},
  error: null,
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  loading: true,
  profileError: false,
  signOut: async () => {},
  retryProfile: () => {},
  push: noopPush,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState(false);

  const push = usePushNotifications(user?.id ?? null);

  const fetchProfile = async (userId: string) => {
    setProfileError(false);
    // Fetch base profile (no private contact columns — those are restricted at the DB level)
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, role, bio, is_verified, verification_badge, is_active, total_listings, total_responses, created_at, updated_at')
      .eq('id', userId)
      .single();
    if (error || !data) {
      setProfileError(true);
      setProfile(null);
      return;
    }
    // Block banned users from accessing the app
    if ((data as any).is_active === false) {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setProfile(null);
      const { toast } = await import('sonner');
      toast.error('تم حظر حسابك. تواصل مع الإدارة.');
      return;
    }
    // Fetch own contact details (phone + whatsapp) via SECURITY DEFINER helper
    const { data: contact } = await supabase.rpc('get_my_contact');
    const c = Array.isArray(contact) ? contact[0] : null;
    setProfile({
      ...(data as any),
      phone: c?.phone ?? '',
      whatsapp_number: c?.whatsapp_number ?? null,
    });
  };

  const retryProfile = () => {
    if (user) {
      setLoading(true);
      fetchProfile(user.id).finally(() => setLoading(false));
    }
  };

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!mounted) return;
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => {
            if (mounted) {
              fetchProfile(session.user.id).finally(() => {
                if (mounted) setLoading(false);
              });
            }
          }, 0);
        } else {
          setProfile(null);
          setProfileError(false);
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id).finally(() => {
          if (mounted) setLoading(false);
        });
      } else {
        if (mounted) setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    if (user) {
      const dts = new DeviceTokenService(supabase);
      dts.unregisterAllForUser(user.id).catch(() => {});
    }
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setProfileError(false);
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, profileError, signOut: handleSignOut, retryProfile, push }}>
      {children}
    </AuthContext.Provider>
  );
};
