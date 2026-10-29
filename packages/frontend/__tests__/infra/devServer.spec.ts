// @vitest-environment node
import {fileURLToPath} from 'node:url';
import {type ViteDevServer, createServer} from 'vite';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';

// The dev server listens on every interface (`host: true`), so it may serve
// files only from this package, the API contract it links, the workspace's
// package store and the brand sources: never the rest of the workspace,
// which holds other packages' secrets (backend-v2's .dev.vars).
const root = fileURLToPath(new URL('../..', import.meta.url));
const repo = fileURLToPath(new URL('../../../..', import.meta.url));

describe('the dev server', () => {
  let server: ViteDevServer | undefined;
  let origin = '';

  beforeAll(async () => {
    server = await createServer({
      root,
      configFile: `${root}vite.config.ts`,
      logLevel: 'silent',
      server: {host: '127.0.0.1', port: 0, strictPort: false, hmr: false},
    });
    await server.listen();
    const address = server.httpServer?.address();
    origin = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
  }, 60_000);

  afterAll(async () => {
    await server?.close();
  });

  const status = async (file: string) =>
    (await fetch(`${origin}/@fs${repo}${file}`)).status;

  it.each([
    'package.json',
    'packages/backend-v2/package.json',
    'packages/backend-v2/wrangler.jsonc',
    'packages/website/package.json',
  ])('refuses %s, outside its allow list', async file => {
    expect(await status(file)).toBe(403);
  });

  it.each(['assets/brand/logo.svg', 'packages/api-shared/src/datetime.ts'])(
    'serves %s',
    async file => {
      expect(await status(file)).toBe(200);
    }
  );
});
