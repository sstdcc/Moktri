import { Home, Search, FileText, Heart, User, Plus, Bell } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useUnreadCount } from '@/hooks/useUnreadCount';
import { cn } from '@/lib/utils';

export const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const unreadCount = useUnreadCount();

  const showFab = profile?.role === 'owner' || profile?.role === 'broker';

  const isItemActive = (item: typeof navItems[0]) =>
    location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));

  const isNotifActive = location.pathname === '/notifications';

  const renderNavButton = (item: typeof navItems[0], isActive: boolean) => (
    <button
      key={item.path}
      onClick={() => navigate(item.path)}
      className={cn(
        'relative flex flex-col items-center justify-center gap-0.5 py-2 transition-all duration-300 min-w-[44px] flex-1',
        isActive
          ? 'text-primary'
          : 'text-muted-foreground/60 active:scale-95'
      )}
      aria-label={item.label}
    >
      <div className={cn(
        'flex items-center justify-center w-10 h-9 rounded-2xl transition-all duration-300',
        isActive
          ? 'bg-primary/12'
          : 'hover:bg-muted/40'
      )}>
        <item.icon className={cn(
          'h-[20px] w-[20px] transition-all duration-300',
          isActive ? 'stroke-[2.5px]' : 'stroke-[1.8px]'
        )} />
      </div>
      <span className={cn(
        'text-[10px] font-tajawal leading-tight transition-all duration-300',
        isActive ? 'font-bold text-primary' : 'font-medium'
      )}>
        {item.label}
      </span>
      {/* Active dot indicator */}
      {isActive && (
        <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
      )}
    </button>
  );

  return (
    <nav
      className="fixed bottom-3 left-3 right-3 z-50 pb-safe"
      aria-label="التنقل الرئيسي"
    >
      <div
        className="mx-auto max-w-lg rounded-2xl border border-border/30 bg-card/75 backdrop-blur-xl backdrop-saturate-150"
        style={{
          boxShadow: '0 8px 32px -8px rgba(0,0,0,0.12), 0 2px 8px -2px rgba(0,0,0,0.06)',
        }}
      >
        <div className="flex h-[64px] items-center justify-around px-1">
          {navItems.map((item, i) => {
            const isActive = isItemActive(item);

            // Insert FAB in the middle
            if (i === 2 && showFab) {
              return (
                <div key="fab-wrapper" className="flex items-center gap-0 flex-1">
                  <div className="flex-1">
                    {renderNavButton(item, isActive)}
                  </div>
                  <div className="flex flex-col items-center px-1">
                    <button
                      onClick={() => navigate('/listings/new')}
                      className="w-[48px] h-[48px] rounded-2xl bg-accent flex items-center justify-center -translate-y-4 transition-all duration-200 hover:brightness-105 active:scale-95"
                      aria-label="إضافة إعلان جديد"
                    >
                      <Plus className="h-5.5 w-5.5 text-accent-foreground stroke-[2.5px]" />
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
              'relative flex flex-col items-center justify-center gap-0.5 py-2 transition-all duration-300 min-w-[44px] flex-1',
              isNotifActive
                ? 'text-primary'
                : 'text-muted-foreground/60 active:scale-95'
            )}
            aria-label="الإشعارات"
          >
            <div className={cn(
              'relative flex items-center justify-center w-10 h-9 rounded-2xl transition-all duration-300',
              isNotifActive
                ? 'bg-primary/12'
                : 'hover:bg-muted/40'
            )}>
              <Bell className={cn(
                'h-[20px] w-[20px] transition-all duration-300',
                isNotifActive ? 'stroke-[2.5px]' : 'stroke-[1.8px]'
              )} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -left-1 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[8px] font-bold text-destructive-foreground ring-2 ring-card/80">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </div>
            <span className={cn(
              'text-[10px] font-tajawal leading-tight transition-all duration-300',
              isNotifActive ? 'font-bold text-primary' : 'font-medium'
            )}>
              إشعارات
            </span>
            {isNotifActive && (
              <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
            )}
          </button>
        </div>
      </div>
    </nav>
  );
};
