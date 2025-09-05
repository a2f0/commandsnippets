import {Capacitor} from '@capacitor/core';

let environment: string;

const {hostname, port} = window.location;

// Check if running in Electron
const isElectron = (): boolean => {
  return (
    typeof window !== 'undefined' &&
    window.electron !== undefined &&
    window.electron.process?.versions?.electron !== undefined
  );
};

if (isElectron()) {
  // For Electron apps, determine environment based on Vite mode
  const viteMode = import.meta.env.MODE;

  switch (viteMode) {
    case 'staging':
      environment = 'staging';
      break;
    case 'production':
      environment = 'production';
      break;
    case 'development':
    default:
      environment = 'development';
      break;
  }
} else if (Capacitor.isNativePlatform()) {
  // For Capacitor apps, determine environment based on build mode
  const viteEnv = import.meta.env?.['VITE_APP_ENV'] || import.meta.env?.MODE;

  switch (viteEnv) {
    case 'staging':
    case 'production':
    case 'development':
    case 'test':
      environment = viteEnv;
      break;
    default:
      // Default to development for Capacitor apps (since we're usually developing)
      environment = 'development';
  }
} else if (hostname === 'app.staging.tearleads.com') {
  environment = 'staging';
} else if (hostname === 'tearleads.com' || hostname === 'app.tearleads.com') {
  environment = 'production';
} else if (hostname === 'localhost' && port === '8080') {
  environment = 'development';
} else if (hostname === 'localhost' && port === '8081') {
  environment = 'test';
} else if (
  // vitest
  hostname === 'localhost' &&
  port === '3000'
) {
  environment = 'test';
} else if (
  // Electron dev server (electron-vite)
  hostname === 'localhost' &&
  port === '5173'
) {
  environment = 'development';
} else {
  throw `Unknown Tearleads environment for hostname ${hostname} and port ${port}`;
}

export {environment};
