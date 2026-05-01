import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const pageTitles: Record<string, string> = {
  '/': 'Moktari (مُكتري) - سوق الإيجارات في تعز',
  '/listings': 'الإعلانات | مُكتري',
  '/requests': 'طلبات السكن | مُكتري',
  '/favorites': 'المفضلة | مُكتري',
  '/settings': 'الإعدادات | مُكتري',
  '/notifications': 'الإشعارات | مُكتري',
  '/auth': 'تسجيل الدخول | مُكتري',
  '/verify': 'التوثيق | مُكتري',
  '/dashboard': 'لوحة التحكم | مُكتري',
  '/dashboard/owner': 'لوحة المالك | مُكتري',
  '/dashboard/broker': 'لوحة الدلال | مُكتري',
  '/dashboard/renter': 'لوحة المستأجر | مُكتري',
  '/dashboard/admin': 'لوحة الإدارة | مُكتري',
  '/requests/new': 'طلب سكن جديد | مُكتري',
};

export const usePageTitle = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    const title = pageTitles[pathname];
    if (title) {
      document.title = title;
    } else if (pathname.startsWith('/listings/')) {
      document.title = 'تفاصيل الإعلان | مُكتري';
    } else if (pathname.startsWith('/requests/')) {
      document.title = 'تفاصيل الطلب | مُكتري';
    } else if (pathname.startsWith('/profile/')) {
      document.title = 'الملف الشخصي | مُكتري';
    } else if (pathname.startsWith('/dashboard/admin')) {
      document.title = 'لوحة الإدارة | مُكتري';
    } else {
      document.title = 'Moktari (مُكتري) - سوق الإيجارات في تعز';
    }
  }, [pathname]);
};
