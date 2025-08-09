import {chromeCapabilities, config as sharedConfig} from './wdio.shared.conf';

const headlessChromeCapabilities: WebdriverIO.Capabilities = {
  ...chromeCapabilities,
  'goog:chromeOptions': {
    ...chromeCapabilities['goog:chromeOptions'],
    args: [
      ...(chromeCapabilities['goog:chromeOptions']?.args || []),
      '--headless',
      '--disable-gpu',
      '--disable-features=NetworkService',
      '--no-sandbox',
      '--disable-dev-shm-usage',
    ],
  },
};

export const config: WebdriverIO.Config = {
  ...sharedConfig,
  ...{
    capabilities: [headlessChromeCapabilities],
  },
};
