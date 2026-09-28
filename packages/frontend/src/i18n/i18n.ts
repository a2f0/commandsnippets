import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import {initReactI18next} from 'react-i18next';

import {translations} from './translations';

// Supported languages
export const supportedLanguages = ['en', 'es'] as const;

// Convert our typed translations to i18next resources format
const resources = {
  en: translations.en,
  es: translations.es,
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    debug: false,

    interpolation: {
      escapeValue: false,
    },

    lng: 'en',

    supportedLngs: supportedLanguages,

    ns: ['common', 'menu', 'tags', 'entries', 'admin'],
    defaultNS: 'common',

    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
    },

    react: {
      useSuspense: false,
    },
  });

export {i18n};
