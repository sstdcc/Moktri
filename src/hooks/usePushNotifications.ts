import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { onRegistered } from 'firebase/messaging';
import { supabase } from '@/integrations/supabase/client';
import DeviceTokenService from '@/services/DeviceTokenService';
import {
  getMessagingInstance,
  getTokenForRegistration,
  onForegroundMessage,
  requestAndGetToken,
  isMessagingSupported,
} from '@/firebase/messaging';

const PLATFORM = 'web';
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;
const MAX_RECENT_IDS = 50;

export interface PushNotificationsState {
  permission: NotificationPermission | null;
  token: string | null;
  isSupported: boolean;
  requestPermission: () => Promise<void>;
  registerCurrentToken: () => Promise<void>;
  unregisterCurrentToken: () => Promise<void>;
  error: string | null;
}

function toErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function usePushNotifications(userId: string | null): PushNotificationsState {
  const dts = useRef(new DeviceTokenService(supabase));
  const userIdRef = useRef(userId);
  userIdRef.current = userId;
  const prevUserIdRef = useRef(userId);
  const tokenRef = useRef<string | null>(null);
  const recentIdsRef = useRef<Set<string>>(new Set());

  const [permission, setPermission] = useState<NotificationPermission | null>(() =>
    typeof Notification !== 'undefined' ? Notification.permission : null
  );
  const [token, setToken] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    isMessagingSupported()
      .then((supported) => {
        if (mounted) setIsSupported(supported);
      })
      .catch(() => {
        if (mounted) setIsSupported(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const sync = () => {
      if (typeof Notification !== 'undefined') {
        setPermission(Notification.permission);
      }
    };
    sync();
    window.addEventListener('focus', sync);
    return () => window.removeEventListener('focus', sync);
  }, []);

  useEffect(() => {
    const prevUid = prevUserIdRef.current;
    prevUserIdRef.current = userId;
    const uid = userId;
    if (!uid) {
      if (prevUid) {
        dts.current.unregisterAllForUser(prevUid).catch(() => {});
      }
      tokenRef.current = null;
      setToken(null);
      setError(null);
      return;
    }
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    let cancelled = false;
    (async () => {
      try {
        const newToken = await getTokenForRegistration(VAPID_KEY);
        if (cancelled) return;
        await dts.current.register(uid, newToken, PLATFORM);
        if (cancelled) return;
        tokenRef.current = newToken;
        setToken(newToken);
        setError(null);
      } catch (e) {
        if (cancelled) return;
        setError(toErrorMessage(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!isSupported) return;
    return onForegroundMessage((payload) => {
      const data = payload.data ?? {};
      const id = data.notification_id;
      if (id) {
        if (recentIdsRef.current.has(id)) return;
        recentIdsRef.current.add(id);
        if (recentIdsRef.current.size > MAX_RECENT_IDS) {
          recentIdsRef.current.delete(recentIdsRef.current.values().next().value);
        }
      }
      toast.info(data.title_ar || 'إشعار جديد', {
        description: data.body_ar || undefined,
      });
    });
  }, [isSupported]);

  useEffect(() => {
    if (!isSupported) return;
    return onRegistered(getMessagingInstance(), async (newToken) => {
      const uid = userIdRef.current;
      if (!uid) return;
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
      try {
        await dts.current.register(uid, newToken, PLATFORM);
        tokenRef.current = newToken;
        setToken(newToken);
        setError(null);
      } catch (e) {
        setError(toErrorMessage(e));
      }
    });
  }, [isSupported]);

  const requestPermission = useCallback(async () => {
    setError(null);
    try {
      const newToken = await requestAndGetToken(VAPID_KEY);
      tokenRef.current = newToken;
      setToken(newToken);
      setPermission('granted');
      const uid = userIdRef.current;
      if (uid) {
        await dts.current.register(uid, newToken, PLATFORM);
      }
    } catch (e) {
      setPermission(typeof Notification !== 'undefined' ? Notification.permission : null);
      setError(toErrorMessage(e));
    }
  }, []);

  const registerCurrentToken = useCallback(async () => {
    const uid = userIdRef.current;
    if (!uid) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    setError(null);
    try {
      const newToken = await getTokenForRegistration(VAPID_KEY);
      await dts.current.register(uid, newToken, PLATFORM);
      tokenRef.current = newToken;
      setToken(newToken);
    } catch (e) {
      setError(toErrorMessage(e));
    }
  }, []);

  const unregisterCurrentToken = useCallback(async () => {
    const uid = userIdRef.current;
    if (!uid) return;
    setError(null);
    try {
      if (tokenRef.current) {
        await dts.current.unregister(tokenRef.current);
      } else {
        await dts.current.unregisterAllForUser(uid);
      }
      tokenRef.current = null;
      setToken(null);
    } catch (e) {
      setError(toErrorMessage(e));
    }
  }, []);

  return {
    permission: userId ? permission : null,
    token,
    isSupported,
    requestPermission,
    registerCurrentToken,
    unregisterCurrentToken,
    error: userId ? error : null,
  };
}
