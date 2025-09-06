import '@testing-library/jest-dom';

import {ThemeProvider} from '@mui/material/styles';
import {act, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {I18nextProvider} from 'react-i18next';
import {vi} from 'vitest';

import {AppContextProvider} from '../src/AppContext';
import {i18n} from '../src/i18n/i18n';
import {BottomBar} from '../src/lib/bottom_bar/BottomBar';
import * as envModule from '../src/lib/environment';
import {darkTheme} from '../src/theme/themes';

const BottomBarWithProviders = () => (
  <I18nextProvider i18n={i18n}>
    <ThemeProvider theme={darkTheme}>
      <AppContextProvider>
        <BottomBar />
      </AppContextProvider>
    </ThemeProvider>
  </I18nextProvider>
);

describe('BottomBar Component', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(['development', 'test'])(
    'renders HUD button in %s environment',
    env => {
      vi.spyOn(envModule, 'environment', 'get').mockReturnValue(env);

      render(<BottomBarWithProviders />);

      expect(screen.getByText('[HUD]')).toBeInTheDocument();
    }
  );

  it('does not render HUD button in production environment', () => {
    vi.spyOn(envModule, 'environment', 'get').mockReturnValue('production');

    render(<BottomBarWithProviders />);

    expect(screen.queryByText('[HUD]')).not.toBeInTheDocument();
  });

  it('always renders version and mode components', () => {
    vi.spyOn(envModule, 'environment', 'get').mockReturnValue('production');

    render(<BottomBarWithProviders />);

    expect(screen.getByText(/\[version:/)).toBeInTheDocument();
    expect(screen.getByText(/\[mode:/)).toBeInTheDocument();
  });

  describe('Layout and alignment', () => {
    it('vertically centers search boxes on the left side', () => {
      const {container} = render(<BottomBarWithProviders />);

      // Get the search input fields by their IDs to verify they exist
      const tagSearch = container.querySelector('#tagSearch');
      const textSearch = container.querySelector('#textEntrySearch');

      expect(tagSearch).toBeInTheDocument();
      expect(textSearch).toBeInTheDocument();

      // Get the left container using data-testid
      const searchContainer = screen.getByTestId('bottom-bar-left-container');
      expect(searchContainer).toBeInTheDocument();

      // Check that the search container has center alignment
      const styles = window.getComputedStyle(searchContainer);
      expect(styles.alignItems).toBe('center');
      expect(styles.display).toBe('flex');
      expect(styles.gap).toBe('8px'); // MUI gap: 1 = 8px
    });

    it('aligns version and HUD options at the bottom on the right side', () => {
      vi.spyOn(envModule, 'environment', 'get').mockReturnValue('development');
      render(<BottomBarWithProviders />);

      // Get the version and HUD button elements to verify they exist
      const versionElement = screen.getByText(/\[version:/);
      const hudButton = screen.getByText('[HUD]');

      // Get the right container using data-testid
      const rightContainer = screen.getByTestId('bottom-bar-right-container');
      expect(rightContainer).toBeInTheDocument();
      expect(rightContainer).toContainElement(versionElement);
      expect(rightContainer).toContainElement(hudButton);

      // Check that the right container has bottom alignment
      const styles = window.getComputedStyle(rightContainer);
      expect(styles.alignItems).toBe('flex-end');
      expect(styles.display).toBe('flex');
      expect(styles.gap).toBe('8px'); // MUI gap: 1 = 8px
    });

    it('uses stretch alignment for the main container to allow different vertical alignments', () => {
      render(<BottomBarWithProviders />);

      // Get the main container using data-testid
      const mainContainer = screen.getByTestId('bottom-bar-main-container');
      expect(mainContainer).toBeInTheDocument();

      // Check that the main container uses stretch alignment
      const styles = window.getComputedStyle(mainContainer);
      expect(styles.alignItems).toBe('stretch');
      expect(styles.justifyContent).toBe('space-between');
      expect(styles.display).toBe('flex');
    });
  });

  describe('HUD Menu functionality', () => {
    beforeEach(() => {
      vi.spyOn(envModule, 'environment', 'get').mockReturnValue('development');
    });

    it('renders HUD button with correct accessibility attributes', () => {
      render(<BottomBarWithProviders />);

      const hudButton = screen.getByRole('button', {name: /Open HUD menu/i});
      expect(hudButton).toBeInTheDocument();
      expect(hudButton).toHaveAttribute('aria-haspopup', 'true');
      expect(hudButton).toHaveAttribute('aria-expanded', 'false');
    });

    it('opens HUD menu when button is clicked', async () => {
      const user = userEvent.setup();
      render(<BottomBarWithProviders />);

      const hudButton = screen.getByRole('button', {name: /Open HUD menu/i});
      await user.click(hudButton);

      await waitFor(() => {
        expect(
          screen.getByRole('tablist', {name: /HUD navigation tabs/i})
        ).toBeInTheDocument();
      });
      expect(hudButton).toHaveAttribute('aria-expanded', 'true');
    });

    it('renders all three tabs when menu is open', async () => {
      const user = userEvent.setup();
      render(<BottomBarWithProviders />);

      const hudButton = screen.getByRole('button', {name: /Open HUD menu/i});
      await user.click(hudButton);

      await waitFor(() => {
        expect(
          screen.getByRole('tab', {name: /Performance/i})
        ).toBeInTheDocument();
        expect(screen.getByRole('tab', {name: /Logs/i})).toBeInTheDocument();
        expect(
          screen.getByRole('tab', {name: /Analytics/i})
        ).toBeInTheDocument();
      });
    });

    it('displays Performance tab content by default', async () => {
      const user = userEvent.setup();
      render(<BottomBarWithProviders />);

      const hudButton = screen.getByRole('button', {name: /Open HUD menu/i});
      await user.click(hudButton);

      await waitFor(() => {
        expect(
          screen.getByText('Performance metrics will be displayed here')
        ).toBeInTheDocument();
      });
      expect(
        screen.queryByText('Application logs will be displayed here')
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText('Analytics data will be displayed here')
      ).not.toBeInTheDocument();
    });

    it('switches tab content when different tab is clicked', async () => {
      const user = userEvent.setup();
      render(<BottomBarWithProviders />);

      const hudButton = screen.getByRole('button', {name: /Open HUD menu/i});
      await user.click(hudButton);

      const logsTab = await screen.findByRole('tab', {name: /Logs/i});
      await user.click(logsTab);

      await waitFor(() => {
        expect(
          screen.getByText('Application logs will be displayed here')
        ).toBeInTheDocument();
      });
      expect(
        screen.queryByText('Performance metrics will be displayed here')
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText('Analytics data will be displayed here')
      ).not.toBeInTheDocument();
    });

    it('maintains proper ARIA relationships between tabs and panels', async () => {
      const user = userEvent.setup();
      render(<BottomBarWithProviders />);

      const hudButton = screen.getByRole('button', {name: /Open HUD menu/i});
      await user.click(hudButton);

      const performanceTab = await screen.findByRole('tab', {
        name: /Performance/i,
      });
      expect(performanceTab).toHaveAttribute('id', 'hud-tab-0');
      expect(performanceTab).toHaveAttribute('aria-controls', 'hud-tabpanel-0');

      const performancePanel = screen.getByRole('tabpanel');
      expect(performancePanel).toHaveAttribute('id', 'hud-tabpanel-0');
      expect(performancePanel).toHaveAttribute('aria-labelledby', 'hud-tab-0');
    });

    it('closes menu when clicking outside', async () => {
      const user = userEvent.setup();
      render(<BottomBarWithProviders />);

      const hudButton = screen.getByRole('button', {name: /Open HUD menu/i});
      await user.click(hudButton);

      await waitFor(() => {
        expect(
          screen.getByRole('tablist', {name: /HUD navigation tabs/i})
        ).toBeInTheDocument();
      });

      // Press Escape to close the menu (more reliable than clicking outside in tests)
      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(
          screen.queryByRole('tablist', {name: /HUD navigation tabs/i})
        ).not.toBeInTheDocument();
      });
      expect(hudButton).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('Language Switcher', () => {
    beforeEach(() => {
      // Reset language to English before each test
      act(() => {
        i18n.changeLanguage('en');
      });
    });

    it('renders language switcher with current language', () => {
      render(<BottomBarWithProviders />);

      const languageSelect = screen.getByRole('combobox');
      expect(languageSelect).toBeInTheDocument();
      expect(languageSelect.textContent).toBe('[English]');
    });

    it('changes language when selecting a different option', async () => {
      const user = userEvent.setup();
      render(<BottomBarWithProviders />);

      expect(i18n.language).toBe('en');

      const languageSelect = screen.getByRole('combobox');
      await user.click(languageSelect);

      const spanishOption = await screen.findByRole('menuitem', {
        name: 'Español',
      });
      await user.click(spanishOption);

      await waitFor(() => {
        expect(i18n.language).toBe('es');
        expect(languageSelect.textContent).toBe('[Español]');
      });
    });

    it('persists language selection across component re-renders', async () => {
      const user = userEvent.setup();
      const {rerender} = render(<BottomBarWithProviders />);

      // Change to Spanish
      const languageSelect = screen.getByRole('combobox');
      await user.click(languageSelect);
      const spanishOption = await screen.findByRole('menuitem', {
        name: 'Español',
      });
      await user.click(spanishOption);

      await waitFor(() => {
        expect(i18n.language).toBe('es');
      });

      // Re-render the component
      rerender(<BottomBarWithProviders />);

      // Check that Spanish is still selected
      await waitFor(() => {
        const updatedSelect = screen.getByRole('combobox');
        expect(updatedSelect.textContent).toBe('[Español]');
      });
    });

    it('is positioned in the bottom bar right container', () => {
      render(<BottomBarWithProviders />);

      const languageSelect = screen.getByRole('combobox');
      const rightContainer = screen.getByTestId('bottom-bar-right-container');

      expect(rightContainer).toContainElement(languageSelect);
    });
  });
});
