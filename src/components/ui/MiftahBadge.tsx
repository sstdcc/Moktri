import { Check, Star, Clock, X, Zap, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

type BadgeVariant = 'active' | 'pending' | 'expired' | 'rented' | 'rejected' | 'verified' | 'urgent' | 'featured';

const variantConfig: Record<BadgeVariant, { bg: string; text: string; icon?: React.ElementType; label: string }> = {
  active: { bg: 'bg-success/10', text: 'text-success', icon: Check, label: 'نشط' },
  pending: { bg: 'bg-accent/10', text: 'text-accent', icon: Clock, label: 'قيد المراجعة' },
  expired: { bg: 'bg-muted', text: 'text-muted-foreground', label: 'منتهي' },
  rented: { bg: 'bg-primary/10', text: 'text-primary', label: 'مؤجر' },
  rejected: { bg: 'bg-danger/10', text: 'text-danger', icon: X, label: 'مرفوض' },
  verified: { bg: 'bg-primary/10', text: 'text-primary', icon: Check, label: 'موثق' },
  urgent: { bg: 'bg-danger/10', text: 'text-danger', icon: Zap, label: 'عاجل' },
  featured: { bg: 'bg-accent/10', text: 'text-accent', icon: Star, label: 'مميز' },
};

interface MiftahBadgeProps {
  variant: BadgeVariant;
  className?: string;
}

export const MiftahBadge = ({ variant, className }: MiftahBadgeProps) => {
  const config = variantConfig[variant];
  const Icon = config.icon;

  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium font-tajawal', config.bg, config.text, className)}>
      {Icon && <Icon className="h-3 w-3" />}
      {config.label}
    </span>
  );
};
