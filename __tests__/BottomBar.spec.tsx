import '@testing-library/jest-dom';

import {ThemeProvider} from '@mui/material/styles';
import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {vi} from 'vitest';

import {AppContextProvider} from '../src/AppContext';
import {BottomBar} from '../src/lib/bottom_bar/BottomBar';
import * as envModule from '../src/lib/environment';
import {darkTheme} from '../src/theme/themes';

const BottomBarWithProviders = () => (
  <ThemeProvider theme={darkTheme}>
    <AppContextProvider>
      <BottomBar />
    </AppContextProvider>
  </ThemeProvider>
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

      // Get the search input fields by their IDs
      const tagSearch = container.querySelector('#tagSearch');
      const textSearch = container.querySelector('#textEntrySearch');

      expect(tagSearch).toBeInTheDocument();
      expect(textSearch).toBeInTheDocument();

      // Get their parent container (the left Box that contains both search fields)
      // Going up from tagSearch: input -> div -> div -> div (container) -> div (Box with center alignment)
      const searchContainer = tagSearch?.closest(
        '#tagSearchContainer'
      )?.parentElement;
      expect(searchContainer).toBeInTheDocument();

      // Check that the search container has center alignment
      const styles = window.getComputedStyle(searchContainer as HTMLElement);
      expect(styles.alignItems).toBe('center');
      expect(styles.display).toBe('flex');
    });

    it('aligns version and HUD options at the bottom on the right side', () => {
      vi.spyOn(envModule, 'environment', 'get').mockReturnValue('development');
      render(<BottomBarWithProviders />);

      // Get the version and HUD button elements
      const versionElement = screen.getByText(/\[version:/);
      const hudButton = screen.getByText('[HUD]');

      // Get their direct parent container (the Box containing Mode, Version, and HUD)
      const rightContainer = versionElement.parentElement;
      expect(rightContainer).toBeInTheDocument();
      expect(rightContainer).toContainElement(hudButton);

      // Check that the right container has bottom alignment
      const styles = window.getComputedStyle(rightContainer as HTMLElement);
      expect(styles.alignItems).toBe('flex-end');
      expect(styles.display).toBe('flex');
    });

    it('uses stretch alignment for the main container to allow different vertical alignments', () => {
      const {container} = render(<BottomBarWithProviders />);

      // Get the main container that holds both left and right sections
      const tagSearch = container.querySelector('#tagSearch');
      // Navigate up to the main container
      const mainContainer = tagSearch?.closest('#tagSearchContainer')
        ?.parentElement?.parentElement;
      expect(mainContainer).toBeInTheDocument();

      // Check that the main container uses stretch alignment
      const styles = window.getComputedStyle(mainContainer as HTMLElement);
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
});
