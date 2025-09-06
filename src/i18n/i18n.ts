import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import {initReactI18next} from 'react-i18next';

import enCommon from './locales/en/common.json';
import enEntries from './locales/en/entries.json';
import enMenu from './locales/en/menu.json';
import enTags from './locales/en/tags.json';
import esCommon from './locales/es/common.json';
import esEntries from './locales/es/entries.json';
import esMenu from './locales/es/menu.json';
import esTags from './locales/es/tags.json';

const resources = {
  en: {
    common: enCommon,
    menu: enMenu,
    tags: enTags,
    entries: enEntries,
  },
  es: {
    common: esCommon,
    menu: esMenu,
    tags: esTags,
    entries: esEntries,
  },
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

    supportedLngs: ['en', 'es'],

    ns: ['common', 'menu', 'tags', 'entries'],
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
