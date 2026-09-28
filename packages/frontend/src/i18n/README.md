# Internationalization (i18n) Guide

This application supports multiple languages using react-i18next with **type-safe translations**.

## Current Languages
- English (en) - Default
- Spanish (es)

## Type Safety

This i18n implementation is **fully type-safe**. Translation keys and interfaces are defined in TypeScript objects, providing:
- Autocomplete for translation keys in your IDE
- Compile-time checking for invalid keys
- Type-safe parameters for interpolation
- No build-time generation step required

## Usage

### Basic Usage (Type-Safe)

Use the `useTypedTranslation` hook for type-safe translations:

```tsx
import { useTypedTranslation } from '../i18n/hooks';

const MyComponent = () => {
  const { t } = useTypedTranslation('menu');

  // TypeScript will autocomplete and validate the key
  return <div>{t('newTag')}</div>;
};
```

### Using Multiple Namespaces

```tsx
import { useTypedTranslation } from '../i18n/hooks';

const MyComponent = () => {
  const { t: tCommon } = useTypedTranslation('common');
  const { t: tMenu } = useTypedTranslation('menu');

  return (
    <div>
      <h1>{tCommon('welcome')}</h1>
      <button>{tMenu('newTag')}</button>
    </div>
  );
};
```

### With Interpolation

```tsx
const { t } = useTypedTranslation('common');

// In translation file: "greeting": "Hello {{name}}!"
return <div>{t('greeting', { name: 'John' })}</div>;
```

### With Pluralization

```tsx
const { t } = useTypedTranslation('tags');

// In the translation objects (and in types.ts), one key per plural form:
// tagCount_one: '{{count}} tag',
// tagCount_other: '{{count}} tags',
// t() takes the key without the suffix, and a count:
return <div>{t('tagCount', { count: itemCount })}</div>;
```

Plural keys use i18next's suffixes, `_one`, `_other` and so on, one for each
plural category of the language (see
[Plurals](https://www.i18next.com/translation-function/plurals)). i18next
ignores the old `_plural` suffix. The typed `t()` takes the key without its
suffix (`tagCount`), and i18next picks the form from `count`. A language whose
plural form has no key falls back to English: Spanish, for example, has a
`many` form for counts such as 1000000, which the Spanish translations do not
define.

### Language Switching

```tsx
import { useTypedTranslation } from '../i18n/hooks';

const LanguageSwitcher = () => {
  const { i18n } = useTypedTranslation();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  return (
    <select value={i18n.language} onChange={(e) => changeLanguage(e.target.value)}>
      <option value="en">English</option>
      <option value="es">Español</option>
    </select>
  );
};
```

## File Structure

```
src/i18n/
├── i18n.ts           # Main configuration
├── hooks.ts          # Type-safe hooks
├── translations/
│   ├── index.ts      # Translation exports
│   ├── types.ts      # TypeScript interfaces
│   ├── en.ts         # English translations (TypeScript objects)
│   └── es.ts         # Spanish translations (TypeScript objects)
└── README.md         # This file
```

## Development Workflow

### 1. Adding New Translations

1. Add the new key-value pair to both language TypeScript objects:
   ```typescript
   // src/i18n/translations/en.ts
   export const en: I18NextTranslations = {
     common: {
       welcome: 'Welcome',
       newFeature: 'New Feature', // Add here
       // ... other keys
     },
     // ... other namespaces
   } as const satisfies I18NextTranslations;

   // src/i18n/translations/es.ts
   export const es: I18NextTranslations = {
     common: {
       welcome: 'Bienvenido',
       newFeature: 'Nueva Característica', // Add here
       // ... other keys
     },
     // ... other namespaces
   } as const satisfies I18NextTranslations;
   ```

2. Update TypeScript interfaces if adding a new namespace:
   ```typescript
   // src/i18n/translations/types.ts
   export interface CommonTranslations {
     welcome: string;
     newFeature: string; // Add here
     // ... other keys
   }
   ```

3. Use the new translation with full type safety:
   ```tsx
   const { t } = useTypedTranslation('common');
   return <div>{t('newFeature')}</div>; // TypeScript knows this key exists!
   ```

### 2. Adding a New Language

1. Create a new language TypeScript object:
   ```typescript
   // src/i18n/translations/fr.ts
   import type {I18NextTranslations} from './types';

   export const fr: I18NextTranslations = {
     common: {
       welcome: 'Bienvenue',
       // ... translate all common keys
     },
     menu: {
       file: 'Fichier',
       // ... translate all menu keys
     },
     // ... other namespaces
   } as const satisfies I18NextTranslations;
   ```

2. Export the new language in index file:
   ```typescript
   // src/i18n/translations/index.ts
   import {en} from './en';
   import {es} from './es';
   import {fr} from './fr'; // Add this

   export const translations = {
     en,
     es,
     fr, // Add this
   } as const;
   ```

3. Update `src/i18n/i18n.ts`:
   ```ts
   // Resources are automatically included from translations object

   // Update supportedLngs
   supportedLngs: ['en', 'es', 'fr'] as const,
   ```

4. Add to language switcher component

### 3. TypeScript Integration

Types are automatically inferred from the TypeScript translation objects. No generation step is required:

- **Compile-time validation**: TypeScript checks all translation keys at build time
- **IntelliSense support**: Full autocomplete in VS Code and other IDEs
- **Interface constraints**: The `I18NextTranslations` type ensures consistency across languages
- **Type exports**: All translation types are available from `src/i18n/translations/types.ts`

## Best Practices

1. **Always use typed hooks**: Prefer `useTypedTranslation` over `useTranslation` for type safety

2. **Organize by feature**: Group related translations in the same namespace

3. **Keep keys descriptive**: Use clear, hierarchical key names
   - Good: `confirmDeleteTag`, `tagCreated`
   - Bad: `confirm`, `success`

4. **Consistent naming**: Use camelCase for keys

5. **Update interfaces**: Add new keys to TypeScript interfaces for proper typing

6. **Test translations**: Verify all languages when adding new keys

## Testing

```tsx
import { render } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { i18n } from '../i18n/i18n';

describe('MyComponent', () => {
  it('renders with translations', () => {
    const { getByText } = render(
      <I18nextProvider i18n={i18n}>
        <MyComponent />
      </I18nextProvider>
    );

    expect(getByText('Welcome')).toBeInTheDocument();
  });

  it('renders Spanish translations', () => {
    i18n.changeLanguage('es');

    const { getByText } = render(
      <I18nextProvider i18n={i18n}>
        <MyComponent />
      </I18nextProvider>
    );

    expect(getByText('Bienvenido')).toBeInTheDocument();
  });
});
```

## Troubleshooting

### Types not updating
- Check that interfaces in `types.ts` match the translation objects
- Restart TypeScript server in VS Code: `Cmd+Shift+P` → "TypeScript: Restart TS Server"
- Ensure `satisfies I18NextTranslations` is used in translation objects

### Missing translations
- Check browser console for missing key warnings
- Ensure key exists in all language files
- Verify namespace is defined in TypeScript interfaces and translation objects

### Language not persisting
- Check localStorage for `i18nextLng` key
- Verify LanguageDetector is configured in `i18n.ts`

## Resources

- [react-i18next documentation](https://react.i18next.com/)
- [i18next documentation](https://www.i18next.com/)
- [TypeScript with i18next](https://www.i18next.com/overview/typescript)
