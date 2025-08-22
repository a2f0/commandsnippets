import react from '@vitejs/plugin-react';
import invariant from 'invariant';
import type {PluginOption} from 'vite';
import {analyzer} from 'vite-bundle-analyzer';
import {createHtmlPlugin} from 'vite-plugin-html';
import {VitePWA} from 'vite-plugin-pwa';
import {defineConfig} from 'vitest/config';
import packageJson from './package.json';

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
    build: {
      outDir: 'build',
      target: 'esnext',
      sourcemap: mode === 'analyze',
      rollupOptions: {
        output: {
          manualChunks: (id: string) => {
            if (id.includes('node_modules')) {
              const match = id.match(/node_modules\/((?:@[^/]+\/[^/]+)|(?:[^/]+))/);
              if (match) {
                const packageName = match[1];
                if (['react', 'react-dom', 'react-router-dom'].includes(packageName)) {
                  return 'react-vendor';
                }
                if (packageName.startsWith('@mui/') || packageName.startsWith('@emotion/')) {
                  return 'mui-vendor';
                }
                if (['mobx', 'mobx-react', 'mobx-state-tree'].includes(packageName)) {
                  return 'mobx-vendor';
                }
              }
              return 'vendor';
            }
            return undefined;
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
    plugins,
  };
});
