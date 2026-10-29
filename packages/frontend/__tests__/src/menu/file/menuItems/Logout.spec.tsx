import {screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {assignLoggedInCookie} from '../../../../util/assignLoggedInCookie';
import {serveMockApi} from '../../../../util/msw';
import {signIn} from '../../../../util/signIn';
import {renderAppAt} from '../../../../util/TestAppRouter';

serveMockApi();
beforeEach(() => {
  signIn();
  assignLoggedInCookie();
});

describe('File Menu', () => {
  it('Logs out to the sign-in page', async () => {
    const user = userEvent.setup();
    const {history} = renderAppAt('/test/test-tag-1');
    expect(history.location.pathname).toBe('/test/test-tag-1');
    const fileMenu = screen.getByRole('menu', {name: 'File'});
    await user.pointer({target: fileMenu, keys: '[MouseLeft]'});
    const logoutButton = screen.getByText('Logout');
    expect(screen.queryByText('Login with Google')).toBeNull();
    expect(screen.queryByText('Login with GitHub')).toBeNull();
    await user.pointer({target: logoutButton, keys: '[MouseLeft]'});
    await waitFor(() => screen.getByText(/Login with Google/i));
    await waitFor(() => screen.getByText(/Login with GitHub/i));
    expect(history.location.pathname).toBe('/');
    expect(document.getElementById('signInPage')).toBeInTheDocument();
  });
});
