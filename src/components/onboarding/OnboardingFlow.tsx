import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Home, Building2, Handshake, Loader2, ArrowLeft } from 'lucide-react';

type OnboardingStep = 1 | 2;

const roleCards = [
  {
    value: 'renter',
    icon: Home,
    title: 'أبحث عن سكن',
    description: 'تصفح الإعلانات وقدم طلب سكن',
  },
  {
    value: 'owner',
    icon: Building2,
    title: 'عندي عقار وأريد تأجيره',
    description: 'انشر إعلانك وتواصل مع المستأجرين',
  },
  {
    value: 'broker',
    icon: Handshake,
    title: 'أعمل كوسيط (دلال)',
    description: 'ساعد الآخرين في إيجاد السكن المناسب',
  },
] as const;

const OnboardingFlow = () => {
  const [step, setStep] = useState<OnboardingStep>(1);
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { retryProfile } = useAuth();

  const pendingData = JSON.parse(sessionStorage.getItem('pending_signup_profile') || '{}');
  const fullName = (pendingData.full_name || '').trim();
  console.log('[DIAG] OnboardingFlow — sessionStorage pending_signup_profile:', pendingData);
  console.log('[DIAG] OnboardingFlow — fullName from sessionStorage:', fullName);

  const handleSubmit = async () => {
    if (!fullName) {
      toast.error('خطأ في بيانات التسجيل');
      return;
    }
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      console.log('[DIAG] OnboardingFlow — auth.user before profile update:', { id: user?.id, email: user?.email, phone: user?.phone });
      if (!user) throw new Error('لم يتم العثور على المستخدم');

      const { data: beforeProfile } = await supabase.from('profiles').select('id, full_name, role, phone').eq('id', user.id).maybeSingle();
      console.log('[DIAG] OnboardingFlow — profile BEFORE update:', beforeProfile);

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          role: selectedRole as 'renter' | 'owner' | 'broker' | 'admin' | 'moderator',
        })
        .eq('id', user.id);

      if (error) {
        console.error('Profile save error:', JSON.stringify(error));
        throw error;
      }

      const { data: afterProfile } = await supabase.from('profiles').select('id, full_name, role, phone').eq('id', user.id).maybeSingle();
      console.log('[DIAG] OnboardingFlow — profile AFTER update:', afterProfile);

      sessionStorage.removeItem('pending_signup_profile');

      toast.success('مرحباً بك في مُكتري!');
      retryProfile();

      const returnUrl = searchParams.get('returnUrl');
      if (returnUrl) {
        navigate(returnUrl, { replace: true });
      } else if (selectedRole === 'renter') {
        navigate('/', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      console.error('Onboarding error:', err);
      toast.error('تعذر حفظ البيانات، حاول مرة أخرى');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Progress dots */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {[1, 2].map((s) => (
          <div
            key={s}
            className={cn(
              'h-2 rounded-full transition-all duration-300',
              s === step ? 'w-8 bg-accent' : s < step ? 'w-2 bg-accent/60' : 'w-2 bg-muted'
            )}
          />
        ))}
      </div>

      {/* ─── Step 1: Intent ─── */}
      <div className={cn('transition-all duration-300', step === 1 ? 'block' : 'hidden')}>
        <h2 className="text-xl font-bold text-foreground text-center mb-1">
          كيف تريد استخدام مُكتري؟
        </h2>
        <p className="text-sm text-muted-foreground text-center mb-6">اختر ما يناسبك وبإمكانك التغيير لاحقاً</p>

        <div className="space-y-3">
          {roleCards.map((card) => {
            const Icon = card.icon;
            const selected = selectedRole === card.value;
            return (
              <button
                key={card.value}
                onClick={() => setSelectedRole(card.value)}
                className={cn(
                  'w-full flex items-start gap-4 rounded-2xl border-2 p-4 text-right transition-all duration-200',
                  selected
                    ? 'border-accent bg-accent/5 shadow-md'
                    : 'border-border bg-card hover:border-accent/40'
                )}
              >
                <div className={cn(
                  'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-colors',
                  selected ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'
                )}>
                  <Icon className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn('font-bold text-sm', selected ? 'text-accent' : 'text-foreground')}>
                    {card.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{card.description}</p>
                </div>
                <div className={cn(
                  'mt-1 h-5 w-5 shrink-0 rounded-full border-2 transition-all',
                  selected ? 'border-accent bg-accent' : 'border-muted-foreground/30'
                )}>
                  {selected && (
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
          onClick={() => setStep(2)}
          disabled={!selectedRole}
          className="w-full h-12 text-base mt-6"
        >
          التالي
        </Button>
      </div>

      {/* ─── Step 2: Confirm ─── */}
      <div className={cn('transition-all duration-300', step === 2 ? 'block' : 'hidden')}>
        <button
          onClick={() => setStep(1)}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4 min-h-[44px]"
        >
          <ArrowLeft className="h-4 w-4" />
          رجوع
        </button>

        <div className="text-center mb-6">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10">
            <span className="text-3xl">🎉</span>
          </div>
          <h2 className="text-xl font-bold text-foreground">كل شيء جاهز!</h2>
          <p className="text-sm text-muted-foreground mt-1">تحقق من بياناتك ثم ابدأ</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 space-y-3 mb-6">
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">الاسم</span>
            <span className="text-sm font-semibold text-foreground">{fullName}</span>
          </div>
          <div className="h-px bg-border" />
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">نوع الحساب</span>
            <span className="text-sm font-semibold text-foreground">
              {roleCards.find(r => r.value === selectedRole)?.title}
            </span>
          </div>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full h-12 text-base"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'ابدأ الآن 🚀'}
        </Button>
      </div>
    </div>
  );
};

export default OnboardingFlow;
