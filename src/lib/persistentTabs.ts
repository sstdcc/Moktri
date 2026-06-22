export type PersistentTabId = 'home' | 'listings' | 'requests' | 'favorites' | 'notifications' | 'settings';

const defaultHrefByTab: Record<PersistentTabId, string> = {
  home: '/',
  listings: '/listings',
  requests: '/requests',
  favorites: '/favorites',
  notifications: '/notifications',
  settings: '/settings',
};

const lastHrefByTab = new Map<PersistentTabId, string>(
  Object.entries(defaultHrefByTab) as [PersistentTabId, string][],
);

export const getPersistentTabId = (pathname: string): PersistentTabId | null => {
  if (pathname === '/') return 'home';
  if (pathname === '/listings') return 'listings';
  if (pathname === '/requests') return 'requests';
  if (pathname === '/favorites') return 'favorites';
  if (pathname === '/notifications') return 'notifications';
  if (pathname === '/settings') return 'settings';
  return null;
};

export const isPersistentBottomTabPath = (pathname: string) => getPersistentTabId(pathname) !== null;

export const rememberPersistentTabLocation = (pathname: string, search = '') => {
  const tabId = getPersistentTabId(pathname);
  if (!tabId) return;
  lastHrefByTab.set(tabId, `${pathname}${search}`);
};

export const getPersistentTabHref = (basePath: string) => {
  const tabId = getPersistentTabId(basePath);
  if (!tabId) return basePath;
  return lastHrefByTab.get(tabId) ?? defaultHrefByTab[tabId];
};