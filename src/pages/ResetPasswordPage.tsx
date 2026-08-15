import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable';
import { toast } from 'sonner';
import { Loader2, Lock, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/ui/Logo';
import { useDir } from '@/i18n/useDir';
import type { User } from '@supabase/supabase-js';

const ResetPasswordPage = () => {
  const { t } = useTranslation();
  const dir = useDir();
  const schema = z.object({
    password: z.string().min(6, t('auth.errors.passwordMin')).max(72),
    confirm: z.string().min(6, t('auth.errors.passwordMin')).max(72),
  }).refine((d) => d.password === d.confirm, {
    message: t('auth.errors.passwordMismatch'),
    path: ['confirm'],
  });

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [sessionUser, setSessionUser] = useState<User | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setSessionUser(session?.user ?? null);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setSessionUser(data.session.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const rawProviders = sessionUser?.app_metadata?.providers;
  const providers: string[] = Array.isArray(rawProviders) ? (rawProviders as string[]) : [];
  const identityProviders: string[] = (sessionUser?.identities ?? []).map((i) => i.provider);
  const allProviders = Array.from(new Set([...providers, ...identityProviders]));
  const hasPasswordMethod = allProviders.includes('email');
  const showGoogleGuidance = !!sessionUser && !hasPasswordMethod;
  const sessionReady = sessionUser !== null;

  const handleSubmit = async () => {
    const parsed = schema.safeParse({ password, confirm });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.issues.forEach((i) => { fieldErrors[i.path[0] as string] = i.message; });
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    if (!sessionUser || !hasPasswordMethod) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        toast.error(t('auth.errors.passwordUpdateFailed'));
        setErrors({ password: t('auth.errors.passwordUpdateFailed') });
        return;
      }
      await supabase.auth.signOut();
      toast.success(t('auth.success.passwordUpdated'));
      navigate('/auth', { replace: true });
    } catch {
      toast.error(t('auth.errors.passwordUpdateFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleContinueWithGoogle = async () => {
    setGoogleLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth('google', {
        redirect_uri: `${window.location.origin}/complete-profile`,
      });
      if (result.error) {
        toast.error(t('auth.errors.googleFailed'));
        setGoogleLoading(false);
        return;
      }
      if (result.redirected) {
        // Android: tab opened in the system browser. Re-enable the button once
        // the browser closes (success navigates away via the deep link; cancel
        // just re-enables the button).
        if (result.browserClosed) {
          void result.browserClosed.finally(() => setGoogleLoading(false));
        }
        return;
      }
      navigate('/complete-profile', { replace: true });
    } catch {
      toast.error(t('auth.errors.googleFailed'));
      setGoogleLoading(false);
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
            {t('auth.resetTitle')}
          </h1>
          <p className="mt-3 text-[13.5px] font-normal text-muted-foreground/90">
            {t('auth.resetSubtitle')}
          </p>
        </div>

        <div className="space-y-6">
          {showGoogleGuidance ? (
            <div className="space-y-6">
              <div className="rounded-xl border border-border/70 bg-muted/40 dark:bg-muted/30 p-5 text-center space-y-2">
                <p className="text-[14px] font-semibold text-foreground">
                  {t('auth.googleAccountNoticeTitle')}
                </p>
                <p className="text-[12.5px] text-muted-foreground/90">
                  {t('auth.googleAccountNoticeText')}
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={handleContinueWithGoogle}
                disabled={googleLoading}
                className="w-full h-12 rounded-xl text-[14px] font-semibold border border-border/60 bg-card text-foreground/90 hover:bg-muted/50 shadow-none active:scale-100"
              >
                {googleLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <span className="flex items-center gap-2">
                    <svg className="h-[18px] w-[18px]" viewBox="0 0 48 48" aria-hidden="true">
                      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.5 6.1 29.6 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"/>
                      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.5 6.1 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
                      <path fill="#4CAF50" d="M24 44c5.5 0 10.6-2 14.4-5.4l-6.9-5.8c-2 1.5-4.7 2.4-7.5 2.4-5.2 0-9.7-3.3-11.3-8.1l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
                      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.7l6.9 5.8C37.4 42.1 44 36 44 24c0-1.3-.1-2.6-.4-3.9z"/>
                    </svg>
                    {t('auth.continueWithGoogle')}
                  </span>
                )}
              </Button>
              <p className="text-center text-[13px] font-normal text-muted-foreground/90 pt-4">
                <Link to="/auth" className="text-primary font-medium hover:underline">
                  {t('auth.backToLogin')}
                </Link>
              </p>
            </div>
          ) : (
            <>
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
                disabled={loading || !sessionReady}
                className="w-full h-12 rounded-xl text-[14.5px] font-semibold mt-4 bg-primary text-primary-foreground hover:bg-primary/90 shadow-none active:scale-100"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('auth.updatePassword')}
              </Button>

              {!sessionReady && (
                <p className="text-center text-[12px] text-muted-foreground/90">
                  {t('auth.openViaEmailLink')}
                </p>
              )}

              <p className="text-center text-[13px] font-normal text-muted-foreground/90 pt-4">
                <Link to="/auth" className="text-primary font-medium hover:underline">
                  {t('auth.backToLogin')}
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
