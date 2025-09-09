import type {CapacitorConfig} from '@capacitor/cli';
import ip from 'ip';

const localIp = ip.address();

const config: CapacitorConfig = {
  appId: 'com.tearleads.app.dev',
  appName: 'Tearleads Dev',
  webDir: 'build',
  server: {
    url: `http://${localIp}:8085`,
    cleartext: true,
  },
};

// biome-ignore lint/style/noDefaultExport: Allow default export for Capacitor config
export default config;
