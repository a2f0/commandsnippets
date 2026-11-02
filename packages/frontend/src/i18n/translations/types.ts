import type {en} from './en';

/** A language's translations: the namespaces and keys English has. */
export type I18NextTranslations = typeof en;

export type NamespaceKeys = keyof I18NextTranslations;

/**
 * i18next's plural suffixes, one key per plural form of the language
 * (https://www.i18next.com/translation-function/plurals): `tagCount_one` and
 * `tagCount_other` in English. i18next no longer reads the old `_plural`
 * suffix (its v3 JSON format).
 */
type PluralSuffix = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';

/** The key `t()` takes for a translation key: a plural key without its suffix. */
type TranslationKey<Key> = Key extends `${infer Base}_${PluralSuffix}`
  ? Base
  : Key;

/**
 * The keys `t()` takes in a namespace. Pass a plural key (`tagCount`) with a
 * `count`, and i18next picks the form: `t('tagCount', {count: 2})`.
 */
export type TranslationKeys<NS extends NamespaceKeys> = TranslationKey<
  keyof I18NextTranslations[NS]
>;

export type MenuKeys = TranslationKeys<'menu'>;
export type AdminKeys = TranslationKeys<'admin'>;
