import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Circle, User } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';
import { calculateProfileCompletion } from '@/lib/profileCompletion';

const ProfileCompletionCard = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { percent, missingFields, completedFields } = calculateProfileCompletion(profile);

  if (percent >= 100) return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3" dir="rtl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-accent" />
          <span className="text-sm font-bold text-foreground">اكتمال الملف</span>
        </div>
        <span className="text-sm font-black text-accent">{percent}%</span>
      </div>

      <Progress value={percent} className="h-2 bg-muted" />

      <div className="space-y-1.5">
        {completedFields.map((f) => (
          <div key={f.key} className="flex items-center gap-2 text-xs text-success">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>{f.label}</span>
          </div>
        ))}
        {missingFields.map((f) => (
          <div key={f.key} className="flex items-center gap-2 text-xs text-muted-foreground">
            <Circle className="h-3.5 w-3.5" />
            <span>{f.label}</span>
          </div>
        ))}
      </div>

      <button
        onClick={() => navigate('/settings')}
        className="w-full rounded-xl bg-accent/10 py-2.5 text-sm font-bold text-accent transition-colors hover:bg-accent/20"
      >
        إكمال الملف
      </button>
    </div>
  );
};

export default ProfileCompletionCard;
