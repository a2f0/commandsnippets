import {defineConfig} from 'vitest/config';

export default defineConfig({
  build: {
    outDir: 'build',
    target: 'esnext',
  },
  server: {
    port: 8080,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['fake-indexeddb/auto', '__tests__/setup.ts'],
    include: ['__tests__/**/*.{test,spec}.{ts,tsx}'],
  },
});
