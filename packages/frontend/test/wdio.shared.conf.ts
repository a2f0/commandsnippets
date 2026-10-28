import type {Capabilities} from '@wdio/types';
import video from 'wdio-video-reporter';
import type {HttpMethod} from '../src/msw/requestCounter';

// Define LogEntry type to match webdriver's actual type
type LogEntry = {
  level: string;
  text: string | null;
  type: string;
  timestamp: number;
  source?: unknown;
  stackTrace?: unknown;
};

declare global {
  namespace WebdriverIO {
    interface Element {
      waitAndRightClick: (
        this: ReturnType<WebdriverIO.Browser['$']>
      ) => Promise<void>;
      waitAndLeftClick: (
        this: ReturnType<WebdriverIO.Browser['$']>
      ) => Promise<void>;
    }
    interface Browser {
      currentTestErrors: LogEntry[];
      login: () => Promise<void>;
      waitForMSW: () => Promise<void>;
      resetMSWHandlers: () => Promise<void>;
      getMSWRequestCount: (method: HttpMethod, url: string) => Promise<number>;
      resetMSWRequestCounts: () => Promise<void>;
      toBeRequestedTimes: (
        method: HttpMethod,
        url: string,
        expected: number
      ) => Promise<void>;
      toBeRequestedAtLeastTimes: (
        method: HttpMethod,
        url: string,
        minExpected: number
      ) => Promise<void>;
    }
  }
}

export const chromeCapabilities: WebdriverIO.Capabilities = {
  browserName: 'chrome',
  'goog:chromeOptions': {
    args: [
      '--disable-web-security',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
    ],
    prefs: {
      'devtools.preferences.currentDockState': '"undocked"',
      'devtools.preferences.panel-selectedTab': '"network"',
    },
  },
};

export const config: WebdriverIO.Config = {
  runner: 'local',
  path: '/',
  specs: ['specs/**/*.spec.ts'],
  exclude: [],
  maxInstances: 2,
  capabilities: [chromeCapabilities],
  logLevel: 'error',
  // Stop running tests after initial failure.
  bail: 1,
  baseUrl: 'http://localhost:8081',
  waitforTimeout: 5000,
  connectionRetryTimeout: 90000,
  connectionRetryCount: 3,
  framework: 'mocha',
  reporters: [
    'dot',
    'spec',
    [
      video,
      {
        saveAllVideos: false,
        videoSlowdownMultiplier: 3,
        videoRenderTimeout: 30000,
      },
    ],
  ],
  mochaOpts: {
    bail: true,
    ui: 'bdd',
    timeout: 60000,
  },

  before: async (
    _capabilities:
      | Capabilities.RequestedStandaloneCapabilities
      | Capabilities.RequestedMultiremoteCapabilities,
    _specs: string[],
    browser
  ) => {
    // Initialize currentTestErrors as a property of the browser object
    browser.currentTestErrors = [];

    await browser.sessionSubscribe({events: ['log.entryAdded']});

    // Add helper command to wait for MSW to be ready
    browser.addCommand('waitForMSW', async () => {
      await browser.waitUntil(
        async () => {
          const mswReady = await browser.execute(() => {
            // Check if MSW worker is available
            const hasMSWWorker = !!window.__MSW_WORKER__;
            // Check if service worker is controlling the page
            const hasServiceWorker = !!navigator.serviceWorker?.controller;
            // Check if page content is loaded
            const pageLoaded =
              document.body.textContent && document.body.textContent.length > 0;
            return hasMSWWorker && hasServiceWorker && pageLoaded;
          });
          return mswReady;
        },
        {
          timeout: 10000,
          timeoutMsg: 'MSW not ready within 10 seconds',
        }
      );
    });

    // Add helper command to reset MSW handlers between tests
    browser.addCommand('resetMSWHandlers', async () => {
      await browser.execute(() => {
        if (window.__MSW_WORKER__) {
          window.__MSW_WORKER__.resetHandlers();
          // Reset stateful MSW data
          if (window.resetMSWState) {
            window.resetMSWState();
          }
          // Reset request counters
          if (window.__MSW_REQUESTS__) {
            window.__MSW_REQUESTS__.reset();
          }
        }
      });
    });

    // The requests the page has made, as the mock API counted them.
    const requests = (method: HttpMethod, url: string) =>
      browser.execute(
        (m: HttpMethod, u: string) => ({
          count: window.__MSW_REQUESTS__?.getCount(m, u) ?? -1,
          all: window.__MSW_REQUESTS__?.getAll() ?? [],
        }),
        method,
        url
      );

    /**
     * Wait until `method url` has been requested `expected` times, then (if
     * `exactly`) check it has not been requested more: a page makes its
     * requests as it syncs, after it renders, so a count read at once can
     * come before them.
     */
    const expectRequested = async (
      method: HttpMethod,
      url: string,
      expected: number,
      exactly: boolean
    ) => {
      let result = await requests(method, url);
      const failure = () =>
        `Expected ${method} ${url} to be requested ${exactly ? '' : 'at least '}${expected} times, but was ${result.count}. All counts: ${JSON.stringify(
          result.all
        )}`;
      await browser.waitUntil(
        async () => {
          result = await requests(method, url);
          return result.count >= expected;
        },
        {timeoutMsg: failure}
      );
      if (exactly && result.count !== expected) {
        throw new Error(failure());
      }
    };

    browser.addCommand(
      'getMSWRequestCount',
      async (method: HttpMethod, url: string) =>
        (await requests(method, url)).count
    );

    browser.addCommand(
      'toBeRequestedAtLeastTimes',
      (method: HttpMethod, url: string, minExpected: number) =>
        expectRequested(method, url, minExpected, false)
    );

    // Add helper to reset only request counters
    browser.addCommand('resetMSWRequestCounts', async () => {
      await browser.execute(() => {
        if (window.__MSW_REQUESTS__) {
          window.__MSW_REQUESTS__.reset();
        }
      });
    });

    browser.addCommand(
      'toBeRequestedTimes',
      (method: HttpMethod, url: string, expected: number) =>
        expectRequested(method, url, expected, true)
    );

    // Create a properly typed wrapper for the log event handler
    function addLogEntryHandler(
      browser: WebdriverIO.Browser,
      handler: (logEntry: LogEntry) => void
    ) {
      browser.on('log.entryAdded', handler);
    }

    addLogEntryHandler(browser, logEntry => {
      if (logEntry.level === 'error') {
        console.info(JSON.stringify(logEntry, null, '  '));
        browser.currentTestErrors.push(logEntry);
      }
    });
    browser.addCommand(
      'waitAndRightClick',
      async function (this: WebdriverIO.Element) {
        await this.waitForClickable();
        await this.click({button: 'right'});
      },
      true
    );
    browser.addCommand(
      'waitAndLeftClick',
      async function (this: WebdriverIO.Element) {
        await this.waitForClickable();
        await this.click();
      },
      true
    );
    browser.addCommand('login', async () => {
      // The app's saved state (src/lib/state/appState.ts: zustand's persist
      // format, merged over the defaults): the test user signed in.
      const saved = {state: {loggedInUser: 'test'}, version: 0};
      await browser.execute(
        (key: string, value: string) => {
          window.localStorage.setItem(key, value);
        },
        'commandsnippets-test',
        JSON.stringify(saved)
      );
      await browser.setCookies({
        name: 'LoggedIn',
        value: 'None',
      });
    });
  },
  // Each test starts with the mock API's data, handlers and counts reset,
  // and counts the errors logged from the end of the last test on.
  afterTest: async () => {
    await browser.resetMSWHandlers();
    browser.currentTestErrors.length = 0;
  },
};
