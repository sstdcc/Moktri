import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RatingStarsProps {
  value: number;
  onChange?: (value: number) => void;
  size?: 'sm' | 'md' | 'lg';
  readOnly?: boolean;
  className?: string;
}

const sizeMap = { sm: 'h-3.5 w-3.5', md: 'h-5 w-5', lg: 'h-7 w-7' };

export const RatingStars = ({ value, onChange, size = 'md', readOnly, className }: RatingStarsProps) => {
  return (
    <div className={cn('flex items-center gap-1', className)} dir="ltr">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= Math.round(value);
        return (
          <button
            key={star}
            type="button"
            disabled={readOnly}
            onClick={() => onChange?.(star)}
            className={cn(
              'transition-transform',
              !readOnly && 'hover:scale-110 cursor-pointer',
              readOnly && 'cursor-default',
            )}
            aria-label={`${star} نجوم`}
          >
            <Star
              className={cn(
                sizeMap[size],
                filled ? 'fill-accent text-accent' : 'fill-none text-muted-foreground/40',
              )}
            />
          </button>
        );
      })}
    </div>
  );
};
