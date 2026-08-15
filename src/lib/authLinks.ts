// Single source of truth for auth-related URLs (password reset, OAuth, etc.).
//
// IMPORTANT (Stage A / deferred verification):
//  - VITE_AUTH_ORIGIN is NOT yet configured because Moktari is local-only.
//  - Until a real production HTTPS domain exists, we fall back to
//    window.location.origin so the existing Web behaviour is preserved.
//  - On Android the WebView origin is https://localhost, so the recovery link
//    will only become valid for phones once VITE_AUTH_ORIGIN is set to a real
//    deployed domain (STAGE B — requires deployment + Supabase allow-list +
//    assetlinks.json). Do NOT invent a domain here.
import { Capacitor } from '@capacitor/core';

// STAGE A: on native Android the reset link is delivered back into the app via
// the custom URL scheme (intent-filter in AndroidManifest.xml), mirroring the
// working Google OAuth callback (com.moktari.app://complete-profile). The
// caller must register this URI in the Supabase Auth redirect allow-list.
export const getAndroidResetPasswordUri = (): string => 'com.moktari.app://reset-password';

export const getAuthOrigin = (): string => {
  const configured = import.meta.env.VITE_AUTH_ORIGIN as string | undefined;
  const origin = configured?.trim();
  return origin && origin.length > 0 ? origin : window.location.origin;
};

export const getResetPasswordUrl = (): string =>
  Capacitor.isNativePlatform()
    ? getAndroidResetPasswordUri()
    : `${getAuthOrigin()}/reset-password`;