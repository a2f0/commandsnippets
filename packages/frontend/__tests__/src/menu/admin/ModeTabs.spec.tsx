import {act, cleanup, fireEvent, screen} from '@testing-library/react';
import {vi} from 'vitest';

import * as adminApi from '../../../../src/lib/api/adminApi';
import {assignLoggedInCookie} from '../../../util/assignLoggedInCookie';
import {mockResult} from '../../../util/mockResult';
import {serveMockApi} from '../../../util/msw';
import {observeSyncWork} from '../../../util/observeSyncWork';
import {signIn, store, TEST_USER} from '../../../util/signIn';
import {renderAppAt} from '../../../util/TestAppRouter';

serveMockApi();
let work: ReturnType<typeof observeSyncWork>;
beforeEach(() => {
  signIn();
  assignLoggedInCookie();
  work = observeSyncWork(TEST_USER);
});
afterEach(async () => {
  cleanup();
  await work.finish();
});

describe('ModeTabs', () => {
  it('is not shown to users who are not staff', async () => {
    await renderAppAt('/test/test', {act: true});

    expect(await screen.findByRole('menu', {name: 'File'})).toBeInTheDocument();
    expect(document.getElementById('modeTabs')).toBeNull();
    expect(screen.queryByRole('tab', {name: 'Admin'})).toBeNull();
  });

  it('shows staff on their entries in User mode, with Admin a click away', async () => {
    act(() => store.setIsStaff(true));
    const {history} = await renderAppAt('/test/test', {act: true});

    expect(
      screen.getByRole('tablist', {name: 'User or admin'})
    ).toBeInTheDocument();
    const userTab = screen.getByRole('tab', {name: 'User'});
    const adminTab = screen.getByRole('tab', {name: 'Admin'});
    expect(userTab).toHaveAttribute('aria-selected', 'true');
    expect(userTab).toHaveAttribute('href', '/test');
    expect(adminTab).toHaveAttribute('aria-selected', 'false');
    expect(adminTab).toHaveAttribute('href', '/admin');

    const access = vi.spyOn(adminApi, 'getStaffStatus');
    await act(async () => fireEvent.click(adminTab));

    expect(history.location.pathname).toBe('/admin');
    // The lazy module and its access check outlive the synchronous URL change.
    expect(await screen.findByRole('heading', {name: 'Admin'})).toBeVisible();
    await act(async () => {
      expect(access).toHaveBeenCalledTimes(1);
      await mockResult(access);
    });
  });

  it('keeps the page when the selected tab is clicked again', async () => {
    act(() => store.setIsStaff(true));
    const {history} = await renderAppAt('/test/test', {act: true});

    await act(async () =>
      fireEvent.click(screen.getByRole('tab', {name: 'User'}))
    );

    // Not /test: the tag shown stays.
    expect(history.location.pathname).toBe('/test/test');
  });
});
