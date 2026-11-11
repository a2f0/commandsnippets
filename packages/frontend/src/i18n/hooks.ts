import {useTranslation as useTranslationBase} from 'react-i18next';

import type {NamespaceKeys, TranslationKeys} from './translations';

type TypedTFunction<NS extends NamespaceKeys> = (
  key: Extract<TranslationKeys<NS>, string>,
  options?: Record<string, unknown>
) => string;

/** `useTranslation` whose `t` takes only the namespace's keys. */
export function useTypedTranslation<NS extends NamespaceKeys = 'common'>(
  namespace?: NS
) {
  const {t, i18n, ready} = useTranslationBase(namespace);
  // Our key map supplies namespace checking; i18next has no resource augmentation.
  const typedT: TypedTFunction<NS> = (key, options) =>
    t<string, Record<string, unknown>, string>(key, options ?? {});
  return {t: typedT, i18n, ready};
}

export type {AdminKeys, MenuKeys} from './translations';
