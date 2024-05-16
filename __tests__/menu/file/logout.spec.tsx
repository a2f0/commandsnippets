import '@testing-library/jest-dom';
import {render, screen, waitFor} from '@testing-library/react';
import React from 'react';
import TestAppRouter from '../../util/TestAppRouter';
import {assignLoggedInCookie} from '../../util/assignLoggedInCookie';
import {createMemoryHistory} from 'history';
import server from '../../util/msw';
import userEvent from '@testing-library/user-event';
import {vi} from 'vitest';

Element.prototype.scrollIntoView = vi.fn();

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
beforeEach(() => assignLoggedInCookie());

describe('File Menu', () => {
  it('Logs out', async () => {
    const user = userEvent.setup();
    const history = createMemoryHistory();
    const route = '/test/test-tag-1';
    history.push(route);
    render(<TestAppRouter history={history} />);
    expect(history.location.pathname).toBe('/test/test-tag-1');
    const fileMenu = screen.getByRole('menu', {name: 'File'});
    await user.pointer({target: fileMenu, keys: '[MouseLeft]'});
    const logoutButton = screen.getByText('Logout');
    expect(screen.queryByText('Login with Google')).toBeNull();
    expect(screen.queryByText('Login with GitHub')).toBeNull();
    await user.pointer({target: logoutButton, keys: '[MouseLeft]'});
    await waitFor(() => screen.getByText(/Login with Google/i));
    await waitFor(() => screen.getByText(/Login with GitHub/i));
    expect(history.location.pathname).toBe('/test/test-tag-1');
  });
});
