import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Lightbulb } from 'lucide-react';
import { useSmartNudges, type Nudge } from '@/hooks/useSmartNudges';

const SmartNudgeBanner = () => {
  const navigate = useNavigate();
  const nudges = useSmartNudges();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const visible = nudges.filter(n => !dismissed.has(n.id));
  if (visible.length === 0) return null;

  const dismiss = (id: string) => setDismissed(prev => new Set(prev).add(id));

  return (
    <div className="space-y-2" dir="rtl">
      {visible.map((nudge) => (
        <div
          key={nudge.id}
          className="flex items-start gap-3 rounded-2xl border border-accent/30 bg-accent/5 p-3 transition-all"
        >
          <Lightbulb className="h-4 w-4 text-accent mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-foreground leading-relaxed">{nudge.message}</p>
            <button
              onClick={() => navigate(nudge.path)}
              className="mt-1.5 text-xs font-bold text-accent hover:underline"
            >
              {nudge.actionLabel} ←
            </button>
          </div>
          <button
            onClick={() => dismiss(nudge.id)}
            className="p-1 rounded-lg hover:bg-accent/10 text-muted-foreground shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};

export default SmartNudgeBanner;
