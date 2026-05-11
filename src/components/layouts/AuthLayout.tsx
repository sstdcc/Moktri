import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { Logo } from '@/components/ui/Logo';
import { PageTransition } from '@/components/layouts/PageTransition';

/**
 * Layout for unauthenticated/auth-flow pages (login, signup, OTP, password reset,
 * complete profile, onboarding-pre-auth). Reuses the main app's premium header
 * style so users never feel trapped.
 *
 * - Back button (right side in RTL) → safely returns to the previous in-app
 *   route, falling back to home when there is no history.
 * - Centered compact framed logo → matches the rest of the app.
 * - Sidebar trigger (left in RTL) → keeps the existing menu access.
 *
 * Forms inside are not modified — only the surrounding header navigation.
 */
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

  return (
    <SidebarProvider>
      <div className="h-[100dvh] flex w-full overflow-hidden" dir="rtl">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0 h-[100dvh] overflow-hidden">
          <header
            className="shrink-0 h-14 border-b border-border/40 bg-card/80 backdrop-blur-xl z-40"
            style={{ boxShadow: '0 1px 8px -4px rgba(0,0,0,0.06)' }}
          >
            <div className="flex h-full w-full items-center justify-between px-2 md:px-6 lg:px-8">
              <button
                type="button"
                onClick={() => goBackSafely(navigate)}
                aria-label="رجوع"
                className="h-11 w-11 flex items-center justify-center rounded-md text-foreground hover:bg-muted active:scale-95 transition-all"
              >
                <ArrowRight className="!size-6" strokeWidth={2} />
              </button>

              <button
                type="button"
                onClick={() => navigate('/')}
                aria-label="الصفحة الرئيسية"
                className="flex items-center gap-2 hover:opacity-80 transition-opacity"
              >
                <Logo framed className="h-9 w-9 md:h-10 md:w-10" />
              </button>

              <SidebarTrigger className="h-11 w-11 [&_svg]:!size-6 text-foreground" />
            </div>
          </header>
          <main className="flex-1 min-w-0 w-full overflow-y-auto overflow-x-hidden">
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
