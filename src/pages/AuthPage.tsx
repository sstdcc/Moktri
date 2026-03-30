import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { signInWithOtp, verifyOtp } from '@/lib/auth';
import { toast } from 'sonner';

const RESEND_COOLDOWN = 60; // seconds

const AuthPage = () => {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval>>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  const startCooldown = () => {
    setCooldown(RESEND_COOLDOWN);
    cooldownRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSendOtp = async () => {
    if (!phone) return;
    setLoading(true);
    try {
      await signInWithOtp(phone);
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

  const handleVerify = async () => {
    if (!otp) return;
    setLoading(true);
    try {
      await verifyOtp(phone, otp);
      toast.success('تم تسجيل الدخول بنجاح');
      const returnUrl = searchParams.get('returnUrl') || '/';
      navigate(returnUrl, { replace: true });
    } catch {
      toast.error('الرمز غير صحيح أو منتهي الصلاحية');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 font-tajawal">
      <div className="w-full max-w-sm">
        <h1 className="text-center text-3xl font-bold text-primary">مفتاح</h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">سجّل دخولك عبر رقم الهاتف</p>

        <div className="mt-8 space-y-4">
          {step === 'phone' ? (
            <>
              <Input
                type="tel"
                placeholder="رقم الهاتف مع رمز الدولة"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="text-right"
                dir="ltr"
              />
              <Button onClick={handleSendOtp} disabled={loading} className="w-full">
                {loading ? 'جاري الإرسال...' : 'إرسال رمز التحقق'}
              </Button>
            </>
          ) : (
            <>
              <Input
                type="text"
                placeholder="أدخل رمز التحقق"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="text-center tracking-widest"
                maxLength={6}
                inputMode="numeric"
              />
              <Button onClick={handleVerify} disabled={loading} className="w-full">
                {loading ? 'جاري التحقق...' : 'تأكيد'}
              </Button>
              <div className="flex items-center justify-between">
                <button onClick={() => { setStep('phone'); setOtp(''); }} className="text-sm text-muted-foreground underline">
                  تغيير الرقم
                </button>
                <button
                  onClick={handleResend}
                  disabled={cooldown > 0 || loading}
                  className="text-sm text-muted-foreground underline disabled:opacity-50 disabled:no-underline"
                >
                  {cooldown > 0 ? `إعادة الإرسال (${cooldown})` : 'إعادة الإرسال'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
export default AuthPage;
