import {config as sharedConfig} from './wdio.shared.conf';

export const config: WebdriverIO.Config = {
  ...sharedConfig,
  ...{
    capabilities: [
      {
        browserName: 'chrome',
        'goog:chromeOptions': {
          args: [
            '--headless',
            '--disable-gpu',
            '--disable-features=NetworkService',
            '--disable-web-security',
            '--no-sandbox',
            '--disable-dev-shm-usage',
          ],
        },
      },
    ],
  },
};
