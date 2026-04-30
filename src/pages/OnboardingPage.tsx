import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import OnboardingFlow from '@/components/onboarding/OnboardingFlow';

const OnboardingPage = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate('/signup', { replace: true });
  }, [loading, user, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-start bg-background px-6 pt-12 pb-12 font-tajawal"
      dir="rtl"
    >
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-md">
            <span className="text-xl font-black text-primary-foreground">م</span>
          </div>
          <h1 className="text-[24px] font-black tracking-tight text-foreground">
            مرحباً بك في <span className="text-primary">مفتاح</span>
          </h1>
          <p className="mt-2 text-[13px] text-muted-foreground">خطوة أخيرة لإكمال حسابك</p>
        </div>
        <OnboardingFlow />
      </div>
    </div>
  );
};

export default OnboardingPage;
