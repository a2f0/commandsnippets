import type {CapacitorConfig} from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tearleads.app',
  appName: 'Tearleads Frontend',
  webDir: 'build',
  server: {
    url: 'http://10.0.1.10:8080',
    cleartext: true,
  },
};

// biome-ignore lint/style/noDefaultExport: Allow default export for Capacitor config
export default config;
