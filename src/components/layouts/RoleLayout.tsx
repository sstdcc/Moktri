import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { MainLayout } from '@/components/layouts/MainLayout';
import { AdminLayout } from '@/components/admin/AdminLayout';

/**
 * Picks the correct persistent layout based on role + route.
 * - admin/moderator on /dashboard/admin* → AdminLayout
 * - everyone else (including admins browsing consumer pages) → MainLayout
 *   so the standard bottom nav (Home/Search/Requests/Favorites/Profile) stays visible.
 */
export const RoleLayout = ({ children }: { children: ReactNode }) => {
  const { profile } = useAuth();
  const location = useLocation();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'moderator';
  const onAdminRoute = location.pathname.startsWith('/dashboard/admin');
  if (isAdmin && onAdminRoute) return <AdminLayout>{children}</AdminLayout>;
  return <MainLayout>{children}</MainLayout>;
};
