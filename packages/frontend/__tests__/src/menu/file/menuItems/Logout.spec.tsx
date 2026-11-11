import {act, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {vi} from 'vitest';

import {signedOutDataCleanedUp} from '../../../../../src/lib/state/appState';
import * as signOutWarning from '../../../../../src/lib/state/signOutWarning';
import {syncSession} from '../../../../../src/lib/sync/session';
import {assignLoggedInCookie} from '../../../../util/assignLoggedInCookie';
import {mockResult} from '../../../../util/mockResult';
import {serveMockApi} from '../../../../util/msw';
import {observeSignOutWork} from '../../../../util/observeSignOutWork';
import {signIn, TEST_USER} from '../../../../util/signIn';
import {renderAppAt} from '../../../../util/TestAppRouter';

serveMockApi();
beforeEach(() => {
  signIn();
  assignLoggedInCookie();
});

describe('File Menu', () => {
  it('Logs out to the sign-in page', async () => {
    const user = userEvent.setup();
    const session = syncSession(TEST_USER);
    const original = session.sync.syncAll.bind(session.sync);
    const gate = Promise.withResolvers<void>();
    const collection = vi
      .spyOn(session.sync, 'syncAll')
      .mockImplementation(async () => {
        await gate.promise;
        return original();
      });
    const work = observeSignOutWork();
    const errors = vi.spyOn(console, 'error');
    const requested = vi.spyOn(signOutWarning, 'requestSignOut');
    try {
      const {history} = renderAppAt('/test/test-tag-1');
      expect(history.location.pathname).toBe('/test/test-tag-1');
      const fileMenu = screen.getByRole('menu', {name: 'File'});
      await user.pointer({target: fileMenu, keys: '[MouseLeft]'});
      const logoutButton = screen.getByText('Logout');
      expect(screen.queryByText('Login with Google')).toBeNull();
      expect(screen.queryByText('Login with GitHub')).toBeNull();
      // Keep the mount's actual collection pending across logout, not teardown.
      await waitFor(() => expect(collection).toHaveBeenCalledTimes(1));
      await user.pointer({target: logoutButton, keys: '[MouseLeft]'});
      await act(async () => {
        expect(requested).toHaveBeenCalledTimes(1);
        await mockResult(requested);
        await signedOutDataCleanedUp();
      });
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
      await screen.findByText(/Login with Google/i);
      await screen.findByText(/Login with GitHub/i);
      expect(history.location.pathname).toBe('/');
      expect(document.getElementById('signInPage')).toBeInTheDocument();
    } finally {
      gate.resolve();
    }
  });
});
