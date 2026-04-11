import { BadgeCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VerifiedBadgeProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = {
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
};

export const VerifiedBadge = ({ className, size = 'md' }: VerifiedBadgeProps) => (
  <BadgeCheck className={cn(sizeMap[size], 'text-success shrink-0', className)} />
);
