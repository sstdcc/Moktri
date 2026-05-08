import { useState } from 'react';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Mail, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/ui/Logo';

const schema = z.object({
  email: z.string().trim().email('البريد الإلكتروني غير صالح').max(120),
});

const ForgotPasswordPage = () => {
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
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        toast.error('تعذر إرسال الرابط، حاول مرة أخرى');
        setErrors({ email: 'تعذر إرسال الرابط، تحقق من البريد الإلكتروني' });
        return;
      }
      setSent(true);
      toast.success('تم إرسال رابط إعادة التعيين إلى بريدك الإلكتروني');
    } catch {
      toast.error('تعذر إرسال الرابط، حاول مرة أخرى');
    } finally {
      setLoading(false);
    }
  };

  const fieldClass =
    'h-12 rounded-xl border border-border/70 bg-muted/40 dark:bg-muted/30 pr-11 pl-4 text-[14.5px] text-foreground placeholder:text-muted-foreground/60 shadow-none focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:border-primary/50 focus-visible:bg-background transition-colors';
  const iconClass = 'absolute right-3.5 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-muted-foreground/70 pointer-events-none';

  return (
    <div className="flex min-h-screen flex-col items-center justify-start bg-background px-6 pt-16 pb-12 font-tajawal" dir="rtl">
      <div className="w-full max-w-sm">
        <div className="mb-12 text-center">
          <Logo className="mx-auto mb-6 h-20 w-20" />
          <h1 className="text-[26px] font-semibold tracking-tight leading-tight text-foreground">
            نسيت كلمة المرور؟
          </h1>
          <p className="mt-3 text-[13.5px] font-normal text-muted-foreground/90">
            أدخل بريدك الإلكتروني لإرسال رابط إعادة التعيين
          </p>
        </div>

        {sent ? (
          <div className="space-y-6">
            <div className="rounded-xl border border-border/70 bg-muted/40 dark:bg-muted/30 p-5 text-center">
              <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-primary" strokeWidth={1.75} />
              <p className="text-[14px] font-medium text-foreground">
                تم إرسال رابط إعادة التعيين إلى بريدك الإلكتروني
              </p>
              <p className="mt-2 text-[12.5px] text-muted-foreground/90">
                تحقق من صندوق الوارد وسلة الرسائل غير المرغوب فيها
              </p>
            </div>
            <Link to="/auth" className="block">
              <Button className="w-full h-12 rounded-xl text-[14.5px] font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-none active:scale-100">
                العودة إلى تسجيل الدخول
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label className="text-[12.5px] font-medium text-foreground/90 block">البريد الإلكتروني</Label>
              <div className="relative">
                <Mail className={iconClass} strokeWidth={1.75} />
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
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'إرسال رابط إعادة التعيين'}
            </Button>

            <p className="text-center text-[13px] font-normal text-muted-foreground/90 pt-4">
              تذكرت كلمة المرور؟{' '}
              <Link to="/auth" className="text-primary font-medium hover:underline">
                تسجيل الدخول
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
