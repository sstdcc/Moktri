import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { BottomNav } from '@/components/ui/BottomNav';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/contexts/AuthContext';
import { useUnreadCount } from '@/hooks/useUnreadCount';

export const MainLayout = ({ children }: { children: ReactNode }) => {
  const isMobile = useIsMobile();
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const unreadCount = useUnreadCount();
  // Admin/moderator use AdminLayout (with its own bottom nav). Everyone else gets the
  // shared mobile BottomNav rendered from the layout so it persists across all pages.
  const showBottomNav =
    isMobile && profile?.role !== 'admin' && profile?.role !== 'moderator';

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full overflow-x-hidden" dir="rtl">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
          <header className="sticky top-0 z-40 h-14 border-b border-border/40 bg-card/80 backdrop-blur-xl"
            style={{ boxShadow: '0 1px 8px -4px rgba(0,0,0,0.06)' }}
          >
            <div className="mx-auto flex h-full w-full max-w-6xl items-center justify-between px-2 md:px-4 lg:px-6">
              <SidebarTrigger className="h-11 w-11 [&_svg]:!size-6 text-foreground md:hidden" />
              <div className="hidden md:block" />
              {user && (
                <button
                  onClick={() => navigate('/notifications')}
                  aria-label="الإشعارات"
                  className="relative h-11 w-11 flex items-center justify-center rounded-md text-foreground hover:bg-muted transition-colors"
                >
                  <Bell className="!size-6" strokeWidth={1.8} />
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 left-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-0.5 text-[9px] font-bold text-destructive-foreground ring-2 ring-card">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>
              )}
            </div>
          </header>
          <main className={showBottomNav ? 'flex-1 pb-24' : 'flex-1'}>
            <div className="mx-auto w-full max-w-6xl">
              {children}
            </div>
          </main>
          {showBottomNav && <BottomNav />}
        </div>
      </div>
    </SidebarProvider>
  );
};
