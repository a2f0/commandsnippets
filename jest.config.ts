import type {JestConfigWithTsJest} from 'ts-jest';

const config: JestConfigWithTsJest = {
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  testEnvironment: 'jsdom',
  testMatch: ['**/*.spec.tsx'],
  testEnvironmentOptions: {
    url: 'http://localhost:8081/',
  },
  transform: {
    '^.+\\.[tj]sx?$': [
      'ts-jest',
      {
        tsconfig: './__tests__/tsconfig.json',
        useESM: true,
      },
    ],
  },
};

export default config;
