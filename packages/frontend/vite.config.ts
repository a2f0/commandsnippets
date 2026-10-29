import {readdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join, relative, resolve, sep} from 'node:path';
import react from '@vitejs/plugin-react';
import type {Plugin, PluginOption} from 'vite';
import {analyzer} from 'vite-bundle-analyzer';
import {createHtmlPlugin} from 'vite-plugin-html';
import {VitePWA} from 'vite-plugin-pwa';
import {defineConfig} from 'vitest/config';
import packageJson from './package.json' with {type: 'json'};

// Search engines may index production only, and there only the root (the
// sign-in page): every other build says noindex in index.html and, through
// _headers, on every response; production says it on every other page
// (robotsHeaders). src/components/RobotsNoindex.tsx says it on users' pages.
const NOINDEX = 'noindex, nofollow';

/** The directories the dev server serves files from (`server.fs.allow`). */
const DEV_SERVER_ALLOW = [
  '.',
  '../api-shared',
  '../../node_modules',
  '../../assets/brand',
];

/**
 * Files it never serves, wherever a path reaches them (`server.fs.deny`):
 * Vite's defaults and the workspace's secrets. Vite checks the requested
 * path, not where a symlink in an allowed directory leads.
 */
const DEV_SERVER_DENY = [
  '.env',
  '.env.*',
  '*.{crt,pem}',
  '**/.git/**',
  '.dev.vars',
  '.dev.vars.*',
  '.secrets',
  '**/.secrets/**',
];

/**
 * `headers` (a _headers file) with `line` added to the rule for `pattern`,
 * or with a new rule for it: a second rule with the same pattern would
 * replace the first one's headers rather than add to them.
 */
function addToRule(headers: string, pattern: string, line: string): string {
  const lines = headers.split('\n');
  const rule = lines.indexOf(pattern);
  if (rule === -1) {
    return `${headers.trimEnd()}\n\n${pattern}\n  ${line}\n`;
  }
  lines.splice(rule + 1, 0, `  ${line}`);
  return lines.join('\n');
}

/**
 * Writes public/_headers to the build with its X-Robots-Tag rules. Rules of
 * different patterns merge, so a response matching two that set the header
 * would carry it twice; each build sets it in one place:
 *
 * - Outside production, the `/*` rule says noindex on every response.
 * - In production, `/:user` and `/:user/*` say it on every path below the
 *   root. Users' public pages (`/:user`, `/:user/:tag`) stay out of search,
 *   and a pattern cannot tell them from the app's own routes (`/admin`,
 *   `/oauth/...`, routePaths.ts), which have nothing to rank either. Each
 *   file of the build then detaches the header again (`!`), so the icons,
 *   robots.txt and assets answer as before. Files, not directories: a user
 *   named `assets` has pages under `/assets/`. A detach removes only what
 *   the rules before it attached, so the page rules come first.
 *
 * It runs once the build is written, after vite-plugin-pwa's service worker.
 */
const robotsHeaders = (indexable: boolean): Plugin => {
  let outDir = '';
  return {
    name: 'commandsnippets:robots-headers',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle: {
      order: 'post',
      sequential: true,
      handler(error) {
        if (error) {
          return;
        }
        const header = `X-Robots-Tag: ${NOINDEX}`;
        let headers = readFileSync(
          join(import.meta.dirname, 'public/_headers'),
          'utf8'
        );
        if (indexable) {
          headers = `# Every page below the root says noindex (vite.config.ts).\n/:user\n  ${header}\n\n/:user/*\n  ${header}\n\n${headers}`;
          const files = readdirSync(outDir, {
            recursive: true,
            withFileTypes: true,
          }).filter(entry => entry.isFile() && entry.name !== '_headers');
          for (const file of files) {
            const path = relative(outDir, join(file.parentPath, file.name));
            headers = addToRule(
              headers,
              `/${path.split(sep).join('/')}`,
              '! X-Robots-Tag'
            );
          }
        } else {
          headers = addToRule(headers, '/*', header);
        }
        // Cloudflare's limit; a code-split build could reach it one day.
        const rules = headers.split('\n').filter(line => line.startsWith('/'));
        if (rules.length > 100) {
          throw new Error(`_headers has ${rules.length} rules, over 100`);
        }
        writeFileSync(join(outDir, '_headers'), headers);
      },
    },
  };
};

// biome-ignore lint/style/noDefaultExport: Vite requires default export for config
export default defineConfig(({command, mode}) => {
  const indexable = mode === 'production';
  const basePlugins = [
    react(),
    createHtmlPlugin({
      inject: {
        data: {
          VITE_APP_VERSION: packageJson.version,
        },
        tags: indexable
          ? []
          : [
              {
                tag: 'meta',
                attrs: {name: 'robots', content: NOINDEX},
                injectTo: 'head',
              },
            ],
      },
    }),
    VitePWA({
      devOptions: {
        enabled: false,
      },
      registerType: 'autoUpdate',
      // The icons are rendered into public/ from ../../assets/brand by
      // `bun run images`, which the dev, test and build scripts run first.
      includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Command Snippets',
        short_name: 'Command Snippets',
        description:
          'An opinionated note-taking system for technical professionals.',
        theme_color: '#ffffff',
        icons: [
          {src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png'},
          {src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png'},
          {src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml'},
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,ico,png,svg,webmanifest}'],
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        navigateFallback: null,
        // These cache names predate the rename to Command Snippets. Keep them:
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

  const plugins: PluginOption[] = [...basePlugins, robotsHeaders(indexable)];

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
    resolve: {
      dedupe: ['zod'],
      // Builds for the environments with a HUD (staging) render with React's
      // profiling build, whose Profilers time each commit for the HUD
      // (`lib/metrics/`); production's do nothing. (Development and tests
      // run React's development build, which profiles anyway.)
      alias:
        command === 'build' && mode !== 'production'
          ? [{find: /^react-dom\/client$/, replacement: 'react-dom/profiling'}]
          : [],
    },
    build: {
      outDir: 'build',
      target: 'esnext',
      sourcemap: mode === 'analyze',
      // Keep automatic chunking: forcing dependencies into a vendor chunk
      // created a cycle with the shared timings chunk, which held runtime
      // helpers the vendor code called before they were initialized.
    },
    server: {
      port: 8085,
      host: true, // Listen on all network interfaces
      hmr: true,
      // What the dev server may serve outside this package (relative to it):
      // the API contract it links, the workspace's package store, and the
      // repository's brand sources (the logo and shared selection styles).
      // Never the whole workspace, which holds other packages' secrets
      // (backend-v2's .dev.vars) and the .secrets link.
      fs: {
        allow: DEV_SERVER_ALLOW,
        deny: DEV_SERVER_DENY,
      },
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
