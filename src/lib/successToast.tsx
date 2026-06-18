import { toast } from 'sonner';

interface SuccessToastOptions {
  description?: string;
  duration?: number;
}

const SuccessIcon = () => (
  <span className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success/15 animate-success-ring">
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-success" fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" stroke="currentColor">
      <path d="M5 12.5l4.2 4.2L19 7" style={{ strokeDasharray: 24, strokeDashoffset: 24 }} className="animate-check-draw" />
    </svg>
  </span>
);

export const successToast = (message: string, opts: SuccessToastOptions = {}) => {
  return toast.custom(
    (id) => (
      <div
        dir="rtl"
        className="font-tajawal flex items-center gap-3 w-full min-w-[280px] max-w-[380px] rounded-xl border border-border bg-background/95 backdrop-blur-md p-3.5 pr-4 shadow-elevated animate-toast-in"
        onClick={() => toast.dismiss(id)}
      >
        <SuccessIcon />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground leading-tight">{message}</p>
          {opts.description && (
            <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{opts.description}</p>
          )}
        </div>
      </div>
    ),
    { duration: opts.duration ?? 3200 }
  );
};
