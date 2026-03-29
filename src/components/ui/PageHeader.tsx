import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface PageHeaderProps {
  title: string;
  showBack?: boolean;
  action?: React.ReactNode;
}

export const PageHeader = ({ title, showBack = false, action }: PageHeaderProps) => {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-card px-4">
      <div className="w-10">
        {showBack && (
          <button onClick={() => navigate(-1)} className="flex items-center justify-center rounded-lg p-2 text-foreground hover:bg-muted">
            <ArrowRight className="h-5 w-5" />
          </button>
        )}
      </div>
      <h1 className="text-base font-bold text-foreground font-tajawal">{title}</h1>
      <div className="w-10 flex justify-start">{action}</div>
    </header>
  );
};
