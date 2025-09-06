# Internationalization (i18n) Guide

This application supports multiple languages using react-i18next with **type-safe translations**.

## Current Languages
- English (en) - Default
- Spanish (es)

## Type Safety

This i18n implementation is **fully type-safe**. Translation keys are automatically generated from the JSON files, providing:
- Autocomplete for translation keys in your IDE
- Compile-time checking for invalid keys
- Type-safe parameters for interpolation

## Usage

### Basic Usage (Type-Safe)

Use the `useTypedTranslation` hook for type-safe translations:

```tsx
import { useTypedTranslation } from '@/i18n/hooks';

const MyComponent = () => {
  const { t } = useTypedTranslation('menu');

  // TypeScript will autocomplete and validate the key
  return <div>{t('newTag')}</div>;
};
```

### Using Multiple Namespaces

```tsx
import { useTypedTranslation } from '@/i18n/hooks';

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

// In translation file:
// "tagCount": "{{count}} tag",
// "tagCount_plural": "{{count}} tags"
return <div>{t('tagCount', { count: itemCount })}</div>;
```

### Language Switching

```tsx
import { useTypedTranslation } from '@/i18n/hooks';

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
├── types.ts          # Auto-generated types
├── locales/
│   ├── en/
│   │   ├── common.json    # Common UI elements
│   │   ├── menu.json      # Menu items
│   │   ├── tags.json      # Tag-related text
│   │   └── entries.json   # Entry-related text
│   └── es/
│       ├── common.json
│       ├── menu.json
│       ├── tags.json
│       └── entries.json
└── README.md         # This file

public/locales/       # Public translations (for runtime loading if needed)
└── [same structure as src/i18n/locales]
```

## Development Workflow

### 1. Adding New Translations

1. Add the new key-value pair to the appropriate JSON file in both language folders:
   ```json
   // src/i18n/locales/en/common.json
   {
     "newFeature": "New Feature"
   }

   // src/i18n/locales/es/common.json
   {
     "newFeature": "Nueva Característica"
   }
   ```

2. Copy to public folder if using runtime loading:
   ```bash
   cp src/i18n/locales/en/*.json public/locales/en/
   cp src/i18n/locales/es/*.json public/locales/es/
   ```

3. Regenerate types:
   ```bash
   pnpm generate:i18n-types
   ```

4. Use the new translation with full type safety:
   ```tsx
   const { t } = useTypedTranslation('common');
   return <div>{t('newFeature')}</div>; // TypeScript knows this key exists!
   ```

### 2. Adding a New Language

1. Create new folders:
   ```bash
   mkdir -p src/i18n/locales/fr public/locales/fr
   ```

2. Copy English files as templates:
   ```bash
   cp src/i18n/locales/en/*.json src/i18n/locales/fr/
   cp public/locales/en/*.json public/locales/fr/
   ```

3. Translate all values in the new language files

4. Update `src/i18n/i18n.ts`:
   ```ts
   import frCommon from './locales/fr/common.json';
   // ... import other fr files

   const resources = {
     en: { /* ... */ },
     es: { /* ... */ },
     fr: {
       common: frCommon,
       // ... other namespaces
     }
   };

   // Update supportedLngs
   supportedLngs: ['en', 'es', 'fr'],
   ```

5. Add to language switcher component

### 3. Type Generation

Types are automatically generated from the English locale files. Run this command after adding new translations:

```bash
pnpm generate:i18n-types
```

This creates/updates `src/i18n/types.ts` with:
- `I18nNamespaces` - Interface with all namespaces and their keys
- `TranslationKey` - Union type of all possible translation keys
- `CommonKeys`, `MenuKeys`, etc. - Namespace-specific key types

## Best Practices

1. **Always use typed hooks**: Prefer `useTypedTranslation` over `useTranslation` for type safety

2. **Organize by feature**: Group related translations in the same namespace

3. **Keep keys descriptive**: Use clear, hierarchical key names
   - Good: `confirmDeleteTag`, `tagCreated`
   - Bad: `confirm`, `success`

4. **Consistent naming**: Use camelCase for keys

5. **Regenerate types**: Run `pnpm generate:i18n-types` after any translation changes

6. **Test translations**: Verify all languages when adding new keys

## Testing

```tsx
import { render } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { i18n } from '@/i18n/i18n';

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
- Run `pnpm generate:i18n-types` to regenerate
- Restart TypeScript server in VS Code: `Cmd+Shift+P` → "TypeScript: Restart TS Server"

### Missing translations
- Check browser console for missing key warnings
- Ensure key exists in all language files
- Verify namespace is loaded in `i18n.ts`

### Language not persisting
- Check localStorage for `i18nextLng` key
- Verify LanguageDetector is configured in `i18n.ts`

## Resources

- [react-i18next documentation](https://react.i18next.com/)
- [i18next documentation](https://www.i18next.com/)
- [TypeScript with i18next](https://www.i18next.com/overview/typescript)
