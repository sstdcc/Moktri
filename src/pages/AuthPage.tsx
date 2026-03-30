import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { signInWithOtp, verifyOtp } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Phone, KeyRound, UserPlus, Loader2, ArrowRight, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

const RESEND_COOLDOWN = 60;

type Step = 'phone' | 'otp' | 'profile-setup';

const roleOptions = [
  { value: 'renter', label: 'أبحث عن سكن' },
  { value: 'owner', label: 'لدي عقار للإيجار' },
  { value: 'broker', label: 'دلال عقارات' },
] as const;

const AuthPage = () => {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState<string[]>(Array(6).fill(''));
  const [step, setStep] = useState<Step>('phone');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [isNewUser, setIsNewUser] = useState(false);

  // Profile setup
  const [fullName, setFullName] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('renter');
  const [whatsapp, setWhatsapp] = useState('');

  const cooldownRef = useRef<ReturnType<typeof setInterval>>();
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, profile, retryProfile } = useAuth();

  useEffect(() => {
    return () => { if (cooldownRef.current) clearInterval(cooldownRef.current); };
  }, []);

  // After auth completes and profile loads, check if profile setup needed
  useEffect(() => {
    if (step === 'profile-setup' || step === 'phone') return;
    if (user && profile && !isNewUser) {
      // Existing user with profile — redirect
      const returnUrl = searchParams.get('returnUrl') || '/';
      navigate(returnUrl, { replace: true });
    }
  }, [user, profile, step, isNewUser]);

  const startCooldown = () => {
    setCooldown(RESEND_COOLDOWN);
    cooldownRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) { clearInterval(cooldownRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

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

  const handleSendOtp = async () => {
    const normalized = normalizePhone(phone);
    if (normalized.length < 12) {
      toast.error('أدخل رقم هاتف صحيح');
      return;
    }
    setLoading(true);
    try {
      await signInWithOtp(normalized);
      setPhone(normalized);
      setStep('otp');
      startCooldown();
      toast.success('تم إرسال رمز التحقق');
    } catch {
      toast.error('تعذر إكمال العملية، حاول مرة أخرى');
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
      toast.success('تم إعادة إرسال رمز التحقق');
    } catch {
      toast.error('تعذر إكمال العملية، حاول مرة أخرى');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newOtp = [...otp];
    for (let i = 0; i < 6; i++) {
      newOtp[i] = pasted[i] || '';
    }
    setOtp(newOtp);
    const focusIdx = Math.min(pasted.length, 5);
    otpRefs.current[focusIdx]?.focus();
  };

  const otpCode = otp.join('');

  const handleVerify = async () => {
    if (otpCode.length < 6) return;
    setLoading(true);
    try {
      const result = await verifyOtp(phone, otpCode);
      if (result.isNew) {
        setIsNewUser(true);
        setStep('profile-setup');
        toast.success('تم التحقق بنجاح! أكمل ملفك الشخصي');
      } else {
        toast.success('تم تسجيل الدخول بنجاح');
        retryProfile();
        const returnUrl = searchParams.get('returnUrl') || '/';
        navigate(returnUrl, { replace: true });
      }
    } catch {
      toast.error('الرمز غير صحيح أو منتهي الصلاحية');
    } finally {
      setLoading(false);
    }
  };

  const handleProfileSetup = async () => {
    if (!fullName.trim()) { toast.error('أدخل اسمك الكامل'); return; }
    setLoading(true);
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) throw new Error('لم يتم العثور على المستخدم');

      const { error } = await supabase.from('profiles').update({
        full_name: fullName.trim(),
        role: selectedRole as any,
        whatsapp_number: whatsapp.trim() || null,
      }).eq('id', currentUser.id);

      if (error) throw error;
      toast.success('مرحباً بك في مفتاح!');
      retryProfile();
      const returnUrl = searchParams.get('returnUrl') || '/';
      navigate(returnUrl, { replace: true });
    } catch {
      toast.error('تعذر حفظ البيانات، حاول مرة أخرى');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 font-tajawal" dir="rtl">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-lg">
            <span className="text-2xl font-black text-primary-foreground">م</span>
          </div>
          <h1 className="text-3xl font-black text-primary">مفتاح</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {step === 'phone' && 'سجّل دخولك عبر رقم الهاتف'}
            {step === 'otp' && 'أدخل رمز التحقق المرسل'}
            {step === 'profile-setup' && 'أكمل ملفك الشخصي'}
          </p>
        </div>

        {/* ─── STEP 1: Phone Input ─── */}
        {step === 'phone' && (
          <div className="space-y-4">
            <div className="relative">
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Phone className="h-4 w-4 text-muted-foreground" />
              </div>
              <Input
                type="tel"
                placeholder="مثال: 772123456"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="pr-10 text-left"
                dir="ltr"
                inputMode="tel"
                aria-label="رقم الهاتف"
              />
            </div>
            <p className="text-xs text-muted-foreground text-center">
              أدخل رقمك اليمني وسنرسل لك رمز تحقق عبر SMS
            </p>
            <Button onClick={handleSendOtp} disabled={loading || !phone.trim()} className="w-full h-12 text-base">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'إرسال رمز التحقق'}
            </Button>
          </div>
        )}

        {/* ─── STEP 2: OTP Input ─── */}
        {step === 'otp' && (
          <div className="space-y-5">
            <div className="flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2">
              <KeyRound className="h-4 w-4 text-accent shrink-0" />
              <p className="text-xs text-muted-foreground">
                تم إرسال الرمز إلى <span className="font-semibold text-foreground ltr inline-block" dir="ltr">{phone}</span>
              </p>
            </div>

            {/* OTP Boxes */}
            <div className="flex gap-2 justify-center" dir="ltr" onPaste={handleOtpPaste}>
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { otpRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  className={cn(
                    'h-12 w-12 rounded-xl border-2 bg-card text-center text-xl font-bold transition-all duration-200 outline-none',
                    digit ? 'border-accent text-foreground' : 'border-border text-muted-foreground',
                    'focus:border-primary focus:ring-2 focus:ring-primary/20'
                  )}
                  aria-label={`رقم ${i + 1}`}
                />
              ))}
            </div>

            <Button onClick={handleVerify} disabled={loading || otpCode.length < 6} className="w-full h-12 text-base">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'تأكيد'}
            </Button>

            <div className="flex items-center justify-between pt-1">
              <button
                onClick={() => { setStep('phone'); setOtp(Array(6).fill('')); }}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors min-h-[44px] px-1"
              >
                <ArrowRight className="h-3.5 w-3.5" />
                تغيير الرقم
              </button>
              <button
                onClick={handleResend}
                disabled={cooldown > 0 || loading}
                className="flex items-center gap-1 text-sm text-accent hover:text-accent/80 transition-colors disabled:opacity-50 min-h-[44px] px-1"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {cooldown > 0 ? `إعادة الإرسال (${cooldown})` : 'إعادة الإرسال'}
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 3: Profile Setup ─── */}
        {step === 'profile-setup' && (
          <div className="space-y-5">
            <div className="flex items-center gap-2 rounded-xl bg-success/10 px-3 py-2">
              <UserPlus className="h-4 w-4 text-success shrink-0" />
              <p className="text-xs text-success font-medium">مرحباً! أكمل بياناتك للبدء</p>
            </div>

            <div>
              <Label className="text-sm font-semibold mb-2 block">
                الاسم الكامل <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="مثال: أحمد محمد"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                aria-label="الاسم الكامل"
              />
            </div>

            <div>
              <Label className="text-sm font-semibold mb-3 block">ما الذي تبحث عنه؟</Label>
              <RadioGroup value={selectedRole} onValueChange={setSelectedRole} className="space-y-2">
                {roleOptions.map((opt) => (
                  <label
                    key={opt.value}
                    className={cn(
                      'flex items-center gap-3 rounded-xl border-2 p-3 cursor-pointer transition-all',
                      selectedRole === opt.value ? 'border-accent bg-accent/5' : 'border-border hover:border-accent/30'
                    )}
                  >
                    <RadioGroupItem value={opt.value} id={`role-${opt.value}`} />
                    <span className="text-sm font-medium">{opt.label}</span>
                  </label>
                ))}
              </RadioGroup>
            </div>

            <div>
              <Label className="text-sm font-semibold mb-2 block">رقم واتساب (اختياري)</Label>
              <Input
                type="tel"
                placeholder="مثال: 772123456"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                dir="ltr"
                className="text-left"
                aria-label="رقم واتساب"
              />
            </div>

            <Button onClick={handleProfileSetup} disabled={loading || !fullName.trim()} className="w-full h-12 text-base">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'ابدأ الآن'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthPage;
