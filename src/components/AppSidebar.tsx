import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUnreadCount } from '@/hooks/useUnreadCount';
import { cn } from '@/lib/utils';
import {
  Home, Search, Heart, Bell, Settings, Plus, LayoutDashboard,
  Building2, FileText, Shield, LogOut, BadgeCheck, ChevronLeft,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from '@/components/ui/sidebar';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

const mainNav = [
  { title: 'الرئيسية', url: '/', icon: Home },
  { title: 'تصفح الإعلانات', url: '/listings', icon: Search },
  { title: 'طلبات السكن', url: '/requests', icon: FileText },
  { title: 'المفضلة', url: '/favorites', icon: Heart },
  { title: 'الإشعارات', url: '/notifications', icon: Bell },
];

const getRoleDashboardItems = (role?: string) => {
  switch (role) {
    case 'admin':
    case 'moderator':
      return [
        { title: 'لوحة التحكم', url: '/dashboard/admin', icon: LayoutDashboard },
      ];
    case 'owner':
      return [
        { title: 'لوحة التحكم', url: '/dashboard/owner', icon: LayoutDashboard },
        { title: 'إضافة إعلان', url: '/listings/new', icon: Plus },
      ];
    case 'broker':
      return [
        { title: 'لوحة التحكم', url: '/dashboard/broker', icon: LayoutDashboard },
        { title: 'إضافة إعلان', url: '/listings/new', icon: Plus },
      ];
    case 'renter':
      return [
        { title: 'لوحة التحكم', url: '/dashboard/renter', icon: LayoutDashboard },
        { title: 'طلب سكن جديد', url: '/requests/new', icon: Plus },
      ];
    default:
      return [];
  }
};

const roleLabels: Record<string, string> = {
  renter: 'مستأجر',
  owner: 'مالك',
  broker: 'وسيط',
  admin: 'مدير',
  moderator: 'مشرف',
};

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const unreadCount = useUnreadCount();

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  const dashboardItems = getRoleDashboardItems(profile?.role);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <Sidebar collapsible="icon" side="right">
      {/* User header */}
      {user && profile && (
        <SidebarHeader className="border-b border-sidebar-border p-3">
          <button
            onClick={() => navigate('/settings')}
            className="flex items-center gap-3 w-full rounded-xl p-2 hover:bg-sidebar-accent transition-colors"
          >
            <Avatar className="h-10 w-10 shrink-0">
              {profile.avatar_url && <AvatarImage src={profile.avatar_url} alt={profile.full_name} />}
              <AvatarFallback className="bg-primary/10 text-primary font-bold">
                {profile.full_name?.charAt(0) || '؟'}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="flex-1 min-w-0 text-right">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-bold text-sidebar-foreground truncate">{profile.full_name}</p>
                  {profile.is_verified && <BadgeCheck className="h-3.5 w-3.5 text-success shrink-0" />}
                </div>
                <p className="text-[11px] text-muted-foreground truncate" dir="ltr">{profile.phone}</p>
                <Badge variant="secondary" className="text-[10px] mt-0.5">
                  {roleLabels[profile.role] || profile.role}
                </Badge>
              </div>
            )}
          </button>
        </SidebarHeader>
      )}

      <SidebarContent>
        {/* Main navigation */}
        <SidebarGroup>
          <SidebarGroupLabel>التنقل</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    isActive={isActive(item.url)}
                    onClick={() => navigate(item.url)}
                    tooltip={item.title}
                  >
                    <div className="relative">
                      <item.icon className="h-4 w-4" />
                      {item.url === '/notifications' && unreadCount > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-destructive px-0.5 text-[8px] font-bold text-destructive-foreground">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                    </div>
                    {!collapsed && <span>{item.title}</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Role-based dashboard */}
        {user && dashboardItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>لوحة التحكم</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {dashboardItems.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      isActive={isActive(item.url)}
                      onClick={() => navigate(item.url)}
                      tooltip={item.title}
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Settings */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={isActive('/settings')}
                  onClick={() => navigate('/settings')}
                  tooltip="الإعدادات"
                >
                  <Settings className="h-4 w-4" />
                  {!collapsed && <span>الإعدادات</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
              {!profile?.is_verified && user && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={isActive('/verify')}
                    onClick={() => navigate('/verify')}
                    tooltip="توثيق الحساب"
                  >
                    <Shield className="h-4 w-4" />
                    {!collapsed && <span>توثيق الحساب</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer */}
      {user && (
        <SidebarFooter className="border-t border-sidebar-border p-2">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={handleSignOut}
                tooltip="تسجيل الخروج"
                className="text-destructive hover:text-destructive"
              >
                <LogOut className="h-4 w-4" />
                {!collapsed && <span>تسجيل الخروج</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      )}

      {!user && (
        <SidebarFooter className="border-t border-sidebar-border p-2">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => navigate('/auth')}
                tooltip="تسجيل الدخول"
              >
                <LogOut className="h-4 w-4" />
                {!collapsed && <span>تسجيل الدخول</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
