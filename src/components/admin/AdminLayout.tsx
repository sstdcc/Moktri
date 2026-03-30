import { ReactNode } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  ListChecks,
  FileSearch,
  ShieldAlert,
  Users,
  BadgeCheck,
  MapPin,
  LogOut,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const adminNavItems = [
  { label: 'نظرة عامة', icon: LayoutDashboard, path: '/dashboard/admin' },
  { label: 'الإعلانات', icon: ListChecks, path: '/dashboard/admin/listings' },
  { label: 'الطلبات', icon: FileSearch, path: '/dashboard/admin/requests' },
  { label: 'البلاغات', icon: ShieldAlert, path: '/dashboard/admin/reports' },
  { label: 'المستخدمون', icon: Users, path: '/dashboard/admin/users' },
  { label: 'التوثيق', icon: BadgeCheck, path: '/dashboard/admin/verifications' },
  { label: 'الأحياء', icon: MapPin, path: '/dashboard/admin/districts' },
];

export const AdminLayout = ({ children }: { children: ReactNode }) => {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();

  const isActive = (path: string) =>
    path === '/dashboard/admin'
      ? location.pathname === '/dashboard/admin'
      : location.pathname.startsWith(path);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-background font-tajawal flex" dir="rtl">
      {/* Sidebar - md+ only */}
      {!isMobile && (
        <aside className="w-60 shrink-0 fixed top-0 right-0 h-screen bg-card border-l border-border flex flex-col z-40">
          <div className="p-4 border-b border-border">
            <h2 className="text-lg font-bold text-foreground">مفتاح — لوحة التحكم</h2>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-sm text-muted-foreground">{profile?.full_name}</span>
              <Badge variant="secondary" className="text-xs">
                {profile?.role === 'admin' ? 'مدير' : 'مشرف'}
              </Badge>
            </div>
          </div>

          <nav className="flex-1 p-3 space-y-1 overflow-auto">
            {adminNavItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors',
                  isActive(item.path)
                    ? 'bg-accent/10 text-accent font-semibold'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>

          <div className="p-3 border-t border-border">
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-danger"
              onClick={handleSignOut}
            >
              <LogOut className="h-5 w-5" />
              تسجيل الخروج
            </Button>
          </div>
        </aside>
      )}

      {/* Main content */}
      <main
        className={cn(
          'flex-1 overflow-auto',
          !isMobile ? 'mr-60' : 'pb-20'
        )}
      >
        <div className="p-4">{children}</div>
      </main>

      {/* Mobile bottom nav */}
      {isMobile && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/50 bg-card/95 backdrop-blur-xl pb-safe px-1">
          <div className="flex h-16 items-center justify-around overflow-x-auto scrollbar-hide">
            {adminNavItems.slice(0, 5).map((item) => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  'flex flex-col items-center gap-0.5 px-2 py-2 rounded-2xl transition-all duration-200 min-w-0',
                  isActive(item.path)
                    ? 'bg-accent/10 text-accent'
                    : 'text-muted-foreground'
                )}
              >
                <item.icon className="h-[22px] w-[22px]" />
                <span
                  className={cn(
                    'text-[9px] font-tajawal truncate max-w-[48px]',
                    isActive(item.path) ? 'font-semibold' : 'font-medium'
                  )}
                >
                  {item.label}
                </span>
              </button>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
};
