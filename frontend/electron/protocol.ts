/**
 * Get the Electron protocol scheme based on environment.
 * This works in both main process (Node.js) and renderer process contexts.
 */
export const getElectronProtocolScheme = (isDev: boolean): string => {
  // In production build, check VITE_MODE for staging
  // VITE_MODE is set via electron.vite.config.ts define
  if (!isDev) {
    return process.env['VITE_MODE'] === 'staging'
      ? 'tearleads-staging'
      : 'tearleads';
  }

  // Development mode
  return 'tearleads-dev';
};
