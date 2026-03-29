import { Home, Search, FileText, Heart, User, Plus } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
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

  const showFab = profile?.role === 'owner' || profile?.role === 'broker';

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/50 bg-card/95 backdrop-blur-xl pb-safe px-2">
      <div className="flex h-16 items-center justify-around">
        {navItems.map((item, i) => {
          const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));

          // Insert FAB in the middle
          if (i === 2 && showFab) {
            return (
              <div key="fab-wrapper" className="flex items-center gap-0">
                <button
                  onClick={() => navigate(item.path)}
                  className={cn(
                    'flex flex-col items-center gap-0.5 px-3 py-2 rounded-2xl transition-all duration-200',
                    isActive ? 'bg-accent/10 text-accent' : 'text-muted-foreground'
                  )}
                >
                  <item.icon className="h-[22px] w-[22px]" />
                  <span className={cn('text-[10px] font-tajawal', isActive ? 'font-semibold' : 'font-medium')}>{item.label}</span>
                </button>
                <button
                  onClick={() => navigate('/listings/new')}
                  className="w-14 h-14 rounded-full bg-accent shadow-lg shadow-accent/30 flex items-center justify-center -mt-6 border-4 border-background transition-all duration-200 hover:scale-105 active:scale-95 mx-1"
                >
                  <Plus className="h-6 w-6 text-white" />
                </button>
              </div>
            );
          }

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                'flex flex-col items-center gap-0.5 px-3 py-2 rounded-2xl transition-all duration-200',
                isActive ? 'bg-accent/10 text-accent' : 'text-muted-foreground'
              )}
            >
              <item.icon className="h-[22px] w-[22px]" />
              <span className={cn('text-[10px] font-tajawal', isActive ? 'font-semibold' : 'font-medium')}>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
