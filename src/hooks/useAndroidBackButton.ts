import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { closeTopModalLayer, hasOpenModalLayer } from '@/lib/modalRegistry';

/**
 * Android hardware back-button handling (native only — no-op on web).
 *
 * Priority:
 *  1. If a modal layer (Dialog / AlertDialog / Sheet) is open → close the
 *     topmost layer, without navigating or exiting.
 *  2. If the router has history → navigate(-1) (same semantics as the app's
 *     existing AuthLayout/SettingsPage goBack helpers, which rely on
 *     window.history.state.idx).
 *  3. Otherwise → exit the application.
 */
export const useAndroidBackButton = () => {
  const navigate = useNavigate();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let removeListener: (() => void) | undefined;

    const backHandler = () => {
      if (hasOpenModalLayer()) {
        closeTopModalLayer();
        return;
      }

      const state = window.history.state as { idx?: number } | null;
      const idx = state && typeof state.idx === 'number' ? state.idx : 0;

      if (idx > 0) {
        navigate(-1);
        return;
      }

      // No router history left → leave the app.
      void App.exitApp();
    };

    App.addListener('backButton', backHandler).then((handle) => {
      removeListener = () => {
        void handle.remove();
      };
    });

    return () => {
      removeListener?.();
    };
  }, [navigate]);

  return null;
};