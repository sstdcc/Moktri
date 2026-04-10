import { Home, Search, FileText, Heart, User, Plus, Bell } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUnreadCount } from '@/hooks/useUnreadCount';
import { cn } from '@/lib/utils';

const navItems = [
  { label: 'الرئيسية', icon: Home, path: '/' },
  { label: 'البحث', icon: Search, path: '/listings' },
  { label: 'طلباتي', icon: FileText, path: '/requests' },
  { label: 'المفضلة', icon: Heart, path: '/favorites' },
  { label: 'حسابي', icon: User, path: '/settings' },
];

export const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const unreadCount = useUnreadCount();

  const showFab = profile?.role === 'owner' || profile?.role === 'broker';

  const isItemActive = (item: typeof navItems[0]) =>
    location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));

  const renderNavButton = (item: typeof navItems[0], isActive: boolean) => (
    <button
      key={item.path}
      onClick={() => navigate(item.path)}
      className={cn(
        'relative flex flex-col items-center justify-center gap-0.5 py-1.5 transition-all duration-300 min-w-[48px]',
        isActive
          ? 'text-primary'
          : 'text-muted-foreground/70 active:scale-95'
      )}
      aria-label={item.label}
    >
      {/* Active indicator pill */}
      {isActive && (
        <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-5 h-[3px] rounded-full bg-primary" />
      )}
      <div className={cn(
        'flex items-center justify-center w-10 h-8 rounded-xl transition-all duration-300',
        isActive ? 'bg-primary/10' : ''
      )}>
        <item.icon className={cn('h-[21px] w-[21px] transition-all', isActive && 'stroke-[2.5px]')} />
      </div>
      <span className={cn(
        'text-[10px] font-tajawal leading-tight transition-all',
        isActive ? 'font-bold text-primary' : 'font-medium'
      )}>
        {item.label}
      </span>
    </button>
  );

  const isNotifActive = location.pathname === '/notifications';

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-2xl border-t border-border/40 pb-safe"
      style={{ boxShadow: '0 -4px 24px -4px rgba(0,0,0,0.08)' }}
      aria-label="التنقل الرئيسي"
    >
      <div className="flex h-[62px] items-end justify-around px-1 max-w-lg mx-auto">
        {navItems.map((item, i) => {
          const isActive = isItemActive(item);

          // Insert FAB in the middle
          if (i === 2 && showFab) {
            return (
              <div key="fab-wrapper" className="flex items-end gap-0">
                {renderNavButton(item, isActive)}
                <div className="flex flex-col items-center -mt-3 mx-0.5">
                  <button
                    onClick={() => navigate('/listings/new')}
                    className="w-[52px] h-[52px] rounded-2xl bg-gradient-to-br from-accent to-accent/85 flex items-center justify-center -translate-y-2 transition-all duration-200 hover:scale-105 active:scale-95"
                    style={{
                      boxShadow: '0 6px 20px -2px hsl(var(--accent) / 0.45), 0 2px 8px -2px hsl(var(--accent) / 0.3)',
                    }}
                    aria-label="إضافة إعلان جديد"
                  >
                    <Plus className="h-6 w-6 text-accent-foreground stroke-[2.5px]" />
                  </button>
                </div>
              </div>
            );
          }

          return renderNavButton(item, isActive);
        })}

        {/* Notifications */}
        <button
          onClick={() => navigate('/notifications')}
          className={cn(
            'relative flex flex-col items-center justify-center gap-0.5 py-1.5 transition-all duration-300 min-w-[48px]',
            isNotifActive
              ? 'text-primary'
              : 'text-muted-foreground/70 active:scale-95'
          )}
          aria-label="الإشعارات"
        >
          {isNotifActive && (
            <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-5 h-[3px] rounded-full bg-primary" />
          )}
          <div className={cn(
            'relative flex items-center justify-center w-10 h-8 rounded-xl transition-all duration-300',
            isNotifActive ? 'bg-primary/10' : ''
          )}>
            <Bell className={cn('h-[21px] w-[21px] transition-all', isNotifActive && 'stroke-[2.5px]')} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -left-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground ring-2 ring-card">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
          <span className={cn(
            'text-[10px] font-tajawal leading-tight transition-all',
            isNotifActive ? 'font-bold text-primary' : 'font-medium'
          )}>
            إشعارات
          </span>
        </button>
      </div>
    </nav>
  );
};
