import type { ReactNode } from 'react';
import { Home, Search, FileText, Heart, User, Plus } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { getPersistentTabHref, isPersistentBottomTabPath } from '@/lib/persistentTabs';

type NavItem = { label: string; icon: typeof Home; path: string };

export const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { t } = useTranslation();
  const showFab = profile?.role === 'owner' || profile?.role === 'broker';

  const navItems: NavItem[] = showFab
    ? [
        { label: t('nav.home'), icon: Home, path: '/' },
        { label: t('nav.marketRequests'), icon: FileText, path: '/requests' },
        { label: t('nav.search'), icon: Search, path: '/listings' },
        { label: t('nav.account'), icon: User, path: '/settings' },
      ]
    : [
        { label: t('nav.home'), icon: Home, path: '/' },
        { label: t('nav.search'), icon: Search, path: '/listings' },
        { label: t('nav.myRequests'), icon: FileText, path: '/requests' },
        { label: t('nav.favorites'), icon: Heart, path: '/favorites' },
        { label: t('nav.account'), icon: User, path: '/settings' },
      ];

  const isItemActive = (item: NavItem) =>
    location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));

  // Avoid piling up history when switching between persistent bottom tabs:
  // tab→tab switches use replace (Back won't randomly walk tab history), while
  // navigating into a tab from a detail/other page keeps a normal push so Back
  // returns to that page.
  const isOnTab = isPersistentBottomTabPath(location.pathname);
  const navigateTab = (href: string) => {
    navigate(href, isOnTab ? { replace: true } : undefined);
  };

  const renderNavButton = (item: NavItem, isActive: boolean) => (
    <button
      key={item.path}
      onClick={() => navigateTab(getPersistentTabHref(item.path))}
      className={cn(
        'relative flex flex-col items-center justify-center gap-0.5 py-2 transition-all duration-300 min-w-[44px] flex-1',
        isActive
          ? 'text-primary'
          : 'text-muted-foreground/60 active:scale-95'
      )}
      aria-label={item.label}
    >
      <div className={cn(
        'flex items-center justify-center w-10 h-9 rounded-2xl transition-all duration-300',
        isActive
          ? 'bg-primary/12'
          : 'hover:bg-muted/40'
      )}>
        <item.icon
          key={isActive ? 'a' : 'i'}
          className={cn(
            'h-[20px] w-[20px] transition-all duration-300',
            isActive ? 'stroke-[2.5px] animate-nav-icon-pop' : 'stroke-[1.8px]'
          )}
        />
      </div>
      <span className={cn(
        'text-[10px] font-tajawal leading-tight transition-all duration-300',
        isActive ? 'font-bold text-primary' : 'font-medium'
      )}>
        {item.label}
      </span>
      {/* Active dot indicator */}
      {isActive && (
        <span className="absolute bottom-0.5 left-1/2 w-1 h-1 rounded-full bg-primary animate-nav-dot-in" />
      )}
    </button>
  );

  return (
    <nav
      className="fixed bottom-3 left-3 right-3 z-50 pb-safe"
      aria-label={t('common.mainNav')}
    >
      <div
        className="mx-auto max-w-lg rounded-2xl border border-border/30 bg-card/75 backdrop-blur-xl backdrop-saturate-150"
        style={{
          boxShadow: '0 8px 32px -8px rgba(0,0,0,0.12), 0 2px 8px -2px rgba(0,0,0,0.06)',
        }}
      >
        <div className="flex h-[64px] items-center justify-around px-1">
          {navItems.flatMap((item, i) => {
            const isActive = isItemActive(item);
            const nodes: ReactNode[] = [];

            if (showFab && i === 2) {
              nodes.push(
                <div key="fab-slot" className="flex flex-1 items-center justify-center px-1">
                  <button
                    onClick={() => navigate('/listings/new')}
                    className="w-[48px] h-[48px] rounded-2xl bg-accent flex items-center justify-center -translate-y-4 transition-all duration-200 hover:brightness-105 active:scale-95"
                    aria-label={t('nav.addListingNew')}
                  >
                    <Plus className="h-5.5 w-5.5 text-accent-foreground stroke-[2.5px]" />
                  </button>
                </div>
              );
            }

            nodes.push(renderNavButton(item, isActive));
            return nodes;
          })}
        </div>
      </div>
    </nav>
  );
};
