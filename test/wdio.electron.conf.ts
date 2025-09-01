import {platform} from 'node:os';
import video from 'wdio-video-reporter';

// Determine the correct Electron app path based on platform
function getElectronAppPath(): string {
  const currentPlatform = platform();
  switch (currentPlatform) {
    case 'darwin': {
      // macOS - using arm64 build (most common for development)
      // Point to the actual executable inside the .app bundle
      return './dist-electron/mac-arm64/Tearleads.app/Contents/MacOS/Tearleads';
    }
    case 'win32': {
      return './dist-electron/win-unpacked/Tearleads.exe';
    }
    case 'linux': {
      return './dist-electron/linux-unpacked/tearleads';
    }
    default: {
      throw new Error(`Unsupported platform: ${currentPlatform}`);
    }
  }
}

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
        appBinaryPath: getElectronAppPath(),
        appArgs: ['--no-sandbox', '--disable-gpu'],
      },
    ],
  ],

  logLevel: 'error',
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
