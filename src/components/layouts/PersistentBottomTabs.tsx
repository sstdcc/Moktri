import { useEffect, useRef } from 'react';
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

  if (activeTab) lastActiveTabRef.current = activeTab;

  useEffect(() => {
    if (!activeTab) return;
    rememberPersistentTabLocation(location.pathname, location.search);
  }, [activeTab, location.pathname, location.search]);

  const visibleTab = activeTab ?? lastActiveTabRef.current;

  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden bg-background" dir="rtl">
      {tabs.map((tab) => {
        const isActive = tab.id === visibleTab;
        return (
          <section
            key={tab.id}
            aria-label={tab.label}
            aria-hidden={!isActive}
            className={cn(
              'absolute inset-0 h-full min-h-0 w-full bg-background',
              isActive ? 'block motion-safe:animate-tab-panel-in' : 'hidden',
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