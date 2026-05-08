import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Loader2, Phone } from 'lucide-react';

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

const CompleteProfilePage = () => {
  const { user, profile, loading: authLoading, retryProfile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [phoneRaw, setPhoneRaw] = useState('');
  const [loading, setLoading] = useState(false);

  // Not signed in? Bounce to signup.
  useEffect(() => {
    if (!authLoading && !user) navigate('/signup', { replace: true });
  }, [authLoading, user]);

  // Already has phone? Skip.
  useEffect(() => {
    if (profile && profile.phone && profile.phone.trim().length > 0) {
      const returnUrl = searchParams.get('returnUrl') || '/';
      navigate(returnUrl, { replace: true });
    }
  }, [profile]);

  const handleSave = async () => {
    const normalized = normalizePhone(phoneRaw);
    if (normalized.length < 12) {
      toast.error('رقم الهاتف غير صالح');
      return;
    }
    if (!user) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ phone: normalized })
        .eq('id', user.id);
      if (error) throw error;
      toast.success('تم إكمال الحساب بنجاح');
      retryProfile();
      const returnUrl = searchParams.get('returnUrl') || '/';
      navigate(returnUrl, { replace: true });
    } catch (e: any) {
      toast.error(e?.message || 'تعذر حفظ الرقم');
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
          <Logo className="mx-auto mb-3 h-20 w-20" />
          <h1 className="text-2xl font-black text-primary">أكمل حسابك</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            نحتاج رقم هاتفك لإكمال إنشاء الحساب
          </p>
        </div>

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

          <Button onClick={handleSave} disabled={loading || !phoneRaw.trim()} className="w-full h-12 text-base">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'حفظ ومتابعة'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CompleteProfilePage;
