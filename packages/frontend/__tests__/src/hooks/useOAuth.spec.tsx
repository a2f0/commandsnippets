import {act, render, waitFor} from '@testing-library/react';
import {CookiesProvider} from 'react-cookie';
import {MemoryRouter} from 'react-router-dom';
import {afterEach, describe, expect, it, vi} from 'vitest';

import {useOAuth} from '../../../src/hooks/useOAuth';
import {apiClient} from '../../../src/lib/api/apiClient';
import {LoggedInAppContextProvider} from '../../util/LoggedInAppContextProvider';
import {store} from '../../util/loggedInStore';

const Callback = () => {
  useOAuth({
    provider: 'github',
    clientId: 'client',
    authUrl: 'https://github.com/login/oauth/authorize',
    scope: 'user:email',
  });
  return null;
};

async function completeLogin(isStaff: boolean | undefined) {
  window.history.pushState({}, '', '/oauth/github?code=abc&state=xyz');
  window.sessionStorage.setItem('oauth_state', 'xyz');
  vi.spyOn(apiClient, 'githubLogin').mockResolvedValue(undefined);
  vi.spyOn(apiClient, 'getCurrentUser').mockResolvedValue({
    data: {
      attributes:
        isStaff === undefined
          ? {username: 'dan'}
          : {username: 'dan', is_staff: isStaff},
    },
  });
  vi.spyOn(console, 'info').mockImplementation(() => {});
  await act(async () => {
    render(
      <MemoryRouter>
        <LoggedInAppContextProvider>
          <CookiesProvider>
            <Callback />
          </CookiesProvider>
        </LoggedInAppContextProvider>
      </MemoryRouter>
    );
  });
  await waitFor(() => expect(store.loggedInUser).toBe('dan'));
}

describe('useOAuth', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    act(() => {
      store.setLoggedInUser('test');
      store.setIsStaff(false);
    });
  });

  it('records whether the user who logged in is staff', async () => {
    await completeLogin(true);
    expect(store.isStaff).toBe(true);
  });

  it('clears the flag for users who are not, or when the API omits it', async () => {
    act(() => store.setIsStaff(true));
    await completeLogin(false);
    expect(store.isStaff).toBe(false);

    act(() => store.setIsStaff(true));
    await completeLogin(undefined);
    expect(store.isStaff).toBe(false);
  });
});
