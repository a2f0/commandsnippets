import {ThemeProvider} from '@mui/material/styles';
import {act, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type React from 'react';
import {I18nextProvider, useTranslation} from 'react-i18next';
import {beforeEach, describe, expect, it, vi} from 'vitest';

import {LanguageSwitcher} from '../../../src/components/LanguageSwitcher';
import {useTypedTranslation} from '../../../src/i18n/hooks';
import {i18n} from '../../../src/i18n/i18n';
import {darkTheme} from '../../../src/theme/themes';

// Test component that uses translations
const TestComponent: React.FC = () => {
  const {t} = useTranslation('common');
  const {t: tMenu} = useTranslation('menu');

  return (
    <div>
      <p data-testid="welcome">{t('welcome')}</p>
      <p data-testid="logout">{t('logout')}</p>
      <p data-testid="new-tag">{tMenu('newTag')}</p>
    </div>
  );
};

describe('i18n', () => {
  beforeEach(() => {
    // Reset language to English before each test
    act(() => {
      i18n.changeLanguage('en');
    });
  });

  it('should initialize with English as default language', () => {
    expect(i18n.language).toBe('en');
  });

  it('should have English and Spanish as supported languages', () => {
    expect(i18n.options.supportedLngs).toContain('en');
    expect(i18n.options.supportedLngs).toContain('es');
  });

  it('should render English translations correctly', async () => {
    render(
      <I18nextProvider i18n={i18n}>
        <TestComponent />
      </I18nextProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('welcome').textContent).toBe('Welcome');
      expect(screen.getByTestId('logout').textContent).toBe('Logout');
      expect(screen.getByTestId('new-tag').textContent).toBe('New Tag');
    });
  });

  it('should render Spanish translations when language is changed', async () => {
    render(
      <I18nextProvider i18n={i18n}>
        <TestComponent />
      </I18nextProvider>
    );

    // Change to Spanish
    act(() => {
      i18n.changeLanguage('es');
    });

    await waitFor(() => {
      expect(screen.getByTestId('welcome').textContent).toBe('Bienvenido');
      expect(screen.getByTestId('logout').textContent).toBe('Cerrar sesión');
      expect(screen.getByTestId('new-tag').textContent).toBe('Nueva Etiqueta');
    });
  });

  it('should have all required namespaces loaded', () => {
    const expectedNamespaces = ['common', 'menu', 'tags', 'entries', 'admin'];
    const enData = i18n.store.data['en'];
    const loadedNamespaces = enData ? Object.keys(enData) : [];

    expectedNamespaces.forEach(ns => {
      expect(loadedNamespaces).toContain(ns);
    });
  });

  it('should have translations for both languages in all namespaces', () => {
    const languages = ['en', 'es'] as const;
    const namespaces = ['common', 'menu', 'tags', 'entries', 'admin'];

    languages.forEach(lang => {
      const langData = i18n.store.data[lang];
      expect(langData).toBeDefined();

      if (langData) {
        namespaces.forEach(ns => {
          expect(langData).toHaveProperty(ns);
          const nsData = langData[ns];
          if (nsData && typeof nsData === 'object') {
            expect(Object.keys(nsData).length).toBeGreaterThan(0);
          }
        });
      }
    });
  });

  it('should persist language selection in localStorage', async () => {
    const localStorageSpy = vi.spyOn(Storage.prototype, 'setItem');

    act(() => {
      i18n.changeLanguage('es');
    });

    await waitFor(() => {
      expect(localStorageSpy).toHaveBeenCalledWith('i18nextLng', 'es');
    });

    localStorageSpy.mockRestore();
  });

  it.each([
    ['en', 'menu', 'logEntry', '1 log entry', '2 log entries'],
    ['en', 'menu', 'errorCaptured', '1 error captured', '2 errors captured'],
    ['en', 'tags', 'tagCount', '1 tag', '2 tags'],
    ['en', 'entries', 'entryCount', '1 entry', '2 entries'],
    [
      'es',
      'menu',
      'logEntry',
      '1 entrada de registro',
      '2 entradas de registro',
    ],
    [
      'es',
      'menu',
      'errorCaptured',
      '1 error capturado',
      '2 errores capturados',
    ],
    ['es', 'tags', 'tagCount', '1 etiqueta', '2 etiquetas'],
    ['es', 'entries', 'entryCount', '1 entrada', '2 entradas'],
  ])('pluralizes %s %s:%s for 1 and 2', (lng, ns, key, one, two) => {
    const t = i18n.getFixedT(lng, ns);

    expect(t(key, {count: 1})).toBe(one);
    expect(t(key, {count: 2})).toBe(two);
  });

  it.each([
    ['en', '1 log entry', '2 log entries'],
    ['es', '1 entrada de registro', '2 entradas de registro'],
  ])('pluralizes through the typed t() in %s', async (lng, one, two) => {
    const LogCount = ({count}: {count: number}) => {
      const {t} = useTypedTranslation('menu');
      return <p>{t('logEntry', {count})}</p>;
    };
    await act(async () => {
      await i18n.changeLanguage(lng);
    });

    render(
      <I18nextProvider i18n={i18n}>
        <LogCount count={1} />
        <LogCount count={2} />
      </I18nextProvider>
    );

    expect(screen.getByText(one)).toBeInTheDocument();
    expect(screen.getByText(two)).toBeInTheDocument();
  });

  it('should handle interpolation correctly', () => {
    // Add a test translation with interpolation
    i18n.addResource('en', 'test', 'greeting', 'Hello {{name}}!');
    i18n.addResource('es', 'test', 'greeting', '¡Hola {{name}}!');

    const tTest = i18n.getFixedT('en', 'test');
    expect(tTest('greeting', {name: 'John'})).toBe('Hello John!');

    const tTestEs = i18n.getFixedT('es', 'test');
    expect(tTestEs('greeting', {name: 'Juan'})).toBe('¡Hola Juan!');
  });
});

describe('LanguageSwitcher', () => {
  beforeEach(() => {
    act(() => {
      i18n.changeLanguage('en');
    });
  });

  it('should render language switcher with current language', () => {
    render(
      <ThemeProvider theme={darkTheme}>
        <I18nextProvider i18n={i18n}>
          <LanguageSwitcher />
        </I18nextProvider>
      </ThemeProvider>
    );

    const select = screen.getByRole('combobox');
    expect(select).toBeDefined();
    // MUI Select doesn't expose value directly, check the displayed text
    expect(select.textContent).toBe('[English]');
  });

  it('should show English and Spanish options', async () => {
    render(
      <ThemeProvider theme={darkTheme}>
        <I18nextProvider i18n={i18n}>
          <LanguageSwitcher />
        </I18nextProvider>
      </ThemeProvider>
    );

    const select = screen.getByRole('combobox');
    await userEvent.click(select);

    await waitFor(() => {
      // Use getAllByText since there may be multiple elements
      expect(screen.getAllByText('English').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Español').length).toBeGreaterThan(0);
    });
  });

  it('should change language when selecting a different option', async () => {
    render(
      <ThemeProvider theme={darkTheme}>
        <I18nextProvider i18n={i18n}>
          <LanguageSwitcher />
          <TestComponent />
        </I18nextProvider>
      </ThemeProvider>
    );

    expect(screen.getByTestId('welcome').textContent).toBe('Welcome');

    const select = screen.getByRole('combobox');
    await userEvent.click(select);

    const spanishOptions = await screen.findAllByText('Español');
    const spanishOption = spanishOptions[spanishOptions.length - 1]; // Get the menu item, not the selected display
    if (spanishOption) {
      await userEvent.click(spanishOption);
    }

    await waitFor(() => {
      expect(i18n.language).toBe('es');
      expect(screen.getByTestId('welcome').textContent).toBe('Bienvenido');
    });
  });

  it('should reflect the current language in the select value', async () => {
    render(
      <ThemeProvider theme={darkTheme}>
        <I18nextProvider i18n={i18n}>
          <LanguageSwitcher />
        </I18nextProvider>
      </ThemeProvider>
    );

    const select = screen.getByRole('combobox');
    expect(select.textContent).toBe('[English]');

    act(() => {
      i18n.changeLanguage('es');
    });

    await waitFor(() => {
      expect(select.textContent).toBe('[Español]');
    });
  });
});

describe('i18n fallback behavior', () => {
  it('should fall back to English for missing translations', () => {
    // Add a key that only exists in English
    i18n.addResource('en', 'test', 'onlyInEnglish', 'English only text');

    const tTest = i18n.getFixedT('es', 'test');
    expect(tTest('onlyInEnglish')).toBe('English only text');
  });

  it('should return key if translation is missing in all languages', () => {
    const tTest = i18n.getFixedT('en', 'test');
    expect(tTest('nonExistentKey')).toBe('nonExistentKey');
  });
});
