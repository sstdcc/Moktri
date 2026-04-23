import { useNavigate, useLocation } from 'react-router-dom';
import { LucideIcon, Lock } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { BottomNav } from '@/components/ui/BottomNav';

interface LoginRequiredProps {
  icon?: LucideIcon;
  title?: string;
  subtitle?: string;
  /** Page header title — when provided, renders header + bottom nav around the prompt. */
  pageTitle?: string;
  /** Show back button in the page header (default true). */
  showBack?: boolean;
  /** Hide the bottom nav (default false). */
  hideBottomNav?: boolean;
  /** Override the return URL after login (defaults to current location). */
  returnUrl?: string;
}

export const LoginRequired = ({
  icon = Lock,
  title = 'سجّل دخولك أولاً',
  subtitle = 'يجب تسجيل الدخول للوصول إلى هذه الصفحة',
  pageTitle,
  showBack = true,
  hideBottomNav = false,
  returnUrl,
}: LoginRequiredProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const target = returnUrl ?? location.pathname;

  const prompt = (
    <EmptyState
      icon={icon}
      title={title}
      subtitle={subtitle}
      actionLabel="تسجيل الدخول"
      onAction={() => navigate(`/auth?returnUrl=${encodeURIComponent(target)}`)}
    />
  );

  if (!pageTitle) return prompt;

  return (
    <div className="min-h-screen bg-background pb-20 font-tajawal" dir="rtl">
      <PageHeader title={pageTitle} showBack={showBack} />
      {prompt}
      {!hideBottomNav && <BottomNav />}
    </div>
  );
};
