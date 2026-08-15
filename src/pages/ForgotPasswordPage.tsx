import { useState } from 'react';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { getResetPasswordUrl } from '@/lib/authLinks';
import { toast } from 'sonner';
import { Loader2, Mail, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/ui/Logo';
import { useDir } from '@/i18n/useDir';

const ForgotPasswordPage = () => {
  const { t } = useTranslation();
  const dir = useDir();
  const schema = z.object({
    email: z.string().trim().email(t('auth.errors.invalidEmail')).max(120),
  });

  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    const parsed = schema.safeParse({ email });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.issues.forEach((i) => { fieldErrors[i.path[0] as string] = i.message; });
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: getResetPasswordUrl(),
      });
      if (error) {
        toast.error(t('auth.errors.resetSendFailed'));
        setErrors({ email: t('auth.errors.resetSendCheckEmail') });
        return;
      }
      setSent(true);
      toast.success(t('auth.success.resetSent'));
    } catch {
      toast.error(t('auth.errors.resetSendFailed'));
    } finally {
      setLoading(false);
    }
  };

  const iconStartClass =
    (dir === 'rtl' ? 'absolute right-3.5 ' : 'absolute left-3.5 ') +
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
            {t('auth.forgotPasswordTitle')}
          </h1>
          <p className="mt-3 text-[13.5px] font-normal text-muted-foreground/90">
            {t('auth.forgotPasswordSubtitle')}
          </p>
        </div>

        {sent ? (
          <div className="space-y-6">
            <div className="rounded-xl border border-border/70 bg-muted/40 dark:bg-muted/30 p-5 text-center">
              <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-primary" strokeWidth={1.75} />
              <p className="text-[14px] font-medium text-foreground">
                {t('auth.resetSent')}
              </p>
              <p className="mt-2 text-[12.5px] text-muted-foreground/90">
                {t('auth.resetCheckInbox')}
              </p>
            </div>
            <Link to="/auth" className="block">
              <Button className="w-full h-12 rounded-xl text-[14.5px] font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-none active:scale-100">
                {t('auth.backToLogin')}
              </Button>
            </Link>
          </div>
        ) : (
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
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                />
              </div>
              {errors.email && <p className="text-[11px] text-destructive">{errors.email}</p>}
            </div>

            <Button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full h-12 rounded-xl text-[14.5px] font-semibold mt-4 bg-primary text-primary-foreground hover:bg-primary/90 shadow-none active:scale-100"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('auth.sendResetLink')}
            </Button>

            <p className="text-center text-[13px] font-normal text-muted-foreground/90 pt-4">
              {t('auth.rememberedPassword')}{' '}
              <Link to="/auth" className="text-primary font-medium hover:underline">
                {t('auth.login')}
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
