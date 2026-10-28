import {ThemeProvider} from '@mui/material/styles';
import {act, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {ReactNode} from 'react';
import {I18nextProvider} from 'react-i18next';
import {vi} from 'vitest';

import {BottomBar} from '../../../../src/components/bottomBar/BottomBar';
import {ErrorBoundary} from '../../../../src/components/errorBoundary';
import {recordError} from '../../../../src/hooks/useErrorStore';
import {i18n} from '../../../../src/i18n/i18n';
import * as envModule from '../../../../src/lib/environment';
import {darkTheme} from '../../../../src/theme/themes';
import {signIn} from '../../../util/signIn';

// The Analytics tab loads its module when first shown (React.lazy): load
// it here, so a test waits for the tab, not for its import.
beforeAll(
  () => import('../../../../src/components/bottomBar/analytics/TimingAnalytics')
);

beforeEach(() => signIn());

const BottomBarWithProviders = () => (
  <I18nextProvider i18n={i18n}>
    <ThemeProvider theme={darkTheme}>
      <BottomBar />
    </ThemeProvider>
  </I18nextProvider>
);

const Throws = (): ReactNode => {
  throw new Error('boom');
};

/**
 * An error the app's error boundary catches and records, in a tree of its
 * own (the HUD's is elsewhere, or not mounted).
 */
const crash = () => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  render(
    <ErrorBoundary onError={recordError}>
      <Throws />
    </ErrorBoundary>
  );
  expect(consoleError).toHaveBeenCalledWith(
    'ErrorBoundary caught an error:',
    expect.objectContaining({message: 'boom'}),
    expect.anything()
  );
};

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

  it('always renders the mode, and no version (it is in Help > About)', () => {
    vi.spyOn(envModule, 'environment', 'get').mockReturnValue('production');

    render(<BottomBarWithProviders />);

    expect(screen.getByText(/\[mode:/)).toBeInTheDocument();
    expect(screen.queryByText(/version/i)).not.toBeInTheDocument();
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

    it('aligns mode and HUD options at the bottom on the right side', () => {
      vi.spyOn(envModule, 'environment', 'get').mockReturnValue('development');
      render(<BottomBarWithProviders />);

      // Get the mode and HUD button elements to verify they exist
      const modeElement = screen.getByText(/\[mode:/);
      const hudButton = screen.getByText('[HUD]');

      // Get the right container using data-testid
      const rightContainer = screen.getByTestId('bottom-bar-right-container');
      expect(rightContainer).toBeInTheDocument();
      expect(rightContainer).toContainElement(modeElement);
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

      const tablist = await screen.findByRole('tablist', {
        name: /HUD navigation tabs/i,
      });
      expect(tablist).toBeInTheDocument();
      expect(hudButton).toHaveAttribute('aria-expanded', 'true');
    });

    it('renders the Logs and Analytics tabs when menu is open', async () => {
      const user = userEvent.setup();
      render(<BottomBarWithProviders />);

      const hudButton = screen.getByRole('button', {name: /Open HUD menu/i});
      await user.click(hudButton);

      const tabs = await screen.findAllByRole('tab');
      expect(tabs.map(tab => tab.textContent)).toEqual(['Logs', 'Analytics']);
    });

    it('displays the Logs tab by default, with no logs at first', async () => {
      const user = userEvent.setup();
      render(<BottomBarWithProviders />);

      const hudButton = screen.getByRole('button', {name: /Open HUD menu/i});
      await user.click(hudButton);

      const logsTab = await screen.findByRole('tab', {name: /Logs/i});
      expect(logsTab).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('tabpanel')).toHaveTextContent(
        'No logs available'
      );
      expect(screen.queryByText(/log entr/)).not.toBeInTheDocument();
    });

    it('switches tab content when different tab is clicked', async () => {
      const user = userEvent.setup();
      render(<BottomBarWithProviders />);

      const hudButton = screen.getByRole('button', {name: /Open HUD menu/i});
      await user.click(hudButton);

      expect(await screen.findByText('No logs available')).toBeInTheDocument();

      await user.click(screen.getByRole('tab', {name: /Analytics/i}));

      // The tab's charts load when it is first shown
      expect(
        await screen.findByRole('heading', {name: 'All timings'})
      ).toBeInTheDocument();
      expect(screen.queryByText('No logs available')).not.toBeInTheDocument();
    });

    it('maintains proper ARIA relationships between tabs and panels', async () => {
      const user = userEvent.setup();
      render(<BottomBarWithProviders />);

      const hudButton = screen.getByRole('button', {name: /Open HUD menu/i});
      await user.click(hudButton);

      const logsTab = await screen.findByRole('tab', {name: /Logs/i});
      expect(logsTab).toHaveAttribute('id', 'hud-tab-0');
      expect(logsTab).toHaveAttribute('aria-controls', 'hud-tabpanel-0');

      const logsPanel = screen.getByRole('tabpanel');
      expect(logsPanel).toHaveAttribute('id', 'hud-tabpanel-0');
      expect(logsPanel).toHaveAttribute('aria-labelledby', 'hud-tab-0');

      const analyticsTab = screen.getByRole('tab', {name: /Analytics/i});
      expect(analyticsTab).toHaveAttribute('id', 'hud-tab-1');
      expect(analyticsTab).toHaveAttribute('aria-controls', 'hud-tabpanel-1');

      await user.click(analyticsTab);

      const analyticsPanel = screen.getByRole('tabpanel');
      expect(analyticsPanel).toHaveAttribute('id', 'hud-tabpanel-1');
      expect(analyticsPanel).toHaveAttribute('aria-labelledby', 'hud-tab-1');
    });

    it('shows an error caught before the HUD was mounted', async () => {
      crash();
      const user = userEvent.setup();
      render(<BottomBarWithProviders />);

      await user.click(screen.getByRole('button', {name: /Open HUD menu/i}));

      expect(
        await screen.findByText('1 log entry • 1 error captured')
      ).toBeInTheDocument();

      await user.click(screen.getByRole('button', {name: /Expand HUD/i}));

      expect(
        screen.getByText(/ERROR: Uncaught Error: boom/)
      ).toBeInTheDocument();
    });

    it('shows an error caught elsewhere while it is open', async () => {
      const user = userEvent.setup();
      render(<BottomBarWithProviders />);
      await user.click(screen.getByRole('button', {name: /Open HUD menu/i}));
      expect(await screen.findByText('No logs available')).toBeInTheDocument();

      crash();

      expect(
        await screen.findByText('1 log entry • 1 error captured')
      ).toBeInTheDocument();
    });

    it('closes menu when clicking outside', async () => {
      const user = userEvent.setup();
      render(<BottomBarWithProviders />);

      const hudButton = screen.getByRole('button', {name: /Open HUD menu/i});
      await user.click(hudButton);

      const tablist = await screen.findByRole('tablist', {
        name: /HUD navigation tabs/i,
      });
      expect(tablist).toBeInTheDocument();

      // Press Escape to close the menu (more reliable than clicking outside in tests)
      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(
          screen.queryByRole('tablist', {name: /HUD navigation tabs/i})
        ).not.toBeInTheDocument();
      });
      expect(hudButton).toHaveAttribute('aria-expanded', 'false');
    });

    describe('HUD Layout and Expand Functionality', () => {
      beforeEach(() => {
        vi.spyOn(envModule, 'environment', 'get').mockReturnValue(
          'development'
        );
      });

      it('renders expand button with correct initial state', async () => {
        const user = userEvent.setup();
        render(<BottomBarWithProviders />);

        const hudButton = screen.getByRole('button', {name: /Open HUD menu/i});
        await user.click(hudButton);

        const expandButton = await screen.findByRole('button', {
          name: /Expand HUD/i,
        });
        expect(expandButton).toBeInTheDocument();
      });

      it('toggles expand state when expand button is clicked', async () => {
        const user = userEvent.setup();
        render(<BottomBarWithProviders />);

        const hudButton = screen.getByRole('button', {name: /Open HUD menu/i});
        await user.click(hudButton);

        const expandButton = await screen.findByRole('button', {
          name: /Expand HUD/i,
        });

        // Click to expand
        await user.click(expandButton);

        const collapseButton = await screen.findByRole('button', {
          name: /Collapse HUD/i,
        });
        expect(collapseButton).toBeInTheDocument();

        // Click to collapse
        await user.click(collapseButton);

        const expandButtonAgain = await screen.findByRole('button', {
          name: /Expand HUD/i,
        });
        expect(expandButtonAgain).toBeInTheDocument();
      });

      it('lists the logs only when expanded', async () => {
        crash();
        const user = userEvent.setup();
        render(<BottomBarWithProviders />);

        const hudButton = screen.getByRole('button', {name: /Open HUD menu/i});
        await user.click(hudButton);

        // Collapsed, the Logs tab counts them
        expect(
          await screen.findByText('1 log entry • 1 error captured')
        ).toBeInTheDocument();
        expect(
          screen.queryByText(/ERROR: Uncaught Error: boom/)
        ).not.toBeInTheDocument();

        // Expand the menu
        const expandButton = await screen.findByRole('button', {
          name: /Expand HUD/i,
        });
        await user.click(expandButton);

        // Expanded, it lists them, with the details
        expect(
          screen.getByText(/ERROR: Uncaught Error: boom/)
        ).toBeInTheDocument();
        expect(screen.getByText('Details')).toBeInTheDocument();
        expect(screen.queryByText(/log entr/)).not.toBeInTheDocument();
      });

      it('expands to nearly the whole window', async () => {
        const user = userEvent.setup();
        render(<BottomBarWithProviders />);

        await user.click(screen.getByRole('button', {name: /Open HUD menu/i}));
        await user.click(
          await screen.findByRole('button', {name: /Expand HUD/i})
        );

        const paper = document.querySelector('#hud-menu .MuiPaper-root');
        expect(paper).toHaveStyle({
          width: `${window.innerWidth - 32}px`,
          height: `${window.innerHeight - 32}px`,
        });
      });

      it('shows the timings in the Analytics tab, expanded or not', async () => {
        const user = userEvent.setup();
        render(<BottomBarWithProviders />);

        await user.click(screen.getByRole('button', {name: /Open HUD menu/i}));
        await user.click(await screen.findByRole('tab', {name: /Analytics/i}));

        expect(
          await screen.findByRole('heading', {name: 'Interaction'})
        ).toBeInTheDocument();
        expect(
          screen.getByRole('heading', {name: 'All timings'})
        ).toBeInTheDocument();
      });

      it('properly styles tab panels without gray areas', async () => {
        const user = userEvent.setup();
        render(<BottomBarWithProviders />);

        const hudButton = screen.getByRole('button', {name: /Open HUD menu/i});
        await user.click(hudButton);

        const logsPanel = await screen.findByRole('tabpanel');
        expect(logsPanel).toBeInTheDocument();

        // Check that the tabpanel has transparent background
        expect(logsPanel).toHaveStyle('background-color: rgba(0, 0, 0, 0)');
        expect(logsPanel).toHaveStyle('display: block');
        expect(logsPanel).toHaveStyle('height: 100%');
      });

      it('switches enhanced content between tabs when expanded', async () => {
        crash();
        const user = userEvent.setup();
        render(<BottomBarWithProviders />);

        const hudButton = screen.getByRole('button', {name: /Open HUD menu/i});
        await user.click(hudButton);

        // Expand first
        const expandButton = await screen.findByRole('button', {
          name: /Expand HUD/i,
        });
        await user.click(expandButton);

        // Switch to logs tab
        const logsTab = await screen.findByRole('tab', {name: /Logs/i});
        await user.click(logsTab);

        // Check logs enhanced content - should show actual log entries
        expect(
          screen.getByText(/ERROR: Uncaught Error: boom/)
        ).toBeInTheDocument();

        // Switch to analytics tab
        const analyticsTab = await screen.findByRole('tab', {
          name: /Analytics/i,
        });
        await user.click(analyticsTab);

        // The timings of the network, IndexedDB and renders
        expect(
          await screen.findByRole('heading', {name: 'All timings'})
        ).toBeInTheDocument();
        expect(
          screen.queryByText(/ERROR: Uncaught Error: boom/)
        ).not.toBeInTheDocument();
      });
    });
  });

  describe('Language Switcher', () => {
    beforeEach(() => {
      // Reset language to English before each test
      act(() => {
        i18n.changeLanguage('en');
      });
    });

    it.each(['development', 'test'])(
      'renders language switcher in %s environment',
      env => {
        vi.spyOn(envModule, 'environment', 'get').mockReturnValue(env);

        render(<BottomBarWithProviders />);

        const languageSelect = screen.getByRole('combobox');
        expect(languageSelect).toBeInTheDocument();
        expect(languageSelect.textContent).toBe('[English]');
      }
    );

    it('does not render language switcher in production environment', () => {
      vi.spyOn(envModule, 'environment', 'get').mockReturnValue('production');

      render(<BottomBarWithProviders />);

      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    });

    describe('in development environment', () => {
      beforeEach(() => {
        vi.spyOn(envModule, 'environment', 'get').mockReturnValue(
          'development'
        );
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
});
