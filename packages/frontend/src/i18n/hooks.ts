import {useTranslation as useTranslationBase} from 'react-i18next';

import type {NamespaceKeys, TranslationKeys} from './translations';

// Type-safe translation function
type TypedTFunction<NS extends NamespaceKeys> = (
  key: Extract<TranslationKeys<NS>, string>,
  options?: Record<string, unknown>
) => string;

// Type-safe wrapper for useTranslation hook with full IntelliSense
export function useTypedTranslation<NS extends NamespaceKeys = 'common'>(
  namespace?: NS
) {
  const {t, i18n, ready} = useTranslationBase(namespace);

  // Create typed translation function with proper parameter handling
  const typedT: TypedTFunction<NS> = (key, options) => {
    if (options === undefined) {
      return t(key);
    }
    return t(key, options);
  };

  return {
    t: typedT,
    i18n,
    ready,
  };
}

// Re-export the original hook for backward compatibility
export {useTranslation} from 'react-i18next';

// Export types for use in components
export type {
  AdminKeys,
  CommonKeys,
  EntriesKeys,
  MenuKeys,
  NamespaceKeys,
  TagsKeys,
  TranslationKeys,
  Translations,
} from './translations';
