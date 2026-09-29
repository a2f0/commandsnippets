import {inspect} from 'node:util';

import {act, render, waitFor} from '@testing-library/react';
import {CookiesProvider} from 'react-cookie';
import {MemoryRouter} from 'react-router-dom';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {useOAuth} from '../../../src/hooks/useOAuth';
import {apiClient} from '../../../src/lib/api/apiClient';
import {signIn, store} from '../../util/signIn';

// The authorization code is a credential until it is exchanged: it must never
// be written to the console.
const code = 'oauth-code-4f9c2e7a';

const GithubCallback = () => {
  useOAuth({
    provider: 'github',
    clientId: 'client',
    authUrl: 'https://github.com/login/oauth/authorize',
    scope: 'user:email',
  });
  return null;
};

const GoogleCallback = () => {
  useOAuth({
    provider: 'google',
    clientId: 'client',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    scope: 'https://www.googleapis.com/auth/userinfo.email',
  });
  return null;
};

/**
 * Silence every console method and return a function that renders all the
 * arguments they were called with (errors with their message, stack and
 * cause) as one string.
 */
function captureConsole(): () => string {
  const spies = [
    vi.spyOn(console, 'debug'),
    vi.spyOn(console, 'error'),
    vi.spyOn(console, 'info'),
    vi.spyOn(console, 'log'),
    vi.spyOn(console, 'trace'),
    vi.spyOn(console, 'warn'),
  ];
  for (const spy of spies) {
    spy.mockImplementation(() => {});
  }
  const dirSpy = vi.spyOn(console, 'dir').mockImplementation(() => {});
  const tableSpy = vi.spyOn(console, 'table').mockImplementation(() => {});
  return () =>
    [...spies, dirSpy, tableSpy]
      .flatMap(spy => spy.mock.calls.flat())
      .map(arg => (typeof arg === 'string' ? arg : inspect(arg, {depth: null})))
      .join('\n');
}

function openCallback(provider: 'github' | 'google', query: string) {
  window.history.pushState({}, '', `/oauth/${provider}?${query}`);
  window.sessionStorage.setItem('oauth_state', 'xyz');
}

async function renderCallback(Callback: () => null) {
  await act(async () => {
    render(
      <MemoryRouter>
        <CookiesProvider>
          <Callback />
        </CookiesProvider>
      </MemoryRouter>
    );
  });
}

async function completeLogin(isStaff: boolean) {
  openCallback('github', `code=${code}&state=xyz`);
  vi.spyOn(apiClient, 'githubLogin').mockResolvedValue(undefined);
  vi.spyOn(apiClient, 'getCurrentUser').mockResolvedValue({
    data: {
      type: 'User',
      id: '1',
      attributes: {
        username: 'dan',
        is_staff: isStaff,
        date_updated: '2026-09-01T00:00:00',
      },
    },
  });
  await renderCallback(GithubCallback);
  await waitFor(() => expect(store.loggedInUser).toBe('dan'));
}

describe('useOAuth', () => {
  let consoleOutput: () => string;

  beforeEach(() => {
    signIn();
    consoleOutput = captureConsole();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('records whether the user who logged in is staff', async () => {
    await completeLogin(true);
    expect(store.isStaff).toBe(true);
  });

  it('clears the flag for users who are not', async () => {
    act(() => store.setIsStaff(true));
    await completeLogin(false);
    expect(store.isStaff).toBe(false);
  });

  it('keeps the authorization code out of the console on a login', async () => {
    await completeLogin(false);

    expect(apiClient.githubLogin).toHaveBeenCalledWith(code);
    expect(consoleOutput()).not.toContain(code);
  });

  it('keeps the authorization code out of the console when the login fails', async () => {
    openCallback(
      'google',
      `code=${code}&scope=${encodeURIComponent('email profile')}&state=xyz`
    );
    // The real client, so the error it logs is the one users would see.
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({errors: []}), {
        status: 401,
        statusText: 'Unauthorized',
      })
    );

    await renderCallback(GoogleCallback);
    await waitFor(() => expect(store.loggedInUser).toBeNull());

    expect(String(fetchSpy.mock.calls[0]?.[1]?.body)).toContain(code);
    // The failure is still logged, without the code.
    const output = consoleOutput();
    expect(output).toContain('google authentication error:');
    expect(output).toContain('Google login failed: Unauthorized');
    expect(output).not.toContain(code);
  });
});
