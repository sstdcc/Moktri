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
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

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
      {/* ── Desktop Sidebar ── */}
      {!isMobile && (
        <aside className="w-[260px] shrink-0 fixed top-0 right-0 h-screen bg-card border-l border-border/60 flex flex-col z-40">
          {/* Header */}
          <div className="p-5 border-b border-border/60">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 shrink-0 ring-2 ring-primary/15 ring-offset-2 ring-offset-card">
                <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
                  {profile?.full_name?.charAt(0) || '؟'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground truncate leading-tight">
                  {profile?.full_name}
                </p>
                <span className={cn(
                  'inline-block text-[10px] font-semibold mt-1 px-2 py-0.5 rounded-md',
                  profile?.role === 'admin' ? 'bg-destructive/10 text-destructive' : 'bg-accent/10 text-accent'
                )}>
                  {profile?.role === 'admin' ? 'مدير' : 'مشرف'}
                </span>
              </div>
            </div>
            <p className="text-xs font-semibold text-primary/70 mt-3">مفتاح — لوحة التحكم</p>
          </div>

          {/* Nav */}
          <nav className="flex-1 p-3 space-y-1 overflow-auto">
            {adminNavItems.map((item) => {
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200',
                    active
                      ? 'bg-primary/10 text-primary font-semibold shadow-sm'
                      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                  )}
                >
                  <item.icon className={cn('h-[18px] w-[18px]', active && 'stroke-[2.5px]')} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="p-3 border-t border-border/60">
            <button
              onClick={handleSignOut}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-destructive/80 hover:text-destructive hover:bg-destructive/5 transition-all duration-200"
            >
              <LogOut className="h-[18px] w-[18px]" />
              تسجيل الخروج
            </button>
          </div>
        </aside>
      )}

      {/* Main content */}
      <main
        className={cn(
          'flex-1 overflow-auto',
          !isMobile ? 'mr-[260px]' : 'pb-20'
        )}
      >
        <div className="p-4">{children}</div>
      </main>

      {/* ── Mobile Bottom Nav ── */}
      {isMobile && (
        <nav
          className="fixed bottom-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-2xl border-t border-border/40 pb-safe"
          style={{ boxShadow: '0 -4px 24px -4px rgba(0,0,0,0.08)' }}
        >
          <div className="flex h-[62px] items-end justify-around px-1">
            {adminNavItems.slice(0, 5).map((item) => {
              const active = isActive(item.path);
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={cn(
                    'relative flex flex-col items-center justify-center gap-0.5 py-1.5 transition-all duration-300 min-w-[48px]',
                    active
                      ? 'text-primary'
                      : 'text-muted-foreground/70 active:scale-95'
                  )}
                >
                  {active && (
                    <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-5 h-[3px] rounded-full bg-primary" />
                  )}
                  <div className={cn(
                    'flex items-center justify-center w-10 h-8 rounded-xl transition-all duration-300',
                    active ? 'bg-primary/10' : ''
                  )}>
                    <item.icon className={cn('h-[21px] w-[21px] transition-all', active && 'stroke-[2.5px]')} />
                  </div>
                  <span className={cn(
                    'text-[9px] font-tajawal leading-tight truncate max-w-[52px] transition-all',
                    active ? 'font-bold text-primary' : 'font-medium'
                  )}>
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
};
