import {screen} from '@testing-library/react';
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

/** Each menu's button: its name, id, and the id of the menu it opens. */
const MENUS = [
  ['File', 'file-menu-button', 'file-menu'],
  ['View', 'view-menu-button', 'view-menu'],
  ['Tags', 'tags-menu-button', 'tags-menu'],
  ['Entries', 'entries-menu-button', 'entries-menu'],
  ['Debug', 'debug-menu-button', 'debug-menu'],
  ['Help', 'helpMenuButton', 'help-menu'],
] as const;

describe('MenuBar', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  describe('Rendering', () => {
    it('renders logo with correct styling', async () => {
      await renderAppAt('/test/test', {act: true});

      const logo = await screen.findByRole('img', {
        name: 'Command Snippets Logo',
      });
      expect(logo).toHaveAttribute('width', '33');
      expect(logo).toHaveAttribute('height', '33');
      // External SVG use needs a file URL; browsers reject data URLs.
      const href = logo.querySelector('use')?.getAttribute('href') ?? '';
      expect(href).toMatch(/\.svg(?:\?[^#]*)?#prompt$/);
      expect(href).not.toMatch(/^data:/);
      expect(screen.getAllByRole('banner').length).toBeGreaterThan(0);
    });
  });

  describe('Menu buttons', () => {
    it.each(MENUS)(
      'renders the %s button, labelled, opening its menu',
      async (name, id, menu) => {
        await renderAppAt('/test/test', {act: true});

        const button = await screen.findByRole('menu', {name});
        expect(button).toHaveAttribute('id', id);
        expect(button).toHaveAttribute('aria-label', name);
        expect(button).toHaveAttribute('aria-haspopup', 'true');
        expect(button).toHaveAttribute('aria-controls', menu);
        expect(button).toHaveClass('MuiButtonBase-root', 'MuiButton-root');
      }
    );
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
});
