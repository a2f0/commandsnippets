import video from 'wdio-video-reporter';
import {getElectronAppExecutablePath} from './util/electronTestUtils';

// Electron capabilities must not inherit Chrome options
const electronCapabilities: WebdriverIO.Capabilities[] = [
  {
    browserName: 'electron',
  },
];

export const config: WebdriverIO.Config = {
  // Minimal config for Electron without inheriting problematic Chrome settings
  runner: 'local',
  capabilities: electronCapabilities,

  // Services for Electron
  services: [
    [
      'electron',
      {
        appBinaryPath: getElectronAppExecutablePath(),
        appArgs: ['--no-sandbox', '--disable-gpu'],
      },
    ],
  ],

  logLevel: 'error',
  bail: 1,
  framework: 'mocha',
  reporters: [
    'dot',
    'spec',
    [
      video,
      {
        saveAllVideos: false,
        videoSlowdownMultiplier: 3,
        videoRenderTimeout: 30000,
      },
    ],
  ],
  mochaOpts: {
    bail: true,
    ui: 'bdd',
    timeout: 60000,
  },

  // Override specs to use electron specific tests
  specs: ['specs/electron/**/*.spec.ts'],

  // Electron specific timeout
  waitforTimeout: 30000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,

  // Before test hook for Electron
  before: async () => {
    // Add any Electron-specific setup here
    console.log('Starting Electron app test...');
  },

  // After test hook
  after: async () => {
    console.log('Electron app test completed');
  },
};
