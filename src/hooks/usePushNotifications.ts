import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { PushNotifications, type PermissionState } from '@capacitor/push-notifications';
import { toast } from 'sonner';
import { onRegistered } from 'firebase/messaging';
import { supabase } from '@/integrations/supabase/client';
import DeviceTokenService from '@/services/DeviceTokenService';
import { getPersistentTabHref } from '@/lib/persistentTabs';
import {
  getMessagingInstance,
  getTokenForRegistration,
  onForegroundMessage,
  requestAndGetToken,
  isMessagingSupported,
} from '@/firebase/messaging';

const IS_NATIVE = Capacitor.isNativePlatform();
const NATIVE_PLATFORM = Capacitor.getPlatform();
const PLATFORM = IS_NATIVE ? (NATIVE_PLATFORM === 'ios' ? 'ios' : 'android') : 'web';
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;
const MAX_RECENT_IDS = 50;

// Android notification channel that FCM messages target via
// send-fcm's android.notification.channel_id. Importance HIGH (4) enables
// heads-up/banner + sound + vibration; it must exist before any notification
// is displayed (channels cannot change importance after creation).
const ANDROID_CHANNEL_ID = 'default';

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

function mapPermissionState(state: PermissionState): NotificationPermission {
  if (state === 'granted') return 'granted';
  if (state === 'denied') return 'denied';
  return 'default';
}

export function usePushNotifications(userId: string | null): PushNotificationsState {
  const dts = useRef(new DeviceTokenService(supabase));
  const userIdRef = useRef(userId);
  userIdRef.current = userId;
  const prevUserIdRef = useRef(userId);
  const tokenRef = useRef<string | null>(null);
  const recentIdsRef = useRef<Set<string>>(new Set());
  const lastHandledLinkRef = useRef<string | null>(null);

  const navigate = useNavigate();
  const location = useLocation();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  const currentPathRef = useRef(location.pathname + location.search);
  currentPathRef.current = location.pathname + location.search;

  const [permission, setPermission] = useState<NotificationPermission | null>(() =>
    typeof Notification !== 'undefined' ? Notification.permission : null
  );
  const [token, setToken] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Platform support detection.
  useEffect(() => {
    let mounted = true;
    if (IS_NATIVE) {
      // The Capacitor plugin is always available on a native build.
      if (mounted) setIsSupported(true);
      return;
    }
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

  // Keep the web permission in sync on window focus (web only).
  useEffect(() => {
    if (IS_NATIVE) return;
    const sync = () => {
      if (typeof Notification !== 'undefined') {
        setPermission(Notification.permission);
      }
    };
    sync();
    window.addEventListener('focus', sync);
    return () => window.removeEventListener('focus', sync);
  }, []);

  // Native: reflect the plugin permission state.
  useEffect(() => {
    if (!IS_NATIVE) return;
    let mounted = true;
    const sync = () => {
      PushNotifications.checkPermissions()
        .then((status) => {
          if (mounted) setPermission(mapPermissionState(status.receive));
        })
        .catch(() => {
          if (mounted) setPermission(null);
        });
    };
    sync();
    return () => {
      mounted = false;
    };
  }, []);

  // Native: create the Android notification channel BEFORE registration /
  // any incoming notification can be displayed. Importance HIGH (4) is what
  // unlocks heads-up/banner + sound + vibration on Android 8+.
  useEffect(() => {
    if (!IS_NATIVE || NATIVE_PLATFORM !== 'android') return;
    PushNotifications.createChannel({
      id: ANDROID_CHANNEL_ID,
      name: 'التنبيهات',
      description: 'إشعارات التطبيق والتنبيهات',
      importance: 4, // IMPORTANCE_HIGH
      vibration: true,
      lights: true,
    }).catch((e) => {
      // Expected on Android < 8 (API < 26) where channels don't exist; the
      // FCM fallback channel is used instead there. Not a user-facing error.
      console.warn('[usePushNotifications] createChannel failed:', e);
    });
  }, []);

  // Register a token for the signed-in user (or clean up on logout).
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
    if (IS_NATIVE) {
      if (permission !== 'granted') return;
      let cancelled = false;
      PushNotifications.register()
        .then(() => {
          // Token arrives via the 'registration' listener below.
        })
        .catch((e) => {
          if (!cancelled) setError(toErrorMessage(e));
        });
      return () => {
        cancelled = true;
      };
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
  }, [userId, permission]);

  // Native: 'registration' / 'registrationError' listeners + foreground toast.
  useEffect(() => {
    if (!IS_NATIVE) return;
    let removeRegistration: (() => void) | undefined;
    let removeRegistrationError: (() => void) | undefined;
    let removeReceived: (() => void) | undefined;

    PushNotifications.addListener('registration', async (registration) => {
      const uid = userIdRef.current;
      if (!uid) return;
      const newToken = registration.value;
      try {
        await dts.current.register(uid, newToken, PLATFORM);
        tokenRef.current = newToken;
        setToken(newToken);
        setError(null);
      } catch (e) {
        setError(toErrorMessage(e));
      }
    }).then((h) => {
      removeRegistration = () => h.remove();
    });

    PushNotifications.addListener('registrationError', (err) => {
      setError(err.error || 'registration-error');
    }).then((h) => {
      removeRegistrationError = () => h.remove();
    });

    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      const data = notification.data ?? {};
      const id = data.notification_id;
      if (id) {
        if (recentIdsRef.current.has(id)) return;
        recentIdsRef.current.add(id);
        if (recentIdsRef.current.size > MAX_RECENT_IDS) {
          recentIdsRef.current.delete(recentIdsRef.current.values().next().value);
        }
      }
      toast.info(data.title_ar || notification.title || 'إشعار جديد', {
        description: data.body_ar || notification.body || undefined,
      });
    }).then((h) => {
      removeReceived = () => h.remove();
    });

    // Native: tapping a push notification opens its in-app link (fallback to
    // the notifications tab), using the same router navigation as the deep
    // linking hook (useAppDeepLink) so no second mechanism is introduced.
    // The dedupe guard skips taps already navigated to (pressing the same
    // notification twice, or a cold-start + appUrlOpen double delivery).
    let removeActionPerformed: (() => void) | undefined;
    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      const data = action.notification?.data ?? {};
      const link: unknown = data.link;
      let targetLink: string | null = null;
      if (typeof link === 'string' && link.length > 0 && link.startsWith('/')) {
        targetLink = link;
      } else {
        targetLink = '/notifications';
      }
      if (lastHandledLinkRef.current === targetLink) return;
      lastHandledLinkRef.current = targetLink;
      const resolvedHref = getPersistentTabHref(targetLink);
      const targetPath = resolvedHref.split('?')[0];
      if (currentPathRef.current.split('?')[0] === targetPath) return;
      navigateRef.current(resolvedHref);
    }).then((h) => {
      removeActionPerformed = () => h.remove();
    });

    return () => {
      removeRegistration?.();
      removeRegistrationError?.();
      removeReceived?.();
      removeActionPerformed?.();
    };
  }, []);

  // Web: foreground messages (in-app toast) + token refresh via onRegistered.
  useEffect(() => {
    if (IS_NATIVE) return;
    if (!isSupported) return;
    const removeMessage = onForegroundMessage((payload) => {
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
    const removeRegistered = onRegistered(getMessagingInstance(), async (newToken) => {
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
    return () => {
      removeMessage();
      removeRegistered();
    };
  }, [isSupported]);

  const requestPermission = useCallback(async () => {
    setError(null);
    try {
      if (IS_NATIVE) {
        const status = await PushNotifications.requestPermissions();
        setPermission(mapPermissionState(status.receive));
        if (status.receive === 'granted') {
          const uid = userIdRef.current;
          if (uid) {
            await PushNotifications.register();
          }
        }
        return;
      }
      const newToken = await requestAndGetToken(VAPID_KEY);
      tokenRef.current = newToken;
      setToken(newToken);
      setPermission('granted');
      const uid = userIdRef.current;
      if (uid) {
        await dts.current.register(uid, newToken, PLATFORM);
      }
    } catch (e) {
      if (!IS_NATIVE && typeof Notification !== 'undefined') {
        setPermission(Notification.permission);
      }
      setError(toErrorMessage(e));
    }
  }, []);

  const registerCurrentToken = useCallback(async () => {
    const uid = userIdRef.current;
    if (!uid) return;
    setError(null);
    try {
      if (IS_NATIVE) {
        await PushNotifications.register();
        return;
      }
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
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
      if (IS_NATIVE) {
        await PushNotifications.unregister();
        tokenRef.current = null;
        setToken(null);
        return;
      }
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
