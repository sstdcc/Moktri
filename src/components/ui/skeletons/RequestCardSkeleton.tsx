import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export const RequestCardSkeleton = ({ className }: { className?: string }) => (
  <div
    className={cn(
      'rounded-2xl border border-border/60 bg-card p-4 shadow-card space-y-3',
      className,
    )}
  >
    <div className="flex items-center gap-3">
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-32" />
        <Skeleton className="h-2.5 w-20" />
      </div>
      <Skeleton className="h-5 w-16 rounded-full" />
    </div>
    <div className="space-y-2">
      <Skeleton className="h-3 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
    </div>
    <div className="flex gap-2 pt-2 border-t border-border/40">
      <Skeleton className="h-3 w-12" />
      <Skeleton className="h-3 w-12" />
      <Skeleton className="h-3 w-16" />
    </div>
  </div>
);

export const RequestCardGridSkeleton = ({ count = 3 }: { count?: number }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
    {Array.from({ length: count }).map((_, i) => (
      <RequestCardSkeleton key={i} />
    ))}
  </div>
);
