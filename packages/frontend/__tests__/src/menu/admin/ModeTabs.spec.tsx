import {act, fireEvent, screen} from '@testing-library/react';

import {assignLoggedInCookie} from '../../../util/assignLoggedInCookie';
import {serveMockApi} from '../../../util/msw';
import {signIn, store} from '../../../util/signIn';
import {renderAppAt} from '../../../util/TestAppRouter';

serveMockApi();
beforeEach(() => {
  signIn();
  assignLoggedInCookie();
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

    fireEvent.click(adminTab);

    expect(history.location.pathname).toBe('/admin');
  });

  it('keeps the page when the selected tab is clicked again', async () => {
    act(() => store.setIsStaff(true));
    const {history} = await renderAppAt('/test/test', {act: true});

    fireEvent.click(screen.getByRole('tab', {name: 'User'}));

    // Not /test: the tag shown stays.
    expect(history.location.pathname).toBe('/test/test');
  });
});
