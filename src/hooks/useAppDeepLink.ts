import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { supabase } from '@/integrations/supabase/client';

// Android deep-link handling for the Capacitor app.
// On the web this hook is a no-op: the browser already navigates to
// /reset-password#access_token=... and supabase-js detects the session itself.

// On Android the WebView lives at https://localhost, so an incoming URL is
// delivered to us through @capacitor/app instead of the browser address bar.
// Two flows are captured:
//   1. App Links — https://<domain>/reset-password#access_token=... (recovery)
//   2. Google OAuth callback — com.moktari.app://complete-profile#access_token=...
//      (custom scheme, see the intent-filter in AndroidManifest.xml)
// We hand the Supabase tokens to supabase-js via setSession() so
// PASSWORD_RECOVERY / SIGNED_IN fire exactly like on web, then navigate.
export const useAppDeepLink = () => {
  const navigate = useNavigate();
  const lastHandledRef = useRef<string | null>(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let active = true;

    const handleRoute = async (url: string) => {
      if (!active) return;

      // The same URL can arrive twice: once for the cold start (getLaunchUrl)
      // and once for the warm start (appUrlOpen). Dedupe identical deliveries
      // so setSession()/navigation run exactly once per callback URL.
      if (lastHandledRef.current === url) return;
      lastHandledRef.current = url;

      try {
        const parsed = new URL(url);
        const { host, pathname, hash } = parsed;

        const isOAuthCallback = host === 'complete-profile' || pathname.startsWith('/complete-profile');
        const isResetPassword =
          host === 'reset-password' || pathname.startsWith('/reset-password');

        if (!isOAuthCallback && !isResetPassword) return;

        const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');

        // A callback URL without both tokens carries no session to restore —
        // treat it as a failed OAuth/recovery handoff and fall back to the
        // auth entry screen instead of navigating as if sign-in had succeeded.
        if (!accessToken || !refreshToken) {
          console.error('[deep-link] incoming URL missing Supabase tokens');
          navigate(isResetPassword ? '/auth' : '/signup', { replace: true });
          return;
        }

        // Await session creation before routing so navigation never races ahead
        // of the auth state: CompleteProfilePage/AuthContext read `user` right
        // after onAuthStateChange, so the session must exist before we navigate.
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (!active) return;

        if (error) {
          console.error('[deep-link] setSession failed for incoming URL');
          navigate(isResetPassword ? '/auth' : '/signup', { replace: true });
          return;
        }

        navigate(isOAuthCallback ? '/complete-profile' : '/reset-password', { replace: true });
      } catch {
        // never surface raw token data; log a generic marker only
        console.error('[deep-link] could not handle incoming OAuth/recovery URL');
      }
    };

    // Cold start: URL that launched the app.
    void App.getLaunchUrl().then((res) => {
      if (active && res?.url) void handleRoute(res.url);
    });

    // Warm start: app already running or resumed from background.
    const listener = App.addListener('appUrlOpen', (event) => {
      void handleRoute(event.url);
    });

    return () => {
      active = false;
      void listener.then((l) => l.remove());
    };
  }, [navigate]);

  return null;
};