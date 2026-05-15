import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { PageTransition } from '@/components/layouts/PageTransition';
import { useDir } from '@/i18n/useDir';

const goBackSafely = (
  navigate: ReturnType<typeof useNavigate>,
  fallback = '/',
) => {
  try {
    const state = window.history.state as { idx?: number } | null;
    const idx = state && typeof state.idx === 'number' ? state.idx : 0;
    if (idx > 0) {
      navigate(-1);
      return;
    }
  } catch {/* noop */}
  navigate(fallback, { replace: true });
};

export const AuthLayout = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const dir = useDir();
  const BackIcon = dir === 'rtl' ? ArrowLeft : ArrowRight;

  return (
    <SidebarProvider>
      <div className="h-[100dvh] flex w-full overflow-hidden" dir={dir}>
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0 h-[100dvh] overflow-hidden">
          <header
            className="shrink-0 h-14 border-b border-border/40 bg-card/80 backdrop-blur-xl z-40"
            style={{ boxShadow: '0 1px 8px -4px rgba(0,0,0,0.06)' }}
          >
            <div className="flex h-full w-full items-center justify-between px-2 md:px-6 lg:px-8">
              <SidebarTrigger className="h-11 w-11 [&_svg]:!size-6 text-foreground" />

              <button
                type="button"
                onClick={() => goBackSafely(navigate)}
                aria-label={t('common.back')}
                className="h-11 w-11 flex items-center justify-center rounded-md text-foreground hover:bg-muted active:scale-95 transition-all"
              >
                <BackIcon className="!size-6" strokeWidth={2} />
              </button>
            </div>
          </header>
          <main data-scroll-container="page" className="flex-1 min-w-0 w-full overflow-y-auto overflow-x-hidden">
            <PageTransition>
              <div className="w-full min-w-0">{children}</div>
            </PageTransition>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AuthLayout;
