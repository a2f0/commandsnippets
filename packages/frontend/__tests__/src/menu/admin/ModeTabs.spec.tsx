import {act, fireEvent, render, screen} from '@testing-library/react';
import {createMemoryHistory} from 'history';

import {assignLoggedInCookie} from '../../../util/assignLoggedInCookie';
import {server} from '../../../util/msw';
import {signIn, store} from '../../../util/signIn';
import {TestAppRouter} from '../../../util/TestAppRouter';

beforeAll(() => server.listen());
afterAll(() => server.close());
beforeEach(() => {
  signIn();
  assignLoggedInCookie();
});
afterEach(() => server.resetHandlers());

async function renderAt(path: string) {
  const history = createMemoryHistory();
  history.push(path);
  await act(async () => {
    render(<TestAppRouter history={history} />);
  });
  return history;
}

describe('ModeTabs', () => {
  it('is not shown to users who are not staff', async () => {
    await renderAt('/test/test');

    expect(await screen.findByRole('menu', {name: 'File'})).toBeInTheDocument();
    expect(document.getElementById('modeTabs')).toBeNull();
    expect(screen.queryByRole('tab', {name: 'Admin'})).toBeNull();
  });

  it('shows staff on their entries in User mode, with Admin a click away', async () => {
    act(() => store.setIsStaff(true));
    const history = await renderAt('/test/test');

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
    const history = await renderAt('/test/test');

    fireEvent.click(screen.getByRole('tab', {name: 'User'}));

    // Not /test: the tag shown stays.
    expect(history.location.pathname).toBe('/test/test');
  });
});
