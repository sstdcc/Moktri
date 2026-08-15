import { useAppDeepLink } from '@/hooks/useAppDeepLink';

// Mounted once inside BrowserRouter. Captures Android App Links (deep links)
// for incoming recovery URLs and hands them to supabase via useAppDeepLink.
// No-op on the web.
const DeepLinkHandler = () => {
  useAppDeepLink();
  return null;
};

export default DeepLinkHandler;