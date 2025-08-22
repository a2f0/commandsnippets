import react from '@vitejs/plugin-react';
import {visualizer} from 'rollup-plugin-visualizer';
import type {PluginOption} from 'vite';
import {createHtmlPlugin} from 'vite-plugin-html';
import {VitePWA} from 'vite-plugin-pwa';
import {defineConfig} from 'vitest/config';
import packageJson from './package.json';

// biome-ignore lint/style/noDefaultExport: Vite requires default export for config
export default defineConfig(({mode}) => ({
  build: {
    outDir: 'build',
    target: 'esnext',
    sourcemap: mode === 'analyze',
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'mui-vendor': [
            '@mui/material',
            '@mui/icons-material',
            '@emotion/react',
            '@emotion/styled',
          ],
          'mobx-vendor': ['mobx', 'mobx-react', 'mobx-state-tree'],
        },
      },
    },
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
  plugins: [
    react(),
    createHtmlPlugin({
      inject: {
        data: {
          VITE_APP_VERSION: packageJson.version,
        },
      },
    }),
    VitePWA({
      devOptions: {
        enabled: false,
      },
      registerType: 'autoUpdate',
      includeAssets: ['pwa-icon-144x144.svg'],
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
        globPatterns: ['**/*.{js,css,ico,png,svg}'],
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            urlPattern: ({url}) =>
              url.origin === self.location.origin &&
              /\.(js|css|ico|png|svg)$/.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'tearleads-static-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days instead of 30
              },
            },
          },
          {
            urlPattern: ({request}) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'tearleads-html-cache',
              networkTimeoutSeconds: 3, // Wait max 3 seconds for network
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 0, // Expire immediately, but still available as fallback
              },
            },
          },
        ],
      },
    }),
    mode === 'analyze' &&
      (visualizer({
        filename: './build/stats.html',
        open: true,
        gzipSize: true,
        brotliSize: true,
        template: 'treemap', // or 'sunburst', 'network', 'raw-data', 'list'
      }) as unknown as PluginOption),
  ].filter(Boolean) as PluginOption[],
}));
