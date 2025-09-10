import os from 'node:os';
import type {CapacitorConfig} from '@capacitor/cli';

function getLocalIp() {
  const interfaces = os.networkInterfaces();

  // First pass: look for preferred interfaces with valid IPs (not link-local)
  for (const name of Object.keys(interfaces)) {
    const ifaces = interfaces[name];
    if (!ifaces) continue;

    for (const iface of ifaces) {
      if (
        iface.family === 'IPv4' &&
        !iface.internal &&
        !iface.address.startsWith('169.254.')
      ) {
        // Prioritize en1, en0 (common for macOS WiFi) or eth0/wlan0 (common for Linux)
        if (
          name === 'en1' ||
          name === 'en0' ||
          name.startsWith('eth') ||
          name.startsWith('wlan')
        ) {
          return iface.address;
        }
      }
    }
  }

  // Second pass: any non-internal, non-link-local IPv4
  for (const name of Object.keys(interfaces)) {
    const ifaces = interfaces[name];
    if (!ifaces) continue;

    for (const iface of ifaces) {
      if (
        iface.family === 'IPv4' &&
        !iface.internal &&
        !iface.address.startsWith('169.254.')
      ) {
        return iface.address;
      }
    }
  }

  return 'localhost';
}

const localIp = getLocalIp();

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
