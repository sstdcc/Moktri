import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { signInWithOtp, verifyOtp } from '@/lib/auth';
import { toast } from 'sonner';

const AuthPage = () => {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const handleSendOtp = async () => {
    if (!phone) return;
    setLoading(true);
    try {
      await signInWithOtp(phone);
      setStep('otp');
      toast.success('تم إرسال رمز التحقق');
    } catch {
      toast.error('فشل إرسال الرمز');
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
      toast.error('رمز التحقق غير صحيح');
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
              />
              <Button onClick={handleVerify} disabled={loading} className="w-full">
                {loading ? 'جاري التحقق...' : 'تأكيد'}
              </Button>
              <button onClick={() => setStep('phone')} className="w-full text-center text-sm text-muted-foreground underline">
                تغيير الرقم
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
export default AuthPage;
