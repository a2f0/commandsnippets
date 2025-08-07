import react from '@vitejs/plugin-react';
import {VitePWA} from 'vite-plugin-pwa';
import {defineConfig} from 'vitest/config';

// biome-ignore lint/style/noDefaultExport: Vite requires default export for config
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
  // Configure MSW to be served properly
  define: {
    // Ensure MSW can access the worker script
    'process.env.NODE_ENV': JSON.stringify(
      process.env['NODE_ENV'] || 'development'
    ),
  },
  // Ensure public directory is served correctly for MSW
  publicDir: 'public',
  // Add module resolution for MSW
  optimizeDeps: {
    include: ['msw', 'msw/browser'],
  },
});
