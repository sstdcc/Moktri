import { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bell } from 'lucide-react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { BottomNav } from '@/components/ui/BottomNav';
import { Logo } from '@/components/ui/Logo';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/contexts/AuthContext';
import { useUnreadCount } from '@/hooks/useUnreadCount';
import { PageTransition } from '@/components/layouts/PageTransition';
import { useDir } from '@/i18n/useDir';

export const MainLayout = ({ children }: { children: ReactNode }) => {
  const isMobile = useIsMobile();
  const location = useLocation();
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const unreadCount = useUnreadCount();
  const { t } = useTranslation();
  const dir = useDir();
  const isChatDetailRoute = /^\/(chat\/[^/]+|request-chat\/[^/]+)$/.test(location.pathname);
  const showAppHeader = !isChatDetailRoute;
  const showBottomNav =
    !isChatDetailRoute && isMobile && profile?.role !== 'admin' && profile?.role !== 'moderator';

  return (
    <SidebarProvider>
      <div className="h-[100dvh] flex w-full overflow-hidden" dir={dir}>
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0 h-[100dvh] overflow-hidden">
          {showAppHeader && (
            <header className="shrink-0 h-14 border-b border-border/40 bg-card/80 backdrop-blur-xl z-40"
              style={{ boxShadow: '0 1px 8px -4px rgba(0,0,0,0.06)' }}
            >
              <div className="flex h-full w-full items-center justify-between px-2 md:px-6 lg:px-8">
                <SidebarTrigger className="h-11 w-11 [&_svg]:!size-6 text-foreground md:hidden" />
                {!user ? (
                  <button
                    onClick={() => navigate('/')}
                    aria-label={t('common.home')}
                    className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                  >
                    <Logo framed className="h-10 w-10 md:h-11 md:w-11" />
                  </button>
                ) : (
                  <span aria-hidden className="flex-1" />
                )}
                {user && (
                  <button
                    onClick={() => navigate('/notifications')}
                    aria-label={t('common.notifications')}
                    className="relative h-11 w-11 flex items-center justify-center rounded-md text-foreground hover:bg-muted transition-colors"
                  >
                    <Bell className="!size-6" strokeWidth={1.8} />
                    {unreadCount > 0 && (
                      <span className={'absolute top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-0.5 text-[9px] font-bold text-destructive-foreground ring-2 ring-card ' + (dir === 'rtl' ? 'left-1.5' : 'right-1.5')}>
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </button>
                )}
              </div>
            </header>
          )}
          <main data-scroll-container="page" className={'flex-1 min-h-0 min-w-0 w-full overflow-x-hidden ' + (isChatDetailRoute ? 'overflow-hidden' : 'overflow-y-auto ') + (showBottomNav ? 'pb-24' : '')}>
            <PageTransition>
              <div className="w-full min-w-0">
                {children}
              </div>
            </PageTransition>
          </main>
          {showBottomNav && <BottomNav />}
        </div>
      </div>
    </SidebarProvider>
  );
};
