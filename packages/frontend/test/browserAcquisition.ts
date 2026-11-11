import assert from 'node:assert/strict';
import {channel} from 'node:diagnostics_channel';
import {mkdtemp, readdir, rm} from 'node:fs/promises';
import {ClientRequest} from 'node:http';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {test} from 'node:test';
import {remote} from 'webdriverio';

test('downloads Chrome and Chromedriver, then reuses both', {
  timeout: 180000,
}, async () => {
  const cacheDir = await mkdtemp(
    join(tmpdir(), 'commandsnippets-browser-acquisition-')
  );
  let archiveDownloads = 0;
  // The pinned downloader uses node:http(s) for Chrome's ZIP archives. A move
  // to fetch/undici or another format must update this measurement, not its gate.
  const requests = channel('http.client.request.start');
  const onRequest = (message: unknown) => {
    if (
      typeof message === 'object' &&
      message !== null &&
      'request' in message &&
      message.request instanceof ClientRequest &&
      message.request.method === 'GET' &&
      message.request.path.endsWith('.zip')
    ) {
      archiveDownloads += 1;
    }
  };
  requests.subscribe(onRequest);
  try {
    // An explicit version prevents WDIO from substituting system Chrome.
    // Resolve the channel once, then reuse that exact build for the warm run.
    let browserVersion = process.env['BROWSER_ACQUISITION_VERSION'] ?? 'stable';
    for (const phase of ['cold', 'warm']) {
      const before = archiveDownloads;
      const browser = await remote({
        cacheDir,
        logLevel: 'info',
        capabilities: {
          browserName: 'chrome',
          browserVersion,
          'goog:chromeOptions': {
            args: ['--headless', '--no-sandbox', '--disable-dev-shm-usage'],
          },
        },
      });
      try {
        await browser.url('data:text/html,<title>browser acquisition</title>');
        assert.equal(await browser.getTitle(), 'browser acquisition');
        const actualVersion = browser.capabilities.browserVersion;
        assert.ok(actualVersion);
        if (phase === 'warm') {
          assert.equal(actualVersion, browserVersion);
          assert.equal(archiveDownloads - before, 0);
        } else {
          assert.ok(archiveDownloads - before >= 2);
        }
        browserVersion = actualVersion;
        const cached = await readdir(cacheDir);
        assert.ok(cached.includes('chrome'));
        assert.ok(cached.includes('chromedriver'));
        console.info(
          JSON.stringify({
            phase,
            browserVersion,
            archiveDownloads: archiveDownloads - before,
          })
        );
      } finally {
        await browser.deleteSession();
      }
    }
  } finally {
    requests.unsubscribe(onRequest);
    await rm(cacheDir, {recursive: true, force: true});
  }
});
