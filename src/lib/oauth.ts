import {environment} from './environment';
import {isCapacitor, isElectron} from './platform';

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

  // For Electron apps, use custom protocol
  if (isElectron()) {
    return `tearleads://oauth/${provider}`;
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
