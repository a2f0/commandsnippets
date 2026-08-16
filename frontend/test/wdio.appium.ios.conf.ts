import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Constants for timeout configuration
const CI_PREPARE_DELAY_MS = 30000; // 30 seconds

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
          log: './logs/appium/appium-ios.log',
        },
        logPath: './logs/appium',
        // Increase startup timeout for slow CI/CD machines
        startupTimeout: 120000, // 2 minutes instead of default 30 seconds
        // Add additional startup parameters
        installTimeout: 180000, // 3 minutes for iOS app installation
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
      'appium:platformVersion':
        process.env['SIMULATOR_PLATFORM_VERSION'] ?? '18.5',
      'appium:deviceName': process.env['SIMULATOR_DEVICE_NAME'] ?? 'iPhone 16',
      'appium:automationName': 'XCUITest',
      // Hosted CI has no visible Simulator window. Without this, Appium
      // restarts an already-booted simulator to try to display its UI.
      'appium:isHeadless': Boolean(process.env['CI']),
      'appium:app': process.env['DERIVED_DATA_PATH']
        ? path.join(
            process.env['DERIVED_DATA_PATH'],
            'Build/Products/Release-iphonesimulator/App.app'
          )
        : path.join(
            process.cwd(),
            'ios/App/build/Build/Products/Release-iphonesimulator/App.app'
          ),
      'appium:bundleId': 'com.tearleads.app.dev',
      'appium:newCommandTimeout': 900,
      'appium:noReset': false,
      'appium:fullReset': false,
      'appium:commandTimeouts': {
        sessionCreation: 900000, // 15 minutes for slow CI/CD
        appLaunch: 900000, // 15 minutes for slow CI/CD
      },
      'appium:wdaStartupRetries': 3, // Reasonable retries
      'appium:wdaStartupRetryInterval': 10000, // 10 second intervals
      // The first WebDriverAgent build on a fresh macOS runner can take
      // several minutes with Xcode 26.
      'appium:wdaLaunchTimeout': 300000,
      // Additional iOS-specific capabilities for CI/CD stability
      'appium:usePrebuiltWDA': false,
      'appium:maxTypingFrequency': 60,
      'appium:clearSystemFiles': true,
      'appium:simpleIsVisibleCheck': true,
      'appium:showXcodeLog': true,
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
  onPrepare: async () => {
    console.log('Preparing Appium iOS environment...');

    // Ensure log directories exist
    const fs = await import('node:fs');
    const path = await import('node:path');
    const logsDir = path.resolve('./logs/appium');
    const screenshotsDir = path.resolve('./logs/screenshots');

    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, {recursive: true});
      console.log('OK: Created logs directory:', logsDir);
    }

    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, {recursive: true});
      console.log('OK: Created screenshots directory:', screenshotsDir);
    }

    // Give CI/CD machines extra time to start services
    if (process.env['CI']) {
      console.log(
        'CI environment detected, waiting extra time for services...'
      );
      console.log('Appium logs will be saved to: ./logs/appium/appium-ios.log');
      await new Promise(resolve => setTimeout(resolve, CI_PREPARE_DELAY_MS)); // CI preparation delay
    }
  },

  beforeSession: () => {
    console.log('Starting Appium iOS session...');
  },

  afterSession: () => {
    console.log('SUCCESS: Appium iOS session completed.');
  },

  afterTest: async (test, _context, {error}) => {
    if (error) {
      await browser.saveScreenshot(
        `./logs/screenshots/error-${test.title}.png`
      );
    }
  },

  // Timeouts - Increased for slow CI/CD machines
  connectionRetryTimeout: 900000, // 15 minutes
  connectionRetryCount: 15, // More retries

  // Logging
  logLevel: 'info',
  bail: 0,
  baseUrl: 'http://localhost:4723',
  waitforTimeout: 30000,
};
