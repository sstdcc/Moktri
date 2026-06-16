import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export const ProfileCardSkeleton = ({ className }: { className?: string }) => (
  <div
    className={cn(
      'rounded-2xl border border-border/60 bg-card p-5 shadow-card space-y-4',
      className,
    )}
  >
    <div className="flex items-center gap-4">
      <Skeleton className="h-16 w-16 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
    <div className="grid grid-cols-3 gap-3">
      <Skeleton className="h-14 rounded-xl" />
      <Skeleton className="h-14 rounded-xl" />
      <Skeleton className="h-14 rounded-xl" />
    </div>
  </div>
);
