import type {CapacitorConfig} from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tearleads.app.staging',
  appName: 'Tearleads Staging',
  webDir: 'build',
  server: {
    url: 'https://app.staging.tearleads.com',
    cleartext: false,
  },
};

// biome-ignore lint/style/noDefaultExport: Allow default export for Capacitor config
export default config;
