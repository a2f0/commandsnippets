import {BasePage} from './pageobjects/base';
import {defaultState} from '../src/lib/shared';

/* eslint-disable @typescript-eslint/no-namespace */
declare global {
  namespace WebdriverIO {
    interface Element {
      waitAndRightClick: (this: WebdriverIO.Element) => Promise<void>;
      waitAndLeftClick: (this: WebdriverIO.Element) => Promise<void>;
    }
  }
}

export const config: WebdriverIO.Config = {
  runner: 'local',
  path: '/',
  specs: ['specs/**/*.spec.ts'],
  exclude: [],
  maxInstances: 1,
  capabilities: [
    {
      maxInstances: 1,
      browserName: 'chrome',
      'goog:chromeOptions': {
        args: ['--disable-web-security', '--auto-open-devtools-for-tabs'],
      },
    },
  ],
  logLevel: 'debug',
  // Stop running tests after initial failure.
  bail: 1,
  baseUrl: 'http://localhost:8081',
  waitforTimeout: 5000,
  connectionRetryTimeout: 90000,
  connectionRetryCount: 3,
  services: ['chromedriver'],
  framework: 'mocha',
  reporters: ['dot', 'spec'],
  mochaOpts: {
    bail: true,
    ui: 'bdd',
    timeout: 60000,
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  before: async (capabilities: typeof browser, specs, browser: any) => {
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
        await this.waitForDisplayed();
        await this.click({button: 'right'});
      },
      true
    );
    browser.addCommand(
      'waitAndLeftClick',
      async function (this: WebdriverIO.Element) {
        await this.waitForDisplayed();
        await this.click();
      },
      true
    );
  },
};
