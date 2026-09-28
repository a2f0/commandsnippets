import {ThemeProvider} from '@mui/material/styles';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {HttpResponse, http} from 'msw';
import {type MockInstance, vi} from 'vitest';
import {AppContext} from '../../../src/AppContext';
import {UserProfileCircle} from '../../../src/components/UserProfileCircle';
import {apiClient} from '../../../src/lib/api/apiClient';
import type {Store} from '../../../src/lib/store/store';
import {darkTheme} from '../../../src/theme/themes';
import {server} from '../../util/msw';

// Mock the environment module to ensure it's not production
vi.mock('../../../src/lib/environment', () => ({
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

// Setup MSW server
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

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

  describe('Logout Functionality', () => {
    it('successfully logs out and closes menu', async () => {
      // The default MSW handler returns success for logout
      renderWithContext('testuser');

      // Open the menu
      const profileButton = screen.getByLabelText('testuser');
      await act(async () => {
        fireEvent.click(profileButton);
      });

      // Wait for menu to be open
      await waitFor(() => {
        expect(screen.getByText('Logout')).toBeInTheDocument();
      });

      // Click logout
      const logoutButton = screen.getByText('Logout');
      await act(async () => {
        fireEvent.click(logoutButton);
      });

      // Verify menu is closed after logout
      await waitFor(() => {
        expect(screen.queryByText('Logout')).not.toBeInTheDocument();
      });
    });

    it('handles logout errors gracefully and still closes menu', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      // Override the logout handler to return an error
      server.use(
        http.post('http://localhost:9001/api-token-deauth/', () => {
          return HttpResponse.json({error: 'Network error'}, {status: 500});
        })
      );

      renderWithContext('testuser');

      // Open the menu
      const profileButton = screen.getByLabelText('testuser');
      await act(async () => {
        fireEvent.click(profileButton);
      });

      // Wait for menu to be open
      await waitFor(() => {
        expect(screen.getByText('Logout')).toBeInTheDocument();
      });

      // Click logout
      const logoutButton = screen.getByText('Logout');
      await act(async () => {
        fireEvent.click(logoutButton);
      });

      // Verify error was logged
      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Logout error:',
          expect.any(Error)
        );
      });

      await waitFor(() => {
        expect(screen.queryByText('Logout')).not.toBeInTheDocument();
      });

      consoleErrorSpy.mockRestore();
    });

    it('ensures menu closes via finally block even if logout throws', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      // Make apiClient.logout throw immediately
      const logoutSpy = vi
        .spyOn(apiClient, 'logout')
        .mockRejectedValue(new Error('Network failure'));

      renderWithContext('testuser');

      // Open the menu
      const profileButton = screen.getByLabelText('testuser');
      await act(async () => {
        fireEvent.click(profileButton);
      });

      // Verify menu is open
      await waitFor(() => {
        expect(screen.getByText('Logout')).toBeInTheDocument();
      });

      // Click logout
      const logoutButton = screen.getByText('Logout');
      await act(async () => {
        fireEvent.click(logoutButton);
      });

      // Verify error was logged
      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Logout error:',
          expect.objectContaining({message: 'Network failure'})
        );
      });

      await waitFor(() => {
        expect(screen.queryByText('Logout')).not.toBeInTheDocument();
      });

      expect(logoutSpy).toHaveBeenCalledTimes(1);
      logoutSpy.mockRestore();
      consoleErrorSpy.mockRestore();
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
