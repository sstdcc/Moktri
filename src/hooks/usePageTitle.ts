import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const pageTitles: Record<string, string> = {
  '/': 'مفتاح - سوق الإيجارات في تعز',
  '/listings': 'الإعلانات | مفتاح',
  '/requests': 'طلبات السكن | مفتاح',
  '/favorites': 'المفضلة | مفتاح',
  '/settings': 'الإعدادات | مفتاح',
  '/notifications': 'الإشعارات | مفتاح',
  '/auth': 'تسجيل الدخول | مفتاح',
  '/verify': 'التوثيق | مفتاح',
  '/dashboard': 'لوحة التحكم | مفتاح',
  '/dashboard/owner': 'لوحة المالك | مفتاح',
  '/dashboard/broker': 'لوحة الدلال | مفتاح',
  '/dashboard/renter': 'لوحة المستأجر | مفتاح',
  '/dashboard/admin': 'لوحة الإدارة | مفتاح',
  '/requests/new': 'طلب سكن جديد | مفتاح',
};

export const usePageTitle = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    const title = pageTitles[pathname];
    if (title) {
      document.title = title;
    } else if (pathname.startsWith('/listings/')) {
      document.title = 'تفاصيل الإعلان | مفتاح';
    } else if (pathname.startsWith('/requests/')) {
      document.title = 'تفاصيل الطلب | مفتاح';
    } else if (pathname.startsWith('/profile/')) {
      document.title = 'الملف الشخصي | مفتاح';
    } else if (pathname.startsWith('/dashboard/admin')) {
      document.title = 'لوحة الإدارة | مفتاح';
    } else {
      document.title = 'مفتاح - سوق الإيجارات في تعز';
    }
  }, [pathname]);
};
