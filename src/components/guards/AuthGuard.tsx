import { useAuth } from '@/contexts/AuthContext';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { LoginRequired } from '@/components/ui/LoginRequired';
import { Button } from '@/components/ui/button';

export const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading, profileError, retryProfile } = useAuth();

  if (loading) return <LoadingSpinner />;
  if (!user) return <LoginRequired />;

  if (profileError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background font-tajawal" dir="rtl">
        <p className="text-destructive">تعذر تحميل الملف الشخصي</p>
        <Button onClick={retryProfile}>إعادة المحاولة</Button>
      </div>
    );
  }

  return <>{children}</>;
};
