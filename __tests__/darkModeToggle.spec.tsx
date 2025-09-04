import '@testing-library/jest-dom';

import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {createMemoryHistory} from 'history';
import {type MockInstance, vi} from 'vitest';
import {assignLoggedInCookie} from './util/assignLoggedInCookie';
import {server} from './util/msw';
import {TestAppRouter} from './util/TestAppRouter';

Element.prototype.scrollIntoView = vi.fn();

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
beforeEach(() => assignLoggedInCookie());

describe('Dark Mode Toggle', () => {
  let consoleMock: MockInstance;

  beforeEach(() => {
    consoleMock = vi.spyOn(global.console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleMock.mockRestore();
  });

  it('successfully toggles from dark to light mode', async () => {
    // Note: The app starts in dark mode by default (defaultState.selectedTheme = 'darkTheme')
    const history = createMemoryHistory();
    const route = '/test/test';
    history.push(route);

    await act(async () => {
      render(<TestAppRouter history={history} />);
    });

    // Wait for initial render
    await waitFor(() => {
      expect(screen.getByRole('menu', {name: 'View'})).toBeInTheDocument();
    });

    // Get initial theme color (should be dark)
    const initialColor = window.getComputedStyle(document.body).backgroundColor;
    console.log('Initial color (dark theme):', initialColor);
    // Verify we start in dark mode
    expect(initialColor).toBe('rgb(18, 18, 18)');

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

    // Wait for theme change
    await waitFor(
      () => {
        const newColor = window.getComputedStyle(document.body).backgroundColor;
        // The color should change when switching to light mode
        return newColor !== initialColor;
      },
      {timeout: 2000}
    );

    const finalColor = window.getComputedStyle(document.body).backgroundColor;
    console.log('Final color (light theme):', finalColor);
    // Should no longer be dark
    expect(finalColor).not.toBe('rgb(18, 18, 18)');
    expect(finalColor).not.toBe(initialColor);
  });

  it('successfully toggles from light back to dark mode', async () => {
    const history = createMemoryHistory();
    const route = '/test/test';
    history.push(route);

    await act(async () => {
      render(<TestAppRouter history={history} />);
    });

    // Wait for initial render
    await waitFor(() => {
      expect(screen.getByRole('menu', {name: 'View'})).toBeInTheDocument();
    });

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
      return color !== 'rgb(18, 18, 18)';
    });

    const lightColor = window.getComputedStyle(document.body).backgroundColor;
    console.log('Light mode color:', lightColor);

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
      return color === 'rgb(18, 18, 18)';
    });

    const darkColor = window.getComputedStyle(document.body).backgroundColor;
    console.log('Dark mode color:', darkColor);

    // Should be back to dark
    expect(darkColor).toBe('rgb(18, 18, 18)');
    expect(darkColor).not.toBe(lightColor);
  });

  it('persists the selected theme in the menu', async () => {
    const history = createMemoryHistory();
    const route = '/test/test';
    history.push(route);

    await act(async () => {
      render(<TestAppRouter history={history} />);
    });

    // Wait for initial render
    await waitFor(() => {
      expect(screen.getByRole('menu', {name: 'View'})).toBeInTheDocument();
    });

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

    // Wait for menu to close and theme to update
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
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

  it('renders components with correct theme after toggle', async () => {
    const history = createMemoryHistory();
    const route = '/test/test';
    history.push(route);

    await act(async () => {
      render(<TestAppRouter history={history} />);
    });

    // Wait for initial render
    await waitFor(() => {
      expect(screen.getByRole('menu', {name: 'View'})).toBeInTheDocument();
    });

    // Get initial body color (may vary based on test order)
    const initialBodyColor = window.getComputedStyle(
      document.body
    ).backgroundColor;
    console.log('Initial body color:', initialBodyColor);

    // Toggle theme (will toggle to opposite of current)
    const viewButton = screen.getByRole('menu', {name: 'View'});
    await act(async () => {
      fireEvent.click(viewButton);
    });

    await waitFor(() => {
      expect(screen.getByText('Light Mode')).toBeInTheDocument();
      expect(screen.getByText('Dark Mode')).toBeInTheDocument();
    });

    // Toggle to opposite theme
    const isDarkMode = initialBodyColor === 'rgb(18, 18, 18)';
    const toggleOption = isDarkMode ? 'Light Mode' : 'Dark Mode';

    await act(async () => {
      fireEvent.click(screen.getByText(toggleOption));
    });

    // Wait for theme change
    await waitFor(
      () => {
        const color = window.getComputedStyle(document.body).backgroundColor;
        return color !== initialBodyColor;
      },
      {timeout: 2000}
    );

    // Verify the body color changed
    const finalBodyColor = window.getComputedStyle(
      document.body
    ).backgroundColor;
    expect(finalBodyColor).not.toBe(initialBodyColor);

    // The theme change is working correctly as the body background changed
    console.log('Theme successfully changed from dark to light');
  });
});
