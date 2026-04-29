import { ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { MainLayout } from '@/components/layouts/MainLayout';
import { AdminLayout } from '@/components/admin/AdminLayout';

/**
 * Picks the correct persistent layout (and therefore the correct navigation)
 * based on the current user's role.
 *
 * - admin / moderator → AdminLayout (its own desktop sidebar + mobile bottom nav)
 * - everyone else (renter / owner / broker / guests) → MainLayout (sidebar + BottomNav)
 *
 * Navigation is rendered from the layout, so it persists across every page
 * that uses this wrapper.
 */
export const RoleLayout = ({ children }: { children: ReactNode }) => {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'moderator';
  if (isAdmin) return <AdminLayout>{children}</AdminLayout>;
  return <MainLayout>{children}</MainLayout>;
};
