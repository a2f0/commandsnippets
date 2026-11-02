import {screen, waitFor} from '@testing-library/react';
import {vi} from 'vitest';
import {loggedInCookieNames} from '../../src/lib/auth/authUtils';
import {assignLoggedInCookie} from '../util/assignLoggedInCookie';
import {stubEnvironment} from '../util/environment';
import {serveMockApi} from '../util/msw';
import {signIn} from '../util/signIn';
import {renderAppAt} from '../util/TestAppRouter';

serveMockApi();
beforeEach(() => {
  signIn();
  assignLoggedInCookie();
});

describe('MenuBar', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  describe('Rendering', () => {
    it('renders all menu buttons when user is logged in', async () => {
      await renderAppAt('/test/test', {act: true});

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
      await renderAppAt('/test/test', {act: true});

      await waitFor(() => {
        const logo = screen.getByRole('img', {name: 'Command Snippets Logo'});
        expect(logo).toBeInTheDocument();
        expect(logo).toHaveAttribute('width', '33');
        expect(logo).toHaveAttribute('height', '33');
        // External SVG use needs a file URL; browsers reject data URLs.
        const href = logo.querySelector('use')?.getAttribute('href') ?? '';
        expect(href).toMatch(/\.svg(?:\?[^#]*)?#prompt$/);
        expect(href).not.toMatch(/^data:/);
      });
    });

    it('renders auth components', async () => {
      await renderAppAt('/test/test', {act: true});

      await waitFor(() => {
        // Check that auth components are rendered (they might be hidden or have specific styling)
        const menuBarContainers = screen.getAllByRole('banner');
        expect(menuBarContainers.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Menu Button Functionality', () => {
    it('has clickable menu buttons', async () => {
      await renderAppAt('/test/test', {act: true});

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
      await renderAppAt('/test/test', {act: true});

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
    it.each([
      ['test', true],
      ['staging', true],
      ['production', false],
    ])('in %s, shows the Debug menu: %s', async (environment, shown) => {
      stubEnvironment(environment);
      // Staging reads a login cookie of its own.
      assignLoggedInCookie(
        loggedInCookieNames(environment)
          .map(name => `${name}=True`)
          .join('; ')
      );

      await renderAppAt('/test/test', {act: true});

      expect(
        await screen.findByRole('menu', {name: 'File'})
      ).toBeInTheDocument();
      expect(screen.queryByRole('menu', {name: 'Debug'}) !== null).toBe(shown);
    });
  });

  describe('Layout and Structure', () => {
    it('renders menu bar with correct layout structure', async () => {
      await renderAppAt('/test/test', {act: true});

      await waitFor(() => {
        // Check that the menu bar container exists
        const menuBar = screen.getAllByRole('banner')[0]; // Use first banner since there might be multiple
        expect(menuBar).toBeInTheDocument();

        // Check that the logo exists
        const logo = screen.getByRole('img', {name: 'Command Snippets Logo'});
        expect(logo).toBeInTheDocument();
      });
    });

    it('has proper menu button styling', async () => {
      await renderAppAt('/test/test', {act: true});

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
      await renderAppAt('/test/test', {act: true});

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
      await renderAppAt('/test/test', {act: true});

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
