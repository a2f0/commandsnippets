# Translations

The app's text is translated with react-i18next, in English (`en`, the
default and fallback) and Spanish (`es`).

## Files

- `i18n.ts` - the i18next instance and `supportedLanguages`. The language is
  the one chosen on this device (the language switcher saves it to
  `localStorage` as `i18nextLng`), else English; the browser's language is
  not consulted.
- `hooks.ts` - `useTypedTranslation(namespace)`, whose `t` takes only that
  namespace's keys, and the `MenuKeys` and `AdminKeys` types.
- `translations/en.ts` - English, by namespace (`common`, `menu`, `tags`,
  `entries`, `admin`, `analytics`). Its shape is the type of every language
  (`I18NextTranslations` in `translations/types.ts`), and its namespaces are
  the ones i18next loads.
- `translations/es.ts` - Spanish, typed `I18NextTranslations`.

## Usage

```tsx
const {t} = useTypedTranslation('menu');
return <span>{t('newTag')}</span>;
```

Interpolate with `{{name}}` in the text and `t('key', {name})`. A plural key
has one entry per plural form, with i18next's suffixes (`tagCount_one`,
`tagCount_other`; see
[Plurals](https://www.i18next.com/translation-function/plurals)); `t` takes
the key without its suffix, and a `count`: `t('tagCount', {count})`. A missing
plural form first uses that language's `_other` form: Spanish's `many`, for
counts such as 1000000, remains Spanish. Missing translations still fall back
to English.

## Adding text or a language

- A key: add it to `en.ts`, then to every other language (the compiler
  names the ones missing it).
- A language: add `translations/<code>.ts` typed `I18NextTranslations`,
  export it from `translations/index.ts`, and add it to `resources` and
  `supportedLanguages` in `i18n.ts`.

Specs render with `I18nextProvider` and the app's `i18n`
(`__tests__/src/i18n/i18n.spec.tsx`).
