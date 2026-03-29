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
  <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
    <div className="mb-4 rounded-full bg-muted p-4">
      <Icon className="h-8 w-8 text-muted-foreground" />
    </div>
    <h3 className="text-lg font-semibold text-foreground font-tajawal">{title}</h3>
    {subtitle && <p className="mt-1 text-sm text-muted-foreground font-tajawal">{subtitle}</p>}
    {actionLabel && onAction && (
      <Button variant="default" className="mt-4" onClick={onAction}>
        {actionLabel}
      </Button>
    )}
  </div>
);
