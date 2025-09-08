import type {CapacitorConfig} from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tearleads.app.dev',
  appName: 'Tearleads Dev',
  webDir: 'build',
  server: {
    url: 'http://10.0.1.10:8085',
    cleartext: true,
  },
};

// biome-ignore lint/style/noDefaultExport: Allow default export for Capacitor config
export default config;
