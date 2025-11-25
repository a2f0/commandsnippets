import {useEffect} from 'react';

import {handleOAuthCallback} from '../lib/oauthUrlUtils';
import {isElectron} from '../lib/platform';

export const useElectronProtocolHandler = () => {
  useEffect(() => {
    // Only add protocol handler for Electron
    if (!isElectron() || !window.api?.onProtocolUrl) {
      return;
    }

    const handleProtocolUrl = (url: string) => {
      handleOAuthCallback(url);
    };

    // Register the protocol URL handler and get cleanup function
    const cleanup = window.api.onProtocolUrl(handleProtocolUrl);

    return cleanup;
  }, []);
};
