import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Lock, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/ui/Logo';
import { useDir } from '@/i18n/useDir';
import { useAuth } from '@/contexts/AuthContext';

const ChangePasswordPage = () => {
  const { t } = useTranslation();
  const dir = useDir();
  const navigate = useNavigate();
  const { user } = useAuth();

  const schema = z.object({
    current: z.string().min(6, t('auth.errors.passwordMin')).max(72),
    password: z.string().min(6, t('auth.errors.passwordMin')).max(72),
    confirm: z.string().min(6, t('auth.errors.passwordMin')).max(72),
  }).refine((d) => d.password === d.confirm, {
    message: t('auth.errors.passwordMismatch'),
    path: ['confirm'],
  });

  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const parsed = schema.safeParse({ current, password, confirm });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.issues.forEach((i) => { fieldErrors[i.path[0] as string] = i.message; });
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setLoading(true);

    try {
      const email = user?.email;
      if (!email) {
        toast.error(t('auth.errors.loginFailed'));
        setLoading(false);
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: current,
      });

      if (signInError) {
        toast.error(t('auth.errors.loginInvalid'));
        setErrors({ current: t('auth.errors.loginInvalid') });
        setLoading(false);
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        toast.error(t('auth.errors.passwordUpdateFailed'));
        setErrors({ password: t('auth.errors.passwordUpdateFailed') });
        return;
      }

      toast.success(t('auth.success.passwordUpdated'));
      navigate('/settings', { replace: true });
    } catch {
      toast.error(t('auth.errors.passwordUpdateFailed'));
    } finally {
      setLoading(false);
    }
  };

  const iconStartClass =
    (dir === 'rtl' ? 'absolute right-3.5 ' : 'absolute left-3.5 ') +
    'top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-muted-foreground/70 pointer-events-none';
  const fieldClass = cn(
    'h-12 rounded-xl border border-border/70 bg-muted/40 dark:bg-muted/30 text-[14.5px] text-foreground placeholder:text-muted-foreground/60 shadow-none focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:border-primary/50 focus-visible:bg-background transition-colors',
    dir === 'rtl' ? 'pr-11 pl-11' : 'pl-11 pr-11'
  );
  const eyeBtnPos = dir === 'rtl' ? 'left-3.5' : 'right-3.5';

  return (
    <div className="flex min-h-screen flex-col items-center justify-start bg-background px-6 pt-16 pb-12 font-tajawal" dir={dir}>
      <div className="w-full max-w-sm">
        <div className="mb-12 text-center">
          <Logo framed className="mx-auto mb-6 h-28 w-28" />
          <h1 className="text-[26px] font-semibold tracking-tight leading-tight text-foreground">
            {t('settings.security.changePassword')}
          </h1>
          <p className="mt-3 text-[13.5px] font-normal text-muted-foreground/90">
            {t('settings.security.changePasswordHint')}
          </p>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label className="text-[12.5px] font-medium text-foreground/90 block">{t('auth.password')}</Label>
            <div className="relative">
              <Lock className={iconStartClass} strokeWidth={1.75} />
              <Input
                type={showCurrent ? 'text' : 'password'}
                autoComplete="current-password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                placeholder="••••••••"
                className={fieldClass}
              />
              <button
                type="button"
                onClick={() => setShowCurrent((s) => !s)}
                className={cn('absolute top-1/2 -translate-y-1/2 text-muted-foreground/70 hover:text-foreground transition-colors', eyeBtnPos)}
                tabIndex={-1}
                aria-label={showCurrent ? t('auth.hidePassword') : t('auth.showPassword')}
              >
                {showCurrent ? <EyeOff className="h-[18px] w-[18px]" strokeWidth={1.75} /> : <Eye className="h-[18px] w-[18px]" strokeWidth={1.75} />}
              </button>
            </div>
            {errors.current && <p className="text-[11px] text-destructive">{errors.current}</p>}
          </div>

          <div className="space-y-2">
            <Label className="text-[12.5px] font-medium text-foreground/90 block">{t('auth.newPassword')}</Label>
            <div className="relative">
              <Lock className={iconStartClass} strokeWidth={1.75} />
              <Input
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={fieldClass}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className={cn('absolute top-1/2 -translate-y-1/2 text-muted-foreground/70 hover:text-foreground transition-colors', eyeBtnPos)}
                tabIndex={-1}
                aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
              >
                {showPassword ? <EyeOff className="h-[18px] w-[18px]" strokeWidth={1.75} /> : <Eye className="h-[18px] w-[18px]" strokeWidth={1.75} />}
              </button>
            </div>
            {errors.password && <p className="text-[11px] text-destructive">{errors.password}</p>}
          </div>

          <div className="space-y-2">
            <Label className="text-[12.5px] font-medium text-foreground/90 block">{t('auth.confirmPassword')}</Label>
            <div className="relative">
              <Lock className={iconStartClass} strokeWidth={1.75} />
              <Input
                type={showConfirm ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                className={fieldClass}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((s) => !s)}
                className={cn('absolute top-1/2 -translate-y-1/2 text-muted-foreground/70 hover:text-foreground transition-colors', eyeBtnPos)}
                tabIndex={-1}
                aria-label={showConfirm ? t('auth.hidePassword') : t('auth.showPassword')}
              >
                {showConfirm ? <EyeOff className="h-[18px] w-[18px]" strokeWidth={1.75} /> : <Eye className="h-[18px] w-[18px]" strokeWidth={1.75} />}
              </button>
            </div>
            {errors.confirm && <p className="text-[11px] text-destructive">{errors.confirm}</p>}
          </div>

          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full h-12 rounded-xl text-[14.5px] font-semibold mt-4 bg-primary text-primary-foreground hover:bg-primary/90 shadow-none active:scale-100"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('auth.updatePassword')}
          </Button>

          <p className="text-center text-[13px] font-normal text-muted-foreground/90 pt-4">
            <button
              type="button"
              onClick={() => navigate('/settings')}
              className="text-primary font-medium hover:underline bg-transparent border-none cursor-pointer"
            >
              {t('settings.back')}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ChangePasswordPage;
