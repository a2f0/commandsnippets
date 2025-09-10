import type {CapacitorConfig} from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tearleads.app.staging',
  appName: 'Tearleads Staging',
  webDir: 'build',
  // No server property for staging - will use bundled assets
};

// biome-ignore lint/style/noDefaultExport: Allow default export for Capacitor config
export default config;
