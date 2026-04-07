import { ReactNode } from 'react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';

export const MainLayout = ({ children }: { children: ReactNode }) => {
  return (
    <SidebarProvider>
        <div className="min-h-screen flex w-full overflow-x-hidden" dir="rtl">
          <AppSidebar />
          <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
          <header className="sticky top-0 z-40 h-12 flex items-center border-b border-border bg-card/95 backdrop-blur-xl px-3">
            <SidebarTrigger className="mr-1" />
          </header>
          <main className="flex-1">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};
