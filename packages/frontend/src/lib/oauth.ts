import {environment} from './environment';

export const getOAuthRedirectUrl = (provider: 'github' | 'google'): string => {
  switch (environment) {
    case 'staging':
      return `https://app.staging.commandsnippets.com/oauth/${provider}`;
    case 'production':
      return `https://commandsnippets.com/oauth/${provider}`;
    default:
      return `http://localhost:8085/oauth/${provider}`;
  }
};
