import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ar from './locales/ar.json';
import en from './locales/en.json';

export const LANGUAGE_KEY = 'moktari_language';
export type AppLanguage = 'ar' | 'en';

export const supportedLanguages: AppLanguage[] = ['ar', 'en'];

i18n
  .use(initReactI18next)
  .init({
    lng: 'ar',
    resources: {
      ar: { translation: ar },
      en: { translation: en },
    },
    fallbackLng: 'ar',
    supportedLngs: supportedLanguages,
    interpolation: { escapeValue: false },
  });

export function applyLanguageDirection(lng: string) {
  const dir = lng === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.setAttribute('lang', lng);
  document.documentElement.setAttribute('dir', dir);
}

applyLanguageDirection(i18n.language || 'ar');
i18n.on('languageChanged', applyLanguageDirection);

export async function setAppLanguage(lng: AppLanguage) {
  await i18n.changeLanguage(lng);
  try {
    localStorage.setItem(LANGUAGE_KEY, lng);
  } catch { /* ignore */ }
  applyLanguageDirection(lng);
}

export default i18n;
