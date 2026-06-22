import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AuthGuard } from '@/components/guards/AuthGuard';
import HomePage from '@/pages/HomePage';
import ListingsPage from '@/pages/ListingsPage';
import HousingRequestsPage from '@/pages/HousingRequestsPage';
import FavoritesPage from '@/pages/FavoritesPage';
import NotificationsPage from '@/pages/NotificationsPage';
import SettingsPage from '@/pages/SettingsPage';
import { cn } from '@/lib/utils';
import {
  getPersistentTabId,
  rememberPersistentTabLocation,
  type PersistentTabId,
} from '@/lib/persistentTabs';

const tabs: { id: PersistentTabId; label: string; node: React.ReactNode }[] = [
  { id: 'home', label: 'الرئيسية', node: <HomePage /> },
  { id: 'listings', label: 'البحث', node: <ListingsPage /> },
  { id: 'requests', label: 'طلبات السكن', node: <HousingRequestsPage /> },
  { id: 'favorites', label: 'المفضلة', node: <AuthGuard><FavoritesPage /></AuthGuard> },
  { id: 'notifications', label: 'الإشعارات', node: <AuthGuard><NotificationsPage /></AuthGuard> },
  { id: 'settings', label: 'الحساب', node: <AuthGuard><SettingsPage /></AuthGuard> },
];

export const PersistentBottomTabs = () => {
  const location = useLocation();
  const activeTab = getPersistentTabId(location.pathname);
  const lastActiveTabRef = useRef<PersistentTabId>(activeTab ?? 'home');
  const [mountedTabs, setMountedTabs] = useState<Set<PersistentTabId>>(() => new Set([activeTab ?? 'home']));

  if (activeTab) lastActiveTabRef.current = activeTab;

  const mountedTabsKey = useMemo(() => Array.from(mountedTabs).sort().join('|'), [mountedTabs]);

  useEffect(() => {
    if (!activeTab) return;
    rememberPersistentTabLocation(location.pathname, location.search);
    setMountedTabs((prev) => {
      if (prev.has(activeTab)) return prev;
      const next = new Set(prev);
      next.add(activeTab);
      return next;
    });
  }, [activeTab, location.pathname, location.search]);

  useEffect(() => {
    let cancelled = false;
    const timers: number[] = [];
    const idleCallbacks: number[] = [];
    const orderedTabs = tabs
      .map((tab) => tab.id)
      .filter((id) => id !== lastActiveTabRef.current);

    const mountTab = (id: PersistentTabId) => {
      if (cancelled) return;
      setMountedTabs((prev) => {
        if (prev.has(id)) return prev;
        const next = new Set(prev);
        next.add(id);
        return next;
      });
    };

    orderedTabs.forEach((id, index) => {
      const schedule = () => mountTab(id);
      const delay = 650 + index * 220;
      timers.push(window.setTimeout(() => {
        if ('requestIdleCallback' in window) {
          const idleId = window.requestIdleCallback(schedule, { timeout: 1200 });
          idleCallbacks.push(idleId);
        } else {
          schedule();
        }
      }, delay));
    });

    return () => {
      cancelled = true;
      timers.forEach(window.clearTimeout);
      if ('cancelIdleCallback' in window) {
        idleCallbacks.forEach((id) => window.cancelIdleCallback(id));
      }
    };
  }, []);

  useEffect(() => {
    if (!activeTab) return;
    const titleByTab: Record<PersistentTabId, string> = {
      home: 'Moktari (مُكتري) - سوق الإيجارات في تعز',
      listings: 'الإعلانات | مُكتري',
      requests: 'طلبات السكن | مُكتري',
      favorites: 'المفضلة | مُكتري',
      notifications: 'الإشعارات | مُكتري',
      settings: 'الإعدادات | مُكتري',
    };
    document.title = titleByTab[activeTab];
  }, [activeTab, mountedTabsKey]);

  const visibleTab = activeTab ?? lastActiveTabRef.current;

  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden bg-background" dir="rtl">
      {tabs.map((tab) => {
        const isActive = tab.id === visibleTab;
        const shouldMount = mountedTabs.has(tab.id) || isActive;
        if (!shouldMount) return null;
        return (
          <section
            key={tab.id}
            aria-label={tab.label}
            aria-hidden={!isActive}
            className={cn(
              'absolute inset-0 h-full min-h-0 w-full bg-background transition-opacity duration-150 ease-out',
              isActive
                ? 'visible z-10 opacity-100 motion-safe:animate-tab-panel-in'
                : 'invisible z-0 opacity-0 pointer-events-none',
            )}
          >
            <div className="h-full min-h-0 w-full overflow-y-auto overflow-x-hidden overscroll-contain">
              {tab.node}
            </div>
          </section>
        );
      })}
    </div>
  );
};