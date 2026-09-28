import react from '@vitejs/plugin-react';
import type {PluginOption} from 'vite';
import {analyzer} from 'vite-bundle-analyzer';
import {createHtmlPlugin} from 'vite-plugin-html';
import {VitePWA} from 'vite-plugin-pwa';
import {defineConfig} from 'vitest/config';
import packageJson from './package.json' with {type: 'json'};

// biome-ignore lint/style/noDefaultExport: Vite requires default export for config
export default defineConfig(({mode}) => {
  const basePlugins = [
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
        name: 'Commandsnippets',
        short_name: 'Commandsnippets',
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
        globPatterns: ['**/*.{js,css,ico,png,svg,webmanifest}'],
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        navigateFallback: null,
        // These cache names predate the rename to Commandsnippets. Keep them:
        // new names would leave the caches browsers already hold behind.
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
  ];

  const plugins: PluginOption[] = [...basePlugins];

  if (mode === 'analyze') {
    plugins.push(
      analyzer({
        analyzerMode: 'static',
        fileName: './stats.html',
      })
    );
  }

  return {
    // api-shared (the API contract) is installed from ../api-shared, and Vite
    // resolves its imports from where its files are: bundle (and test with)
    // this package's zod, the only copy.
    resolve: {dedupe: ['zod']},
    build: {
      outDir: 'build',
      target: 'esnext',
      sourcemap: mode === 'analyze',
      rolldownOptions: {
        output: {
          // Vite 8 deprecates `manualChunks` for Rolldown's `codeSplitting`.
          // Dependencies share one `vendor` chunk and app code is split
          // automatically, the same output the old `manualChunks` produced:
          // its react/mui/mobx groups never matched an isolated install's real
          // paths (`node_modules/.pnpm/...`, now `.bun/...`), so everything
          // fell through to vendor.
          codeSplitting: {
            groups: [{name: 'vendor', test: /[\\/]node_modules[\\/]/}],
          },
        },
      },
    },
    server: {
      port: 8085,
      host: true, // Listen on all network interfaces
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
