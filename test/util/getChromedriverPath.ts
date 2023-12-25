import {dirname} from 'path';
import {fileURLToPath} from 'url';
import os from 'os';
import path from 'path';

const platform = os.platform();

const currentFileUrl = import.meta.url;
const currentFilePath = fileURLToPath(currentFileUrl);
const currentDirectory = dirname(currentFilePath);

let chromedriverPath: string;
if (platform === 'darwin') {
  chromedriverPath = path.join(
    currentDirectory,
    `../../chromedriver/mac_arm-${process.env.CHROME_VERSION}/chromedriver-mac-arm64/chromedriver`
  );
} else {
  chromedriverPath = path.join(
    currentDirectory,
    `../../chromedriver/linux-${process.env.CHROME_VERSION}/chromedriver-linux64/chromedriver`
  );
}

export {chromedriverPath};
