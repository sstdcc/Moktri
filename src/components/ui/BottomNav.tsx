import { Home, Search, FileText, Heart, User } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
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

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card pb-safe">
      <div className="flex h-16 items-center justify-around">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                'flex flex-col items-center gap-1 px-3 py-1 transition-colors',
                isActive ? 'text-accent' : 'text-muted-foreground'
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-[10px] font-tajawal">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
