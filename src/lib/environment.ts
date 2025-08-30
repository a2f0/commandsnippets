import {Capacitor} from '@capacitor/core';

let environment: string;

const {hostname, port} = window.location;

if (Capacitor.isNativePlatform()) {
  // For Capacitor apps, determine environment based on build mode
  const viteMode = import.meta.env?.MODE;
  const viteAppEnv = import.meta.env?.['VITE_APP_ENV'];

  // Check Vite environment variables first
  if (viteMode === 'staging' || viteAppEnv === 'staging') {
    environment = 'staging';
  } else if (viteMode === 'production' || viteAppEnv === 'production') {
    environment = 'production';
  } else if (viteMode === 'development' || viteMode === 'test') {
    environment = viteMode;
  } else {
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
} else {
  throw `Unknown Tearleads environment for hostname ${hostname} and port ${port}`;
}

export {environment};
