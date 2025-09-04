import '@testing-library/jest-dom';

import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {createMemoryHistory} from 'history';
import {type MockInstance, vi} from 'vitest';
import {assignLoggedInCookie} from './util/assignLoggedInCookie';
import {server} from './util/msw';
import {TestAppRouter} from './util/TestAppRouter';

Element.prototype.scrollIntoView = vi.fn();

beforeAll(() => server.listen());
afterAll(() => server.close());

// Define color constants for better maintainability
const DARK_MODE_BG_COLOR = 'rgb(18, 18, 18)';
const LIGHT_MODE_BG_COLOR = 'rgb(255, 255, 255)';

describe('Dark Mode Toggle', () => {
  let consoleMock: MockInstance;

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

    // Mock console to prevent test output clutter
    consoleMock = vi.spyOn(global.console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleMock.mockRestore();

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
    await waitFor(() => {
      const newColor = window.getComputedStyle(document.body).backgroundColor;
      // Assert that the color is the expected light mode color
      return newColor === LIGHT_MODE_BG_COLOR;
    });

    const finalColor = window.getComputedStyle(document.body).backgroundColor;
    // Should now be light mode
    expect(finalColor).toBe(LIGHT_MODE_BG_COLOR);
    expect(finalColor).not.toBe(initialColor);
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
    const darkModeMenuItem = screen.getByText('Dark Mode').closest('li');
    const initialDarkCheck = darkModeMenuItem?.querySelector(
      '[data-testid="CheckIcon"]'
    );
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

  it('verifies theme changes are reflected in UI components', async () => {
    await setupTest();

    // Get the initial body color (could be either light or dark depending on test order)
    const initialBodyColor = window.getComputedStyle(
      document.body
    ).backgroundColor;

    // Determine current mode and choose opposite
    const isCurrentlyDark = initialBodyColor === DARK_MODE_BG_COLOR;
    const targetMode = isCurrentlyDark ? 'Light Mode' : 'Dark Mode';
    const expectedColor = isCurrentlyDark
      ? LIGHT_MODE_BG_COLOR
      : DARK_MODE_BG_COLOR;

    // Toggle to opposite mode
    const viewButton = screen.getByRole('menu', {name: 'View'});
    await act(async () => {
      fireEvent.click(viewButton);
    });

    await waitFor(() => {
      expect(screen.getByText(targetMode)).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText(targetMode));
    });

    // Wait for theme change
    await waitFor(() => {
      const color = window.getComputedStyle(document.body).backgroundColor;
      return color === expectedColor;
    });

    // Verify the body color changed to the expected theme
    const finalBodyColor = window.getComputedStyle(
      document.body
    ).backgroundColor;
    expect(finalBodyColor).toBe(expectedColor);
    expect(finalBodyColor).not.toBe(initialBodyColor);
  });
});
