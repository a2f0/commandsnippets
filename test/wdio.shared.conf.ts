import type {
  RequestedMultiremoteCapabilities,
  RequestedStandaloneCapabilities,
} from '@wdio/types/build/Capabilities';
import video from 'wdio-video-reporter';

import {defaultState} from '../src/lib/shared';

interface LogEntry {
  type: 'console' | 'javascript';
  level: 'debug' | 'info' | 'warn' | 'error';
  text: string;
  timestamp: number;
  stackTrace?: {
    url: string;
    realm: string;
    function?: string;
    line: number;
    column: number;
  };
  args?: Array<{
    type: string;
    value: string;
  }>;
  method?: string;
}

/* eslint-disable @typescript-eslint/no-namespace */
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
      logout: () => Promise<void>;
      login: () => Promise<void>;
      openDevTools: () => Promise<void>;
      waitForMSW: () => Promise<void>;
      resetMSWHandlers: () => Promise<void>;
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
  maxInstances: 1,
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
      | RequestedStandaloneCapabilities
      | RequestedMultiremoteCapabilities,
    _specs: string[],
    // biome-ignore lint: suspicious/noExplicitAny
    browser: any
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
        }
      });
    });

    browser.addCommand('logout', async () => {
      await browser.execute(
        function (this: typeof browser, key: string, value: string) {
          this.localStorage.setItem(key, value);
        },
        'LoggedIn',
        'None'
      );
    });
    browser.on('log.entryAdded', (logEntry: LogEntry) => {
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
      const appState = {
        ...defaultState,
        loggedInUser: 'test',
      };
      await browser.execute(
        function (this: typeof browser, key: string, value: string) {
          this.localStorage.setItem(key, value);
        },
        'mst-tearleads-test',
        JSON.stringify(appState)
      );
      await browser.setCookies({
        name: 'LoggedIn',
        value: 'None',
      });
    });

    browser.addCommand('openDevTools', async () => {
      await browser.execute(() => {
        // Try to open DevTools via keyboard shortcut
        const event = new KeyboardEvent('keydown', {
          key: 'F12',
          code: 'F12',
          keyCode: 123,
          which: 123,
          ctrlKey: false,
          shiftKey: false,
          metaKey: false,
          bubbles: true,
        });
        document.dispatchEvent(event);
      });
    });
  },
  afterTest: async () => {
    await browser.mockRestoreAll();
  },
};
