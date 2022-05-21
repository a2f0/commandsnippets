import type {Config} from '@jest/types';

const config: Config.InitialOptions = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  testMatch: ['**/*.spec.tsx'],
  testEnvironmentOptions: {
    url: 'http://localhost:8081/',
  },
  setupFiles: ['./__tests__/setupGlobals.ts'],
  globals: {
    'ts-jest': {
      tsconfig: '__tests__/tsconfig.json',
    },
  },
};

export default config;
