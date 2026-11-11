import {act, cleanup, fireEvent, screen, waitFor} from '@testing-library/react';
import {vi} from 'vitest';
import * as adminApi from '../../src/lib/api/adminApi';
import {signedOutDataCleanedUp} from '../../src/lib/state/appState';
import * as signOutWarning from '../../src/lib/state/signOutWarning';
import {syncSession} from '../../src/lib/sync/session';
import {assignLoggedInCookie} from '../util/assignLoggedInCookie';
import {mockResult} from '../util/mockResult';
import {serveMockApi} from '../util/msw';
import {observeSignOutWork} from '../util/observeSignOutWork';
import {signIn, store, TEST_USER} from '../util/signIn';
import {renderAppAt} from '../util/TestAppRouter';

serveMockApi();
let finishWork: () => Promise<void>;
let releaseCollection: (() => void) | undefined;
beforeEach(() => {
  finishWork = async () => {};
  releaseCollection = undefined;
});
afterEach(async () => {
  releaseCollection?.();
  try {
    await finishWork();
    await act(() => signedOutDataCleanedUp());
  } finally {
    cleanup();
  }
});

function watchWork() {
  const work = observeSignOutWork();
  finishWork = work.finish;
  return work;
}

function pendingCollection() {
  const session = syncSession(TEST_USER);
  const original = session.sync.syncAll.bind(session.sync);
  const gate = Promise.withResolvers<void>();
  releaseCollection = () => gate.resolve();
  const collection = vi
    .spyOn(session.sync, 'syncAll')
    .mockImplementation(async () => {
      await gate.promise;
      return original();
    });
  const work = watchWork();
  const errors = vi.spyOn(console, 'error');
  return {
    collection,
    finish: async () => {
      gate.resolve();
      const interrupted = expect.objectContaining({
        name: 'DatabaseClosedError',
      });
      await work.finish([interrupted]);
      expect(session.db.hasBeenClosed()).toBe(true);
      expect(errors).toHaveBeenCalledExactlyOnceWith(
        'ERROR: sync failed:',
        interrupted
      );
    },
  };
}

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
    const pending = pendingCollection();
    const requested = vi.spyOn(signOutWarning, 'requestSignOut');
    const {history} = await renderAppAt('/test/test-tag-1', {act: true});
    const fileMenuButton = await waitFor(() => {
      const button = document.getElementById('file-menu-button');
      expect(button).toBeInTheDocument();
      return button as HTMLElement;
    });
    await act(async () => fireEvent.click(fileMenuButton));
    await waitFor(() => expect(pending.collection).toHaveBeenCalledTimes(1));
    const logout = await screen.findByText('Logout');
    await act(async () => {
      fireEvent.click(logout);
      expect(requested).toHaveBeenCalledTimes(1);
      await mockResult(requested);
      await signedOutDataCleanedUp();
    });

    await pending.finish();
    await expectSignInPage(history);
    expect(store.loggedInUser).toBeNull();
  });

  it('goes from the admin page to the sign-in page', async () => {
    store.setIsStaff(true);
    const access = vi.spyOn(adminApi, 'getStaffStatus');
    const {history} = await renderAppAt('/admin', {act: true});
    expect(await screen.findByRole('heading', {name: 'Admin'})).toBeVisible();
    await act(async () => {
      store.setLoggedInUser(null);
      expect(access).toHaveBeenCalledTimes(1);
      await mockResult(access);
      await signedOutDataCleanedUp();
    });

    await expectSignInPage(history);
  });

  it('goes to the sign-in page however the session ends', async () => {
    const pending = pendingCollection();
    const {history} = await renderAppAt('/test', {act: true});
    await waitFor(() => expect(pending.collection).toHaveBeenCalledTimes(1));
    await act(async () => {
      store.setLoggedInUser(null);
      await signedOutDataCleanedUp();
    });

    await pending.finish();
    await expectSignInPage(history);
  });
});

describe('Signed-out visitors', () => {
  it('can open a public user page without signing in', async () => {
    const work = watchWork();
    const {history} = await renderAppAt('/alice/some-tag', {act: true});
    expect(history.location.pathname).toBe('/alice/some-tag');
    expect(document.getElementById('signInPage')).toBeNull();
    expect(screen.getByText('Read-only: alice')).toBeInTheDocument();
    await act(async () =>
      fireEvent.click(screen.getByRole('menu', {name: 'Help'}))
    );
    const about = await screen.findByText('About');
    await act(async () => fireEvent.click(about));
    expect(
      await screen.findByRole('link', {name: 'Privacy Policy'})
    ).toHaveAttribute('href', 'https://commandsnippets.com/privacy/');
    await work.finish();
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
