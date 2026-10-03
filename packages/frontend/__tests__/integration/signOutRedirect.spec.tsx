import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {createMemoryHistory} from 'history';
import {assignLoggedInCookie} from '../util/assignLoggedInCookie';
import {server} from '../util/msw';
import {signIn, store} from '../util/signIn';
import {TestAppRouter} from '../util/TestAppRouter';

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

async function renderAt(path: string) {
  const history = createMemoryHistory();
  history.push(path);
  await act(async () => {
    render(<TestAppRouter history={history} />);
  });
  return history;
}

async function expectSignInPage(history: {location: {pathname: string}}) {
  await waitFor(() => {
    expect(history.location.pathname).toBe('/');
  });
  expect(document.getElementById('signInPage')).toBeInTheDocument();
  expect(document.getElementById('file-menu-button')).toBeNull();
}

describe('Signing out', () => {
  beforeEach(() => {
    signIn();
    assignLoggedInCookie();
  });

  it('goes from File > Logout on a user page to the sign-in page', async () => {
    const history = await renderAt('/test/test-tag-1');
    const fileMenuButton = await waitFor(() => {
      const button = document.getElementById('file-menu-button');
      expect(button).toBeInTheDocument();
      return button as HTMLElement;
    });
    fireEvent.click(fileMenuButton);
    await act(async () => {
      fireEvent.click(await screen.findByText('Logout'));
    });

    await expectSignInPage(history);
    expect(store.loggedInUser).toBeNull();
  });

  it('goes from the admin page to the sign-in page', async () => {
    store.setIsStaff(true);
    const history = await renderAt('/admin');
    await act(async () => {
      store.setLoggedInUser(null);
    });

    await expectSignInPage(history);
  });

  it('goes to the sign-in page however the session ends', async () => {
    const history = await renderAt('/test');
    await act(async () => {
      store.setLoggedInUser(null);
    });

    await expectSignInPage(history);
  });
});

describe('Signed-out visitors', () => {
  it('can open a public user page without signing in', async () => {
    const history = await renderAt('/alice/some-tag');
    expect(history.location.pathname).toBe('/alice/some-tag');
    expect(document.getElementById('signInPage')).toBeNull();
    expect(screen.getByText('Read-only: alice')).toBeInTheDocument();
  });

  it('is sent from the admin page to sign-in', async () => {
    await expectSignInPage(await renderAt('/admin'));
  });

  it('still reach the OAuth callbacks', async () => {
    const history = await renderAt('/oauth/github');

    expect(history.location.pathname).toBe('/oauth/github');
    expect(screen.getByText('Login with GitHub')).toBeInTheDocument();
  });
});
