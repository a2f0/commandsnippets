import path from 'node:path';
import {browser} from '@wdio/globals';

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
        },
        logPath: './logs',
      },
    ],
  ],

  // Test runner configuration
  runner: 'local',
  maxInstances: 1,

  // Capabilities for Android Emulator
  capabilities: [
    {
      platformName: 'Android',
      'appium:platformVersion': '14', // Android 14 (API 34)
      'appium:deviceName': 'emulator-5554',
      'appium:automationName': 'UiAutomator2',
      'appium:app': path.resolve(
        process.cwd(),
        'android/app/build/outputs/apk/debug/app-debug.apk'
      ),
      'appium:appPackage': 'com.tearleads.app',
      'appium:appActivity': 'com.tearleads.app.MainActivity',
      'appium:newCommandTimeout': 300,
      'appium:noReset': false,
      'appium:fullReset': false,
      'appium:autoGrantPermissions': true,
    },
  ],

  // Test files
  specs: [
    path.resolve(process.cwd(), 'test/appium/android/app-launch.spec.ts'),
  ],

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
    console.log('Starting Appium Android session...');
  },

  afterSession: () => {
    console.log('Appium Android session completed.');
  },

  afterTest: async (test, _context, {error}) => {
    if (error) {
      await browser.saveScreenshot(
        `./logs/screenshots/error-${test.title}.png`
      );
    }
  },

  // Timeouts
  connectionRetryTimeout: 90000,
  connectionRetryCount: 3,

  // Logging
  logLevel: 'info',
  bail: 0,
  baseUrl: 'http://localhost:4723',
  waitforTimeout: 10000,
};
