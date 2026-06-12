import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Loader2, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/ui/Logo';
import { useDir } from '@/i18n/useDir';

const AuthPage = () => {
  const { t } = useTranslation();
  const dir = useDir();

  const loginSchema = z.object({
    email: z.string().trim().email(t('auth.errors.invalidEmail')).max(120),
    password: z.string().min(6, t('auth.errors.passwordMin')).max(72),
  });

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, profile, retryProfile } = useAuth();

  useEffect(() => {
    if (user && profile) {
      const returnUrl = searchParams.get('returnUrl') || '/';
      navigate(returnUrl, { replace: true });
    }
  }, [user, profile]);

  const handleLogin = async () => {
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.issues.forEach((i) => { fieldErrors[i.path[0] as string] = i.message; });
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('secure-login', {
        body: { email: email.trim(), password },
      });
      const payload = (data ?? (error as any)?.context?.body) as any;
      const errMsg: string | undefined =
        (typeof payload === 'object' && payload?.error) ||
        (typeof payload === 'string' ? payload : undefined);

      if (error || !data?.session) {
        const msg = errMsg || t('auth.errors.loginFailed');
        toast.error(msg);
        setErrors({ password: msg });
        return;
      }

      // Establish client-side session from server-issued tokens
      const { error: setErr } = await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });
      if (setErr) {
        toast.error(t('auth.errors.loginFailed'));
        return;
      }

      toast.success(t('auth.success.loggedIn'));
      retryProfile();
      const returnUrl = searchParams.get('returnUrl') || '/';
      navigate(returnUrl, { replace: true });
    } catch {
      toast.error(t('auth.errors.loginFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
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
      if (result.redirected) return;
      navigate('/complete-profile', { replace: true });
    } catch {
      toast.error(t('auth.errors.googleFailed'));
      setGoogleLoading(false);
    }
  };

  const iconStartClass =
    (dir === 'rtl'
      ? 'absolute right-3.5 '
      : 'absolute left-3.5 ') +
    'top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-muted-foreground/70 pointer-events-none';
  const fieldClass = cn(
    'h-12 rounded-xl border border-border/70 bg-muted/40 dark:bg-muted/30 text-[14.5px] text-foreground placeholder:text-muted-foreground/60 shadow-none focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:border-primary/50 focus-visible:bg-background transition-colors',
    dir === 'rtl' ? 'pr-11 pl-4' : 'pl-11 pr-4'
  );

  return (
    <div className="flex min-h-screen flex-col items-center justify-start bg-background px-6 pt-16 pb-12 font-tajawal" dir={dir}>
      <div className="w-full max-w-sm">
        <div className="mb-12 text-center">
          <Logo framed className="mx-auto mb-6 h-28 w-28" />
          <h1 className="text-[26px] font-semibold tracking-tight leading-tight text-foreground">
            {t('auth.login')}
          </h1>
          <p className="mt-3 text-[13.5px] font-normal text-muted-foreground/90">
            {t('auth.welcomeBack')}
          </p>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label className="text-[12.5px] font-medium text-foreground/90 block">{t('auth.email')}</Label>
            <div className="relative">
              <Mail className={iconStartClass} strokeWidth={1.75} />
              <Input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@email.com"
                className={cn(fieldClass, 'text-left')}
                dir="ltr"
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              />
            </div>
            {errors.email && <p className="text-[11px] text-destructive">{errors.email}</p>}
          </div>

          <div className="space-y-2">
            <Label className="text-[12.5px] font-medium text-foreground/90 block">{t('auth.password')}</Label>
            <div className="relative">
              <Lock className={iconStartClass} strokeWidth={1.75} />
              <Input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={cn(fieldClass, dir === 'rtl' ? 'pl-11' : 'pr-11')}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className={cn(
                  'absolute top-1/2 -translate-y-1/2 text-muted-foreground/70 hover:text-foreground transition-colors',
                  dir === 'rtl' ? 'left-3.5' : 'right-3.5'
                )}
                tabIndex={-1}
                aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
              >
                {showPassword ? <EyeOff className="h-[18px] w-[18px]" strokeWidth={1.75} /> : <Eye className="h-[18px] w-[18px]" strokeWidth={1.75} />}
              </button>
            </div>
            <div className="flex items-center justify-between pt-1">
              {errors.password ? (
                <p className="text-[11px] text-destructive">{errors.password}</p>
              ) : <span />}
              <Link to="/forgot-password" className="text-[11.5px] text-primary/90 font-medium hover:underline">
                {t('auth.forgotPassword')}
              </Link>
            </div>
          </div>

          <Button
            onClick={handleLogin}
            disabled={loading}
            className="w-full h-12 rounded-xl text-[14.5px] font-semibold mt-4 bg-primary text-primary-foreground hover:bg-primary/90 shadow-none active:scale-100"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('auth.login')}
          </Button>

          <div className="flex items-center gap-3 py-1">
            <div className="flex-1 h-px bg-border/70" />
            <span className="text-[11px] text-muted-foreground/80">{t('common.or')}</span>
            <div className="flex-1 h-px bg-border/70" />
          </div>

          <Button
            type="button"
            variant="secondary"
            onClick={handleGoogle}
            disabled={googleLoading}
            className="w-full h-12 rounded-xl text-[14px] font-medium border border-border/60 bg-card text-foreground/90 hover:bg-muted/50 shadow-none active:scale-100"
          >
            {googleLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                {t('auth.continueWithGoogle')}
              </>
            )}
          </Button>

          <p className="text-center text-[13px] font-normal text-muted-foreground/90 pt-4">
            {t('auth.noAccount')}{' '}
            <Link to="/signup" className="text-primary font-medium hover:underline">
              {t('auth.signup')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
