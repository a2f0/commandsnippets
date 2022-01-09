import {config as sharedConfig} from './wdio.shared.conf';

export const config: WebdriverIO.Config = {
  ...sharedConfig,
  ...{
    capabilities: [
      {
        browserName: 'chrome',
        'goog:chromeOptions': {
          // This path is hardcoded to the determinstic path configured by
          // setup-chrome inside of Github actions. It can be commented out
          // to use the default. See .github/workflows/main.yml
          binary: '/tmp/custom-chrome/chrome',
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
