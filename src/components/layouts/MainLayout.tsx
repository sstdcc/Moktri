import { ReactNode } from 'react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { BottomNav } from '@/components/ui/BottomNav';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/contexts/AuthContext';

export const MainLayout = ({ children }: { children: ReactNode }) => {
  const isMobile = useIsMobile();
  const { profile } = useAuth();
  // Admin/moderator use AdminLayout (with its own bottom nav). Everyone else gets the
  // shared mobile BottomNav rendered from the layout so it persists across all pages.
  const showBottomNav =
    isMobile && profile?.role !== 'admin' && profile?.role !== 'moderator';

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full overflow-x-hidden" dir="rtl">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
          <header className="sticky top-0 z-40 h-14 flex items-center border-b border-border/40 bg-card/80 backdrop-blur-xl px-2"
            style={{ boxShadow: '0 1px 8px -4px rgba(0,0,0,0.06)' }}
          >
            <SidebarTrigger className="h-11 w-11 [&_svg]:!size-6 text-foreground" />
          </header>
          <main className={showBottomNav ? 'flex-1 pb-24' : 'flex-1'}>
            {children}
          </main>
          {showBottomNav && <BottomNav />}
        </div>
      </div>
    </SidebarProvider>
  );
};
