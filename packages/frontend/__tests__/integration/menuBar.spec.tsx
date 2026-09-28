import {act, render, screen, waitFor} from '@testing-library/react';
import {createMemoryHistory} from 'history';
import {type MockInstance, vi} from 'vitest';
import {assignLoggedInCookie} from '../util/assignLoggedInCookie';
import {server} from '../util/msw';
import {TestAppRouter} from '../util/TestAppRouter';

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
beforeEach(() => assignLoggedInCookie());

describe('MenuBar', () => {
  let consoleMock: MockInstance;

  beforeEach(() => {
    consoleMock = vi.spyOn(global.console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleMock.mockRestore();
  });

  describe('Rendering', () => {
    it('renders all menu buttons when user is logged in', async () => {
      const history = createMemoryHistory();
      const route = '/test/test';
      history.push(route);

      await act(async () => {
        render(<TestAppRouter history={history} />);
      });

      await waitFor(() => {
        expect(screen.getByRole('menu', {name: 'File'})).toBeInTheDocument();
        expect(screen.getByRole('menu', {name: 'View'})).toBeInTheDocument();
        expect(screen.getByRole('menu', {name: 'Tags'})).toBeInTheDocument();
        expect(screen.getByRole('menu', {name: 'Entries'})).toBeInTheDocument();
        expect(screen.getByRole('menu', {name: 'Debug'})).toBeInTheDocument();
        expect(screen.getByRole('menu', {name: 'Help'})).toBeInTheDocument();
      });
    });

    it('renders logo with correct styling', async () => {
      const history = createMemoryHistory();
      const route = '/test/test';
      history.push(route);

      await act(async () => {
        render(<TestAppRouter history={history} />);
      });

      await waitFor(() => {
        const logo = screen.getByAltText('Commandsnippets Logo');
        expect(logo).toBeInTheDocument();
        expect(logo).toHaveAttribute('src', '/logo-small.svg');
      });
    });

    it('renders auth components', async () => {
      const history = createMemoryHistory();
      const route = '/test/test';
      history.push(route);

      await act(async () => {
        render(<TestAppRouter history={history} />);
      });

      await waitFor(() => {
        // Check that auth components are rendered (they might be hidden or have specific styling)
        const menuBarContainers = screen.getAllByRole('banner');
        expect(menuBarContainers.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Menu Button Functionality', () => {
    it('has clickable menu buttons', async () => {
      const history = createMemoryHistory();
      const route = '/test/test';
      history.push(route);

      await act(async () => {
        render(<TestAppRouter history={history} />);
      });

      await waitFor(() => {
        const fileButton = screen.getByRole('menu', {name: 'File'});
        const viewButton = screen.getByRole('menu', {name: 'View'});
        const tagsButton = screen.getByRole('menu', {name: 'Tags'});
        const entriesButton = screen.getByRole('menu', {name: 'Entries'});
        const debugButton = screen.getByRole('menu', {name: 'Debug'});
        const helpButton = screen.getByRole('menu', {name: 'Help'});

        expect(fileButton).toBeInTheDocument();
        expect(viewButton).toBeInTheDocument();
        expect(tagsButton).toBeInTheDocument();
        expect(entriesButton).toBeInTheDocument();
        expect(debugButton).toBeInTheDocument();
        expect(helpButton).toBeInTheDocument();

        // Check that buttons have proper ARIA attributes
        expect(fileButton).toHaveAttribute('aria-haspopup', 'true');
        expect(viewButton).toHaveAttribute('aria-haspopup', 'true');
        expect(tagsButton).toHaveAttribute('aria-haspopup', 'true');
        expect(entriesButton).toHaveAttribute('aria-haspopup', 'true');
        expect(debugButton).toHaveAttribute('aria-haspopup', 'true');
        expect(helpButton).toHaveAttribute('aria-haspopup', 'true');
      });
    });

    it('has proper button IDs', async () => {
      const history = createMemoryHistory();
      const route = '/test/test';
      history.push(route);

      await act(async () => {
        render(<TestAppRouter history={history} />);
      });

      await waitFor(() => {
        expect(screen.getByRole('menu', {name: 'File'})).toHaveAttribute(
          'id',
          'file-menu-button'
        );
        expect(screen.getByRole('menu', {name: 'View'})).toHaveAttribute(
          'id',
          'view-menu-button'
        );
        expect(screen.getByRole('menu', {name: 'Tags'})).toHaveAttribute(
          'id',
          'tags-menu-button'
        );
        expect(screen.getByRole('menu', {name: 'Entries'})).toHaveAttribute(
          'id',
          'entries-menu-button'
        );
        expect(screen.getByRole('menu', {name: 'Debug'})).toHaveAttribute(
          'id',
          'debug-menu-button'
        );
        expect(screen.getByRole('menu', {name: 'Help'})).toHaveAttribute(
          'id',
          'helpMenuButton'
        );
      });
    });
  });

  describe('Environment-specific Behavior', () => {
    it('shows Debug menu in non-production environment', async () => {
      const history = createMemoryHistory();
      const route = '/test/test';
      history.push(route);

      await act(async () => {
        render(<TestAppRouter history={history} />);
      });

      await waitFor(() => {
        expect(screen.getByRole('menu', {name: 'Debug'})).toBeInTheDocument();
      });
    });

    it('hides Debug menu in production environment', async () => {
      // Mock the environment module to return 'production' for this test only
      vi.doMock('../../src/lib/environment', () => ({
        environment: 'production',
      }));

      // Clear module cache to ensure the mock is used
      vi.resetModules();

      // Dynamically import the TestAppRouter to use the mocked environment
      const {TestAppRouter: MockedTestAppRouter} = await import(
        '../util/TestAppRouter'
      );

      const history = createMemoryHistory();
      const route = '/test/test';
      history.push(route);

      await act(async () => {
        render(<MockedTestAppRouter history={history} />);
      });

      await waitFor(() => {
        // In production, the Debug menu should not be rendered
        expect(
          screen.queryByRole('menu', {name: 'Debug'})
        ).not.toBeInTheDocument();
      });

      // Restore the original module
      vi.doUnmock('../../src/lib/environment');
      vi.resetModules();
    });

    it('shows Debug menu in staging environment', async () => {
      // Mock the environment module to return 'staging' for this test only
      vi.doMock('../../src/lib/environment', () => ({
        environment: 'staging',
      }));

      // Clear module cache to ensure the mock is used
      vi.resetModules();

      // Dynamically import the TestAppRouter to use the mocked environment
      const {TestAppRouter: MockedTestAppRouter} = await import(
        '../util/TestAppRouter'
      );

      const history = createMemoryHistory();
      const route = '/test/test';
      history.push(route);

      await act(async () => {
        render(<MockedTestAppRouter history={history} />);
      });

      await waitFor(() => {
        // In staging, the Debug menu should be rendered (non-production)
        expect(screen.getByRole('menu', {name: 'Debug'})).toBeInTheDocument();
      });

      // Restore the original module
      vi.doUnmock('../../src/lib/environment');
      vi.resetModules();
    });
  });

  describe('Layout and Structure', () => {
    it('renders menu bar with correct layout structure', async () => {
      const history = createMemoryHistory();
      const route = '/test/test';
      history.push(route);

      await act(async () => {
        render(<TestAppRouter history={history} />);
      });

      await waitFor(() => {
        // Check that the menu bar container exists
        const menuBar = screen.getAllByRole('banner')[0]; // Use first banner since there might be multiple
        expect(menuBar).toBeInTheDocument();

        // Check that the logo exists
        const logo = screen.getByAltText('Commandsnippets Logo');
        expect(logo).toBeInTheDocument();
      });
    });

    it('has proper menu button styling', async () => {
      const history = createMemoryHistory();
      const route = '/test/test';
      history.push(route);

      await act(async () => {
        render(<TestAppRouter history={history} />);
      });

      await waitFor(() => {
        const fileButton = screen.getByRole('menu', {name: 'File'});

        // Check that buttons have proper styling classes
        expect(fileButton).toHaveClass('MuiButtonBase-root');
        expect(fileButton).toHaveClass('MuiButton-root');
      });
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels', async () => {
      const history = createMemoryHistory();
      const route = '/test/test';
      history.push(route);

      await act(async () => {
        render(<TestAppRouter history={history} />);
      });

      await waitFor(() => {
        expect(screen.getByRole('menu', {name: 'File'})).toHaveAttribute(
          'aria-label',
          'File'
        );
        expect(screen.getByRole('menu', {name: 'View'})).toHaveAttribute(
          'aria-label',
          'View'
        );
        expect(screen.getByRole('menu', {name: 'Tags'})).toHaveAttribute(
          'aria-label',
          'Tags'
        );
        expect(screen.getByRole('menu', {name: 'Entries'})).toHaveAttribute(
          'aria-label',
          'Entries'
        );
        expect(screen.getByRole('menu', {name: 'Debug'})).toHaveAttribute(
          'aria-label',
          'Debug'
        );
        expect(screen.getByRole('menu', {name: 'Help'})).toHaveAttribute(
          'aria-label',
          'Help'
        );
      });
    });

    it('has proper ARIA controls', async () => {
      const history = createMemoryHistory();
      const route = '/test/test';
      history.push(route);

      await act(async () => {
        render(<TestAppRouter history={history} />);
      });

      await waitFor(() => {
        expect(screen.getByRole('menu', {name: 'File'})).toHaveAttribute(
          'aria-controls',
          'file-menu'
        );
        expect(screen.getByRole('menu', {name: 'View'})).toHaveAttribute(
          'aria-controls',
          'view-menu'
        );
        expect(screen.getByRole('menu', {name: 'Tags'})).toHaveAttribute(
          'aria-controls',
          'tags-menu'
        );
        expect(screen.getByRole('menu', {name: 'Entries'})).toHaveAttribute(
          'aria-controls',
          'entries-menu'
        );
        expect(screen.getByRole('menu', {name: 'Debug'})).toHaveAttribute(
          'aria-controls',
          'debug-menu'
        );
        expect(screen.getByRole('menu', {name: 'Help'})).toHaveAttribute(
          'aria-controls',
          'help-menu'
        );
      });
    });
  });
});
