# Internationalization (i18n) Guide

This application supports multiple languages using react-i18next.

## Current Languages
- English (en) - Default
- Spanish (es)

## Usage

### Using translations in components:

```tsx
import { useTranslation } from 'react-i18next';

const MyComponent = () => {
  const { t } = useTranslation('common'); // namespace

  return <div>{t('welcome')}</div>;
};
```

### With multiple namespaces:

```tsx
const { t } = useTranslation(['common', 'menu']);
```

### With interpolation:

```tsx
// In translation file: "greeting": "Hello {{name}}!"
{t('greeting', { name: 'John' })}
```

### With pluralization:

```tsx
// In translation file:
// "tagCount": "{{count}} tag",
// "tagCount_plural": "{{count}} tags"
{t('tags:tagCount', { count: 5 })}
```

## File Structure

Translation files are located in `/public/locales/`:

```
public/locales/
├── en/
│   ├── common.json    # Common UI elements
│   ├── menu.json      # Menu items
│   ├── tags.json      # Tag-related text
│   └── entries.json   # Entry-related text
└── es/
    ├── common.json
    ├── menu.json
    ├── tags.json
    └── entries.json
```

## Adding New Translations

1. Add the text to the appropriate namespace JSON file for each language
2. Use the translation key in your component with `t('namespace:key')`

## Adding a New Language

1. Create a new folder in `/public/locales/` with the language code
2. Copy all JSON files from `/public/locales/en/` to the new folder
3. Translate all text values
4. Update `src/i18n/i18n.ts` to include the new language in `supportedLngs`
5. Add the language option to `src/components/LanguageSwitcher.tsx`

## Language Switching

The language switcher is available in the top menu bar. The selected language is persisted in localStorage.
