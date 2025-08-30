import type {CapacitorConfig} from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tearleads.app',
  appName: 'Tearleads',
  webDir: 'build',
  // No server property for production - will use bundled assets
};

// biome-ignore lint/style/noDefaultExport: Allow default export for Capacitor config
export default config;
