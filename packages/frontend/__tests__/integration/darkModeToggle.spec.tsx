import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import {createMemoryHistory} from 'history';
import {vi} from 'vitest';
import {assignLoggedInCookie} from '../util/assignLoggedInCookie';
import {store as loggedInStore} from '../util/loggedInStore';
import {server} from '../util/msw';
import {TestAppRouter} from '../util/TestAppRouter';

beforeAll(() => server.listen());
afterAll(() => server.close());

// Define color constants for better maintainability
const DARK_MODE_BG_COLOR = 'rgb(18, 18, 18)';
const LIGHT_MODE_BG_COLOR = 'rgb(255, 255, 255)';

describe('Dark Mode Toggle', () => {
  // Setup helper function to reduce duplication
  async function setupTest() {
    const history = createMemoryHistory();
    const route = '/test/test';
    history.push(route);

    await act(async () => {
      render(<TestAppRouter history={history} />);
    });

    await waitFor(() => {
      expect(screen.getByRole('menu', {name: 'View'})).toBeInTheDocument();
    });

    return {history};
  }

  beforeEach(() => {
    // Reset MSW handlers
    server.resetHandlers();

    // Assign logged in cookie
    assignLoggedInCookie();

    // Ensure MobX store theme is reset to a known default for test isolation
    loggedInStore.setSelectedTheme('darkTheme');
  });

  afterEach(() => {
    // Clean up any rendered components
    vi.clearAllMocks();
  });

  it('successfully toggles from dark to light mode', async () => {
    // Note: The app starts in dark mode by default (defaultState.selectedTheme = 'darkTheme')
    await setupTest();

    // Get initial theme color (should be dark)
    const initialColor = window.getComputedStyle(document.body).backgroundColor;
    // Verify we start in dark mode
    expect(initialColor).toBe(DARK_MODE_BG_COLOR);

    // Open View menu
    const viewButton = screen.getByRole('menu', {name: 'View'});
    await act(async () => {
      fireEvent.click(viewButton);
    });

    // Wait for menu to open
    await waitFor(() => {
      expect(screen.getByText('Light Mode')).toBeInTheDocument();
    });

    // Click Light Mode to switch from dark to light
    const lightModeOption = screen.getByText('Light Mode');
    await act(async () => {
      fireEvent.click(lightModeOption);
    });

    // Wait for theme change to light mode
    // Wait for theme change to light mode and assert the new color
    await waitFor(() => {
      const finalColor = window.getComputedStyle(document.body).backgroundColor;
      expect(finalColor).toBe(LIGHT_MODE_BG_COLOR);
      expect(finalColor).not.toBe(initialColor);
    });
  });

  it('successfully toggles from light back to dark mode', async () => {
    await setupTest();

    const viewButton = screen.getByRole('menu', {name: 'View'});

    // First switch to light mode
    await act(async () => {
      fireEvent.click(viewButton);
    });

    await waitFor(() => {
      expect(screen.getByText('Light Mode')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Light Mode'));
    });

    // Wait for switch to light mode
    await waitFor(() => {
      const color = window.getComputedStyle(document.body).backgroundColor;
      return color === LIGHT_MODE_BG_COLOR;
    });

    const lightColor = window.getComputedStyle(document.body).backgroundColor;
    expect(lightColor).toBe(LIGHT_MODE_BG_COLOR);

    // Now switch back to dark mode
    await act(async () => {
      fireEvent.click(viewButton);
    });

    await waitFor(() => {
      expect(screen.getByText('Dark Mode')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Dark Mode'));
    });

    // Wait for switch back to dark mode
    await waitFor(() => {
      const color = window.getComputedStyle(document.body).backgroundColor;
      return color === DARK_MODE_BG_COLOR;
    });

    const darkColor = window.getComputedStyle(document.body).backgroundColor;

    // Should be back to dark
    expect(darkColor).toBe(DARK_MODE_BG_COLOR);
    expect(darkColor).not.toBe(lightColor);
  });

  it('persists the selected theme in the menu', async () => {
    await setupTest();

    // Open View menu
    const viewButton = screen.getByRole('menu', {name: 'View'});
    await act(async () => {
      fireEvent.click(viewButton);
    });

    // Wait for menu to open
    await waitFor(() => {
      expect(screen.getByText('Light Mode')).toBeInTheDocument();
      expect(screen.getByText('Dark Mode')).toBeInTheDocument();
    });

    // Initially, Dark Mode should be checked (default state)
    const darkModeMenuItem = screen.getByRole('menuitem', {name: 'Dark Mode'});
    const initialDarkCheck = within(darkModeMenuItem).getByTestId('CheckIcon');
    expect(initialDarkCheck).toBeInTheDocument();

    // Click Light Mode
    const lightModeOption = screen.getByText('Light Mode');
    await act(async () => {
      fireEvent.click(lightModeOption);
    });

    // Wait for theme to change
    await waitFor(() => {
      const color = window.getComputedStyle(document.body).backgroundColor;
      return color === LIGHT_MODE_BG_COLOR;
    });

    // Open menu again to check if selection persisted
    await act(async () => {
      fireEvent.click(viewButton);
    });

    await waitFor(() => {
      expect(screen.getByText('Light Mode')).toBeInTheDocument();
    });

    // Check that Light Mode now has the checkmark
    const lightModeMenuItem = screen.getByText('Light Mode').closest('li');
    const lightCheck = lightModeMenuItem?.querySelector(
      '[data-testid="CheckIcon"]'
    );

    // Light mode should now be checked
    expect(lightCheck).toBeInTheDocument();

    // Dark mode should not be checked anymore
    const darkMenuItem = screen.getByText('Dark Mode').closest('li');
    const darkCheck = darkMenuItem?.querySelector('[data-testid="CheckIcon"]');
    expect(darkCheck).not.toBeInTheDocument();
  });
});
