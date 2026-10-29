import {act, fireEvent, screen, waitFor} from '@testing-library/react';
import {assignLoggedInCookie} from '../util/assignLoggedInCookie';
import {serveMockApi} from '../util/msw';
import {signIn, store} from '../util/signIn';
import {renderAppAt} from '../util/TestAppRouter';

serveMockApi();

async function expectSignInPage(history: {location: {pathname: string}}) {
  await waitFor(() => {
    expect(history.location.pathname).toBe('/');
  });
  expect(document.getElementById('signInPage')).toBeInTheDocument();
  expect(document.getElementById('file-menu-button')).toBeNull();
  expect(screen.getByRole('link', {name: 'Privacy Policy'})).toHaveAttribute(
    'href',
    'https://commandsnippets.com/privacy/'
  );
  expect(screen.getByRole('link', {name: 'Terms of Service'})).toHaveAttribute(
    'href',
    'https://commandsnippets.com/terms/'
  );
  expect(
    screen.getByText('Command Snippets is operated by Tearleads, LLC.')
  ).toBeVisible();
}

describe('Signing out', () => {
  beforeEach(() => {
    signIn();
    assignLoggedInCookie();
  });

  it('goes from File > Logout on a user page to the sign-in page', async () => {
    const {history} = await renderAppAt('/test/test-tag-1', {act: true});
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
    const {history} = await renderAppAt('/admin', {act: true});
    await act(async () => {
      store.setLoggedInUser(null);
    });

    await expectSignInPage(history);
  });

  it('goes to the sign-in page however the session ends', async () => {
    const {history} = await renderAppAt('/test', {act: true});
    await act(async () => {
      store.setLoggedInUser(null);
    });

    await expectSignInPage(history);
  });
});

describe('Signed-out visitors', () => {
  it('can open a public user page without signing in', async () => {
    const {history} = await renderAppAt('/alice/some-tag', {act: true});
    expect(history.location.pathname).toBe('/alice/some-tag');
    expect(document.getElementById('signInPage')).toBeNull();
    expect(screen.getByText('Read-only: alice')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('menu', {name: 'Help'}));
    fireEvent.click(await screen.findByText('About'));
    expect(
      await screen.findByRole('link', {name: 'Privacy Policy'})
    ).toHaveAttribute('href', 'https://commandsnippets.com/privacy/');
  });

  it('is sent from the admin page to sign-in', async () => {
    const {history} = await renderAppAt('/admin', {act: true});
    await expectSignInPage(history);
  });

  it('still reach the OAuth callbacks', async () => {
    const {history} = await renderAppAt('/oauth/github', {act: true});

    expect(history.location.pathname).toBe('/oauth/github');
    expect(screen.getByText('Login with GitHub')).toBeInTheDocument();
  });
});
