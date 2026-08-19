import { useLocation } from 'react-router-dom';
import { useSeo } from '@/hooks/useSeo';

const PRIVATE_PREFIXES = [
  '/auth',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/complete-profile',
  '/onboarding',
  '/favorites',
  '/notifications',
  '/settings',
  '/change-password',
  '/verify',
  '/chat',
  '/request-chat',
  '/dashboard',
  '/listing-requests',
];

const PUBLIC_PATHS = [
  '/',
  '/listings',
  '/requests',
  '/terms',
  '/privacy',
];

const isPrivatePath = (pathname: string) =>
  PRIVATE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)) ||
  pathname === '/requests/new' ||
  /^\/listings\/[^/]+\/edit$/.test(pathname) ||
  pathname === '/listings/new';

const isPublicPath = (pathname: string) => {
  if (pathname === '/') return true;
  if (PUBLIC_PATHS.includes(pathname)) return true;
  if (pathname.startsWith('/listings/')) return true;
  if (pathname.startsWith('/requests/')) return true;
  if (pathname.startsWith('/profile/')) return true;
  return false;
};

export const IndexabilityTracker = () => {
  const { pathname, search } = useLocation();

  const privatePath = isPrivatePath(pathname);
  const filteredListings = pathname === '/listings' && search.length > 0;
  const unknownPath = !isPrivatePath(pathname) && !isPublicPath(pathname);

  const noindex = privatePath || filteredListings || unknownPath;
  const canonicalPath = !noindex ? pathname : undefined;

  useSeo({
    canonicalPath,
    noindex,
  });

  return null;
};