import type {Tracker} from '@a2f0/ct-client';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

let tracker: Tracker | undefined;
let click: EventListener | undefined;
const send = vi.fn().mockResolvedValue({ok: true});

async function start(
  mode = 'production',
  origin = 'https://app.commandsnippets.com'
) {
  vi.stubEnv('MODE', mode);
  vi.stubGlobal(
    'location',
    new URL(`${origin}/private-user/private-tag?token=secret#private`)
  );
  const {initClickTracking} = await import('../../src/lib/clickTracking');
  tracker = initClickTracking();
  return initClickTracking;
}

function trustedClick(html = '<button>Private snippet text</button>') {
  document.body.innerHTML = html;
  const target = document.body.firstElementChild;
  click?.({
    isTrusted: true,
    composedPath: () => [target, document.body],
  } as unknown as Event);
}

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('PROD', true);
  vi.stubGlobal('fetch', send);
  send.mockClear();
  localStorage.removeItem('ct:opt-out');
  document.documentElement.removeAttribute('data-ct-disabled');
  Object.defineProperty(navigator, 'webdriver', {
    configurable: true,
    value: false,
  });
  Object.defineProperty(navigator, 'doNotTrack', {
    configurable: true,
    value: null,
  });
  Object.defineProperty(navigator, 'globalPrivacyControl', {
    configurable: true,
    value: true,
  });
  const addListener = document.addEventListener.bind(document);
  vi.spyOn(document, 'addEventListener').mockImplementation(
    (type, listener, options) => {
      if (type === 'click') click = listener as EventListener;
      addListener(type, listener, options);
    }
  );
});

afterEach(() => {
  tracker?.destroy();
  tracker = undefined;
  click = undefined;
  localStorage.removeItem('ct:opt-out');
  document.documentElement.removeAttribute('data-ct-disabled');
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('deployed browser app click collection', () => {
  it.each([
    ['production', 'https://app.commandsnippets.com'],
    ['staging', 'https://app-staging.commandsnippets.com'],
  ])(
    'queues %s clicks with GPC override and no private routes',
    async (mode, origin) => {
      const init = await start(mode, origin);
      expect(init()).toBe(tracker);
      trustedClick();
      expect(send).not.toHaveBeenCalled();
      await tracker?.flush();
      expect(send).toHaveBeenCalledTimes(1);
      const [endpoint, request] = send.mock.calls[0] as [string, RequestInit];
      expect(endpoint).toBe('https://ct.a2f0.net/v1/clicks');
      expect(request).toMatchObject({
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
      });
      const body = JSON.parse(String(request.body));
      expect(body).toMatchObject({site: 'commandsnippets', environment: mode});
      expect(body.events).toHaveLength(1);
      expect(body.events[0]).toEqual({
        id: expect.any(String),
        timestamp: expect.any(Number),
        app: 'web-app',
        page: '/',
        target: 'button',
        label: null,
      });
      expect(String(request.body)).not.toMatch(
        /private|secret|snippet text|token/i
      );
    }
  );

  it.each([
    ['development', 'https://app.commandsnippets.com'],
    ['test', 'https://app.commandsnippets.com'],
    ['staging', 'https://app.commandsnippets.com'],
    ['production', 'https://app-staging.commandsnippets.com'],
    ['production', 'http://app.commandsnippets.com'],
    ['production', 'https://app.commandsnippets.com:8443'],
    ['production', 'https://preview.workers.dev'],
    ['production', 'http://localhost:8081'],
  ])('does not initialize for %s/%s', async (mode, origin) => {
    await start(mode, origin);
    expect(tracker).toBeUndefined();
    expect(click).toBeUndefined();
    expect(send).not.toHaveBeenCalled();
  });

  it('imports are inert even on an allowed origin', async () => {
    vi.stubEnv('MODE', 'production');
    vi.stubGlobal('location', new URL('https://app.commandsnippets.com'));
    await import('../../src/lib/clickTracking');
    expect(click).toBeUndefined();
    expect(send).not.toHaveBeenCalled();
  });

  it('non-production builds never initialize', async () => {
    vi.stubEnv('PROD', false);
    await start();
    expect(tracker).toBeUndefined();
    expect(click).toBeUndefined();
    expect(send).not.toHaveBeenCalled();
  });

  it.each(['dnt', 'extension', 'local', 'webdriver'])(
    'still honors %s opt-out',
    async preference => {
      if (preference === 'dnt')
        Object.defineProperty(navigator, 'doNotTrack', {
          configurable: true,
          value: '1',
        });
      if (preference === 'extension')
        document.documentElement.setAttribute('data-ct-disabled', '');
      if (preference === 'local') localStorage.setItem('ct:opt-out', '1');
      if (preference === 'webdriver')
        Object.defineProperty(navigator, 'webdriver', {
          configurable: true,
          value: true,
        });
      await start();
      trustedClick();
      await tracker?.flush();
      expect(send).not.toHaveBeenCalled();
    }
  );

  it('excludes form contents, editable controls and ignored elements', async () => {
    await start();
    for (const html of [
      '<input value="secret">',
      '<textarea>secret</textarea>',
      '<div contenteditable>secret</div>',
      '<button data-ct-ignore>secret</button>',
    ]) {
      trustedClick(html);
    }
    await tracker?.flush();
    expect(send).not.toHaveBeenCalled();
  });

  it('drops pending clicks when the extension opts out', async () => {
    await start();
    trustedClick();
    document.documentElement.setAttribute('data-ct-disabled', '');
    document.dispatchEvent(new Event('ct:opt-out-change'));
    await tracker?.flush();
    expect(send).not.toHaveBeenCalled();
  });
});
