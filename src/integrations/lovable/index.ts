import type { AuthError, Provider } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { supabase } from '../supabase/client';

type SignInOptions = {
  redirect_uri?: string;
  extraParams?: Record<string, string>;
};

// Resolves once the system browser / Custom Tab is closed by the user.
// The auth pages use it to re-enable the "Continue with Google" button on cancel.
const waitForBrowserClose = (): Promise<void> => {
  return new Promise((resolve) => {
    let resolved = false;
    void Browser.addListener('browserFinished', () => {
      if (resolved) return;
      resolved = true;
      resolve();
    }).then((handle) => {
      // no-op handle kept for symmetry; listener removal happens on unmount below
      return handle;
    });
  });
};

// On Android the WebView lives at https://localhost, so Google OAuth must run in
// the system browser (Chrome Custom Tab via @capacitor/browser) instead of inside
// the WebView. The OAuth result is delivered back to the app through a custom URL
// scheme (intent-filter in AndroidManifest.xml) and consumed by useAppDeepLink.
const ANDROID_OAUTH_REDIRECT_URI = 'com.moktari.app://complete-profile';

type SignInWithOAuthResult = {
  error?: AuthError;
  redirected?: boolean;
  native?: boolean;
  browserClosed?: Promise<void>;
  data?: { provider: string; url: string | null };
};

export const lovable = {
  auth: {
    signInWithOAuth: async (
      provider: 'google' | 'apple' | 'microsoft' | 'lovable',
      opts?: SignInOptions
    ): Promise<SignInWithOAuthResult> => {
      const isAndroid = Capacitor.getPlatform() === 'android';

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: provider as Provider,
        options: {
          redirectTo: isAndroid ? ANDROID_OAUTH_REDIRECT_URI : opts?.redirect_uri,
          skipBrowserRedirect: isAndroid,
          ...(provider === 'google'
            ? { queryParams: { prompt: 'select_account', ...(opts?.extraParams || {}) } }
            : opts?.extraParams
              ? { queryParams: opts.extraParams }
              : {}),
        },
      });

      if (error) {
        return { error };
      }

      if (data?.url) {
        if (isAndroid) {
          const browserClosed = waitForBrowserClose();
          await Browser.open({ url: data.url });
          return { redirected: true, native: true, browserClosed };
        }
        return { redirected: true };
      }

      return { data: data as { provider: string; url: string | null } };
    },
  },
};