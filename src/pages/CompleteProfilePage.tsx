import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Loader2, Phone, KeyRound, Home, Building2, Handshake, ArrowLeft, RefreshCw } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { signInWithOtp, verifyGoogleOtp } from '@/lib/auth';
import { cn } from '@/lib/utils';

const RESEND_COOLDOWN = 60;

const normalizePhone = (raw: string) => {
  let d = raw.replace(/[^\d+]/g, '');
  if (!d.startsWith('+')) {
    if (d.startsWith('00')) d = '+' + d.slice(2);
    else if (d.startsWith('967')) d = '+' + d;
    else if (d.startsWith('0')) d = '+967' + d.slice(1);
    else d = '+967' + d;
  }
  return d;
};

const roleCards = [
  {
    value: 'renter',
    icon: Home,
    title: 'مستأجر',
    description: 'أبحث عن سكن مناسب',
  },
  {
    value: 'owner',
    icon: Building2,
    title: 'مالك عقار',
    description: 'نشر إعلاناتي وإدارة عقاراتي',
  },
  {
    value: 'broker',
    icon: Handshake,
    title: 'دلال عقارات',
    description: 'مساعدة الآخرين في إيجاد السكن',
  },
] as const;

type Step = 'phone' | 'otp' | 'role';

const CompleteProfilePage = () => {
  const { user, profile, loading: authLoading, retryProfile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();


  const [step, setStep] = useState<Step>('phone');
  const [phoneRaw, setPhoneRaw] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState<string[]>(Array(6).fill(''));
  const [selectedRole, setSelectedRole] = useState('renter');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const cooldownRef = useRef<ReturnType<typeof setInterval>>();
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const googleName = user?.user_metadata?.full_name || user?.user_metadata?.name || '';

  useEffect(() => () => { if (cooldownRef.current) clearInterval(cooldownRef.current); }, []);

  useEffect(() => {
    if (!authLoading && !user) navigate('/signup', { replace: true });
  }, [authLoading, user]);

  useEffect(() => {
    if (profile?.full_name) {
      const returnUrl = searchParams.get('returnUrl') || '/';
      navigate(returnUrl, { replace: true });
    }
  }, [profile]);

  const startCooldown = () => {
    setCooldown(RESEND_COOLDOWN);
    cooldownRef.current = setInterval(() => {
      setCooldown((p) => { if (p <= 1) { clearInterval(cooldownRef.current); return 0; } return p - 1; });
    }, 1000);
  };

  const handleSendOtp = async () => {
    const normalized = normalizePhone(phoneRaw);
    if (normalized.length < 12) {
      toast.error('رقم الهاتف غير صالح');
      return;
    }
    setLoading(true);
    try {
      await signInWithOtp({ email: user?.email, phone: normalized });
      setPhone(normalized);
      setStep('otp');
      startCooldown();
      toast.success('تم إرسال رمز التحقق');
    } catch (e: any) {
      toast.error(e?.message || 'تعذر إرسال الرمز');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || !phone) return;
    setLoading(true);
    try {
      await signInWithOtp({ email: user?.email });
      startCooldown();
      toast.success('تم إعادة إرسال الرمز');
    } catch {
      toast.error('تعذر إرسال الرمز');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (i: number, v: string) => {
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

  useEffect(() => {
    if (step === 'otp' && otpCode.length === 6 && !loading) {
      handleVerifyOtp();
    }
  }, [otpCode, step]);

  const handleVerifyOtp = async () => {
    if (otpCode.length < 6 || !phone) return;
    setLoading(true);
    try {
      await verifyGoogleOtp(otpCode);
      toast.success('تم التحقق من البريد الإلكتروني');
      setStep('role');
    } catch {
      toast.error('الرمز غير صحيح أو منتهي الصلاحية');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedRole || !user || !phone) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          phone,
          role: selectedRole as 'renter' | 'owner' | 'broker' | 'admin' | 'moderator',
          full_name: googleName || 'مستخدم جديد',
        })
        .eq('id', user.id);
      if (error) throw error;
      toast.success('تم إكمال التسجيل');
      retryProfile();
      const returnUrl = searchParams.get('returnUrl') || '/';
      navigate(returnUrl, { replace: true });
    } catch (e: any) {
      toast.error(e?.message || 'تعذر حفظ البيانات');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 font-tajawal" dir="rtl">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Logo framed className="mx-auto mb-3 h-28 w-28" />
          <h1 className="text-2xl font-black text-primary">أكمل حسابك</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {step === 'phone' && 'أدخل رقم هاتفك للتواصل'}
            {step === 'otp' && 'أدخل رمز التحقق المرسل إلى بريدك الإلكتروني'}
            {step === 'role' && 'اختر نوع الحساب'}
          </p>
        </div>

        <div className="flex items-center justify-center gap-2 mb-6">
          {(['phone', 'otp', 'role'] as const).map((s) => {
            const idx = ['phone', 'otp', 'role'].indexOf(s);
            const cur = ['phone', 'otp', 'role'].indexOf(step);
            return (
              <div
                key={s}
                className={cn(
                  'h-2 rounded-full transition-all duration-300',
                  idx === cur ? 'w-8 bg-accent' : idx < cur ? 'w-2 bg-accent/60' : 'w-2 bg-muted'
                )}
              />
            );
          })}
        </div>

        {/* Step 1: Phone */}
        {step === 'phone' && (
          <div className="space-y-4">
            <div>
              <Label className="text-xs font-semibold mb-1.5 block">رقم الهاتف</Label>
              <div className="relative">
                <Phone className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="tel"
                  inputMode="tel"
                  value={phoneRaw}
                  onChange={(e) => setPhoneRaw(e.target.value)}
                  placeholder="مثال: 772123456"
                  className="h-11 pr-10 text-left"
                  dir="ltr"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                سيُستخدم للتواصل مع المالكين والمستأجرين
              </p>
            </div>
            <Button onClick={handleSendOtp} disabled={loading || !phoneRaw.trim()} className="w-full h-12 text-base">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'إرسال رمز التحقق'}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              سيتم إرسال رمز التحقق إلى بريدك الإلكتروني المرتبط بحساب Google.
            </p>
          </div>
        )}

        {/* Step 2: OTP */}
        {step === 'otp' && (
          <div className="space-y-5">
            <div className="flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2">
              <KeyRound className="h-4 w-4 text-accent shrink-0" />
              <p className="text-xs text-muted-foreground">
                تم إرسال الرمز إلى <span className="font-semibold text-foreground inline-block" dir="ltr">{user?.email}</span>
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
            <Button onClick={handleVerifyOtp} disabled={loading || otpCode.length < 6} className="w-full h-12 text-base">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'تأكيد الرمز'}
            </Button>
            <div className="flex items-center justify-between pt-1">
              <button
                onClick={() => { setStep('phone'); setOtp(Array(6).fill('')); }}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground min-h-[44px] px-1"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                تعديل الرقم
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

        {/* Step 3: Role selection */}
        {step === 'role' && (
          <div className="space-y-4">
            {googleName && (
              <div className="rounded-xl bg-muted/50 px-3 py-2 text-center">
                <p className="text-xs text-muted-foreground">مرحباً</p>
                <p className="text-sm font-semibold text-foreground">{googleName}</p>
              </div>
            )}
            <p className="text-sm text-muted-foreground text-center">اختر نوع الحساب الذي يناسبك</p>
            <div className="space-y-3">
              {roleCards.map((card) => {
                const Icon = card.icon;
                const sel = selectedRole === card.value;
                return (
                  <button
                    key={card.value}
                    onClick={() => setSelectedRole(card.value)}
                    className={cn(
                      'w-full flex items-start gap-4 rounded-2xl border-2 p-4 text-right transition-all duration-200',
                      sel ? 'border-accent bg-accent/5 shadow-md' : 'border-border bg-card hover:border-accent/40'
                    )}
                  >
                    <div className={cn(
                      'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-colors',
                      sel ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'
                    )}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn('font-bold text-sm', sel ? 'text-accent' : 'text-foreground')}>
                        {card.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{card.description}</p>
                    </div>
                    <div className={cn(
                      'mt-1 h-5 w-5 shrink-0 rounded-full border-2 transition-all',
                      sel ? 'border-accent bg-accent' : 'border-muted-foreground/30'
                    )}>
                      {sel && (
                        <svg viewBox="0 0 20 20" fill="white" className="h-full w-full p-0.5">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
            <Button
              onClick={handleSave}
              disabled={loading || !selectedRole}
              className="w-full h-12 text-base"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'ابدأ الآن'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CompleteProfilePage;
