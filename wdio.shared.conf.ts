export const config: WebdriverIO.Config = {
  runner: 'local',
  path: '/',
  specs: ['./test/**/*.ts'],
  exclude: [],
  maxInstances: 10,
  capabilities: [
    {
      maxInstances: 5,
      browserName: 'chrome',
    },
  ],
  logLevel: 'info',
  bail: 0,
  baseUrl: 'http://localhost:8081',
  waitforTimeout: 10000,
  connectionRetryTimeout: 90000,
  connectionRetryCount: 3,
  services: ['chromedriver'],
  framework: 'mocha',
  reporters: ['dot', 'spec'],
  mochaOpts: {
    ui: 'bdd',
    timeout: 60000,
    requireModule: ['@babel/register'],
  },
};
