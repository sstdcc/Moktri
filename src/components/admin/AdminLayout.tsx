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
  Handshake,
  LogOut,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

const adminNavItems = [
  { label: 'نظرة عامة', icon: LayoutDashboard, path: '/dashboard/admin' },
  { label: 'الإعلانات', icon: ListChecks, path: '/dashboard/admin/listings' },
  { label: 'الطلبات', icon: FileSearch, path: '/dashboard/admin/requests' },
  { label: 'المستخدمون', icon: Users, path: '/dashboard/admin/users' },
  { label: 'البلاغات', icon: ShieldAlert, path: '/dashboard/admin/reports' },
  { label: 'الإيجارات', icon: Handshake, path: '/dashboard/admin/rentals' },
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
        <aside className="w-[260px] shrink-0 fixed top-0 right-0 h-screen bg-card/95 backdrop-blur-xl border-l border-border/40 flex flex-col z-40"
          style={{ boxShadow: '-4px 0 24px -8px rgba(0,0,0,0.06)' }}
        >
          {/* Header */}
          <div className="p-5 border-b border-border/40">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 shrink-0 ring-2 ring-primary/10 ring-offset-2 ring-offset-card shadow-sm">
                <AvatarFallback className="bg-gradient-to-br from-primary/15 to-primary/5 text-primary font-bold text-sm">
                  {profile?.full_name?.charAt(0) || '؟'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground truncate leading-tight">
                  {profile?.full_name}
                </p>
                <span className={cn(
                  'inline-block text-[10px] font-semibold mt-1.5 px-2.5 py-0.5 rounded-lg border',
                  profile?.role === 'admin'
                    ? 'bg-destructive/10 text-destructive border-destructive/20'
                    : 'bg-accent/10 text-accent border-accent/20'
                )}>
                  {profile?.role === 'admin' ? 'مدير' : 'مشرف'}
                </span>
              </div>
            </div>
            <p className="text-[11px] font-semibold text-primary/60 mt-3 tracking-wide">مفتاح — لوحة التحكم</p>
          </div>

          {/* Nav */}
          <nav className="flex-1 p-3 space-y-0.5 overflow-auto">
            {adminNavItems.map((item) => {
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200',
                    active
                      ? 'bg-primary/10 text-primary font-semibold shadow-[0_2px_8px_-2px_hsl(var(--primary)/0.2)]'
                      : 'text-muted-foreground/70 hover:bg-muted/50 hover:text-foreground'
                  )}
                >
                  <item.icon className={cn(
                    'h-[18px] w-[18px] transition-all',
                    active ? 'stroke-[2.5px]' : 'stroke-[1.8px]'
                  )} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="p-3 border-t border-border/40">
            <button
              onClick={handleSignOut}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-destructive/70 hover:text-destructive hover:bg-destructive/5 transition-all duration-200"
            >
              <LogOut className="h-[18px] w-[18px] stroke-[1.8px]" />
              تسجيل الخروج
            </button>
          </div>
        </aside>
      )}

      {/* Main content */}
      <main
        className={cn(
          'flex-1 overflow-auto',
          !isMobile ? 'mr-[260px]' : 'pb-24'
        )}
      >
        <div className="p-4">{children}</div>
      </main>

      {/* ── Mobile Bottom Nav ── */}
      {isMobile && (
        <nav
          className="fixed bottom-3 left-3 right-3 z-50 pb-safe"
        >
          <div
            className="mx-auto rounded-2xl border border-border/30 bg-card/75 backdrop-blur-xl backdrop-saturate-150"
            style={{
              boxShadow: '0 8px 32px -8px rgba(0,0,0,0.12), 0 2px 8px -2px rgba(0,0,0,0.06)',
            }}
          >
            <div className="flex h-[64px] items-center justify-around px-1">
              {adminNavItems.slice(0, 5).map((item) => {
                const active = isActive(item.path);
                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={cn(
                      'relative flex flex-col items-center justify-center gap-0.5 py-2 transition-all duration-300 min-w-[44px] flex-1',
                      active
                        ? 'text-primary'
                        : 'text-muted-foreground/60 active:scale-95'
                    )}
                  >
                    <div className={cn(
                      'flex items-center justify-center w-10 h-9 rounded-2xl transition-all duration-300',
                      active
                        ? 'bg-primary/12 shadow-[0_2px_8px_-2px_hsl(var(--primary)/0.25)]'
                        : 'hover:bg-muted/40'
                    )}>
                      <item.icon className={cn(
                        'h-[20px] w-[20px] transition-all duration-300',
                        active ? 'stroke-[2.5px]' : 'stroke-[1.8px]'
                      )} />
                    </div>
                    <span className={cn(
                      'text-[9px] font-tajawal leading-tight truncate max-w-[52px] transition-all duration-300',
                      active ? 'font-bold text-primary' : 'font-medium'
                    )}>
                      {item.label}
                    </span>
                    {active && (
                      <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </nav>
      )}
    </div>
  );
};
