import '@testing-library/jest-dom';

import {
  render,
  screen,
  waitForElementToBeRemoved,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {createMemoryHistory} from 'history';
import React from 'react';
import {describe, expect, it, vi} from 'vitest';

import {assignLoggedInCookie} from '../../util/assignLoggedInCookie';
import {server} from '../../util/msw';
import {TestAppRouter} from '../../util/TestAppRouter';

Element.prototype.scrollIntoView = vi.fn();

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
beforeEach(() => assignLoggedInCookie());

describe('Help Menu', () => {
  it('Is clickable', async () => {
    const user = userEvent.setup();
    const history = createMemoryHistory();
    const route = '/test/test';
    history.push(route);
    render(<TestAppRouter history={history} />);
    const helpMenu = screen.getByRole('menu', {name: 'Help'});
    await user.pointer({target: helpMenu, keys: '[MouseLeft]'});
    const about = screen.getByText('About');
    await user.pointer({target: about, keys: '[MouseLeft]'});
    const dialogTitle = screen.getByText('About Tearleads');
    expect(dialogTitle).toBeVisible();
    const dismiss = screen.getByText('Dismiss');
    await user.pointer({target: dismiss, keys: '[MouseLeft]'});
    await waitForElementToBeRemoved(() => screen.getByText('Dismiss'));
  });
});
