let environment: string;

const {hostname, port} = window.location;

if (hostname === 'app.staging.commandsnippets.com') {
  environment = 'staging';
} else if (
  hostname === 'commandsnippets.com' ||
  hostname === 'app.commandsnippets.com'
) {
  environment = 'production';
} else if (hostname === 'localhost' && port === '8085') {
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
  throw `Unknown environment for hostname ${hostname} and port ${port}`;
}

export {environment};
