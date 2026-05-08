import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Lock, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/ui/Logo';

const schema = z.object({
  password: z.string().min(6, 'كلمة المرور يجب ألا تقل عن 6 أحرف').max(72),
  confirm: z.string().min(6, 'كلمة المرور يجب ألا تقل عن 6 أحرف').max(72),
}).refine((d) => d.password === d.confirm, {
  message: 'كلمتا المرور غير متطابقتين',
  path: ['confirm'],
});

const ResetPasswordPage = () => {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Supabase places a recovery session via the email link automatically.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setSessionReady(true);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setSessionReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async () => {
    const parsed = schema.safeParse({ password, confirm });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.issues.forEach((i) => { fieldErrors[i.path[0] as string] = i.message; });
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        toast.error('تعذر تحديث كلمة المرور، حاول مرة أخرى');
        setErrors({ password: 'تعذر تحديث كلمة المرور' });
        return;
      }
      await supabase.auth.signOut();
      toast.success('تم تحديث كلمة المرور بنجاح، يمكنك تسجيل الدخول الآن');
      navigate('/auth', { replace: true });
    } catch {
      toast.error('تعذر تحديث كلمة المرور، حاول مرة أخرى');
    } finally {
      setLoading(false);
    }
  };

  const fieldClass =
    'h-12 rounded-xl border border-border/70 bg-muted/40 dark:bg-muted/30 pr-11 pl-11 text-[14.5px] text-foreground placeholder:text-muted-foreground/60 shadow-none focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:border-primary/50 focus-visible:bg-background transition-colors';
  const iconClass = 'absolute right-3.5 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-muted-foreground/70 pointer-events-none';

  return (
    <div className="flex min-h-screen flex-col items-center justify-start bg-background px-6 pt-16 pb-12 font-tajawal" dir="rtl">
      <div className="w-full max-w-sm">
        <div className="mb-12 text-center">
          <Logo className="mx-auto mb-6 h-20 w-20" />
          <h1 className="text-[26px] font-semibold tracking-tight leading-tight text-foreground">
            تعيين كلمة مرور جديدة
          </h1>
          <p className="mt-3 text-[13.5px] font-normal text-muted-foreground/90">
            أدخل كلمة المرور الجديدة لحسابك
          </p>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label className="text-[12.5px] font-medium text-foreground/90 block">كلمة المرور الجديدة</Label>
            <div className="relative">
              <Lock className={iconClass} strokeWidth={1.75} />
              <Input
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={cn(fieldClass)}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/70 hover:text-foreground transition-colors"
                tabIndex={-1}
                aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
              >
                {showPassword ? <EyeOff className="h-[18px] w-[18px]" strokeWidth={1.75} /> : <Eye className="h-[18px] w-[18px]" strokeWidth={1.75} />}
              </button>
            </div>
            {errors.password && <p className="text-[11px] text-destructive">{errors.password}</p>}
          </div>

          <div className="space-y-2">
            <Label className="text-[12.5px] font-medium text-foreground/90 block">تأكيد كلمة المرور</Label>
            <div className="relative">
              <Lock className={iconClass} strokeWidth={1.75} />
              <Input
                type={showConfirm ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                className={cn(fieldClass)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((s) => !s)}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/70 hover:text-foreground transition-colors"
                tabIndex={-1}
                aria-label={showConfirm ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
              >
                {showConfirm ? <EyeOff className="h-[18px] w-[18px]" strokeWidth={1.75} /> : <Eye className="h-[18px] w-[18px]" strokeWidth={1.75} />}
              </button>
            </div>
            {errors.confirm && <p className="text-[11px] text-destructive">{errors.confirm}</p>}
          </div>

          <Button
            onClick={handleSubmit}
            disabled={loading || !sessionReady}
            className="w-full h-12 rounded-xl text-[14.5px] font-semibold mt-4 bg-primary text-primary-foreground hover:bg-primary/90 shadow-none active:scale-100"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'تحديث كلمة المرور'}
          </Button>

          {!sessionReady && (
            <p className="text-center text-[12px] text-muted-foreground/90">
              افتح هذه الصفحة عبر الرابط المُرسَل إلى بريدك الإلكتروني
            </p>
          )}

          <p className="text-center text-[13px] font-normal text-muted-foreground/90 pt-4">
            <Link to="/auth" className="text-primary font-medium hover:underline">
              العودة إلى تسجيل الدخول
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
