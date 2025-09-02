import path from 'node:path';
import {fileURLToPath} from 'node:url';

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
        },
        logPath: './logs',
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
      'appium:platformVersion': '17.0',
      'appium:deviceName': 'iPhone 15',
      'appium:automationName': 'XCUITest',
      'appium:app': path.join(
        process.cwd(),
        'ios/App/build/Build/Products/Release-iphonesimulator/App.app'
      ),
      'appium:bundleId': 'com.tearleads.app',
      'appium:newCommandTimeout': 900,
      'appium:noReset': false,
      'appium:fullReset': false,
      'appium:commandTimeouts': {
        sessionCreation: 600000, // 10 minutes for slow CI/CD
        appLaunch: 600000, // 10 minutes for slow CI/CD
        implicit: 120000, // 2 minutes
      },
      'appium:wdaStartupRetries': 5, // More retries
      'appium:wdaStartupRetryInterval': 30000, // 30 second intervals
      // Additional iOS-specific capabilities for CI/CD stability
      'appium:usePrebuiltWDA': false,
      'appium:derivedDataPath': './ios/DerivedData',
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
    console.log('🚀 Preparing Appium iOS environment...');
    // Give CI/CD machines extra time to start services
    if (process.env['CI']) {
      console.log(
        '🔄 CI environment detected, waiting extra time for services...'
      );
      await new Promise(resolve => setTimeout(resolve, 30000)); // 30 second delay in CI
    }
  },

  beforeSession: () => {
    console.log('📱 Starting Appium iOS session...');
  },

  afterSession: () => {
    console.log('✅ Appium iOS session completed.');
  },

  afterTest: async (test, _context, {error}) => {
    if (error) {
      await browser.saveScreenshot(
        `./logs/screenshots/error-${test.title}.png`
      );
    }
  },

  // Timeouts - Increased for slow CI/CD machines
  connectionRetryTimeout: 600000, // 10 minutes
  connectionRetryCount: 10, // More retries

  // Logging
  logLevel: 'info',
  bail: 0,
  baseUrl: 'http://localhost:4723',
  waitforTimeout: 30000,
};
