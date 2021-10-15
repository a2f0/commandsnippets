import {BasePage} from './test/pageobjects/base';

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
  logLevel: 'info',
  bail: 0,
  baseUrl: 'http://localhost:8081',
  waitforTimeout: 60000,
  connectionRetryTimeout: 90000,
  connectionRetryCount: 3,
  services: ['chromedriver'],
  framework: 'mocha',
  reporters: ['dot', 'spec'],
  mochaOpts: {
    ui: 'bdd',
    timeout: 60000,
    requireModule: ['@babel/register'],
  },
  before: async (capabilities, specs, browser) => {
    const defaultState = {
      loggedInUser: 'test',
      selectedTheme: 'darkTheme',
      tagSortOrder: 'order',
      entrySortOrder: 'order',
      mainPanel: 'EntryList',
      tagNew: false,
      tagSearch: false,
      mostRecentCopyType: null,
      mostRecentCopyID: null,
    };
    await BasePage.open('');
    await browser.execute(
      function (this: typeof browser, key: string, value: string) {
        this.localStorage.setItem(key, value);
      },
      'mst-tearleads-test',
      JSON.stringify(defaultState)
    );
  },
};
