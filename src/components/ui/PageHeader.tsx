import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface PageHeaderProps {
  title: string;
  showBack?: boolean;
  /** Safe fallback when there is no history to go back to. Defaults to "/" (or role-aware dashboard if user is signed in). */
  fallbackPath?: string;
  action?: React.ReactNode;
}

export const PageHeader = ({ title, showBack = false, fallbackPath, action }: PageHeaderProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleBack = () => {
    // Safe navigation: prefer history, fallback to a known safe route.
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    if (fallbackPath) {
      navigate(fallbackPath);
      return;
    }
    navigate(user ? '/dashboard' : '/');
  };

  return (
    <header className="sticky top-0 z-40 flex h-[56px] items-center justify-between border-b border-border/50 bg-card/80 backdrop-blur-xl backdrop-saturate-150 px-4">
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
    </header>
  );
};
