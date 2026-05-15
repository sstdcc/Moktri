import { useTranslation } from 'react-i18next';

export type AppDir = 'rtl' | 'ltr';

export function useDir(): AppDir {
  const { i18n } = useTranslation();
  return i18n.language?.startsWith('en') ? 'ltr' : 'rtl';
}
