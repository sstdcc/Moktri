import { RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export const ErrorState = ({ message = 'تعذر تحميل البيانات', onRetry }: ErrorStateProps) => (
  <div className="flex flex-col items-center justify-center gap-3 py-12 font-tajawal">
    <div className="rounded-2xl bg-destructive/10 p-3">
      <AlertCircle className="h-7 w-7 text-destructive" />
    </div>
    <p className="text-sm text-muted-foreground">{message}</p>
    {onRetry && (
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw className="h-4 w-4 ml-2" />
        إعادة المحاولة
      </Button>
    )}
  </div>
);

export const LoadMoreButton = ({
  onClick,
  loading,
  hasMore,
}: {
  onClick: () => void;
  loading: boolean;
  hasMore: boolean;
}) => {
  if (!hasMore) return null;
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="mx-auto mt-6 block rounded-lg border border-border bg-card px-6 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50 font-tajawal"
    >
      {loading ? 'جاري التحميل...' : 'تحميل المزيد'}
    </button>
  );
};
