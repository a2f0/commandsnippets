let environment: string;

if (window.location.hostname === 'staging.tearleads.com') {
  environment = 'staging';
} else if (window.location.hostname === 'tearleads.com') {
  environment = 'production';
} else if (
  window.location.hostname === 'localhost' &&
  window.location.port === '8080'
) {
  environment = 'development';
} else if (
  window.location.hostname === 'localhost' &&
  window.location.port === '8081'
) {
  environment = 'test';
} else {
  throw 'Unknown Tearleads environment';
}

export {environment};
