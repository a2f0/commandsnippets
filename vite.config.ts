import react from '@vitejs/plugin-react';
import {VitePWA} from 'vite-plugin-pwa';
import {defineConfig} from 'vitest/config';

export default defineConfig({
  build: {
    outDir: 'build',
    target: 'esnext',
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
  ],
});
