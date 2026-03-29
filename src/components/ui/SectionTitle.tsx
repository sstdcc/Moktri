import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

interface SectionTitleProps {
  title: string;
  action?: { label: string; href: string };
}

export const SectionTitle = ({ title, action }: SectionTitleProps) => {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        <div className="h-6 w-1 rounded-full bg-accent" />
        <h2 className="text-lg font-bold text-foreground font-tajawal">{title}</h2>
      </div>
      {action && (
        <button
          onClick={() => navigate(action.href)}
          className="text-xs text-accent font-medium flex items-center gap-1 font-tajawal hover:underline transition-all duration-200"
        >
          {action.label}
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
};
