import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useUnreadCount } from '@/hooks/useUnreadCount';
import { useUnreadChats } from '@/hooks/useUnreadChats';
import { usePendingListingRequests } from '@/hooks/usePendingListingRequests';
import { cn } from '@/lib/utils';
import {
  Home, Search, Heart, Bell, Settings, Plus, LayoutDashboard,
  FileText, Shield, LogOut, MessageSquare, Inbox,
} from 'lucide-react';
import { VerifiedBadge } from '@/components/ui/VerifiedBadge';
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
import { CountBadge } from '@/components/ui/CountBadge';
import { useDir } from '@/i18n/useDir';

const roleBadgeColors: Record<string, string> = {
  admin: 'bg-destructive/10 text-destructive border-destructive/20',
  moderator: 'bg-accent/10 text-accent border-accent/20',
  owner: 'bg-primary/10 text-primary border-primary/20',
  broker: 'bg-success/10 text-success border-success/20',
  renter: 'bg-muted text-muted-foreground border-border',
};

export function AppSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const unreadCount = useUnreadCount();
  const unreadChats = useUnreadChats();
  const pendingListingRequests = usePendingListingRequests();
  const { t } = useTranslation();
  const dir = useDir();
  const isProvider = profile?.role === 'owner' || profile?.role === 'broker' || profile?.role === 'admin';

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  const mainNav = [
    { title: t('nav.home'), url: '/', icon: Home },
    { title: t('nav.browse'), url: '/listings', icon: Search },
    { title: isProvider ? t('nav.marketRequests') : t('nav.requests'), url: '/requests', icon: FileText },
    { title: t('nav.chat'), url: '/chat', icon: MessageSquare },
    { title: t('nav.favorites'), url: '/favorites', icon: Heart },
    { title: t('nav.notifications'), url: '/notifications', icon: Bell },
  ];

  const getRoleDashboardItems = (role?: string) => {
    switch (role) {
      case 'admin':
      case 'moderator':
        return [{ title: t('nav.dashboard'), url: '/dashboard/admin', icon: LayoutDashboard }];
      case 'owner':
        return [
          { title: t('nav.dashboard'), url: '/dashboard/owner', icon: LayoutDashboard },
          { title: t('nav.incomingRequests'), url: '/listing-requests', icon: Inbox },
          { title: t('nav.addListing'), url: '/listings/new', icon: Plus },
        ];
      case 'broker':
        return [
          { title: t('nav.dashboard'), url: '/dashboard/broker', icon: LayoutDashboard },
          { title: t('nav.incomingRequests'), url: '/listing-requests', icon: Inbox },
          { title: t('nav.addListing'), url: '/listings/new', icon: Plus },
        ];
      case 'renter':
        return [
          { title: t('nav.dashboard'), url: '/dashboard/renter', icon: LayoutDashboard },
          { title: t('nav.newRequest'), url: '/requests/new', icon: Plus },
        ];
      default:
        return [];
    }
  };

  const roleLabels: Record<string, string> = {
    renter: t('roles.renter'),
    owner: t('roles.owner'),
    broker: t('roles.broker'),
    admin: t('roles.admin'),
    moderator: t('roles.moderator'),
  };

  const dashboardItems = getRoleDashboardItems(profile?.role);

  const go = (path: string) => {
    navigate(path);
    if (isMobile) setOpenMobile(false);
  };

  const handleSignOut = async () => {
    await signOut();
    if (isMobile) setOpenMobile(false);
    navigate('/auth');
  };

  return (
    <Sidebar collapsible="icon" side={dir === 'rtl' ? 'right' : 'left'}>
      {/* ── User Header ── */}
      {user && profile && (
        <SidebarHeader className={cn("border-b border-sidebar-border/50 overflow-hidden", collapsed ? "p-0" : "p-0")}>
          <button
            onClick={() => go('/settings')}
            className={cn(
              "flex items-center w-full hover:bg-sidebar-accent/40 transition-all duration-200 group overflow-hidden",
              collapsed ? "flex-col justify-center items-center px-0 py-3 mx-auto" : "gap-3 px-3 py-3"
            )}
          >
            <Avatar className={cn(
              "shrink-0 ring-2 ring-primary/10 ring-offset-1 ring-offset-sidebar shadow-sm",
              collapsed ? "h-8 w-8" : "h-10 w-10"
            )}>
              {profile.avatar_url && <AvatarImage src={profile.avatar_url} alt={profile.full_name} />}
              <AvatarFallback className="bg-gradient-to-br from-primary/15 to-primary/5 text-primary font-bold text-sm">
                {profile.full_name?.charAt(0) || '؟'}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="flex-1 min-w-0 text-right overflow-hidden">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-bold text-sidebar-foreground truncate leading-tight group-hover:text-primary transition-colors">
                    {profile.full_name}
                  </p>
                  {profile.is_verified && <VerifiedBadge />}
                </div>
                <p className="text-[11px] text-muted-foreground/70 truncate mt-0.5" dir="ltr">
                  {profile.phone}
                </p>
                <span className={cn(
                  'inline-block text-[10px] font-semibold mt-1.5 px-2.5 py-0.5 rounded-lg border',
                  roleBadgeColors[profile.role] || 'bg-muted text-muted-foreground border-border'
                )}>
                  {roleLabels[profile.role] || profile.role}
                </span>
              </div>
            )}
          </button>
        </SidebarHeader>
      )}

      <SidebarContent className={cn("py-3", collapsed ? "px-0" : "px-2")}>
        {/* ── Main Navigation ── */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/50 mb-2 px-3">
            التنقل
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {mainNav.map((item) => {
                const active = isActive(item.url);
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      isActive={active}
                      onClick={() => go(item.url)}
                      tooltip={item.title}
                      className={cn(
                        'relative rounded-xl h-10 transition-all duration-300 gap-3 overflow-hidden',
                        active
                          ? 'bg-primary/10 text-primary font-semibold'
                          : 'text-sidebar-foreground/65 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground hover:translate-x-[2px] rtl:hover:-translate-x-[2px]'
                      )}
                    >
                      {active && (
                        <span
                          aria-hidden
                          className={cn(
                            'absolute top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full bg-primary animate-nav-dot-in',
                            dir === 'rtl' ? 'right-0' : 'left-0'
                          )}
                        />
                      )}
                      <div className="relative flex items-center justify-center w-5 h-5 shrink-0">
                        <item.icon
                          key={active ? 'a' : 'i'}
                          className={cn(
                            'h-[18px] w-[18px] transition-transform',
                            active ? 'stroke-[2.5px] animate-nav-icon-pop' : 'stroke-[1.8px]'
                          )}
                        />
                        {item.url === '/notifications' && (
                          <CountBadge
                            count={unreadCount}
                            className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-0.5 text-[8px] font-bold text-destructive-foreground ring-2 ring-sidebar"
                          />
                        )}
                        {item.url === '/chat' && (
                          <CountBadge
                            count={unreadChats}
                            className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-0.5 text-[8px] font-bold text-destructive-foreground ring-2 ring-sidebar"
                          />
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
          <SidebarGroup className="mt-3">
            <SidebarGroupLabel className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/50 mb-2 px-3">
              لوحة التحكم
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1">
                {dashboardItems.map((item) => {
                  const active = isActive(item.url);
                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton
                        isActive={active}
                        onClick={() => go(item.url)}
                        tooltip={item.title}
                        className={cn(
                          'relative rounded-xl h-10 transition-all duration-300 gap-3 overflow-hidden',
                          active
                            ? 'bg-primary/10 text-primary font-semibold'
                            : 'text-sidebar-foreground/65 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground hover:translate-x-[2px] rtl:hover:-translate-x-[2px]'
                        )}
                      >
                        {active && (
                          <span
                            aria-hidden
                            className={cn(
                              'absolute top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full bg-primary animate-nav-dot-in',
                              dir === 'rtl' ? 'right-0' : 'left-0'
                            )}
                          />
                        )}
                        <div className="relative flex items-center justify-center w-5 h-5 shrink-0">
                          <item.icon
                            key={active ? 'a' : 'i'}
                            className={cn(
                              'h-[18px] w-[18px] transition-transform',
                              active ? 'stroke-[2.5px] animate-nav-icon-pop' : 'stroke-[1.8px]'
                            )}
                          />
                          {item.url === '/listing-requests' && (
                            <CountBadge
                              count={pendingListingRequests}
                              className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-0.5 text-[8px] font-bold text-destructive-foreground ring-2 ring-sidebar"
                            />
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
        )}

        {/* ── Settings & Verification ── */}
        <SidebarGroup className="mt-3">
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={isActive('/settings')}
                  onClick={() => go('/settings')}
                  tooltip="الإعدادات"
                  className={cn(
                    'rounded-xl h-10 transition-all duration-200 gap-3',
                    isActive('/settings')
                      ? 'bg-primary/10 text-primary font-semibold'
                      : 'text-sidebar-foreground/65 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'
                  )}
                >
                  <div className="flex items-center justify-center w-5 h-5 shrink-0">
                    <Settings className={cn(
                      'h-[18px] w-[18px]',
                      isActive('/settings') ? 'stroke-[2.5px]' : 'stroke-[1.8px]'
                    )} />
                  </div>
                  {!collapsed && <span>الإعدادات</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
              {!profile?.is_verified && user && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={isActive('/verify')}
                    onClick={() => go('/verify')}
                    tooltip="توثيق الحساب"
                    className={cn(
                      'rounded-xl h-10 transition-all duration-200 gap-3',
                      isActive('/verify')
                        ? 'bg-accent/10 text-accent font-semibold'
                        : 'text-accent/70 hover:bg-accent/5 hover:text-accent'
                    )}
                  >
                    <div className="flex items-center justify-center w-5 h-5 shrink-0">
                      <Shield className={cn(
                        'h-[18px] w-[18px]',
                        isActive('/verify') ? 'stroke-[2.5px]' : 'stroke-[1.8px]'
                      )} />
                    </div>
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
        <SidebarFooter className={cn("border-t border-sidebar-border/50", collapsed ? "p-1" : "p-3")}>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={handleSignOut}
                tooltip="تسجيل الخروج"
                className="rounded-xl h-10 text-destructive/70 hover:text-destructive hover:bg-destructive/5 transition-all duration-200 gap-3"
              >
                <div className="flex items-center justify-center w-5 h-5 shrink-0">
                  <LogOut className="h-[18px] w-[18px] stroke-[1.8px]" />
                </div>
                {!collapsed && <span>تسجيل الخروج</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      ) : (
        <SidebarFooter className={cn("border-t border-sidebar-border/50", collapsed ? "p-1" : "p-3")}>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => go('/auth')}
                tooltip="تسجيل الدخول"
                className="rounded-xl h-10 text-primary hover:bg-primary/5 transition-all duration-200 gap-3"
              >
                <div className="flex items-center justify-center w-5 h-5 shrink-0">
                  <LogOut className="h-[18px] w-[18px] stroke-[1.8px]" />
                </div>
                {!collapsed && <span>تسجيل الدخول</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
