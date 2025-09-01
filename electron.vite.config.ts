import react from '@vitejs/plugin-react';
import {defineConfig, externalizeDepsPlugin} from 'electron-vite';

// biome-ignore lint/style/noDefaultExport: electron-vite requires default export
export default defineConfig({
  main: {
    build: {
      lib: {
        entry: 'electron/main.ts',
      },
    },
    plugins: [externalizeDepsPlugin()],
  },
  preload: {
    build: {
      lib: {
        entry: 'electron/preload.ts',
        formats: ['cjs'],
      },
      rollupOptions: {
        output: {
          entryFileNames: '[name].js',
        },
      },
    },
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    root: '.',
    build: {
      outDir: 'out/renderer',
      rollupOptions: {
        input: './index.html',
      },
    },
    plugins: [react()],
  },
});
