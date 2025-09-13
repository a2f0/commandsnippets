import {App} from '@capacitor/app';
import {useEffect} from 'react';

import {handleOAuthCallback} from '../lib/oauthUrlUtils';
import {isCapacitor} from '../lib/platform';

export const useDeepLinkHandler = () => {
  useEffect(() => {
    // Only add deep link listener for native platforms
    if (!isCapacitor()) {
      return;
    }

    const handleAppUrlOpen = (event: {url: string}) => {
      handleOAuthCallback(event.url);
    };

    // Listen for app URL opens (deep links)
    const listenerPromise = App.addListener('appUrlOpen', handleAppUrlOpen);

    return () => {
      listenerPromise.then(handle => handle.remove());
    };
  }, []);
};
