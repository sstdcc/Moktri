import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUnreadCount } from '@/hooks/useUnreadCount';
import { cn } from '@/lib/utils';
import {
  Home, Search, Heart, Bell, Settings, Plus, LayoutDashboard,
  FileText, Shield, LogOut, BadgeCheck, MessageSquare,
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

const mainNav = [
  { title: 'الرئيسية', url: '/', icon: Home },
  { title: 'تصفح الإعلانات', url: '/listings', icon: Search },
  { title: 'طلبات السكن', url: '/requests', icon: FileText },
  { title: 'المحادثات', url: '/chat', icon: MessageSquare },
  { title: 'المفضلة', url: '/favorites', icon: Heart },
  { title: 'الإشعارات', url: '/notifications', icon: Bell },
];

const getRoleDashboardItems = (role?: string) => {
  switch (role) {
    case 'admin':
    case 'moderator':
      return [{ title: 'لوحة التحكم', url: '/dashboard/admin', icon: LayoutDashboard }];
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

const roleBadgeColors: Record<string, string> = {
  admin: 'bg-destructive/10 text-destructive',
  moderator: 'bg-accent/10 text-accent',
  owner: 'bg-primary/10 text-primary',
  broker: 'bg-success/10 text-success',
  renter: 'bg-muted text-muted-foreground',
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
      {/* ── User Header ── */}
      {user && profile && (
        <SidebarHeader className="border-b border-sidebar-border p-0">
          <button
            onClick={() => navigate('/settings')}
            className="flex items-center gap-3 w-full p-4 hover:bg-sidebar-accent/50 transition-colors"
          >
            <Avatar className="h-11 w-11 shrink-0 ring-2 ring-primary/15 ring-offset-2 ring-offset-sidebar">
              {profile.avatar_url && <AvatarImage src={profile.avatar_url} alt={profile.full_name} />}
              <AvatarFallback className="bg-primary/10 text-primary font-bold text-base">
                {profile.full_name?.charAt(0) || '؟'}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="flex-1 min-w-0 text-right">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-bold text-sidebar-foreground truncate leading-tight">
                    {profile.full_name}
                  </p>
                  {profile.is_verified && (
                    <BadgeCheck className="h-4 w-4 text-success shrink-0" />
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground/80 truncate mt-0.5" dir="ltr">
                  {profile.phone}
                </p>
                <span className={cn(
                  'inline-block text-[10px] font-semibold mt-1 px-2 py-0.5 rounded-md',
                  roleBadgeColors[profile.role] || 'bg-muted text-muted-foreground'
                )}>
                  {roleLabels[profile.role] || profile.role}
                </span>
              </div>
            )}
          </button>
        </SidebarHeader>
      )}

      <SidebarContent className="px-2 py-3">
        {/* ── Main Navigation ── */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-1 px-3">
            التنقل
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5">
              {mainNav.map((item) => {
                const active = isActive(item.url);
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      isActive={active}
                      onClick={() => navigate(item.url)}
                      tooltip={item.title}
                      className={cn(
                        'rounded-xl h-10 transition-all duration-200',
                        active
                          ? 'bg-primary/10 text-primary font-semibold shadow-sm'
                          : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                      )}
                    >
                      <div className="relative">
                        <item.icon className={cn('h-[18px] w-[18px]', active && 'stroke-[2.5px]')} />
                        {item.url === '/notifications' && unreadCount > 0 && (
                          <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-0.5 text-[8px] font-bold text-destructive-foreground ring-2 ring-sidebar">
                            {unreadCount > 99 ? '99+' : unreadCount}
                          </span>
                        )}
                      </div>
                      {!collapsed && <span>{item.title}</span>}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ── Dashboard ── */}
        {user && dashboardItems.length > 0 && (
          <SidebarGroup className="mt-2">
            <SidebarGroupLabel className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-1 px-3">
              لوحة التحكم
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-0.5">
                {dashboardItems.map((item) => {
                  const active = isActive(item.url);
                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton
                        isActive={active}
                        onClick={() => navigate(item.url)}
                        tooltip={item.title}
                        className={cn(
                          'rounded-xl h-10 transition-all duration-200',
                          active
                            ? 'bg-primary/10 text-primary font-semibold shadow-sm'
                            : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                        )}
                      >
                        <item.icon className={cn('h-[18px] w-[18px]', active && 'stroke-[2.5px]')} />
                        {!collapsed && <span>{item.title}</span>}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* ── Settings & Verification ── */}
        <SidebarGroup className="mt-2">
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5">
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={isActive('/settings')}
                  onClick={() => navigate('/settings')}
                  tooltip="الإعدادات"
                  className={cn(
                    'rounded-xl h-10 transition-all duration-200',
                    isActive('/settings')
                      ? 'bg-primary/10 text-primary font-semibold shadow-sm'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                  )}
                >
                  <Settings className={cn('h-[18px] w-[18px]', isActive('/settings') && 'stroke-[2.5px]')} />
                  {!collapsed && <span>الإعدادات</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
              {!profile?.is_verified && user && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={isActive('/verify')}
                    onClick={() => navigate('/verify')}
                    tooltip="توثيق الحساب"
                    className={cn(
                      'rounded-xl h-10 transition-all duration-200',
                      isActive('/verify')
                        ? 'bg-accent/10 text-accent font-semibold'
                        : 'text-accent/80 hover:bg-accent/5 hover:text-accent'
                    )}
                  >
                    <Shield className={cn('h-[18px] w-[18px]', isActive('/verify') && 'stroke-[2.5px]')} />
                    {!collapsed && <span>توثيق الحساب</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* ── Footer ── */}
      {user ? (
        <SidebarFooter className="border-t border-sidebar-border p-2">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={handleSignOut}
                tooltip="تسجيل الخروج"
                className="rounded-xl h-10 text-destructive/80 hover:text-destructive hover:bg-destructive/5 transition-all duration-200"
              >
                <LogOut className="h-[18px] w-[18px]" />
                {!collapsed && <span>تسجيل الخروج</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      ) : (
        <SidebarFooter className="border-t border-sidebar-border p-2">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => navigate('/auth')}
                tooltip="تسجيل الدخول"
                className="rounded-xl h-10 text-primary hover:bg-primary/5 transition-all duration-200"
              >
                <LogOut className="h-[18px] w-[18px]" />
                {!collapsed && <span>تسجيل الدخول</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
