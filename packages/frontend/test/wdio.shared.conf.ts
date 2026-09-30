import type {Capabilities} from '@wdio/types';
import video from 'wdio-video-reporter';

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
      getMSWRequestCount: (
        method:
          | 'GET'
          | 'POST'
          | 'PUT'
          | 'PATCH'
          | 'DELETE'
          | 'OPTIONS'
          | 'HEAD',
        url: string
      ) => Promise<number>;
      resetMSWRequestCounts: () => Promise<void>;
      toBeRequestedTimes: (
        method:
          | 'GET'
          | 'POST'
          | 'PUT'
          | 'PATCH'
          | 'DELETE'
          | 'OPTIONS'
          | 'HEAD',
        url: string,
        expected: number
      ) => Promise<void>;
      toBeRequestedAtLeastTimes: (
        method:
          | 'GET'
          | 'POST'
          | 'PUT'
          | 'PATCH'
          | 'DELETE'
          | 'OPTIONS'
          | 'HEAD',
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

    // Add helper to fetch request count for a method+url
    browser.addCommand(
      'getMSWRequestCount',
      async (
        method:
          | 'GET'
          | 'POST'
          | 'PUT'
          | 'PATCH'
          | 'DELETE'
          | 'OPTIONS'
          | 'HEAD',
        url: string
      ) => {
        const count = await browser.execute(
          (m: typeof method, u: string) => {
            if (window.__MSW_REQUESTS__) {
              return window.__MSW_REQUESTS__.getCount(m, u);
            }
            return -1;
          },
          method,
          url
        );
        return count as number;
      }
    );

    // Assert helper for at-least semantics
    browser.addCommand(
      'toBeRequestedAtLeastTimes',
      async (
        method:
          | 'GET'
          | 'POST'
          | 'PUT'
          | 'PATCH'
          | 'DELETE'
          | 'OPTIONS'
          | 'HEAD',
        url: string,
        minExpected: number
      ) => {
        const result = await browser.execute(
          (m: typeof method, u: string) => {
            const count = window.__MSW_REQUESTS__?.getCount?.(m, u) ?? -1;
            const all = window.__MSW_REQUESTS__?.getAll?.() ?? [];
            return {count, all};
          },
          method,
          url
        );
        if (result.count < minExpected) {
          throw new Error(
            `Expected ${method} ${url} to be requested at least ${minExpected} times, but was ${result.count}. All counts: ${JSON.stringify(
              result.all
            )}`
          );
        }
      }
    );

    // Add helper to reset only request counters
    browser.addCommand('resetMSWRequestCounts', async () => {
      await browser.execute(() => {
        if (window.__MSW_REQUESTS__) {
          window.__MSW_REQUESTS__.reset();
        }
      });
    });

    // Assert helper similar to base branch usage
    browser.addCommand(
      'toBeRequestedTimes',
      async (
        method:
          | 'GET'
          | 'POST'
          | 'PUT'
          | 'PATCH'
          | 'DELETE'
          | 'OPTIONS'
          | 'HEAD',
        url: string,
        expected: number
      ) => {
        const result = await browser.execute(
          (m: typeof method, u: string) => {
            const count = window.__MSW_REQUESTS__?.getCount?.(m, u) ?? -1;
            const all = window.__MSW_REQUESTS__?.getAll?.() ?? [];
            return {count, all};
          },
          method,
          url
        );
        if (result.count !== expected) {
          throw new Error(
            `Expected ${method} ${url} to be requested ${expected} times, but was ${result.count}. All counts: ${JSON.stringify(
              result.all
            )}`
          );
        }
      }
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
  afterTest: async () => {
    await browser.mockRestoreAll();
  },
};
