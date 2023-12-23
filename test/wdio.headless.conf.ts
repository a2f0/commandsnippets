import {chromeCapabilities, config as sharedConfig} from './wdio.shared.conf';
import {dirname} from 'path';
import {fileURLToPath} from 'url';
import os from 'os';
import path from 'path';

const currentFileUrl = import.meta.url;
const currentFilePath = fileURLToPath(currentFileUrl);
const currentDirectory = dirname(currentFilePath);

const platform = os.platform();

if (process.env.CHROME_VERSION) {
  console.info(
    '=== using custom chrome path: ' + process.env.CUSTOM_CHROME_PATH
  );
} else {
  console.info('=== not using custom chrome path');
}

let chromePath;
if (platform === 'darwin') {
  chromePath = path.join(
    currentDirectory,
    `../chrome/mac_arm-${process.env.CHROME_VERSION}/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`
  );
} else {
  chromePath = path.join(
    currentDirectory,
    `../chrome/linux-${process.env.CHROME_VERSION}/chrome-linux64/chrome`
  );
}

const headlessChromeCapabilities = {
  ...chromeCapabilities,
  'goog:chromeOptions': {
    ...chromeCapabilities['goog:chromeOptions'],
    binary: chromePath,
    args: [
      ...chromeCapabilities['goog:chromeOptions']['args'],
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
