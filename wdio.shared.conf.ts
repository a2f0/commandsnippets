import {BasePage} from './test/pageobjects/base';
import {defaultState} from './src/lib/shared';

export const config: WebdriverIO.Config = {
  runner: 'local',
  path: '/',
  specs: ['./test/**/*.ts'],
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
  logLevel: 'warn',
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
    requireModule: ['@babel/register'],
  },
  before: async (capabilities, specs, browser) => {
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
  },
};
