import path from 'path';
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const config: WebdriverIO.Config = {
  // Appium server configuration
  services: [
    [
      'appium',
      {
        // Will start appium automatically
        command: 'appium',
        args: {
          address: '127.0.0.1',
          port: 4723,
          relaxedSecurity: true,
          log: './appium.log',
          'log-level': 'debug',
          'local-timezone': true,
        },
        logPath: './logs',
      },
    ],
  ],

  // Test runner configuration
  runner: 'local',
  maxInstances: 1,

  // Capabilities for iOS Simulator
  capabilities: [
    {
      platformName: 'iOS',
      'appium:platformVersion': '18.5',
      'appium:deviceName': 'iPhone 16',
      'appium:automationName': 'XCUITest',
      'appium:app': path.join(
        process.cwd(),
        'ios/App/build/Build/Products/Release-iphonesimulator/App.app'
      ),
      'appium:bundleId': 'com.tearleads.app',
      'appium:newCommandTimeout': 1200,
      'appium:noReset': false,
      'appium:fullReset': false,
      'appium:commandTimeouts': {
        sessionCreation: 600000,
        appLaunch: 600000,
      },
      'appium:wdaStartupRetries': 3,
      'appium:wdaStartupRetryInterval': 20000,
    },
  ],

  // Test files
  specs: [path.join(__dirname, 'appium/ios/**/*.spec.ts')],

  // Exclude patterns
  exclude: [],

  // Test framework
  framework: 'mocha',
  mochaOpts: {
    ui: 'bdd',
    timeout: 120000,
  },

  // Reporters
  reporters: [
    'spec',
    [
      'dot',
      {
        outputDir: './logs/appium',
      },
    ],
  ],

  // Hooks
  beforeSession: () => {
    console.log('Starting Appium iOS session...');
  },

  afterSession: () => {
    console.log('Appium iOS session completed.');
  },

  afterTest: async (test, _context, {error}) => {
    if (error) {
      await browser.saveScreenshot(
        `./logs/screenshots/error-${test.title}.png`
      );
    }
  },

  // Timeouts
  connectionRetryTimeout: 600000,
  connectionRetryCount: 3,

  // Logging
  logLevel: 'debug',
  bail: 0,
  baseUrl: 'http://localhost:4723',
  waitforTimeout: 10000,
};
