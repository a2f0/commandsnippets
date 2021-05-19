
import { config as sharedConfig } from './wdio.shared.conf'

export const config = {
  ...sharedConfig,
  ...{
    capabilities: [{
      browserName: 'chrome',
      'wdio:devtoolsOptions': {
        ignoreDefaultArgs: true,
        ignoreDefaultArgs: ['--disable-sync', '--disable-extensions'],
      },
      'goog:chromeOptions': {
        args: ['--headless', '--disable-gpu', '--disable-features=NetworkService', "--no-sandbox", "--disable-dev-shm-usage"],
      }
    }]
  }
}
