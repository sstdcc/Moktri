import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export const ListingCardSkeleton = ({ className }: { className?: string }) => (
  <div
    className={cn(
      'overflow-hidden rounded-2xl border border-border/40 bg-card shadow-card',
      className,
    )}
  >
    <Skeleton className="h-48 w-full rounded-none" />
    <div className="p-4 space-y-2.5">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-4 w-12" />
      </div>
      <Skeleton className="h-3 w-2/3" />
      <div className="flex gap-3">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-16" />
      </div>
      <div className="pt-3 border-t border-border/40">
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  </div>
);

export const ListingCardGridSkeleton = ({ count = 6 }: { count?: number }) => (
  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
    {Array.from({ length: count }).map((_, i) => (
      <ListingCardSkeleton key={i} />
    ))}
  </div>
);
