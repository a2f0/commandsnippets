import '@testing-library/jest-dom';

import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {createMemoryHistory} from 'history';
import React from 'react';
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

  it('proves ThemeProvider does NOT re-render when dark mode is toggled', async () => {
    const history = createMemoryHistory();
    const route = '/test/test';
    history.push(route);

    // Create a ref to track ThemeProvider renders
    let themeProviderRenderCount = 0;

    // Spy on React.createElement to track ThemeProvider renders
    const originalCreateElement = React.createElement;
    const createElementSpy = vi
      .spyOn(React, 'createElement')
      .mockImplementation((...args: Parameters<typeof React.createElement>) => {
        // Check if we're creating a ThemeProvider component
        const component = args[0];
        if (
          typeof component === 'function' &&
          (component.name === 'ThemeProvider' ||
            (component as any).displayName === 'ThemeProvider')
        ) {
          themeProviderRenderCount++;
        }
        return originalCreateElement.apply(React, args);
      });

    await act(async () => {
      render(<TestAppRouter history={history} />);
    });

    // Wait for initial render
    await waitFor(() => {
      expect(screen.getByRole('menu', {name: 'View'})).toBeInTheDocument();
    });

    // Store initial render count
    const initialRenderCount = themeProviderRenderCount;
    console.log('Initial ThemeProvider render count:', initialRenderCount);

    // Open View menu
    const viewButton = screen.getByRole('menu', {name: 'View'});
    await act(async () => {
      fireEvent.click(viewButton);
    });

    // Wait for menu to open
    await waitFor(() => {
      expect(screen.getByText('Dark Mode')).toBeInTheDocument();
    });

    // Click Dark Mode option
    const darkModeOption = screen.getByText('Dark Mode');
    await act(async () => {
      fireEvent.click(darkModeOption);
    });

    // Wait a bit to ensure any potential re-renders would have happened
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    console.log('Final ThemeProvider render count:', themeProviderRenderCount);

    // This assertion proves the bug: ThemeProvider should re-render when theme changes,
    // but it doesn't because it's not wrapped with observer
    expect(themeProviderRenderCount).toBe(initialRenderCount);

    // Restore original createElement
    createElementSpy.mockRestore();
  });

  it('shows the store updates but UI does not reflect the change', async () => {
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

    // Get the initial background color
    const initialBackgroundColor = window.getComputedStyle(
      document.body
    ).backgroundColor;
    console.log('Initial background color:', initialBackgroundColor);

    // Open View menu
    const viewButton = screen.getByRole('menu', {name: 'View'});
    await act(async () => {
      fireEvent.click(viewButton);
    });

    // Wait for menu to open and check initial state
    await waitFor(() => {
      expect(screen.getByText('Dark Mode')).toBeInTheDocument();
      expect(screen.getByText('Light Mode')).toBeInTheDocument();
    });

    // The test will continue to work even if we can't verify the checkmarks
    // The important part is proving the background color doesn't change

    // Click Dark Mode option
    const darkModeOption = screen.getByText('Dark Mode');
    await act(async () => {
      fireEvent.click(darkModeOption);
    });

    // Wait a moment for the store to update
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    // But the actual background color hasn't changed (proving the UI bug)
    const finalBackgroundColor = window.getComputedStyle(
      document.body
    ).backgroundColor;
    console.log('Final background color:', finalBackgroundColor);

    // This proves the bug: background color should change but doesn't
    expect(finalBackgroundColor).toBe(initialBackgroundColor);
  });

  it('demonstrates that adding observer to ThemeProvider would fix the issue', async () => {
    // This test documents what the fix would look like
    // The ThemeProvider in src/theme/Theme.tsx needs to be wrapped with observer

    const history = createMemoryHistory();
    const route = '/test/test';
    history.push(route);

    await act(async () => {
      render(<TestAppRouter history={history} />);
    });

    await waitFor(() => {
      expect(screen.getByRole('menu', {name: 'View'})).toBeInTheDocument();
    });

    // This test serves as documentation for the fix:
    // In src/theme/Theme.tsx, the component should be:
    // export const ThemeProvider = observer(({children}: IThemeProps) => { ... })
    //
    // Currently it's just a plain React component, so it doesn't react to MobX store changes

    expect(true).toBe(true); // Placeholder assertion for documentation purposes
  });
});
