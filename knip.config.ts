import type {KnipConfig} from 'knip';

// Unused files, exports and dependencies across the root tooling and every
// workspace. Knip's plugins find most entries from the tools' own configs
// (Vite, Vitest, WebdriverIO, Wrangler, Astro, Bun); the entries below are
// the ones no config names.
const config: KnipConfig = {
  treatConfigHintsAsErrors: true,
  // A type an exported signature uses stays exported, so it can be named.
  ignoreExportsUsedInFile: {interface: true, type: true},
  ignoreIssues: {
    // Exports the page-object class its one instance is built from; the
    // frontend test refactor owns the file.
    'packages/frontend/test/pageobjects/base.ts': ['exports'],
  },
  workspaces: {
    '.': {
      entry: ['scripts/**/*.ts', 'terraform/scripts/**/*.ts'],
      project: ['*.{ts,mts}', 'scripts/**/*.ts', 'terraform/scripts/**/*.ts'],
      // The commit-msg hook runs commitlint, and its config names the preset
      // by string.
      ignoreDependencies: ['@commitlint/cli'],
      ignoreBinaries: ['shellcheck'],
    },
    'packages/frontend': {
      entry: [
        '__tests__/**/*.spec.{ts,tsx}',
        'test/wdio.*.conf.ts',
        'test/specs/**/*.ts',
      ],
      project: ['src/**/*.{ts,tsx}', '__tests__/**/*.{ts,tsx}', 'test/**/*.ts'],
      // WebdriverIO loads its runner, framework, reporters and their types
      // from names in the config, and the video reporter finds ffmpeg itself.
      ignoreDependencies: [
        '@ffmpeg-installer/ffmpeg',
        '@types/mocha',
        '@wdio/dot-reporter',
        '@wdio/local-runner',
        '@wdio/reporter',
        '@wdio/spec-reporter',
      ],
    },
    'packages/backend-v2': {
      entry: ['scripts/**/*.test.ts', 'test/**/*.test.ts'],
      project: ['src/**/*.ts', 'scripts/**/*.ts', 'test/**/*.ts'],
    },
    'packages/api-shared': {
      entry: ['test/**/*.test.ts'],
      project: ['src/**/*.ts', 'test/**/*.ts'],
    },
    'packages/website': {
      entry: ['src/pages/**/*.astro', 'test/**/*.test.ts'],
      project: ['src/**/*.{astro,ts}', 'worker/**/*.ts', 'test/**/*.ts'],
    },
  },
};

export default config;
