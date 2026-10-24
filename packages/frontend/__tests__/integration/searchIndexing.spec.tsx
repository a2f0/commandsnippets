import {act, render, screen, waitFor} from '@testing-library/react';
import {createMemoryHistory} from 'history';
import {afterAll, afterEach, beforeAll, describe, expect, it} from 'vitest';
import {assignLoggedInCookie} from '../util/assignLoggedInCookie';
import {server} from '../util/msw';
import {signIn} from '../util/signIn';
import {TestAppRouter} from '../util/TestAppRouter';

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const robotsTags = () =>
  [...document.head.querySelectorAll('meta[name="robots"]')].map(meta =>
    meta.getAttribute('content')
  );

const mount = async (url: string) => {
  const history = createMemoryHistory();
  history.push(url);
  await act(async () => {
    render(<TestAppRouter history={history} />);
  });
  return history;
};

// Users' public pages stay out of search results; the root, the sign-in
// page, is the app's page to rank. (Production's _headers says the same.)
describe('search indexing', () => {
  it.each(['/test', '/test/test-tag-1'])(
    "keeps a guest's view of %s out of search, and not the sign-in page",
    async url => {
      const history = await mount(url);
      expect(await screen.findByText('Read-only: test')).toBeInTheDocument();
      expect(robotsTags()).toEqual(['noindex, nofollow']);
      act(() => history.push('/'));
      expect(await screen.findByText(/Login to Continue/i)).toBeTruthy();
      expect(robotsTags()).toEqual([]);
    }
  );

  it('leaves the sign-in page indexable', async () => {
    await mount('/');
    expect(await screen.findByText(/Login to Continue/i)).toBeTruthy();
    expect(robotsTags()).toEqual([]);
  });

  it("keeps the signed-in user's own page, where the root goes, out of search", async () => {
    signIn();
    assignLoggedInCookie();
    const history = await mount('/');
    await waitFor(() => expect(history.location.pathname).toBe('/test'));
    expect(await screen.findByText('test-tag-1')).toBeInTheDocument();
    expect(robotsTags()).toEqual(['noindex, nofollow']);
  });
});
