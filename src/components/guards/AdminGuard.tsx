import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useEffect, useRef } from 'react';

export const AdminGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile, loading, profileError, retryProfile } = useAuth();
  const toastShown = useRef(false);

  if (loading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/auth" replace />;

  if (profileError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background font-tajawal" dir="rtl">
        <p className="text-destructive">تعذر تحميل الملف الشخصي</p>
        <Button onClick={retryProfile}>إعادة المحاولة</Button>
      </div>
    );
  }

  if (!profile) return <LoadingSpinner />;

  if (profile.role !== 'admin' && profile.role !== 'moderator') {
    if (!toastShown.current) {
      toastShown.current = true;
      toast.error('ليست لديك صلاحية للوصول إلى هذه الصفحة');
    }
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};
