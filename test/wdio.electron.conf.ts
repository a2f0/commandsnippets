import type {Options} from '@wdio/types';
import {config as sharedConfig} from './wdio.shared.conf';

export const config: Options.Testrunner = {
  ...sharedConfig,
  
  // Electron specific capabilities
  capabilities: [
    {
      browserName: 'electron',
      'wdio:electronServiceOptions': {
        // Path to the Electron app (using arm64 build for M1 Macs)
        appBinaryPath: './dist-electron/mac-arm64/Tearleads.app',
        appArgs: ['--no-sandbox', '--disable-gpu'],
      },
    },
  ],
  
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
  before: async function (capabilities, specs) {
    // Add any Electron-specific setup here
    console.log('Starting Electron app test...');
  },
  
  // After test hook
  after: async function (result, capabilities, specs) {
    console.log('Electron app test completed');
  },
};