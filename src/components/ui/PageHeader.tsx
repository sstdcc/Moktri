import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface PageHeaderProps {
  title: string;
  showBack?: boolean;
  /** Safe fallback when there is no history to go back to. Defaults to a role-aware home. */
  fallbackPath?: string;
  action?: React.ReactNode;
}

/**
 * Robust back navigation:
 * - `window.history.length` is unreliable in SPAs (often >1 even on first load).
 * - We use the History API's `state.idx` (set by react-router) when available
 *   to detect whether there is a real previous in-app entry.
 * - If not, we fall back to a safe in-app route so the user is never sent
 *   outside the app or stuck.
 */
const goBackSafely = (
  navigate: ReturnType<typeof useNavigate>,
  fallbackPath: string,
) => {
  try {
    const state = window.history.state as { idx?: number } | null;
    const idx = state && typeof state.idx === 'number' ? state.idx : 0;
    if (idx > 0) {
      navigate(-1);
      return;
    }
  } catch {
    // ignore – fall through to fallback
  }
  navigate(fallbackPath, { replace: true });
};

export const PageHeader = ({ title, showBack = false, fallbackPath, action }: PageHeaderProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleBack = () => {
    const fallback = fallbackPath ?? (user ? '/dashboard' : '/');
    goBackSafely(navigate, fallback);
  };

  return (
    <header className="sticky top-0 z-40 pt-safe border-b border-border/50 bg-card/80 backdrop-blur-xl backdrop-saturate-150 px-4">
      <div className="flex h-[56px] items-center justify-between">
      <div className="w-10">
        {showBack && (
          <button
            onClick={handleBack}
            aria-label="رجوع"
            className="flex items-center justify-center rounded-xl p-2 text-foreground transition-all duration-200 hover:bg-muted active:scale-95"
          >
            <ArrowRight className="h-5 w-5 stroke-[2.2px]" />
          </button>
        )}
      </div>
      <h1 className="text-[15px] font-bold text-foreground font-tajawal">{title}</h1>
      <div className="flex shrink-0 justify-start">{action}</div>
      </div>
    </header>
  );
};
