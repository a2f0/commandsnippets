import {act, screen, waitFor} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {assignLoggedInCookie} from '../util/assignLoggedInCookie';
import {serveMockApi} from '../util/msw';
import {signIn} from '../util/signIn';
import {renderAppAt} from '../util/TestAppRouter';

serveMockApi();

const robotsTags = () =>
  [...document.head.querySelectorAll('meta[name="robots"]')].map(meta =>
    meta.getAttribute('content')
  );

// Users' public pages stay out of search results; the root, the sign-in
// page, is the app's page to rank. (Production's _headers says the same.)
describe('search indexing', () => {
  it.each(['/test', '/test/test-tag-1'])(
    "keeps a guest's view of %s out of search, and not the sign-in page",
    async url => {
      const {history} = await renderAppAt(url, {act: true});
      expect(await screen.findByText('Read-only: test')).toBeInTheDocument();
      expect(robotsTags()).toEqual(['noindex, nofollow']);
      act(() => history.push('/'));
      expect(await screen.findByText(/Login to Continue/i)).toBeTruthy();
      expect(robotsTags()).toEqual([]);
    }
  );

  it('leaves the sign-in page indexable', async () => {
    await renderAppAt('/', {act: true});
    expect(await screen.findByText(/Login to Continue/i)).toBeTruthy();
    expect(robotsTags()).toEqual([]);
  });

  it("keeps the signed-in user's own page, where the root goes, out of search", async () => {
    signIn();
    assignLoggedInCookie();
    const {history} = await renderAppAt('/', {act: true});
    await waitFor(() => expect(history.location.pathname).toBe('/test'));
    expect(await screen.findByText('test-tag-1')).toBeInTheDocument();
    expect(robotsTags()).toEqual(['noindex, nofollow']);
  });
});
