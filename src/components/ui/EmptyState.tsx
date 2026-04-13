import { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState = ({ icon: Icon, title, subtitle, actionLabel, onAction }: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
    <div className="mb-5 rounded-2xl bg-gradient-to-br from-muted to-muted/60 p-5 shadow-card">
      <Icon className="h-9 w-9 text-muted-foreground/70 stroke-[1.6px]" />
    </div>
    <h3 className="text-[17px] font-bold text-foreground font-tajawal">{title}</h3>
    {subtitle && <p className="mt-2 text-sm text-muted-foreground font-tajawal leading-relaxed max-w-[260px]">{subtitle}</p>}
    {actionLabel && onAction && (
      <Button variant="default" className="mt-5" onClick={onAction}>
        {actionLabel}
      </Button>
    )}
  </div>
);
