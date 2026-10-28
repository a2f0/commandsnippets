import type {TextEntryReusedCreateDocument} from '@commandsnippets/api-shared/requests';
import {$, browser, expect} from '@wdio/globals';
import {BasePage} from '../../pageobjects/base';

const rendered = () =>
  browser.execute(() => document.querySelectorAll('#entryReuses > li').length);

const dates = () =>
  browser.execute(() =>
    [...document.querySelectorAll('#entryReuses time')].map(time =>
      time.getAttribute('datetime')
    )
  );

const laterRequests = () =>
  browser.execute(() =>
    (window.__MSW_REQUESTS__?.getAll() ?? [])
      .filter(request => request.method === 'GET')
      .map(request => ({url: new URL(request.url), count: request.count}))
      .filter(request => request.url.pathname.endsWith('/entry_reuses'))
      .map(request => ({
        page: Number(request.url.searchParams.get('page[number]')),
        entryId: request.url.searchParams.get('filter[text_entry.id]'),
        count: request.count,
      }))
      .filter(request => request.page > 1)
  );

/** Enter the prefetch area while the pagination controls are still offscreen. */
const nearBottom = () =>
  browser.execute(() => {
    const footer = document.getElementById('entryReusePagination');
    if (footer === null) throw new Error('History pagination is missing');
    window.scrollTo(
      0,
      footer.getBoundingClientRect().top + window.scrollY - innerHeight - 200
    );
    if (footer.getBoundingClientRect().top <= innerHeight)
      throw new Error('Expected to prefetch before the footer is visible');
    return window.scrollY;
  });

describe('Infinite reuse history', () => {
  beforeEach(async () => {
    await browser.setViewport({width: 1100, height: 700});
    await BasePage.signIn('test?entries=all');
    await $('#tagsEntries-1').waitForDisplayed();
    // Seed the page's mock API, then navigate within the app so it is retained.
    await browser.execute(async () => {
      for (let index = 0; index < 101; index += 1) {
        const body: TextEntryReusedCreateDocument = {
          data: {
            type: 'TextEntryReused',
            attributes: {client_id: `scroll-copy-${index}`},
            relationships: {
              text_entry: {
                data: {type: 'TextEntry', id: index % 2 ? '2' : '1'},
              },
            },
          },
        };
        const response = await fetch(
          'http://localhost:9001/api/v1/entry_reuses',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/vnd.api+json',
              'X-Data-Version': '1',
            },
            body: JSON.stringify(body),
          }
        );
        if (!response.ok)
          throw new Error(`Could not seed reuses: ${response.status}`);
      }
    });
    await $('#view-menu-button').click();
    await $('#view-menu-reuses').click();
    await browser.waitUntil(async () => (await rendered()) === 50);
  });

  for (const scope of ['all', 'entry']) {
    it(`loads ${scope} reuses by scrolling, without moving existing rows or repeating pages`, async () => {
      if (scope === 'entry') {
        await $('#entryReuses a').click();
        await $('#entryPage').waitForDisplayed();
        await browser.waitUntil(async () => (await rendered()) === 50);
      }
      const firstDates = await dates();
      expect(firstDates).toHaveLength(50);
      expect(await laterRequests()).toEqual([]);
      const before = await nearBottom();
      const nextCount = scope === 'all' ? 100 : 51;
      await browser.waitUntil(async () => (await rendered()) === nextCount, {
        timeoutMsg: 'Expected the next page before reaching the bottom',
      });
      expect(
        Math.abs((await browser.execute(() => window.scrollY)) - before)
      ).toBeLessThan(2);
      expect((await dates()).slice(0, 50)).toEqual(firstDates);
      if (scope === 'all') {
        await nearBottom();
        await browser.waitUntil(async () => (await rendered()) === 101);
      }
      const loadedDates = await dates();
      expect(new Set(loadedDates).size).toBe(loadedDates.length);
      await expect($('#entryReusePagination [role="status"]')).toHaveText(
        'End of reuse history.'
      );
      expect(await laterRequests()).toEqual(
        scope === 'all'
          ? [
              {page: 2, entryId: null, count: 1},
              {page: 3, entryId: null, count: 1},
            ]
          : [{page: 2, entryId: '1', count: 1}]
      );
      expect(browser.currentTestErrors).toHaveLength(0);
    });
  }
});
