let environment: string;

const {hostname, port} = window.location;

if (hostname === 'app.staging.tearleads.com') {
  environment = 'staging';
} else if (hostname === 'tearleads.com' || hostname === 'app.tearleads.com') {
  environment = 'production';
} else if (hostname === 'localhost' && port === '8080') {
  environment = 'development';
} else if (hostname === 'localhost' && port === '8081') {
  environment = 'test';
} else if (
  // vitest
  hostname === 'localhost' &&
  port === '3000'
) {
  environment = 'test';
} else {
  throw `Unknown Tearleads environment for hostname ${hostname} and port ${port}`;
}

export {environment};
