import react from '@vitejs/plugin-react';
import {VitePWA} from 'vite-plugin-pwa';
import {defineConfig} from 'vitest/config';

// biome-ignore lint/style/noDefaultExport: Vite requires default export for config
export default defineConfig(({mode}) => {
  const plugins = [
    react(),
    VitePWA({
      devOptions: {
        enabled: false,
      },
      manifest: {
        name: 'Tearleads',
        short_name: 'Tearleads',
        description: 'Note taking for technical professionals.',
        theme_color: '#ffffff',
        icons: [
          {
            src: 'pwa-icon-144x144.svg',
            sizes: '144x144',
            type: 'image/svg+xml',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.(js|css|html|ico|svg)$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'tearleads-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
        ],
      },
    }),
  ];

  // Add visualizer plugin only in analyze mode
  if (mode === 'analyze') {
    const {visualizer} = require('rollup-plugin-visualizer');
    plugins.push(
      visualizer({
        filename: 'bundle-analysis.html',
        open: true,
        gzipSize: true,
        brotliSize: true,
      })
    );
  }

  return {
    build: {
      outDir: 'build',
      target: 'esnext',
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            mui: [
              '@mui/material',
              '@mui/icons-material',
              '@emotion/react',
              '@emotion/styled',
            ],
            mobx: ['mobx', 'mobx-react', 'mobx-state-tree'],
            router: ['react-router-dom'],
            dnd: ['react-dnd', 'react-dnd-html5-backend'],
            utils: ['axios', 'dexie', 'immutability-helper'],
          },
        },
      },
      chunkSizeWarningLimit: 1000,
    },
    server: {
      port: 8080,
      hmr: true,
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['fake-indexeddb/auto', '__tests__/setup.ts'],
      include: ['__tests__/**/*.{test,spec}.{ts,tsx}'],
    },
    plugins,
  };
});
