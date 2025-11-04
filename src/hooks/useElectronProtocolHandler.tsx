import {useEffect} from 'react';

import {handleOAuthCallback} from '../lib/oauthUrlUtils';
import {isElectron} from '../lib/platform';

export const useElectronProtocolHandler = () => {
  useEffect(() => {
    console.log('useElectronProtocolHandler: Initializing');
    console.log('isElectron():', isElectron());
    console.log('window.api:', window.api);
    console.log('window.api?.onProtocolUrl:', window.api?.onProtocolUrl);

    // Only add protocol handler for Electron
    if (!isElectron() || !window.api?.onProtocolUrl) {
      console.warn('Protocol handler not registered - missing Electron API');
      return;
    }

    console.log('Registering protocol URL handler...');

    const handleProtocolUrl = (url: string) => {
      console.log('Protocol URL received in renderer:', url);
      handleOAuthCallback(url);
    };

    // Register the protocol URL handler and get cleanup function
    const cleanup = window.api.onProtocolUrl(handleProtocolUrl);

    console.log('Protocol URL handler registered successfully');

    return cleanup;
  }, []);
};
