import {platform} from 'node:os';
import {config as sharedConfig} from './wdio.shared.conf';

type ElectronCapabilities = {
  browserName: string;
  'wdio:electronServiceOptions': {
    appBinaryPath: string;
    appArgs: string[];
  };
};

// Determine the correct Electron app path based on platform
function getElectronAppPath(): string {
  const currentPlatform = platform();
  switch (currentPlatform) {
    case 'darwin': {
      // macOS - using arm64 build (most common for development)
      return './dist-electron/mac-arm64/Tearleads.app';
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

const electronCapabilities: ElectronCapabilities[] = [
  {
    browserName: 'electron',
    'wdio:electronServiceOptions': {
      appBinaryPath: getElectronAppPath(),
      appArgs: ['--no-sandbox', '--disable-gpu'],
    },
  },
];

export const config: WebdriverIO.Config = {
  ...sharedConfig,
  capabilities: electronCapabilities,

  // Services for Electron
  services: [
    [
      'electron',
      {
        appBinaryPath: './dist-electron/mac-arm64/Tearleads.app',
        appArgs: ['--no-sandbox', '--disable-gpu'],
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
