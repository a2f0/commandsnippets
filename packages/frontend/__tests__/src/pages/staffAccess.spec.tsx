import {act, fireEvent, screen, waitFor} from '@testing-library/react';
import * as adminApi from '../../../src/lib/api/adminApi';
import {assignLoggedInCookie} from '../../util/assignLoggedInCookie';
import {serveMockApi} from '../../util/msw';
import {signIn, store} from '../../util/signIn';
import {renderAppAt} from '../../util/TestAppRouter';

serveMockApi();
beforeAll(async () => {
  await import('../../../src/pages/AdminPage');
});
beforeEach(() => {
  signIn();
  assignLoggedInCookie();
});

it.each(['staff', 'forbidden', 'expired'])(
  'finishes a current-user retry as %s',
  async outcome => {
    const checks = vi
      .spyOn(adminApi, 'getStaffStatus')
      .mockRejectedValueOnce(new Error('controlled initial read failure'));
    if (outcome === 'expired')
      checks.mockRejectedValueOnce(new adminApi.AdminSignedOutError());
    else checks.mockResolvedValueOnce(outcome === 'staff');
    const view = await renderAppAt('/admin', {act: true});
    fireEvent.click(await screen.findByRole('button', {name: 'Try again'}));
    if (outcome === 'staff') await screen.findByRole('table', {name: 'Users'});
    else if (outcome === 'forbidden')
      await screen.findByText('You do not have access to this page.');
    else await waitFor(() => expect(store.loggedInUser).toBeNull());
    expect(checks).toHaveBeenCalledTimes(2);
    expect(store.isStaff).toBe(outcome === 'staff');
    expect(store.loggedInUser).toBe(outcome === 'expired' ? null : 'test');
    view.unmount();
  }
);

it.each([
  {retry: false, outcome: 'success'},
  {retry: false, outcome: 'expired'},
  {retry: true, outcome: 'success'},
  {retry: true, outcome: 'expired'},
])(
  'ignores an unmounted check: $retry / $outcome',
  async ({retry, outcome}) => {
    const old = Promise.withResolvers<boolean>();
    const checks = vi.spyOn(adminApi, 'getStaffStatus');
    if (retry)
      checks.mockRejectedValueOnce(
        new Error('controlled initial read failure')
      );
    checks.mockReturnValueOnce(old.promise);
    const view = await renderAppAt('/admin', {act: true});
    if (retry)
      fireEvent.click(await screen.findByRole('button', {name: 'Try again'}));
    await waitFor(() => expect(checks).toHaveBeenCalledTimes(retry ? 2 : 1));
    view.unmount();
    await act(async () => {
      if (outcome === 'success') old.resolve(true);
      else old.reject(new adminApi.AdminSignedOutError());
      await old.promise.catch(() => undefined);
    });
    expect(store.loggedInUser).toBe('test');
    expect(store.isStaff).toBe(false);
  }
);

it.each(['success', 'expired'])(
  'ignores a stale retry %s after a replacement user was checked',
  async outcome => {
    const old = Promise.withResolvers<boolean>();
    const checks = vi
      .spyOn(adminApi, 'getStaffStatus')
      .mockRejectedValueOnce(new Error('controlled initial read failure'))
      .mockReturnValueOnce(old.promise)
      .mockResolvedValue(false);
    const view = await renderAppAt('/admin', {act: true});
    try {
      fireEvent.click(await screen.findByRole('button', {name: 'Try again'}));
      await waitFor(() => expect(checks).toHaveBeenCalledTimes(2));
      act(() => store.setLoggedInUser('replacement-user'));
      await screen.findByText('You do not have access to this page.');
      expect(checks).toHaveBeenCalledTimes(3);
      await act(async () => {
        if (outcome === 'success') old.resolve(true);
        else old.reject(new adminApi.AdminSignedOutError());
        await old.promise.catch(() => undefined);
      });
      expect(store.loggedInUser).toBe('replacement-user');
      expect(store.isStaff).toBe(false);
      expect(
        screen.getByText('You do not have access to this page.')
      ).toBeInTheDocument();
    } finally {
      old.resolve(true);
      await old.promise.catch(() => undefined);
      view.unmount();
    }
  }
);
