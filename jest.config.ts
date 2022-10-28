import type {JestConfigWithTsJest} from 'ts-jest';

const config: JestConfigWithTsJest = {
  preset: 'ts-jest/presets/js-with-ts',
  testEnvironment: 'jsdom',
  testMatch: ['**/*.spec.tsx'],
  testEnvironmentOptions: {
    url: 'http://localhost:8081/',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-dnd/dist|react-dnd-html5-backend/dist|dnd-core/dist|@react-dnd/invariant/dist|@react-dnd/asap/dist|@react-dnd/shallowequal/dist)/)',
  ],
  transform: {
    '^.+\\.[tj]sx?$': [
      'ts-jest',
      {
        tsconfig: './__tests__/tsconfig.json',
      },
    ],
  },
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname',
  ],
};

export default config;
