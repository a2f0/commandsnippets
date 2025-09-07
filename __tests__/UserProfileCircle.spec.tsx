import '@testing-library/jest-dom';

import {ThemeProvider} from '@mui/material/styles';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {type MockInstance, vi} from 'vitest';
import {AppContext} from '../src/AppContext';
import {UserProfileCircle} from '../src/components/UserProfileCircle';
import type {Store} from '../src/lib/store/store';
import {darkTheme} from '../src/theme/themes';

// Mock the environment module to ensure it's not production
vi.mock('../src/lib/environment', () => ({
  environment: 'test',
}));

// Mock store with MobX-like interface
const createMockStore = (
  loggedInUser: string | null = 'testuser'
): Partial<Store> => ({
  loggedInUser,
  setLoggedInUser: vi.fn(),
});

const renderWithContext = (loggedInUser: string | null = 'testuser') => {
  const mockStore = createMockStore(loggedInUser);
  return render(
    <ThemeProvider theme={darkTheme}>
      <AppContext.Provider value={mockStore as Store}>
        <UserProfileCircle />
      </AppContext.Provider>
    </ThemeProvider>
  );
};

describe('UserProfileCircle', () => {
  let consoleMock: MockInstance;

  beforeEach(() => {
    consoleMock = vi.spyOn(global.console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleMock.mockRestore();
  });

  describe('Rendering', () => {
    it('renders user profile circle when logged in', () => {
      renderWithContext('testuser');

      const profileButton = screen.getByLabelText('testuser');
      expect(profileButton).toBeInTheDocument();
    });

    it('displays user initials correctly', () => {
      renderWithContext('testuser');

      const profileButton = screen.getByLabelText('testuser');
      expect(profileButton).toBeInTheDocument();
      // The username 'testuser' should display 'TE' as initials (first two chars)
      expect(profileButton).toHaveTextContent('TE');
    });

    it('handles usernames with spaces correctly', () => {
      renderWithContext('John Doe');

      const profileButton = screen.getByLabelText('John Doe');
      expect(profileButton).toBeInTheDocument();
      // Should display first and last initials: 'JD'
      expect(profileButton).toHaveTextContent('JD');
    });

    it('does not render when user is not logged in', () => {
      renderWithContext(null);

      const profileButton = screen.queryByRole('button');
      expect(profileButton).not.toBeInTheDocument();
    });
  });

  describe('Dropdown Menu', () => {
    it('opens dropdown menu on click', async () => {
      renderWithContext('testuser');

      const profileButton = screen.getByLabelText('testuser');

      await act(async () => {
        fireEvent.click(profileButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Profile')).toBeInTheDocument();
        expect(screen.getByText('Settings')).toBeInTheDocument();
        expect(screen.getByText('Logout')).toBeInTheDocument();
      });
    });

    it('displays username in dropdown', async () => {
      renderWithContext('testuser');

      const profileButton = screen.getByLabelText('testuser');

      await act(async () => {
        fireEvent.click(profileButton);
      });

      await waitFor(() => {
        // The username should be displayed at the top of the menu
        const menuItems = screen.getAllByRole('menuitem');
        expect(menuItems[0]).toHaveTextContent('testuser');
      });
    });

    it('can open dropdown menu', async () => {
      renderWithContext('testuser');

      const profileButton = screen.getByLabelText('testuser');

      await act(async () => {
        fireEvent.click(profileButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Profile')).toBeInTheDocument();
        expect(screen.getByText('Settings')).toBeInTheDocument();
        expect(screen.getByText('Logout')).toBeInTheDocument();
      });
    });

    it('closes dropdown when menu item is clicked', async () => {
      renderWithContext('testuser');

      const profileButton = screen.getByLabelText('testuser');

      await act(async () => {
        fireEvent.click(profileButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Profile')).toBeInTheDocument();
      });

      const profileMenuItem = screen.getByText('Profile');

      await act(async () => {
        fireEvent.click(profileMenuItem);
      });

      await waitFor(() => {
        expect(screen.queryByText('Profile')).not.toBeInTheDocument();
      });
    });
  });

  describe('Environment-specific Behavior', () => {
    it('checks that component respects environment variable', () => {
      // Since we mock environment as 'test' at the top level,
      // we know it should render (non-production)
      renderWithContext('testuser');
      const profileButton = screen.getByLabelText('testuser');
      expect(profileButton).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA attributes when closed', () => {
      renderWithContext('testuser');

      const profileButton = screen.getByLabelText('testuser');
      expect(profileButton).toBeInTheDocument();
      expect(profileButton).toHaveAttribute('aria-haspopup', 'true');
      // aria-expanded and aria-controls are only set when the menu would be open
    });

    it('updates ARIA expanded when menu is open', async () => {
      renderWithContext('testuser');

      const profileButton = screen.getByLabelText('testuser');

      await act(async () => {
        fireEvent.click(profileButton);
      });

      await waitFor(() => {
        expect(profileButton).toHaveAttribute('aria-expanded', 'true');
        expect(profileButton).toHaveAttribute('aria-controls', 'user-menu');
      });
    });
  });

  describe('User Initials Logic', () => {
    it('handles single word usernames', () => {
      renderWithContext('test');

      const profileButton = screen.getByLabelText('test');
      expect(profileButton).toHaveTextContent('TE');
    });

    it('handles usernames with spaces', () => {
      renderWithContext('John Doe');

      const profileButton = screen.getByLabelText('John Doe');
      // Should show first and last initials: 'JD'
      expect(profileButton).toHaveTextContent('JD');
    });

    it('handles short usernames', () => {
      renderWithContext('a');

      const profileButton = screen.getByLabelText('a');
      // Should show first character uppercased: 'A'
      expect(profileButton).toHaveTextContent('A');
    });

    it('handles empty names gracefully', () => {
      renderWithContext('');

      const profileButton = screen.queryByRole('button');
      expect(profileButton).not.toBeInTheDocument();
    });
  });
});
