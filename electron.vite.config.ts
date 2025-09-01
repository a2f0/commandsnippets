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
      },
    },
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    build: {
      rollupOptions: {
        input: 'index.html',
      },
    },
    plugins: [react()],
  },
});
