import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

interface SectionTitleProps {
  title: string;
  action?: { label: string; href: string };
}

export const SectionTitle = ({ title, action }: SectionTitleProps) => {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-3">
        <div className="h-7 w-1.5 rounded-full bg-gradient-to-b from-accent to-accent/60" />
        <h2 className="text-[17px] font-extrabold text-foreground font-tajawal tracking-tight">{title}</h2>
      </div>
      {action && (
        <button
          onClick={() => navigate(action.href)}
          className="text-xs text-accent font-semibold flex items-center gap-0.5 font-tajawal transition-all duration-200 hover:gap-1.5 active:scale-95"
        >
          {action.label}
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
};
