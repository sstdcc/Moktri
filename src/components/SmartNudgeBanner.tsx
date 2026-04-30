import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ArrowLeft } from 'lucide-react';
import { useSmartNudges } from '@/hooks/useSmartNudges';
import { useAuth } from '@/contexts/AuthContext';

const STORAGE_KEY = 'miftah_dismissed_nudges';

function getDismissed(userId: string): Set<string> {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}_${userId}`);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveDismissed(userId: string, ids: Set<string>) {
  localStorage.setItem(`${STORAGE_KEY}_${userId}`, JSON.stringify([...ids]));
}

const SmartNudgeBanner = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const nudges = useSmartNudges();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user?.id) setDismissed(getDismissed(user.id));
  }, [user?.id]);

  const visible = nudges.filter(n => !dismissed.has(n.id));
  if (visible.length === 0) return null;

  const dismiss = (id: string) => {
    setDismissed(prev => {
      const next = new Set(prev).add(id);
      if (user?.id) saveDismissed(user.id, next);
      return next;
    });
  };

  // Split nudge message into title + subtitle (first sentence as title)
  const splitMessage = (msg: string) => {
    // try to split on common separators; otherwise use whole message as title
    const parts = msg.split(/\s+(?:ل|حتى|كي)\s+/);
    if (parts.length >= 2) {
      return { title: parts[0].trim(), subtitle: 'ل' + parts.slice(1).join(' ').trim() };
    }
    return { title: msg, subtitle: '' };
  };

  return (
    <div className="space-y-3" dir="rtl">
      {visible.map((nudge) => {
        const { title, subtitle } = splitMessage(nudge.message);
        return (
          <div
            key={nudge.id}
            className="relative rounded-2xl border border-border/50 bg-card p-5 shadow-sm transition-all hover:shadow-md"
          >
            {/* Top row: close button aligned with title area */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-foreground leading-tight">
                  {title}
                </h3>
                {subtitle && (
                  <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                    {subtitle}
                  </p>
                )}
              </div>
              <button
                onClick={() => dismiss(nudge.id)}
                className="-mt-1 -ml-1 inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground shrink-0"
                aria-label="إغلاق"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Primary CTA */}
            <button
              onClick={() => navigate(nudge.path)}
              className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground shadow-sm transition-all hover:brightness-105 active:scale-[0.98]"
            >
              {nudge.actionLabel}
              <ArrowLeft className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default SmartNudgeBanner;
