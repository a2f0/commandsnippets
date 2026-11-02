import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import {initReactI18next} from 'react-i18next';

import {en, es} from './translations';

export const supportedLanguages = ['en', 'es'] as const;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {en, es},
    fallbackLng: 'en',
    // React escapes what it renders.
    interpolation: {escapeValue: false},
    supportedLngs: supportedLanguages,
    ns: Object.keys(en),
    defaultNS: 'common',
    // The language chosen on this device (the language switcher saves it),
    // else English: the browser's language is not consulted.
    detection: {order: ['localStorage'], caches: ['localStorage']},
    react: {useSuspense: false},
  });

export {i18n};
