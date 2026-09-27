import {en} from './en';
import {es} from './es';

export const translations = {
  en,
  es,
} as const;

export type SupportedLanguage = keyof typeof translations;

export * from './types';
export {en, es};
