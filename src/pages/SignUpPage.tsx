import { useState, useRef, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { signInWithOtp, verifyOtp } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Loader2, ArrowRight, RefreshCw, User, Phone, KeyRound, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

const RESEND_COOLDOWN = 60;

const signupSchema = z
  .object({
    firstName: z.string().trim().min(2, 'الاسم الأول قصير جداً').max(40),
    lastName: z.string().trim().min(2, 'اسم العائلة قصير جداً').max(40),
    email: z.string().trim().email('البريد الإلكتروني غير صالح').max(120),
    phone: z.string().trim().min(8, 'رقم الهاتف غير صالح'),
    password: z.string().min(6, 'كلمة المرور يجب ألا تقل عن 6 أحرف').max(72),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'كلمتا المرور غير متطابقتين',
    path: ['confirmPassword'],
  });

type Step = 'form' | 'otp';

const normalizePhone = (raw: string) => {
  let digits = raw.replace(/[^\d+]/g, '');
  if (!digits.startsWith('+')) {
    if (digits.startsWith('00')) digits = '+' + digits.slice(2);
    else if (digits.startsWith('967')) digits = '+' + digits;
    else if (digits.startsWith('0')) digits = '+967' + digits.slice(1);
    else digits = '+967' + digits;
  }
  return digits;
};

const SignUpPage = () => {
  const [step, setStep] = useState<Step>('form');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneRaw, setPhoneRaw] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState<string[]>(Array(6).fill(''));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const cooldownRef = useRef<ReturnType<typeof setInterval>>();
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, profile, retryProfile } = useAuth();

  // Already signed in? Send to onboarding if profile not completed, else to returnUrl/home.
  useEffect(() => {
    if (step !== 'form') return;
    if (user && profile) {
      const returnUrl = searchParams.get('returnUrl');
      const needsOnboarding = !profile.full_name || profile.full_name.trim() === '';
      if (needsOnboarding) {
        const target = returnUrl
          ? `/onboarding?returnUrl=${encodeURIComponent(returnUrl)}`
          : '/onboarding';
        navigate(target, { replace: true });
      } else {
        navigate(returnUrl || '/', { replace: true });
      }
    }
  }, [user, profile, step]);

  useEffect(() => () => { if (cooldownRef.current) clearInterval(cooldownRef.current); }, []);

  const startCooldown = () => {
    setCooldown(RESEND_COOLDOWN);
    cooldownRef.current = setInterval(() => {
      setCooldown((p) => { if (p <= 1) { clearInterval(cooldownRef.current); return 0; } return p - 1; });
    }, 1000);
  };

  const handleSignUp = async () => {
    if (!agreed) {
      setErrors({ agreed: 'يجب الموافقة على الشروط والأحكام وسياسة الخصوصية' });
      toast.error('يجب الموافقة على الشروط والأحكام وسياسة الخصوصية');
      return;
    }
    const parsed = signupSchema.safeParse({
      firstName, lastName, email, phone: phoneRaw, password, confirmPassword,
    });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.issues.forEach((i) => { fieldErrors[i.path[0] as string] = i.message; });
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    const normalized = normalizePhone(phoneRaw);
    if (normalized.length < 12) {
      setErrors({ phone: 'رقم الهاتف غير صالح' });
      return;
    }

    setLoading(true);
    try {
      await signInWithOtp(normalized);
      // Stash profile data to apply after verification.
      sessionStorage.setItem(
        'pending_signup_profile',
        JSON.stringify({
          full_name: `${firstName.trim()} ${lastName.trim()}`,
          email: email.trim(),
          password,
        })
      );
      setPhone(normalized);
      setStep('otp');
      startCooldown();
      toast.success('تم إرسال رمز التحقق');
    } catch (e: any) {
      toast.error(e?.message || 'تعذر إرسال الرمز، حاول مرة أخرى');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setLoading(true);
    try {
      await signInWithOtp(phone);
      startCooldown();
      toast.success('تم إعادة إرسال الرمز');
    } catch {
      toast.error('تعذر إعادة الإرسال');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (i: number, v: string) => {
    // Support browsers/autofill that deliver multiple digits to one input
    const digits = v.replace(/\D/g, '');
    if (!digits && v !== '') return;
    if (digits.length > 1) {
      setOtp((prev) => {
        const n = [...prev];
        for (let k = 0; k < 6 - i && k < digits.length; k++) n[i + k] = digits[k];
        return n;
      });
      const focusIdx = Math.min(i + digits.length, 5);
      otpRefs.current[focusIdx]?.focus();
      return;
    }
    setOtp((prev) => {
      const n = [...prev];
      n[i] = digits.slice(-1);
      return n;
    });
    if (digits && i < 5) otpRefs.current[i + 1]?.focus();
  };
  const handleOtpKey = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus();
  };
  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    setOtp((prev) => {
      const n = [...prev];
      for (let i = 0; i < 6; i++) n[i] = pasted[i] || '';
      return n;
    });
    otpRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  const otpCode = otp.join('');

  // Auto-submit when 6 digits are entered
  useEffect(() => {
    if (step === 'otp' && otpCode.length === 6 && !loading) {
      handleVerify();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otpCode, step]);

  const handleVerify = async () => {
    if (otpCode.length < 6) return;
    setLoading(true);
    try {
      const result = await verifyOtp(phone, otpCode);

      // Apply pending profile data (name, email, password) to the freshly created account
      const pending = sessionStorage.getItem('pending_signup_profile');
      if (pending) {
        try {
          const { full_name, email: pendingEmail, password: pendingPassword } = JSON.parse(pending);
          const { data: { user: u } } = await supabase.auth.getUser();
          if (u) {
            if (pendingEmail || pendingPassword) {
              await supabase.auth.updateUser({
                ...(pendingEmail ? { email: pendingEmail } : {}),
                ...(pendingPassword ? { password: pendingPassword } : {}),
              });
            }
            if (full_name) {
              await supabase.from('profiles').update({ full_name }).eq('id', u.id);
            }
          }
        } catch {/* non-fatal */}
        sessionStorage.removeItem('pending_signup_profile');
      }

      toast.success('تم إنشاء الحساب بنجاح');
      retryProfile();
      const returnUrl = searchParams.get('returnUrl');
      const target = returnUrl
        ? `/onboarding?returnUrl=${encodeURIComponent(returnUrl)}`
        : '/onboarding';
      navigate(target, { replace: true });
    } catch {
      toast.error('الرمز غير صحيح أو منتهي الصلاحية');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    if (!agreed) {
      setErrors({ agreed: 'يجب الموافقة على الشروط والأحكام وسياسة الخصوصية' });
      toast.error('يجب الموافقة على الشروط والأحكام وسياسة الخصوصية');
      return;
    }
    setGoogleLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth('google', {
        redirect_uri: `${window.location.origin}/complete-profile`,
      });
      if (result.error) {
        toast.error('تعذر تسجيل الدخول بـ Google');
        setGoogleLoading(false);
        return;
      }
      if (result.redirected) return;
      // Tokens received directly — check if profile has phone
      navigate('/complete-profile', { replace: true });
    } catch {
      toast.error('تعذر تسجيل الدخول بـ Google');
      setGoogleLoading(false);
    }
  };

  // Shared tokens — themed for both light and dark modes
  const fieldClass =
    'h-[48px] rounded-xl border border-border bg-card pr-11 pl-4 text-[14.5px] text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary/60 hover:bg-accent/5 transition-colors';
  const iconClass = 'absolute right-3.5 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-muted-foreground pointer-events-none';

  return (
    <div className="flex min-h-screen flex-col items-center justify-start bg-background px-6 pt-12 pb-12 font-tajawal" dir="rtl">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <Logo className="mx-auto mb-6 h-20 w-20" />
          <h1 className="text-[28px] font-black tracking-tight leading-tight text-foreground">
            إنشاء <span className="text-primary">حساب</span>
          </h1>
          <p className="mt-2.5 text-[13px] text-muted-foreground leading-relaxed">
            {step === 'form' ? 'أنشئ حسابك في Moktari (مُكتري) بخطوات بسيطة' : 'أدخل رمز التحقق المرسل إليك'}
          </p>
        </div>

        {step === 'form' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-[12.5px] font-semibold text-foreground block">الاسم الأول</Label>
                <div className="relative">
                  <User className={iconClass} strokeWidth={1.75} />
                  <Input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="أحمد"
                    className={fieldClass}
                  />
                </div>
                {errors.firstName && <p className="text-[11px] text-destructive">{errors.firstName}</p>}
              </div>
              <div className="space-y-2">
                <Label className="text-[12.5px] font-semibold text-foreground block">اسم العائلة</Label>
                <div className="relative">
                  <User className={iconClass} strokeWidth={1.75} />
                  <Input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="محمد"
                    className={fieldClass}
                  />
                </div>
                {errors.lastName && <p className="text-[11px] text-destructive">{errors.lastName}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[12.5px] font-semibold text-foreground block">رقم الهاتف</Label>
              <div className="relative">
                <Phone className={iconClass} strokeWidth={1.75} />
                <Input
                  type="tel"
                  inputMode="tel"
                  value={phoneRaw}
                  onChange={(e) => setPhoneRaw(e.target.value)}
                  placeholder="7721234567"
                  className={cn(fieldClass, 'text-left')}
                  dir="ltr"
                />
              </div>
              {errors.phone ? (
                <p className="text-[11px] text-destructive">{errors.phone}</p>
              ) : (
                <p className="text-[11px] text-muted-foreground">سنرسل لك رمز تحقق عبر SMS</p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-[12.5px] font-semibold text-foreground block">البريد الإلكتروني</Label>
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
                />
              </div>
              {errors.email && <p className="text-[11px] text-destructive">{errors.email}</p>}
            </div>

            <div className="space-y-2">
              <Label className="text-[12.5px] font-semibold text-foreground block">كلمة المرور</Label>
              <div className="relative">
                <Lock className={iconClass} strokeWidth={1.75} />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="أدخل كلمة مرور قوية"
                  className={cn(fieldClass, 'pl-11')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                >
                  {showPassword ? <EyeOff className="h-[18px] w-[18px]" strokeWidth={1.75} /> : <Eye className="h-[18px] w-[18px]" strokeWidth={1.75} />}
                </button>
              </div>
              {errors.password ? (
                <p className="text-[11px] text-destructive">{errors.password}</p>
              ) : (
                <p className="text-[11px] text-muted-foreground">6 أحرف على الأقل</p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-[12.5px] font-semibold text-foreground block">تأكيد كلمة المرور</Label>
              <div className="relative">
                <Lock className={iconClass} strokeWidth={1.75} />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="أعد إدخال كلمة المرور"
                  className={fieldClass}
                />
              </div>
              {errors.confirmPassword && <p className="text-[11px] text-destructive">{errors.confirmPassword}</p>}
            </div>

            <Button
              onClick={handleSignUp}
              disabled={loading}
              className="w-full h-[46px] rounded-xl text-[14px] font-bold mt-3 bg-primary text-primary-foreground hover:bg-primary/90 shadow-none"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'إنشاء الحساب'}
            </Button>

            <div className="space-y-1.5">
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <Checkbox
                  checked={agreed}
                  onCheckedChange={(v) => {
                    setAgreed(v === true);
                    if (v === true && errors.agreed) {
                      const { agreed: _omit, ...rest } = errors;
                      setErrors(rest);
                    }
                  }}
                  className="mt-0.5"
                  aria-label="الموافقة على الشروط"
                />
                <span className="text-[12.5px] text-muted-foreground leading-relaxed">
                  أوافق على{' '}
                  <Link to="/terms" target="_blank" className="text-primary font-semibold hover:underline">
                    الشروط والأحكام
                  </Link>{' '}
                  و
                  <Link to="/privacy" target="_blank" className="text-primary font-semibold hover:underline">
                    سياسة الخصوصية
                  </Link>
                </span>
              </label>
              {errors.agreed && <p className="text-[11px] text-destructive pr-7">{errors.agreed}</p>}
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-[11px] text-muted-foreground">أو</span>
              <div className="flex-1 h-px bg-border" />
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
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  المتابعة بحساب Google
                </>
              )}
            </Button>

            <p className="text-center text-[13px] text-muted-foreground pt-2">
              لديك حساب؟{' '}
              <Link to="/auth" className="text-primary font-bold hover:underline">
                سجّل دخولك
              </Link>
            </p>
          </div>
        )}

        {step === 'otp' && (
          <div className="space-y-5">
            <div className="flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2">
              <KeyRound className="h-4 w-4 text-accent shrink-0" />
              <p className="text-xs text-muted-foreground">
                تم إرسال الرمز إلى <span className="font-semibold text-foreground inline-block" dir="ltr">{phone}</span>
              </p>
            </div>
            <div className="flex gap-2 justify-center" dir="ltr" onPaste={handleOtpPaste}>
              {otp.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => { otpRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={d}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKey(i, e)}
                  className={cn(
                    'h-12 w-12 rounded-xl border-2 bg-card text-center text-xl font-bold outline-none transition-all',
                    d ? 'border-accent text-foreground' : 'border-border text-muted-foreground',
                    'focus:border-primary focus:ring-2 focus:ring-primary/20'
                  )}
                />
              ))}
            </div>
            <Button onClick={handleVerify} disabled={loading || otpCode.length < 6} className="w-full h-12 text-base">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'تأكيد وإنشاء الحساب'}
            </Button>
            <div className="flex items-center justify-between pt-1">
              <button
                onClick={() => { setStep('form'); setOtp(Array(6).fill('')); }}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground min-h-[44px] px-1"
              >
                <ArrowRight className="h-3.5 w-3.5" />
                تعديل البيانات
              </button>
              <button
                onClick={handleResend}
                disabled={cooldown > 0 || loading}
                className="flex items-center gap-1 text-sm text-accent hover:text-accent/80 disabled:opacity-50 min-h-[44px] px-1"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {cooldown > 0 ? `إعادة الإرسال (${cooldown})` : 'إعادة الإرسال'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SignUpPage;
