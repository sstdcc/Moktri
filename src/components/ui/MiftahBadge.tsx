import { Check, Star, Clock, X, Zap, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

type BadgeVariant = 'active' | 'pending' | 'expired' | 'rented' | 'rejected' | 'verified' | 'urgent' | 'featured';

const variantConfig: Record<BadgeVariant, { bg: string; text: string; border: string; icon?: React.ElementType; label: string }> = {
  active: { bg: 'bg-success/10', text: 'text-success', border: 'border-success/20', icon: Check, label: 'نشط' },
  pending: { bg: 'bg-accent/10', text: 'text-accent', border: 'border-accent/20', icon: Clock, label: 'قيد المراجعة' },
  expired: { bg: 'bg-muted', text: 'text-muted-foreground', border: 'border-border', label: 'منتهي' },
  rented: { bg: 'bg-primary/10', text: 'text-primary', border: 'border-primary/20', label: 'مؤجر' },
  rejected: { bg: 'bg-danger/10', text: 'text-danger', border: 'border-danger/20', icon: X, label: 'مرفوض' },
  verified: { bg: 'bg-primary/10', text: 'text-primary', border: 'border-primary/20', icon: Check, label: 'موثق' },
  urgent: { bg: 'bg-danger/10', text: 'text-danger', border: 'border-danger/20', icon: Zap, label: 'عاجل' },
  featured: { bg: 'bg-accent/10', text: 'text-accent', border: 'border-accent/20', icon: Star, label: 'مميز' },
};

interface MiftahBadgeProps {
  variant: BadgeVariant;
  className?: string;
}

export const MiftahBadge = ({ variant, className }: MiftahBadgeProps) => {
  const config = variantConfig[variant];
  const Icon = config.icon;

  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-lg border px-2.5 py-0.5 text-[11px] font-bold font-tajawal backdrop-blur-sm',
      config.bg, config.text, config.border, className
    )}>
      {Icon && <Icon className="h-3 w-3 stroke-[2.5px]" />}
      {config.label}
    </span>
  );
};
