import video from 'wdio-video-reporter';

import {defaultState} from '../src/lib/shared';
import {BasePage} from './pageobjects/base';
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
      waitAndRightClick: (this: WebdriverIO.Element) => Promise<void>;
      waitAndLeftClick: (this: WebdriverIO.Element) => Promise<void>;
    }
    interface Browser {
      currentTestErrors: LogEntry[];
    }
  }
}

export const chromeCapabilities: WebdriverIO.Capabilities = {
  browserName: 'chrome',
  'goog:chromeOptions': {
    args: ['--disable-web-security'],
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  before: async (capabilities: typeof browser, specs, browser: any) => {
    // Initialize currentTestErrors as a property of the browser object
    browser.currentTestErrors = [];

    await browser.sessionSubscribe({events: ['log.entryAdded']});

    browser.on('log.entryAdded', (logEntry: LogEntry) => {
      if (logEntry.level === 'error') {
        browser.currentTestErrors.push(logEntry);
      }
    });

    await BasePage.open('');
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
  },
};
