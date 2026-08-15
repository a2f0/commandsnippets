import {GoogleAuth} from './GoogleAuth';
import {GoogleAuthIntegrated} from './GoogleAuthIntegrated';
import {isCapacitor} from './lib/platform';

const GoogleAuthWrapper = () => {
  if (isCapacitor()) {
    return <GoogleAuthIntegrated />;
  }

  return <GoogleAuth />;
};

export {GoogleAuthWrapper};
