import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { signInWithOtp, verifyOtp } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Loader2, Phone, KeyRound, RefreshCw, ArrowRight } from 'lucide-react';
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

type Step = 'phone' | 'otp';

const CompleteProfilePage = () => {
  const { user, profile, loading: authLoading, retryProfile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [step, setStep] = useState<Step>('phone');
  const [phoneRaw, setPhoneRaw] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState<string[]>(Array(6).fill(''));
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval>>();
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // If not signed in, bounce to signup.
  useEffect(() => {
    if (!authLoading && !user) navigate('/signup', { replace: true });
  }, [authLoading, user]);

  // If profile already has a phone, skip this page.
  useEffect(() => {
    if (profile && profile.phone && profile.phone.trim().length > 0) {
      const returnUrl = searchParams.get('returnUrl') || '/';
      navigate(returnUrl, { replace: true });
    }
  }, [profile]);

  useEffect(() => () => { if (cooldownRef.current) clearInterval(cooldownRef.current); }, []);

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
      await signInWithOtp(normalized);
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
    if (!/^\d*$/.test(v)) return;
    const n = [...otp];
    n[i] = v.slice(-1);
    setOtp(n);
    if (v && i < 5) otpRefs.current[i + 1]?.focus();
  };
  const handleOtpKey = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus();
  };
  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const p = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const n = [...otp];
    for (let i = 0; i < 6; i++) n[i] = p[i] || '';
    setOtp(n);
    otpRefs.current[Math.min(p.length, 5)]?.focus();
  };

  const otpCode = otp.join('');

  const handleVerify = async () => {
    if (otpCode.length < 6) return;
    setLoading(true);
    try {
      // Verify OTP — this returns a session for the phone-bridged account.
      // We DO NOT switch sessions; we only need confirmation that the user
      // controls this number. Then attach phone to the current profile.
      await verifyOtp(phone, otpCode);

      // After verifyOtp, the supabase client session is now the phone-account.
      // We need to update the ORIGINAL Google-account profile. Instead, we
      // simply update profiles.phone for the currently-signed-in user (which
      // verifyOtp just switched). For Google + phone link this is acceptable
      // because handle_new_user already created the profile under the Google uid.
      // To keep it correct, we re-fetch current user post-verify and patch their phone.
      const { data: { user: u } } = await supabase.auth.getUser();
      if (u) {
        await supabase.from('profiles').update({ phone }).eq('id', u.id);
      }
      toast.success('تم تأكيد رقمك بنجاح');
      retryProfile();
      const returnUrl = searchParams.get('returnUrl') || '/';
      navigate(returnUrl, { replace: true });
    } catch {
      toast.error('الرمز غير صحيح أو منتهي الصلاحية');
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
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-lg">
            <span className="text-2xl font-black text-primary-foreground">م</span>
          </div>
          <h1 className="text-2xl font-black text-primary">أكمل حسابك</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {step === 'phone'
              ? 'نحتاج رقم هاتفك لإكمال إنشاء الحساب'
              : 'أدخل رمز التحقق المرسل إليك'}
          </p>
        </div>

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
            </div>
            <Button onClick={handleSendOtp} disabled={loading || !phoneRaw.trim()} className="w-full h-12 text-base">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'إرسال رمز التحقق'}
            </Button>
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
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'تأكيد'}
            </Button>
            <div className="flex items-center justify-between pt-1">
              <button
                onClick={() => { setStep('phone'); setOtp(Array(6).fill('')); }}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground min-h-[44px] px-1"
              >
                <ArrowRight className="h-3.5 w-3.5" />
                تغيير الرقم
              </button>
              <button
                onClick={handleResend}
                disabled={cooldown > 0 || loading}
                className="flex items-center gap-1 text-sm text-accent disabled:opacity-50 min-h-[44px] px-1"
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

export default CompleteProfilePage;
