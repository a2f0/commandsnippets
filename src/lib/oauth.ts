import {environment} from './environment';
import {isCapacitor, isElectron} from './platform';

/**
 * Get the Electron protocol scheme based on environment
 */
export const getElectronProtocolScheme = (): string => {
  switch (environment) {
    case 'staging':
      return 'tearleads-staging';
    case 'production':
      return 'tearleads';
    default:
      return 'tearleads-dev';
  }
};

export const getOAuthRedirectUrl = (provider: 'github' | 'google'): string => {
  // For Capacitor apps, use deep link scheme based on environment
  if (isCapacitor()) {
    switch (environment) {
      case 'staging':
        return `com.tearleads.app.staging://oauth/${provider}`;
      case 'production':
        return `com.tearleads.app://oauth/${provider}`;
      default:
        return `com.tearleads.app.dev://oauth/${provider}`;
    }
  }

  // For Electron apps, use custom protocol based on environment
  if (isElectron()) {
    return `${getElectronProtocolScheme()}://oauth/${provider}`;
  }

  // For web apps, use standard URLs
  switch (environment) {
    case 'staging':
      return `https://app.staging.tearleads.com/oauth/${provider}`;
    case 'production':
      return `https://tearleads.com/oauth/${provider}`;
    default:
      return `http://localhost:8085/oauth/${provider}`;
  }
};
